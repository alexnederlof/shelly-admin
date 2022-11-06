import axios, { AxiosInstance } from "axios";
import { config } from "dotenv";
import express from "express";
import basicAuth from "express-basic-auth";
import fs from "fs-extra";
import os from "os";
import { collectDefaultMetrics, Gauge, Registry } from "prom-client";
import ReactDOMServer from "react-dom/server";
import shellies from "shellies";
import { ListView } from "./layout/ListView";
export interface FoundShelly {
  id: string;
  host: string;
  status: ShellyStatus;
  settings: ShellySettings;
  lastUpdate: Date;
}

const found = new Map<string, FoundShelly>();

const CACHE_LOCATION = process.env["SHELLY_CACHE_FILE"] || "/data/devices.json";

async function main() {
  config();

  const username = process.env["SHELLY_USERNAME"] || "";
  const password = process.env["SHELLY_PASSWORD"] || "";
  const client = axios.create({
    auth: { username, password },
  });

  console.log("Creating prometheus registry");
  const register = new Registry();
  collectDefaultMetrics({ register });
  const app = express();
  const auth = basicAuth({
    users: { [username]: password },
    challenge: true,
    realm: "shellies.nlove",
  });

  app.get("/", auth, async (req, res) => {
    if (req.query["add"]) {
      const ip = req.query["add"] as string;
      await loadDevice(client, ip);
    }
    if (req.query["update"]) {
      await updateDevices(client);
      return res.redirect("/");
    }
    res.send(
      ReactDOMServer.renderToString(
        ListView({
          devices: [...found.values()],
          username,
          password,
          sort: req.query["sort"] as string | undefined,
        })
      )
    );
  });

  app.get("/metrics", async (req, res) => {
    const metrics = await register.metrics();
    res.contentType("text/plain").send(metrics);
  });

  app.get("/health", (req, res) => {
    if (shellies.running) {
      return res.send("OK");
    } else {
      console.error("Shellies not running but ", shellies.running);
      return res.status(500).send("Not listening");
    }
  });

  let port = Number(process.env["NODE_PORT"] || 3000);
  app.listen(port, () => console.log("Started!"));

  await loadCache();

  console.log("Started finding");
  setupListener(client);
  setupMetrics(register);
  process.on("SIGINT", shellies.stop);
  process.on("SIGTERM", shellies.stop);
  process.on("SIGHUP", shellies.stop);

  setInterval(async () => {
    try {
      updateDevices(client);
    } catch (e) {
      console.error("Error during update", e);
    }
  }, 2 * 3600_000);
  updateDevices(client);
}

async function setupListener(client: AxiosInstance) {
  const iface = getNetworkInterface();
  console.log(`Listen for shellies on ${iface}`);
  await shellies.start(iface);
  shellies.on("discover", async (dev: Shelly) => {
    console.log(`Found ${dev.id} @ ${dev.host}`);
    // dev.on("change", (prop, old, newVal) => {
    //   console.log(`${dev.name} updated ${prop}="${newVal}" from "${old}"`);
    // });
    await loadDevice(client, dev.host);
  });

  shellies.on("stale", (dev: any) => console.log("Device is now stale", dev));
}

async function loadDevice(client: AxiosInstance, host: string) {
  try {
    const { data: status } = await client.get<ShellyStatus>(
      `http://${host}/status`
    );
    const { data: settings } = await client.get<ShellySettings>(
      `http://${host}/settings`
    );
    let toUpdate = found.get(settings.device.hostname);
    if (toUpdate) {
      console.log(`Found ${host} = ${settings.name}`);
      toUpdate.status = status;
      toUpdate.settings = settings;
      toUpdate.lastUpdate = new Date();
    } else {
      console.log(`Adding ${host} = ${settings.name}`);
      found.set(settings.device.hostname, {
        id: settings.device.mac,
        host,
        settings,
        status,
        lastUpdate: new Date(),
      });
    }
    await writeCache();
  } catch (e: any) {
    if (e.response) {
      console.error("Cannot get status", e?.response);
    } else {
      console.error("Cannot get status", e);
    }
  }
}

function getNetworkInterface() {
  const iface = process.env["SHELLY_IFACE"];
  if (!iface) {
    return null;
  }

  const ifaces = os.networkInterfaces();

  // if an interface name has been specified, return its address
  if (ifaces[iface] && ifaces[iface]?.length) {
    // return the first address
    return ifaces[iface]![0].address;
  }

  // otherwise, go through each interface and see if there is one with the
  // specified address
  for (const i in ifaces) {
    for (const ii of ifaces[i]!) {
      if (ii.address === iface) {
        // address found, so it's valid
        return ii.address;
      }
    }
  }

  // the configured value doesn't match any interface name or address, so
  // ignore it
  console.warn(`Ignoring unknown network interface name or address ${iface}`);
  return null;
}

function setupMetrics(register: Registry) {
  let devices = new Gauge({
    name: "shellies_found_devices",
    help: "How many devices did we find",
    collect: () => {
      devices.set(found.size);
    },
  });
  let update: Gauge<string> = new Gauge({
    name: "shellies_has_updates",
    help: "Does the devices have an update",
    labelNames: ["name"],
    collect: () =>
      found.forEach((f) =>
        update.set(
          { name: f.settings.name },
          f.status.update.has_update ? 1 : 0
        )
      ),
  });
  register.registerMetric(devices);
  register.registerMetric(update);
}

main().catch((e) => {
  if (e.isAxiosError && e.response) {
    console.error(e.response);
  } else {
    console.error(e);
  }
  process.exit(1);
});

async function loadCache() {
  try {
    if (!(await fs.pathExists(CACHE_LOCATION))) {
      console.log("No cache file found");
      return;
    }
    console.log("Loading from " + CACHE_LOCATION);
    const entries: FoundShelly[] = await fs.readJson(CACHE_LOCATION);
    entries.forEach((e) =>
      found.set(e.settings.device.hostname, {
        ...e,
        lastUpdate: new Date(e.lastUpdate),
      })
    );
  } catch (e) {
    console.error("Could not read the cache ", e);
  }
}

async function writeCache() {
  try {
    await fs.writeJson(CACHE_LOCATION, [...found.values()], { spaces: 2 });
  } catch (e) {
    console.error("Could not write the cache", e);
  }
}

async function updateDevices(axios: AxiosInstance) {
  for await (const shelly of found.values()) {
    if (new Date().getTime() - shelly.lastUpdate.getTime() > 60_000) {
      console.log(
        `Updating ${shelly.settings.name || shelly.id} @ ${shelly.host}`
      );
      await loadDevice(axios, shelly.host);
    }
  }
}
