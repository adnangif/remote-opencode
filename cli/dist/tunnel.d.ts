import { Config } from "./config.js";
export declare function startTunnel(config: Config): Promise<string>;
export declare function stopTunnel(): Promise<void>;
