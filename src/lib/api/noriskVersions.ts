import type { NoriskVersionProfile, NoriskVersionsConfig } from "$lib/types/noriskVersions";
import { invoke } from "@tauri-apps/api/core";

export async function getNoriskProfiles(): Promise<NoriskVersionProfile[]> {
    return ((await invoke('get_standard_profiles')) as NoriskVersionsConfig).profiles;
}