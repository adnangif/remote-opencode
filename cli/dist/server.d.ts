import { ChildProcess } from "node:child_process";
import { Config } from "./config.js";
export declare function checkServerHealth(hostname: string, port: number): Promise<boolean>;
export declare function waitForServer(hostname: string, port: number): Promise<boolean>;
export declare function startServer(config: Config, cwd: string): Promise<{
    child: ChildProcess;
    username: string;
    password: string;
}>;
