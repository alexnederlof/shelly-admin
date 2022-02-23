import axios from "axios";
import { config } from "dotenv";
import express from "express";
import basicAuth from "express-basic-auth";
import os from "os";
import { collectDefaultMetrics, Registry } from "prom-client";
import ReactDOMServer from "react-dom/server";
import shellies from "shellies";
import { ListView } from "./layout/ListView";
export interface FoundShelly {
  id: string;
  host: string;
  status: ShellyStatus;
  settings: ShellySettings;
}

async function main() {
  config();
  const found = new Map<string, FoundShelly>();
  const username = process.env["SHELLY_USERNAME"] || "";
  const password = process.env["SHELLY_PASSWORD"] || "";

  console.log("Creating prometheus registry");
  const register = new Registry();
  collectDefaultMetrics({ register });

  const app = express();
  app.use(
    basicAuth({
      users: { [username]: password },
      challenge: true,
      realm: "shellies.nlove",
    })
  );
  app.get("/", (req, res) => {
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

  app.listen(3000, () => console.log("Started!"));

  const iface = getNetworkInterface();
  console.log(`Listen for shellies on ${iface}`);
  await shellies.start(iface);
  console.log("Started finding");
  const client = axios.create({
    auth: { username, password },
  });
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

main().catch((e) => {
  if (e.isAxiosError && e.response) {
    console.error(e.response);
  } else {
    console.error(e);
  }
  process.exit(1);
});
