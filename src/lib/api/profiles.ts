import { invoke } from '@tauri-apps/api/core';
import type { Profile } from '$lib/types/profile';

// Interface für die Profile-Update Parameter
export interface UpdateProfileParams {
    name?: string;
    game_version?: string;
    loader?: string;
    loader_version?: string;
    settings?: any; // Angepasst, da ProfileSettings nicht exportiert wird
    selected_norisk_pack_id?: string;
}

// Neue Interface für die Profile-Kopier Parameter
export interface CopyProfileParams {
    source_profile_id: string;
    new_profile_name: string;
    include_files?: string[];
}

// Profile-Liste abrufen
export async function getProfiles(): Promise<Profile[]> {
    return invoke('list_profiles');
}

// Einzelnes Profil abrufen
export async function getProfile(id: string): Promise<Profile> {
    return invoke('get_profile', { id });
}

// Profil aktualisieren
export async function updateProfile(id: string, params: UpdateProfileParams): Promise<void> {
    return invoke('update_profile', { id, params });
}

// Profil löschen
export async function deleteProfile(id: string): Promise<void> {
    return invoke('delete_profile', { id });
}

// Profil-Ordner öffnen
export async function openProfileFolder(profileId: string): Promise<void> {
    return invoke('open_profile_folder', { profileId });
}

// Profil starten
export async function launchProfile(id: string): Promise<void> {
    return invoke('launch_profile', { id });
}

// Profil kopieren mit ausgewählten Dateien
export async function copyProfile(params: CopyProfileParams): Promise<string> {
    return invoke('copy_profile', { params });
}

// Verzeichnisstruktur eines Profils laden
export async function getProfileDirectoryStructure(profileId: string): Promise<any> {
    return invoke('get_profile_directory_structure', { profileId });
} 