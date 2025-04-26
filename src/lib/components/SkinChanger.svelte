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

    // Define interface for local skin type
    interface LocalSkin {
        id: string;
        name: string;
        base64_data: string;
        variant: string;
        description: string;
        added_at: string;
    }

    let skinData: MinecraftProfile | null = $state(null);
    let skinUrl: string | null = $state(null);
    let skinModel: string | null = $state(null);
    let skinVariant: string = $state("classic"); // "classic" or "slim"
    let loading: boolean = $state(false);
    let error: string | null = $state(null);
    let successMessage: string | null = $state(null);

    // Local skins state
    let localSkins: LocalSkin[] = $state([]);
    let localSkinsLoading: boolean = $state(false);
    let localSkinsError: string | null = $state(null);
    let selectedLocalSkin: LocalSkin | null = $state(null);

    // Editing state
    let editingSkin: LocalSkin | null = $state(null);
    let editSkinName: string = $state("");
    let editSkinVariant: string = $state("classic");

    onMount(async () => {
        // Initialize accounts if not already loaded
        if (!$activeAccount) {
            await initializeAccounts();
        }

        // Load skin data if we have an active account
        await loadSkinData();

        // Load local skins regardless of account status
        await loadLocalSkins();
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

            successMessage = "Skin updated successfully and added to your local library!";
            // Reload skin data to display the new skin
            await loadSkinData();
            // Reload local skins to show the newly added skin
            await loadLocalSkins();
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

    // Load all local skins from the database
    async function loadLocalSkins() {
        localSkinsLoading = true;
        localSkinsError = null;

        try {
            const skins = await invoke<LocalSkin[]>("get_all_skins");
            localSkins = skins;
            console.log(`Loaded ${skins.length} local skins`);
        } catch (err) {
            console.error("Error loading local skins:", err);
            localSkinsError = err instanceof Error ? err.message : String(err);
        } finally {
            localSkinsLoading = false;
        }
    }

    // Apply a local skin to the current user
    async function applyLocalSkin(skin: LocalSkin) {
        if (!$activeAccount) {
            error = "You must be logged in to apply a skin";
            return;
        }

        error = null;
        successMessage = null;
        loading = true;
        selectedLocalSkin = skin;

        try {
            // Set the skin variant based on the selected skin
            skinVariant = skin.variant;

            // Apply the skin using the base64 data
            await invoke("apply_skin_from_base64", {
                uuid: $activeAccount.id,
                accessToken: $activeAccount.access_token,
                base64Data: skin.base64_data,
                skinVariant: skin.variant
            });

            successMessage = `Successfully applied skin: ${skin.name} (${skin.variant} model)`;

            // Reload skin data to display the new skin
            await loadSkinData();
        } catch (err) {
            console.error("Error applying local skin:", err);
            if (typeof err === 'object' && err !== null && 'message' in err) {
                error = String(err.message);
            } else {
                error = `Failed to apply skin: ${String(err)}`;
            }
        } finally {
            loading = false;
        }
    }

    // Start editing a skin
    function startEditSkin(skin: LocalSkin, event: MouseEvent) {
        // Prevent the click from triggering the parent's click handler (applyLocalSkin)
        event.stopPropagation();

        editingSkin = skin;
        editSkinName = skin.name;
        editSkinVariant = skin.variant;
    }

    // Cancel editing a skin
    function cancelEditSkin() {
        editingSkin = null;
    }

    // Save edited skin properties
    async function saveEditSkin() {
        if (!editingSkin) return;

        error = null;
        successMessage = null;
        localSkinsError = null;
        localSkinsLoading = true;

        try {
            // Call the backend to update the skin properties
            const updatedSkin = await invoke<LocalSkin | null>("update_skin_properties", {
                id: editingSkin.id,
                name: editSkinName,
                variant: editSkinVariant
            });

            if (updatedSkin) {
                successMessage = `Successfully updated skin: ${updatedSkin.name}`;

                // Update the skin in the local list
                const index = localSkins.findIndex(s => s.id === updatedSkin.id);
                if (index !== -1) {
                    localSkins[index] = updatedSkin;
                }

                // If this was the selected skin, update the selection
                if (selectedLocalSkin?.id === updatedSkin.id) {
                    selectedLocalSkin = updatedSkin;
                }
            } else {
                localSkinsError = "Skin not found. It may have been deleted.";
            }
        } catch (err) {
            console.error("Error updating skin properties:", err);
            if (typeof err === 'object' && err !== null && 'message' in err) {
                localSkinsError = String(err.message);
            } else {
                localSkinsError = `Failed to update skin: ${String(err)}`;
            }
        } finally {
            localSkinsLoading = false;
            editingSkin = null; // Exit edit mode
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

        <!-- Local Skins Section -->
        <div class="local-skins-section">
            <h3>Local Skin Library</h3>

            {#if localSkinsLoading}
                <p class="loading">Loading local skins...</p>
            {:else if localSkinsError}
                <p class="error">{localSkinsError}</p>
            {:else if localSkins.length === 0}
                <p class="note">No local skins found. Upload skins to add them to your library.</p>
            {:else}
                {#if editingSkin}
                    <div class="edit-skin-form">
                        <h4>Edit Skin Properties</h4>
                        <div class="form-group">
                            <label for="skinName">Skin Name:</label>
                            <input 
                                type="text" 
                                id="skinName" 
                                bind:value={editSkinName} 
                                placeholder="Enter skin name"
                            />
                        </div>
                        <div class="form-group">
                            <label>Skin Variant:</label>
                            <div class="variant-selector">
                                <label>
                                    <input type="radio" bind:group={editSkinVariant} value="classic" />
                                    Classic (Steve)
                                </label>
                                <label>
                                    <input type="radio" bind:group={editSkinVariant} value="slim" />
                                    Slim (Alex)
                                </label>
                            </div>
                        </div>
                        <div class="edit-buttons">
                            <button on:click={saveEditSkin} disabled={localSkinsLoading}>
                                Save Changes
                            </button>
                            <button on:click={cancelEditSkin} class="cancel-button" disabled={localSkinsLoading}>
                                Cancel
                            </button>
                        </div>
                    </div>
                {:else}
                    <div class="local-skins-grid">
                        {#each localSkins as skin (skin.id)}
                            <div 
                                class="local-skin-item" 
                                class:selected={selectedLocalSkin?.id === skin.id}
                                on:click={() => applyLocalSkin(skin)}
                            >
                                <div class="local-skin-preview">
                                    <img 
                                        src={`data:image/png;base64,${skin.base64_data}`} 
                                        alt={skin.name} 
                                        class="local-skin-image" 
                                    />
                                </div>
                                <div class="local-skin-info">
                                    <p class="local-skin-name">{skin.name}</p>
                                    <p class="local-skin-variant">{skin.variant === 'slim' ? 'Slim (Alex)' : 'Classic (Steve)'}</p>
                                </div>
                                <button 
                                    class="edit-button" 
                                    on:click={(e) => startEditSkin(skin, e)}
                                    title="Edit skin properties"
                                >
                                    Edit
                                </button>
                            </div>
                        {/each}
                    </div>
                {/if}
            {/if}
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

    /* Local Skins Section Styles */
    .local-skins-section {
        margin-top: 30px;
        border-top: 1px solid #ddd;
        padding-top: 20px;
    }

    .local-skins-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
        gap: 15px;
        margin-top: 15px;
    }

    .local-skin-item {
        border: 2px solid #ddd;
        border-radius: 5px;
        padding: 10px;
        cursor: pointer;
        transition: all 0.2s;
        background-color: #f9f9f9;
    }

    .local-skin-item:hover {
        border-color: #4a90e2;
        transform: translateY(-2px);
        box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
    }

    .local-skin-item.selected {
        border-color: #2ecc71;
        background-color: #e8f8f5;
    }

    .local-skin-preview {
        display: flex;
        justify-content: center;
        margin-bottom: 8px;
    }

    .local-skin-image {
        width: 64px;
        height: 64px;
        image-rendering: pixelated;
        background-color: #e0e0e0;
    }

    .local-skin-info {
        text-align: center;
    }

    .local-skin-name {
        margin: 0 0 4px 0;
        font-weight: bold;
        font-size: 0.9em;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .local-skin-variant {
        margin: 0;
        font-size: 0.8em;
        color: #666;
    }

    /* Edit button styles */
    .edit-button {
        position: absolute;
        top: 5px;
        right: 5px;
        padding: 3px 8px;
        background-color: rgba(74, 144, 226, 0.8);
        color: white;
        border: none;
        border-radius: 3px;
        font-size: 0.8em;
        cursor: pointer;
        opacity: 0;
        transition: opacity 0.2s;
    }

    .local-skin-item {
        position: relative; /* For absolute positioning of edit button */
    }

    .local-skin-item:hover .edit-button {
        opacity: 1;
    }

    .edit-button:hover {
        background-color: rgba(53, 122, 189, 1);
    }

    /* Edit form styles */
    .edit-skin-form {
        background-color: #f9f9f9;
        border: 1px solid #ddd;
        border-radius: 5px;
        padding: 15px;
        margin-top: 15px;
    }

    .form-group {
        margin-bottom: 15px;
    }

    .form-group label {
        display: block;
        margin-bottom: 5px;
        font-weight: bold;
    }

    .form-group input[type="text"] {
        width: 100%;
        padding: 8px;
        border: 1px solid #ddd;
        border-radius: 4px;
        font-size: 1em;
    }

    .edit-buttons {
        display: flex;
        gap: 10px;
        margin-top: 15px;
    }

    .cancel-button {
        background-color: #e74c3c;
    }

    .cancel-button:hover:not(:disabled) {
        background-color: #c0392b;
    }
</style> 
