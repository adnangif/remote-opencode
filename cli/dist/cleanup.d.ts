import { ChildProcess } from "node:child_process";
import { Config } from "./config.js";
export declare function cleanup(serverProcess: ChildProcess | null, ngrokStarted: boolean, config: Config): Promise<void>;
