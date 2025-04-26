<script lang="ts">
    import { invoke } from "@tauri-apps/api/core";
    import { onMount } from "svelte";

    interface MinecraftAccount {
        id: string;
        username: string;
        minecraft_username: string;
        active: boolean;
        access_token: string;
    }

    interface SkinData {
        id: string;
        name: string;
        properties: {
            name: string;
            value: string;
        }[];
    }

    let skinData: SkinData | null = $state(null);
    let skinUrl: string | null = $state(null);
    let skinVariant: string = $state("classic"); // "classic" or "slim"
    let loading: boolean = $state(true);
    let error: string | null = $state(null);
    let successMessage: string | null = $state(null);

    // Track the active account
    let activeAccount: MinecraftAccount | null = $state(null);

    onMount(async () => {
        await loadActiveAccount();
    });

    async function loadActiveAccount() {
        loading = true;
        error = null;
        
        try {
            // Get the active account (similar to AccountManager.svelte)
            const account = await invoke<MinecraftAccount>('get_active_account');
            activeAccount = account;
            
            if (account) {
                await loadSkinData(account.id, account.access_token);
            }
        } catch (err) {
            console.error("Error loading active account:", err);
            error = err instanceof Error ? err.message : String(err);
            activeAccount = null;
        } finally {
            loading = false;
        }
    }

    async function loadSkinData(uuid: string, accessToken: string) {
        if (!uuid || !accessToken) return;
        
        loading = true;
        error = null;
        successMessage = null;
        
        try {
            // Pass UUID and access token to the command
            const data = await invoke<SkinData>("get_user_skin_data", {
                uuid,
                accessToken
            });
            
            skinData = data;
            
            // Extract the skin URL from the properties
            if (data && data.properties) {
                const textures = data.properties.find(prop => prop.name === "textures");
                if (textures) {
                    try {
                        // The value is a base64 encoded JSON
                        const decodedValue = atob(textures.value);
                        const texturesJson = JSON.parse(decodedValue);
                        skinUrl = texturesJson.textures?.SKIN?.url || null;
                    } catch (e) {
                        console.error("Error parsing skin textures:", e);
                    }
                }
            }
        } catch (err) {
            console.error("Error loading skin data:", err);
            error = err instanceof Error ? err.message : String(err);
        } finally {
            loading = false;
        }
    }

    async function handleUploadSkin() {
        if (!activeAccount) return;
        
        error = null;
        successMessage = null;
        loading = true;
        
        try {
            await invoke("upload_skin", {
                uuid: activeAccount.id,
                accessToken: activeAccount.access_token,
                skinVariant
            });
            
            successMessage = "Skin updated successfully!";
            // Reload skin data to display the new skin
            await loadSkinData(activeAccount.id, activeAccount.access_token);
        } catch (err) {
            console.error("Error uploading skin:", err);
            error = err instanceof Error ? err.message : String(err);
        } finally {
            loading = false;
        }
    }

    async function handleResetSkin() {
        if (!activeAccount) return;
        
        if (!confirm("Are you sure you want to reset your skin to the default?")) {
            return;
        }
        
        error = null;
        successMessage = null;
        loading = true;
        
        try {
            await invoke("reset_skin", {
                uuid: activeAccount.id,
                accessToken: activeAccount.access_token
            });
            
            successMessage = "Skin reset to default!";
            // Reload skin data to display the default skin
            await loadSkinData(activeAccount.id, activeAccount.access_token);
        } catch (err) {
            console.error("Error resetting skin:", err);
            error = err instanceof Error ? err.message : String(err);
        } finally {
            loading = false;
        }
    }
</script>

<div class="skin-changer">
    <h3>Minecraft Skin Manager</h3>
    
    {#if !activeAccount}
        <p class="note">Please log in to a Minecraft account to manage skins.</p>
    {:else if loading}
        <p class="loading">Loading skin data...</p>
    {:else if error}
        <p class="error">{error}</p>
    {:else}
        <div class="skin-container">
            <div class="skin-preview">
                <h4>Current Skin: {activeAccount.minecraft_username}</h4>
                {#if skinUrl}
                    <img src={skinUrl} alt="Minecraft Skin" class="skin-image" />
                {:else}
                    <div class="no-skin">Default Steve/Alex skin</div>
                {/if}
            </div>
            
            <div class="skin-controls">
                <div class="variant-selector">
                    <label>
                        <input type="radio" bind:group={skinVariant} value="classic" />
                        Classic (Steve)
                    </label>
                    <label>
                        <input type="radio" bind:group={skinVariant} value="slim" />
                        Slim (Alex)
                    </label>
                </div>
                
                <div class="skin-buttons">
                    <button on:click={handleUploadSkin} disabled={loading}>
                        Upload New Skin
                    </button>
                    <button on:click={handleResetSkin} disabled={loading} class="reset-button">
                        Reset to Default
                    </button>
                </div>
                
                {#if successMessage}
                    <p class="success">{successMessage}</p>
                {/if}
            </div>
        </div>
    {/if}
</div>

<style>
    .skin-changer {
        padding: 15px;
        border: 1px solid #ddd;
        border-radius: 5px;
        margin-bottom: 20px;
    }
    
    h3 {
        margin-top: 0;
        margin-bottom: 15px;
    }
    
    h4 {
        margin-top: 0;
        margin-bottom: 10px;
        font-size: 1em;
    }
    
    .skin-container {
        display: flex;
        gap: 20px;
        align-items: flex-start;
    }
    
    .skin-preview {
        flex: 0 0 auto;
        border: 1px solid #ccc;
        padding: 10px;
        border-radius: 5px;
        background-color: #f5f5f5;
    }
    
    .skin-image {
        width: 128px;
        height: 128px;
        image-rendering: pixelated;
        background-color: #e0e0e0;
        display: block;
    }
    
    .no-skin {
        width: 128px;
        height: 128px;
        display: flex;
        align-items: center;
        justify-content: center;
        text-align: center;
        background-color: #e0e0e0;
        color: #666;
        font-size: 0.9em;
    }
    
    .skin-controls {
        flex: 1;
    }
    
    .variant-selector {
        margin-bottom: 15px;
        display: flex;
        gap: 20px;
    }
    
    .skin-buttons {
        display: flex;
        gap: 10px;
    }
    
    button {
        padding: 8px 16px;
        background-color: #4a90e2;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        transition: background-color 0.2s;
    }
    
    button:hover:not(:disabled) {
        background-color: #357abd;
    }
    
    button:disabled {
        background-color: #ccc;
        cursor: not-allowed;
    }
    
    .reset-button {
        background-color: #e74c3c;
    }
    
    .reset-button:hover:not(:disabled) {
        background-color: #c0392b;
    }
    
    .loading {
        color: #666;
        font-style: italic;
    }
    
    .error {
        color: #e74c3c;
        padding: 10px;
        background-color: #fbeae8;
        border: 1px solid #e74c3c;
        border-radius: 4px;
    }
    
    .success {
        color: #2ecc71;
        padding: 10px;
        background-color: #e8f8f5;
        border: 1px solid #2ecc71;
        border-radius: 4px;
        margin-top: 15px;
    }
    
    .note {
        color: #666;
        font-style: italic;
    }
</style> 