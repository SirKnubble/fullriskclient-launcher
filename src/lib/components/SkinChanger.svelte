<script lang="ts">
    import { invoke } from "@tauri-apps/api/core";
    import { onMount } from "svelte";
    import { 
        activeAccount, 
        isLoading as accountLoading, 
        error as accountError,
        initializeAccounts
    } from '$lib/stores/accountStore';
    import type { 
        MinecraftAccount, 
        MinecraftProfile, 
        TexturesData, 
        TexturesDictionary
    } from '$lib/types/minecraft';

    let skinData: MinecraftProfile | null = $state(null);
    let skinUrl: string | null = $state(null);
    let skinModel: string | null = $state(null);
    let skinVariant: string = $state("classic"); // "classic" or "slim"
    let loading: boolean = $state(false);
    let error: string | null = $state(null);
    let successMessage: string | null = $state(null);

    onMount(async () => {
        // Initialize accounts if not already loaded
        if (!$activeAccount) {
            await initializeAccounts();
        }
        
        // Load skin data if we have an active account
        await loadSkinData();
    });

    // Reactive effect to reload skin data when active account changes
    $effect(() => {
        if ($activeAccount) {
            loadSkinData();
        } else {
            skinData = null;
            skinUrl = null;
            skinModel = null;
        }
    });

    async function loadSkinData() {
        if (!$activeAccount) return;
        
        loading = true;
        error = null;
        successMessage = null;
        
        try {
            // Pass UUID and access token to the command
            const data = await invoke<MinecraftProfile>("get_user_skin_data", {
                uuid: $activeAccount.id,
                accessToken: $activeAccount.access_token
            });
            
            skinData = data;
            
            // Extract the skin URL from the properties
            if (data && data.properties) {
                const textures = data.properties.find(prop => prop.name === "textures");
                if (textures) {
                    try {
                        // The value is a base64 encoded JSON
                        const decodedValue = atob(textures.value);
                        const texturesJson = JSON.parse(decodedValue) as TexturesData;
                        
                        // Set the skin URL
                        skinUrl = texturesJson.textures?.SKIN?.url || null;
                        
                        // Get the skin model (slim or classic)
                        skinModel = texturesJson.textures?.SKIN?.metadata?.model || null;
                        
                        // Auto-select the skin variant based on the current skin
                        if (skinModel === "slim") {
                            skinVariant = "slim";
                        } else {
                            skinVariant = "classic";
                        }
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
        if (!$activeAccount) return;
        
        error = null;
        successMessage = null;
        loading = true;
        
        try {
            await invoke("upload_skin", {
                uuid: $activeAccount.id,
                accessToken: $activeAccount.access_token,
                skinVariant
            });
            
            successMessage = "Skin updated successfully!";
            // Reload skin data to display the new skin
            await loadSkinData();
        } catch (err) {
            console.error("Error uploading skin:", err);
            // More detailed error handling
            if (typeof err === 'object' && err !== null && 'message' in err) {
                error = String(err.message);
            } else {
                error = `Failed to upload skin: ${String(err)}`;
            }
            
            // Add helpful message
            if (error.includes("No skin file selected")) {
                error = "Please select a valid PNG skin file to upload.";
            } else if (error.includes("access_token")) {
                error = "Authentication error. Please try logging out and back in.";
            }
        } finally {
            loading = false;
        }
    }

    async function handleResetSkin() {
        if (!$activeAccount) return;
        
        if (!confirm("Are you sure you want to reset your skin to the default?")) {
            return;
        }
        
        error = null;
        successMessage = null;
        loading = true;
        
        try {
            await invoke("reset_skin", {
                uuid: $activeAccount.id,
                accessToken: $activeAccount.access_token
            });
            
            successMessage = "Skin reset to default!";
            // Reload skin data to display the default skin
            await loadSkinData();
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
    
    {#if $accountLoading}
        <p class="loading">Loading account data...</p>
    {:else if $accountError}
        <p class="error">{$accountError}</p>
    {:else if !$activeAccount}
        <p class="note">Please log in to a Minecraft account to manage skins.</p>
    {:else if loading}
        <p class="loading">Loading skin data...</p>
    {:else if error}
        <p class="error">{error}</p>
    {:else}
        <div class="skin-container">
            <div class="skin-preview">
                <h4>Current Skin: {$activeAccount.minecraft_username || $activeAccount.username}</h4>
                {#if skinUrl}
                    <div class="skin-info">
                        <img src={skinUrl} alt="Minecraft Skin" class="skin-image" />
                        <p class="skin-model">
                            Model: {skinModel === 'slim' ? 'Slim (Alex)' : 'Classic (Steve)'}
                        </p>
                    </div>
                {:else}
                    <div class="no-skin">Default Steve/Alex skin</div>
                {/if}
            </div>
            
            <div class="skin-controls">
                <div class="variant-selector">
                    <h4>Choose skin model:</h4>
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
    
    .skin-info {
        display: flex;
        flex-direction: column;
        align-items: center;
    }
    
    .skin-model {
        margin: 8px 0 0 0;
        font-size: 0.9em;
        color: #666;
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
        flex-direction: column;
        gap: 10px;
    }
    
    .variant-selector label {
        display: flex;
        align-items: center;
        gap: 8px;
    }
    
    .skin-buttons {
        display: flex;
        gap: 10px;
        margin-top: 5px;
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