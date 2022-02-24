import axios from "axios";
import { config } from "dotenv";
import express from "express";
import basicAuth from "express-basic-auth";
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
}

const found = new Map<string, FoundShelly>();
async function main() {
  config();
  const username = process.env["SHELLY_USERNAME"] || "";
  const password = process.env["SHELLY_PASSWORD"] || "";

  console.log("Creating prometheus registry");
  const register = new Registry();
  collectDefaultMetrics({ register });

  const app = express();
  const auth = basicAuth({
    users: { [username]: password },
    challenge: true,
    realm: "shellies.nlove",
  });

  app.get("/", auth, (req, res) => {
    res.send(
      ReactDOMServer.renderToString(
        ListView({ devices: [...found.values()], username, password })
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
      return res.status(500).send("Not listening");
    }
  });

  app.listen(3000, () => console.log("Started!"));

  console.log("Started finding");

  setupListener(username, password);
  setupMetrics(register);
}

async function setupListener(username: string, password: string) {
  const client = axios.create({
    auth: { username, password },
  });
  const iface = getNetworkInterface();
  console.log(`Listen for shellies on ${iface}`);
  await shellies.start(iface);
  shellies.on("discover", async (dev: Shelly) => {
    console.log(`Found ${dev.id} @ ${dev.host}`);
    try {
      const { data: status } = await client.get<ShellyStatus>(
        `http://${dev.host}/status`
      );
      const { data: settings } = await client.get<ShellySettings>(
        `http://${dev.host}/settings`
      );
      let toUpdate = found.get(dev.id);
      if (toUpdate) {
        console.log(`Found ${dev.id} @ ${dev.host} = ${settings.name}`);
        toUpdate.status = status;
        toUpdate.settings = settings;
      } else {
        console.log(`Adding ${dev.id} @ ${dev.host} = ${settings.name}`);
        found.set(dev.id, {
          id: dev.id,
          host: dev.host,
          settings,
          status,
        });
      }
    } catch (e: any) {
      if (e.response) {
        console.error("Cannot get status", e?.response);
      } else {
        console.error("Cannot get status", e);
      }
    }
  });

  shellies.on("stale", (dev: any) => console.log("Device is now stale", dev));
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
