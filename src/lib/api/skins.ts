/*
get_user_skin_data,
upload_skin,
reset_skin,
apply_skin_from_base64,
get_all_skins,
get_skin_by_id,
add_skin,
remove_skin,
update_skin_properties
*/

import type { MinecraftProfile } from "$lib/types/minecraft";
import type { MinecraftSkin } from "$lib/types/skin";
import { invoke } from "@tauri-apps/api/core";

export async function getUserSkinData(): Promise<MinecraftProfile> {
    return invoke('get_user_skin_data');
}

export async function uploadSkin(uuid: string, accessToken: string, skinVariant: 'slim' | 'classic'): Promise<void> {
    return invoke('upload_skin', { uuid, accessToken, skinVariant });
}

export async function resetSkin(uuid: string, accessToken: string): Promise<void> {
    return invoke('reset_skin', { uuid, accessToken });
}

export async function applySkinFromBase64(uuid: string, accessToken: string, base64Data: string, skinVariant: 'slim' | 'classic'): Promise<void> {
    return invoke('apply_skin_from_base64', { uuid, accessToken, base64Data, skinVariant });
}

export async function getAllSkins(): Promise<MinecraftSkin[]> {
    return invoke('get_all_skins');
}

export async function getSkinById(id: string): Promise<MinecraftSkin> {
    return invoke('get_skin_by_id', { id });
}

export async function addSkin(name: string, base64Data: string, variant: 'slim' | 'classic', description?: string): Promise<MinecraftSkin> {
    return invoke('add_skin', { name, base64Data, variant, description });
}

export async function removeSkin(id: string): Promise<void> {
    return invoke('remove_skin', { id });
}

export async function updateSkinProperties(uuid: string, accessToken: string, base64Data: string, skinVariant: 'slim' | 'classic'): Promise<void> {
    return invoke('update_skin_properties', { uuid, accessToken, base64Data, skinVariant });
}