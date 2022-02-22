import express from "express";
import { collectDefaultMetrics, Gauge, Registry } from "prom-client";
import ReactDOMServer from "react-dom/server";
import { ListView } from "./layout/ListView";

async function main() {
  console.log("Creating prometheus registry");
  const register = new Registry();
  collectDefaultMetrics({ register });

  const app = express();
  app.get("/", (req, res) => {
    res.send(ReactDOMServer.renderToString(ListView({})));
  });

  app.get("/metrics", async (req, res) => {
    const metrics = await register.metrics();
    res.contentType("text/plain").send(metrics);
  });

  app.listen(3000, () => console.log("Started!"));
}

main().catch((e) => {
  if (e.isAxiosError && e.response) {
    console.error(e.response);
  } else {
    console.error(e);
  }
  process.exit(1);
});
