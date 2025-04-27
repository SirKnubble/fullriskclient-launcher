import { getConfig, setConfig } from "$lib/api/config";
import type { LauncherConfig } from "$lib/types/core";
import { writable, type Writable } from "svelte/store";

export const launcherConfig: Writable<LauncherConfig | null> = writable(null);

export async function loadConfig(): Promise<void> {
    const config = await getConfig();
    launcherConfig.set(config);
}

export async function updateConfig(config: LauncherConfig): Promise<void> {
    launcherConfig.set(config);
    await setConfig(config);
}