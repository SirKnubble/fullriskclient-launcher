<script lang="ts">
    import { invoke } from '@tauri-apps/api/core';
    import { onMount } from 'svelte';

    interface Profile {
        name: string;
        minecraft_version: string;
        game_directory: string;
        java_version: number;
        modloader: string;
        settings: {
            memory: {
                min: string;
                max: string;
            };
        };
    }

    let profiles: Profile[] = [];
    let selectedProfile: string = '';
    let isLaunching = false;
    let launchError: string | null = null;

    onMount(async () => {
        await loadProfiles();
    });

    async function loadProfiles() {
        try {
            await invoke('load_profiles');
            profiles = await invoke<Profile[]>('get_profiles');
        } catch (error) {
            console.error('Fehler beim Laden der Profile:', error);
        }
    }

    async function launchGame() {
        if (!selectedProfile) return;
        
        try {
            isLaunching = true;
            launchError = null;
            await invoke('launch_minecraft', { profileName: selectedProfile });
            isLaunching = false;
        } catch (error: any) {
            console.error(error);
            launchError = error.message || error;
            isLaunching = false;
        }
    }
</script>

<div class="game-launcher">
    <h2>Minecraft starten</h2>

    <div class="launch-form">
        <select bind:value={selectedProfile}>
            <option value="">Profil auswählen</option>
            {#each profiles as profile}
                <option value={profile.name}>
                    {profile.name} ({profile.minecraft_version} - {profile.modloader})
                </option>
            {/each}
        </select>

        <button on:click={launchGame} disabled={isLaunching || !selectedProfile}>
            {#if isLaunching}
                Startet...
            {:else}
                Minecraft starten
            {/if}
        </button>
    </div>

    {#if launchError}
        <div class="error">{launchError}</div>
    {/if}
</div>

<style>
    .game-launcher {
        padding: 20px;
        max-width: 800px;
        margin: 0 auto;
    }

    .game-launcher h2 {
        font-size: 24px;
        margin-bottom: 20px;
    }

    .launch-form {
        display: flex;
        flex-direction: column;
        gap: 10px;
        margin-bottom: 20px;
    }

    select {
        padding: 8px;
        border: 1px solid #ddd;
        border-radius: 4px;
    }

    button {
        padding: 8px 16px;
        background-color: #4a90e2;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
    }

    button:hover:not(:disabled) {
        background-color: #357abd;
    }

    button:disabled {
        background-color: #ccc;
        cursor: not-allowed;
    }

    .error {
        color: #e74c3c;
        padding: 10px;
        border: 1px solid #e74c3c;
        border-radius: 4px;
        background-color: #fde8e8;
    }
</style> 