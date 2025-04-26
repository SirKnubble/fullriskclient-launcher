<script lang="ts">
    import { onMount } from 'svelte';
    import { 
        accounts, 
        activeAccount, 
        isLoading, 
        error, 
        initializeAccounts, 
        addAccount, 
        removeAccount, 
        setActiveAccount 
    } from '$lib/stores/accountStore';
    import type { MinecraftAccount } from '$lib/types/minecraft';

    onMount(async () => {
        // Initialize accounts if not already loaded
        if ($accounts.length === 0) {
            await initializeAccounts();
        }
    });
</script>

<div class="account-manager">
    <h2>Account Manager</h2>
    
    {#if $error}
        <div class="error-message">
            {$error}
        </div>
    {/if}
    
    <div class="accounts-list">
        {#if $isLoading}
            <div class="loading-spinner">
                Loading accounts...
            </div>
        {:else if $accounts.length === 0}
            <p class="no-accounts">No accounts found</p>
        {:else}
            {#each $accounts as account}
                <div class="account-card">
                    <div class="account-info">
                        <h3>{account.minecraft_username || account.username}</h3>
                        <p class="account-id">ID: {account.id}</p>
                    </div>
                    <div class="account-actions">
                        {#if account.active}
                            <span class="active-badge">Active</span>
                        {:else}
                            <button class="set-active-btn" on:click={() => setActiveAccount(account.id)}>Set Active</button>
                        {/if}
                        <button class="delete-btn" on:click={() => removeAccount(account.id)}>Delete</button>
                    </div>
                </div>
            {/each}
        {/if}
    </div>

    <button class="add-account-btn" on:click={addAccount} disabled={$isLoading}>
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

    .add-account-btn:hover:not(:disabled) {
        background-color: #27ae60;
    }

    .add-account-btn:disabled {
        background-color: #a5d6a7;
        cursor: not-allowed;
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