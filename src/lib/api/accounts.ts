import type { MinecraftAccount } from "$lib/types/minecraft";
import { invoke } from "@tauri-apps/api/core";

export async function getAccounts(): Promise<MinecraftAccount[]> {
    return invoke("get_accounts");
}

export async function getActiveAccount(): Promise<MinecraftAccount | null> {
    return invoke("get_active_account");
}

export async function setActiveAccount(account_id: string): Promise<void> {
    return invoke("set_active_account", { account_id });
}

export async function beginLogin(): Promise<void> {
    return invoke("begin_login");
}

export async function removeAccount(account_id: string): Promise<void> {
    return invoke("remove_account", { account_id });
}