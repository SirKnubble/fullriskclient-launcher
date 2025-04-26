import { writable, derived } from 'svelte/store';
import { invoke } from '@tauri-apps/api/core';

export interface Account {
    id: string;
    minecraft_username: string;
    access_token: string;
    refresh_token: string;
    expires_at: string;
}

// Store for all accounts
export const accounts = writable<Account[]>([]);

// Store for the currently selected account
export const selectedAccount = writable<Account | null>(null);

// Initialize the stores
export async function initializeAccounts() {
    try {
        const allAccounts = await invoke<Account[]>('get_accounts');
        accounts.set(allAccounts);
        
        const active = await invoke<Account | null>('get_active_account');
        selectedAccount.set(active);
    } catch (error) {
        console.error('Error initializing accounts:', error);
    }
}

// Function to set active account
export async function setActiveAccount(accountId: string) {
    try {
        await invoke('set_active_account', { accountId });
        
        // Update the selected account in the store
        const account = await invoke<Account | null>('get_active_account');
        selectedAccount.set(account);
    } catch (error) {
        console.error('Error setting active account:', error);
        throw error;
    }
}

// Function to remove an account
export async function removeAccount(accountId: string) {
    try {
        await invoke('remove_account', { accountId });
        
        // Update accounts list
        const allAccounts = await invoke<Account[]>('get_accounts');
        accounts.set(allAccounts);
        
        // Update selected account
        const active = await invoke<Account | null>('get_active_account');
        selectedAccount.set(active);
    } catch (error) {
        console.error('Error removing account:', error);
        throw error;
    }
} 