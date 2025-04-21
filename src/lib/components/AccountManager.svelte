<script lang="ts">
    import { invoke } from '@tauri-apps/api/core';
    import type { MinecraftAccount } from '../types/minecraft';
    import { onMount } from 'svelte';

    let accounts: MinecraftAccount[] = [];
    let loading = true;
    let error: string | null = null;

    onMount(async () => {
        await loadAccounts();
    });

    async function loadAccounts() {
        try {
            loading = true;
            // Ensure there's an active account
            await invoke('get_active_account');
            accounts = await invoke<MinecraftAccount[]>('get_accounts');
            error = null;
        } catch (err) {
            console.error('Error loading accounts:', err);
            error = err.message ?? 'Failed to load accounts';
        } finally {
            loading = false;
        }
    }

    async function handleAddAccount() {
        try {
            const account = await invoke<MinecraftAccount>('begin_login');
            console.log('Login result:', account);
            
            // Set the new account as active and deactivate all others
            await invoke('set_active_account', { accountId: account.id });
            
            await loadAccounts(); // Reload accounts after adding a new one
        } catch (err) {
            console.error('Error during login:', err);
            error = err instanceof Error ? err.message : 'Failed to add account';
        }
    }

    async function handleDeleteAccount(id: string) {
        if (!confirm('Are you sure you want to delete this account?')) {
            return;
        }

        try {
            await invoke('remove_account', { accountId: id });
            // Ensure there's an active account after deletion
            await invoke('get_active_account');
            await loadAccounts(); // Reload accounts after deletion
        } catch (err) {
            console.error('Error deleting account:', err);
            error = err instanceof Error ? err.message : 'Failed to delete account';
        }
    }

    async function handleSetActive(id: string) {
        try {
            await invoke('set_active_account', { accountId: id });
            await loadAccounts(); // Reload accounts after setting active
        } catch (err) {
            console.error('Error setting active account:', err);
            error = err instanceof Error ? err.message : 'Failed to set active account';
        }
    }
</script>

<div class="account-manager">
    <h2>Account Manager</h2>
    
    {#if error}
        <div class="error-message">
            {error}
        </div>
    {/if}
    
    <div class="accounts-list">
        {#if loading}
            <div class="loading-spinner">
                Loading accounts...
            </div>
        {:else if accounts.length === 0}
            <p class="no-accounts">No accounts found</p>
        {:else}
            {#each accounts as account}
                <div class="account-card">
                    <div class="account-info">
                        <h3>{account.username}</h3>
                        <p class="account-id">ID: {account.id}</p>
                    </div>
                    <div class="account-actions">
                        {#if account.active}
                            <span class="active-badge">Active</span>
                        {:else}
                            <button class="set-active-btn" on:click={() => handleSetActive(account.id)}>Set Active</button>
                        {/if}
                        <button class="delete-btn" on:click={() => handleDeleteAccount(account.id)}>Delete</button>
                    </div>
                </div>
            {/each}
        {/if}
    </div>

    <button class="add-account-btn" on:click={handleAddAccount}>
        Add Account
    </button>
</div>

<style>
    .account-manager {
        padding: 1rem;
        background-color: #f0f2f5;
        border-radius: 8px;
        margin-bottom: 1rem;
        border: 1px solid #e0e0e0;
    }

    h2 {
        margin-bottom: 1rem;
        color: #333;
    }

    .accounts-list {
        margin-bottom: 1rem;
    }

    .account-card {
        background: white;
        padding: 1rem;
        border-radius: 6px;
        margin-bottom: 0.5rem;
        display: flex;
        justify-content: space-between;
        align-items: center;
        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        transition: box-shadow 0.2s;
    }

    .account-card:hover {
        box-shadow: 0 2px 5px rgba(0,0,0,0.2);
    }

    .account-info {
        flex: 1;
    }

    .account-info h3 {
        margin: 0;
        font-size: 1.1rem;
        color: #333;
    }

    .account-id {
        margin: 0;
        font-size: 0.8rem;
        color: #666;
    }

    .account-actions {
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }

    .active-badge {
        background-color: #e6f7e6;
        color: #2e7d32;
        padding: 0.25rem 0.5rem;
        border-radius: 12px;
        font-size: 0.8rem;
        font-weight: 500;
    }

    .delete-btn {
        background-color: #ffebee;
        color: #c62828;
        border: none;
        padding: 0.25rem 0.5rem;
        border-radius: 4px;
        cursor: pointer;
        font-size: 0.8rem;
        transition: background-color 0.2s;
    }

    .delete-btn:hover {
        background-color: #ffcdd2;
    }

    .loading-spinner {
        text-align: center;
        padding: 1rem;
        color: #666;
    }

    .no-accounts {
        text-align: center;
        padding: 1rem;
        color: #666;
    }

    .error-message {
        background-color: #ffebee;
        color: #c62828;
        padding: 0.5rem;
        border-radius: 4px;
        margin-bottom: 1rem;
    }

    .add-account-btn {
        background-color: #2ecc71;
        color: white;
        border: none;
        padding: 0.5rem 1rem;
        border-radius: 4px;
        cursor: pointer;
        font-weight: 500;
        transition: background-color 0.2s;
    }

    .add-account-btn:hover {
        background-color: #27ae60;
    }

    .set-active-btn {
        background-color: #e3f2fd;
        color: #1976d2;
        border: none;
        padding: 0.25rem 0.5rem;
        border-radius: 4px;
        cursor: pointer;
        font-size: 0.8rem;
        transition: background-color 0.2s;
    }

    .set-active-btn:hover {
        background-color: #bbdefb;
    }
</style> 