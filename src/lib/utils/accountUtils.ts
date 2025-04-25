import { beginLogin, getAccounts, removeAccount as removeAccountInternal, setActiveAccount } from "$lib/api/accounts";
import type { MinecraftAccount } from "$lib/types/minecraft";
import { get, writable, type Writable } from "svelte/store";
import { translations } from "./translationUtils";

export const accounts: Writable<MinecraftAccount[] | null> = writable(null);
export const selectedAccount: Writable<MinecraftAccount | null> = writable(null);

export async function loadAccounts() {
    const loadedAccounts = await getAccounts();
    
    accounts.set(loadedAccounts);
    selectedAccount.set(loadedAccounts.find(account => account.active) ?? null);

    console.log("Accounts loaded:", loadedAccounts);
}

export async function addAccount(): Promise<void> {
    accounts.set([...get(accounts) ?? [], {
        id: 'ADD_ACCOUNT',
        username: get(translations).settings.accounts.modal.dummy_account_name,
        active: false,
        access_token: '',
        refresh_token: '',
        expires: ''
    }]);
    await beginLogin();
    await loadAccounts();
}

export async function selectAccount(accountId: string) {
    if (accountId == get(selectedAccount)?.id) return;

    const loadedAccounts = get(accounts);
    const selected = loadedAccounts?.find(account => account.id === accountId);
    
    if (selected) {
        await setActiveAccount(accountId);
        selectedAccount.set(selected);
    } else {
        console.error(`Account with ID ${accountId} not found.`);
    }
}

export async function removeAccount(accountId: string) {
    await removeAccountInternal(accountId);
    loadAccounts();
}
