export interface Config {
    hostname: string;
    port: number;
    ngrokAuthtoken: string | null;
    pid: number | null;
    username: string | null;
    password: string | null;
    ngrokUrl: string | null;
}
export declare function getConfigPath(): string;
export declare function loadConfig(): Config;
export declare function saveConfig(config: Config): void;
export declare function clearDynamicFields(configPath?: string): void;
export declare function generateCredentials(): {
    username: string;
    password: string;
};
export declare function promptNgrokAuthtoken(): Promise<string>;
export declare function isPidAlive(pid: number): boolean;
