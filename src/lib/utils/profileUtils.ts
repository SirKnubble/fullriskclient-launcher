import type { Profile } from "$lib/types/profile";
import { invoke } from "@tauri-apps/api/core";
import { get, writable, type Writable } from "svelte/store";

export const profiles: Writable<Profile[]> = writable([]);
export const selectedProfileId: Writable<string | null> = writable(null);

export async function loadProfiles(): Promise<void> {
    try {
        const profileList = await invoke<Profile[]>('list_profiles');
        profiles.set(profileList);
        console.log("Profiles loaded:", profileList);

        // Optional: Auto-select the first profile if none is selected
        selectedProfileId.update(currentId => {
            if (!currentId && profileList.length > 0) {
                return profileList[0].id;
            }
            return currentId;
        });

    } catch (error) {
        console.error("Failed to load profiles:", error);
        profiles.set([]);
        selectedProfileId.set(null);
    }
}

export function selectProfile(profileId: string | null): void {
    selectedProfileId.set(profileId);
}