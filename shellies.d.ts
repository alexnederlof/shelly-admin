declare module "shellies";

function on(type: "discover", listener: (device: Shelly) => void): void;
function start(networkInterface?: unknown): Promise<any>;
function setAuthCredentials(username: string, password: string): void;
const size: number;
const running: boolean;
[Symbol.iterator[Shelly]];

class Shelly {
  public id: string;
  public name: string;
  public host: string;
}

interface ShellyStatus {
  wifi_sta: WifiStatus;
  cloud: Cloud;
  mqtt: Mqtt;
  time: string;
  unixtime: number;
  serial: number;
  has_update: boolean;
  mac: string;
  update: Update;
  ram_total: number;
  ram_free: number;
  ram_lwm: number;
  fs_size: number;
  fs_free: number;
  uptime: number;
}

interface Cloud {
  enabled: boolean;
  connected: boolean;
}

interface Mqtt {
  connected: boolean;
}

interface Update {
  status: string;
  has_update: boolean;
  new_version: string;
  old_version: string;
}

interface WifiStatus {
  connected: boolean;
  ssid: string;
  ip: string;
  rssi: number;
}

interface ShellySettings {
  build_info: {
    build_id: string;
    build_timestamp: string;
    build_version: string;
  };
  name: string;
  device: {
    type: string;
  };
  hwinfo?: {
    hw_revision: string;
  };
}
