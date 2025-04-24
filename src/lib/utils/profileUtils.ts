import type { NoriskVersionProfile, NoriskVersionsConfig } from "$lib/types/noriskVersions";
import type { Profile } from "$lib/types/profile";
import { invoke } from "@tauri-apps/api/core";
import { get, writable, type Writable } from "svelte/store";

export const profiles: Writable<Profile[]> = writable([]);
export const defaultProfiles: Writable<NoriskVersionProfile[]> = writable([]);
export const selectedProfileId: Writable<string | null> = writable(null);
export const selectedProfile: Writable<Profile | NoriskVersionProfile | null> = writable(null);

export async function loadProfiles(): Promise<void> {
    try {
        const profileList = await invoke<Profile[]>('list_profiles');
        const defaultProfileList = (await invoke<NoriskVersionsConfig>('get_standard_profiles')).profiles;
        profiles.set(profileList);
        defaultProfiles.set(defaultProfileList);
        
        console.log("Profiles loaded:", profileList);
        console.log("Default profiles loaded:", defaultProfileList);

        // Optional: Auto-select the first profile if none is selected
        if (get(selectedProfileId) == null && defaultProfileList.length > 0) {
            selectProfile(defaultProfileList[0].id);
        }

    } catch (error) {
        console.error("Failed to load profiles:", error);
        profiles.set([]);
        selectedProfileId.set(null);
    }
}

export function selectProfile(profileId: string | null): void {
    selectedProfileId.set(profileId);
    if (profileId) {
        const profileList = get(profiles);
        const defaultProfileList = get(defaultProfiles);
        const selected = profileList.find(profile => profile.id === profileId);
        const selectedDefault = defaultProfileList.find(profile => profile.id === profileId);
        selectedProfile.set(selected || selectedDefault || null);
    } else {
        selectedProfile.set(null);
    }
}