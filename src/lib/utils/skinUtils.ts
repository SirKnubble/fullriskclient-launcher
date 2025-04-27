import { getAllSkins } from "$lib/api/skins";
import type { MinecraftSkin } from "$lib/types/skin";
import { writable, type Writable } from "svelte/store";

export const localSkins: Writable<MinecraftSkin[] | null> = writable(null);

export async function loadLocalSkins(): Promise<void> {
    const skins = await getAllSkins();
    localSkins.set(skins);
}