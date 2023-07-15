import React from "react";
import { FoundShelly } from "../index";
import { Body } from "./Body";

const SORTERS: {
  [key: string]: (one: FoundShelly, other: FoundShelly) => number;
} = {
  name: (a, b) => a.name.localeCompare(b.name),
  type: (a, b) => a.model.localeCompare(b.model),
  uptime: (a, b) => a.uptime - b.uptime,
  update: (a, b) => (a.lastUpdate < b.lastUpdate ? 1 : 0),
  software: (a, b) => a.update.old_version.localeCompare(b.update.old_version),
};

export function ListView(props: {
  devices: FoundShelly[];
  username: string;
  password: string;
  sort?: string;
}) {
  let devs = props.devices;
  if (props.sort && SORTERS[props.sort]) {
    devs = devs.sort(SORTERS[props.sort]);
  }
  return (
    <Body title="Your shellies">
      <>
        <h1>Your shellies:</h1>
        <table className="table table-hover">
          <thead>
            <tr>
              <th scope="col">
                <a href="/?sort=name">Name</a>
              </th>
              <th scope="col">
                <a href="/?sort=type">Type</a>
              </th>
              <th scope="col">ID</th>
              <th scope="col">
                <a href="/?sort=software">Software</a>
              </th>
              <th scope="col">Hardware</th>
              <th scope="col">
                <a href="/?sort=update">Last update</a>
              </th>
              <th scope="col">
                <a href="/?sort=uptime">Uptime</a>
              </th>
            </tr>
          </thead>
          <tbody>
            {devs.map(
              (
                { id, host, name, model, hwModel, update, uptime, lastUpdate },
                key,
              ) => (
                <tr key={key}>
                  <td>
                    <a
                      href={`http://${props.username}:${props.password}@${host}`}
                      target="_blank"
                    >
                      {" "}
                      {name}
                    </a>
                  </td>
                  <td>{model}</td>
                  <td>{host}</td>
                  <td>
                    {id}
                    <br />
                    HW: {hwModel || "Not set"}
                  </td>
                  <td>{formatUpdate(update)}</td>
                  <td>{lastUpdate?.toLocaleString()}</td>
                  <td>{formatUptime(uptime)}</td>
                </tr>
              ),
            )}
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
