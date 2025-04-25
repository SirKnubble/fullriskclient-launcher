import { getNoriskProfiles } from "$lib/api/noriskVersions";
import { getProfiles } from "$lib/api/profiles";
import type { Profile } from "$lib/types/profile";
import { get, writable, type Writable } from "svelte/store";

export const profiles: Writable<Profile[]> = writable([]);
export const selectedProfile: Writable<Profile | null> = writable(null);

export async function loadProfiles(): Promise<void> {
    try {
        const profileList = await getProfiles();
        const defaultProfileList = await getNoriskProfiles();
        profiles.set([...defaultProfileList, ...profileList]);
        
        console.log("Profiles loaded:", profileList);
        console.log("Default profiles loaded:", defaultProfileList);

        // Optional: Auto-select the first profile if none is selected
        if (get(selectedProfile) == null && defaultProfileList.length > 0) {
            selectProfile(defaultProfileList[0].id);
        }

    } catch (error) {
        console.error("Failed to load profiles:", error);
        profiles.set([]);
        selectedProfile.set(null);
    }
}

export function selectProfile(profileId: string | null): void {
    if (profileId) {
        const profileList = get(profiles);
        const selected = profileList.find(profile => profile.id === profileId);
        selectedProfile.set(selected || null);
    } else {
        selectedProfile.set(null);
    }
}