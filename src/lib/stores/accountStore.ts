import { writable, derived, get } from 'svelte/store';
import { invoke } from '@tauri-apps/api/core';
import type { MinecraftAccount } from '../types/minecraft';

// Store for all accounts
export const accounts = writable<MinecraftAccount[]>([]);

// Store for the currently selected/active account
export const activeAccount = writable<MinecraftAccount | null>(null);

// Loading state
export const isLoading = writable<boolean>(false);

// Error state
export const error = writable<string | null>(null);

// Initialize the stores - call this function at app startup
export async function initializeAccounts() {
    isLoading.set(true);
    error.set(null);
    
    try {
        // Fetch active account first
        const active = await invoke<MinecraftAccount | null>('get_active_account');
        activeAccount.set(active);
        
        // Fetch all accounts
        const allAccounts = await invoke<MinecraftAccount[]>('get_accounts');
        accounts.set(allAccounts);
    } catch (err) {
        console.error('Error initializing accounts:', err);
        error.set(err instanceof Error ? err.message : String(err));
    } finally {
        isLoading.set(false);
    }
}

// Refresh accounts from backend - call this after changes
export async function refreshAccounts() {
    // Don't set isLoading true here to avoid UI flicker on frequent updates
    error.set(null);
    
    try {
        // Fetch active account
        const active = await invoke<MinecraftAccount | null>('get_active_account');
        activeAccount.set(active);
        
        // Fetch all accounts
        const allAccounts = await invoke<MinecraftAccount[]>('get_accounts');
        accounts.set(allAccounts);
    } catch (err) {
        console.error('Error refreshing accounts:', err);
        error.set(err instanceof Error ? err.message : String(err));
    }
}

// Add a new account
export async function addAccount() {
    isLoading.set(true);
    error.set(null);
    
    try {
        const account = await invoke<MinecraftAccount>('begin_login');
        
        if (account) {
            // Set the new account as active
            await invoke('set_active_account', { accountId: account.id });
            
            // Refresh accounts from backend
            await refreshAccounts();
        }
    } catch (err) {
        console.error('Error adding account:', err);
        error.set(err instanceof Error ? err.message : String(err));
    } finally {
        isLoading.set(false);
    }
}

// Set active account
export async function setActiveAccount(accountId: string) {
    isLoading.set(true);
    error.set(null);
    
    try {
        await invoke('set_active_account', { accountId });
        
        // Refresh accounts from backend
        await refreshAccounts();
    } catch (err) {
        console.error('Error setting active account:', err);
        error.set(err instanceof Error ? err.message : String(err));
    } finally {
        isLoading.set(false);
    }
}

// Remove account
export async function removeAccount(accountId: string) {
    isLoading.set(true);
    error.set(null);
    
    try {
        await invoke('remove_account', { accountId });
        
        // Refresh accounts from backend
        await refreshAccounts();
    } catch (err) {
        console.error('Error removing account:', err);
        error.set(err instanceof Error ? err.message : String(err));
    } finally {
        isLoading.set(false);
    }
} 