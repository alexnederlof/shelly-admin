import React from "react";
import { FoundShelly } from "../index";
import { Body } from "./Body";

export function ListView(props: {
  devices: FoundShelly[];
  username: string;
  password: string;
}) {
  let devs = props.devices.sort((a, b) =>
    a.settings.name.localeCompare(b.settings.name)
  );
  return (
    <Body title="Your shellies">
      <>
        <h1>Your shellies:</h1>
        <table className="table table-hover">
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Type</th>
              <th scope="col">IP</th>
              <th scope="col">ID</th>
              <th scope="col">MQTT</th>
              <th scope="col">Software</th>
              <th scope="col">Hardware</th>
              <th scope="col">Uptime</th>
            </tr>
          </thead>
          <tbody>
            {devs.map(({ id, host, settings, status }, key) => (
              <tr key={key}>
                <td>
                  <a
                    href={`http://${props.username}:${props.password}@${host}`}
                    target="_blank"
                  >
                    {" "}
                    {settings.name}
                  </a>
                  <pre style={{ display: "none" }}>
                    {JSON.stringify(settings, null, 2)}
                  </pre>
                  <pre style={{ display: "none" }}>
                    {JSON.stringify(status, null, 2)}
                  </pre>
                </td>
                <td>{settings.device.type}</td>
                <td>{host}</td>
                <td>{id}</td>
                <td>
                  {status.mqtt.connected ? "connected" : "Not connected?"}
                </td>
                <td>{formatUpdate(status.update)}</td>
                <td>{settings.hwinfo?.hw_revision || "Not setome"}</td>
                <td>{formatUptime(status.uptime)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </>
    </Body>
  );
}
function formatUpdate(update: Update): JSX.Element {
  if (update.has_update) {
    return (
      <>
        Update available!
        <br /> from {update.old_version} to {update.new_version}
      </>
    );
  } else {
    return <>{update.old_version}</>;
  }
}

function formatUptime(uptime: number): string {
  return new Date(new Date().getTime() - uptime * 1000).toISOString();
}
