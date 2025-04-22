import { writable, derived, type Writable, type Readable } from 'svelte/store';
import { invoke } from '@tauri-apps/api/core';

// --- Interfaces matching Rust structs --- 

// Interface for ModSource (simplified for frontend use)
// We might not need all details on the frontend list, adjust as needed.
export interface ModSource {
    type: 'local' | 'url' | 'maven' | 'embedded' | 'modrinth';
    file_name?: string; // Available in local, potentially in url/modrinth
    url?: string; // Available in url
    coordinates?: string; // Available in maven
    name?: string; // Available in embedded
    project_id?: string; // Available in modrinth
    // Add other fields if needed for display
}

// Interface matching Rust Mod struct
export interface Mod {
    id: string; // Uuid maps to string
    source: ModSource;
    enabled: boolean;
    display_name: string | null;
    version: string | null;
    game_versions: string[] | null;
    associated_loader: string | null; // Added field matching Rust struct
    // file_name_override: string | null; // Usually not needed for display
}

// Interfaces matching Rust ProfileSettings and related structs
export interface WindowSize {
    width: number;
    height: number;
}

export interface MemorySettings {
    min: number; // u32 maps to number
    max: number;
}

export interface ProfileSettings {
    java_path: string | null;
    memory: MemorySettings;
    resolution: WindowSize | null;
    fullscreen: boolean;
    extra_args: string[];
}

// Enum matching Rust ProfileState
export type ProfileState = 'not_installed' | 'installing' | 'installed' | 'running' | 'error';

// Interface matching Rust NoriskModIdentifier struct
export interface NoriskModIdentifier {
    pack_id: string;
    mod_id: string;
    game_version: string; 
    loader: string; // Send/Receive as string, backend converts to/from enum 
}

// Interface matching Rust Profile struct (adjusted)
export interface Profile {
    id: string; 
    name: string;
    path: string;
    game_version: string;
    loader: string; 
    loader_version: string | null;
    created: string; 
    last_played: string | null;
    mods: Mod[]; // Use the specific Mod interface
    settings: ProfileSettings;
    state: ProfileState;
    selected_norisk_pack_id: string | null;
    // Use the detailed identifier set
    disabled_norisk_mods_detailed?: NoriskModIdentifier[]; // Changed to array for Svelte reactivity? Or keep Set?
    // Let's stick to the Rust structure and handle Set logic in functions for now.
    // Need to adjust how we check includes if it's not an array.
    // We'll need a helper function anyway.
}

// --- Stores --- 

// Store for the list of all profiles
export const profiles: Writable<Profile[]> = writable([]);

// Store for the ID of the currently selected profile
export const selectedProfileId: Writable<string | null> = writable(null);

// Derived store to get the full object of the selected profile
export const selectedProfile: Readable<Profile | null> = derived(
    [profiles, selectedProfileId],
    ([$profiles, $selectedProfileId]) => {
        if (!$selectedProfileId) {
            return null;
        }
        return $profiles.find(p => p.id === $selectedProfileId) ?? null;
    }
);

// Function to load profiles from the backend
export async function loadProfiles(): Promise<void> {
    console.log("Attempting to load profiles from backend...");
    try {
        const profileList = await invoke<Profile[]>('list_profiles');
        profiles.set(profileList);
        console.log("Profiles loaded:", profileList);

        // Optional: Auto-select the first profile if none is selected
        // selectedProfileId.update(currentId => {
        //     if (!currentId && profileList.length > 0) {
        //         return profileList[0].id;
        //     }
        //     return currentId;
        // });

    } catch (error) {
        console.error("Failed to load profiles:", error);
        profiles.set([]); // Clear profiles on error
        selectedProfileId.set(null); // Clear selection on error
    }
}

// Consider calling loadProfiles() explicitly from a layout or page component
// instead of automatically loading it here. 