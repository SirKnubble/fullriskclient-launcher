import type { LauncherConfig } from "$lib/types/core";
import { invoke } from "@tauri-apps/api/core";

export function getConfig(): Promise<LauncherConfig> {
    return invoke("get_launcher_config");
}

export function setConfig(config: LauncherConfig): Promise<void> {
    return invoke("set_launcher_config", { config });
}
