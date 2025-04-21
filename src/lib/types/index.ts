export interface EventPayload {
    event_id: string;
    event_type: string;
    target_id: string | null;
    message: string;
    progress: number | null;
    error: string | null;
}

// Types matching profile_state.rs
export interface MemorySettings {
    min: number; // in MB
    max: number; // in MB
}

export interface WindowSize {
    width: number;
    height: number;
}

export interface ProfileSettings {
    java_path?: string | null;
    memory: MemorySettings;
    resolution?: WindowSize | null;
    fullscreen: boolean;
    extra_args: string[];
}

// Re-export existing types if they are also defined here
// export type { NoriskModpacksConfig, NoriskPackDefinition, NoriskPackMod } from './noriskPacks';
// export type { ModrinthVersion, ModrinthProjectContext, ModrinthAllVersionsResult, ModrinthDependency, ModrinthFile } from './modrinth';
// ... other type exports

// You might need to define Profile type here eventually if it's used across components
// import type { Mod, ModLoader, ProfileState } from '$lib/stores/profileStore'; // Example if they come from store
// export interface Profile {
//     id: string; // UUID as string in TS
//     name: string;
//     path: string;
//     game_version: string;
//     loader: ModLoader; 
//     loader_version?: string | null;
//     created: string; // Date as string
//     last_played?: string | null; // Date as string
//     settings: ProfileSettings;
//     state: ProfileState;
//     mods: Mod[];
//     selected_norisk_pack_id?: string | null;
//     disabled_norisk_mods_detailed: any[]; // Define NoriskModIdentifier if needed here too
// } 