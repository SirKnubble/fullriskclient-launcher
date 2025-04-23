<script lang="ts">
    import { invoke } from "@tauri-apps/api/core";
    import { onMount } from "svelte";
    import type { NoriskVersionProfile, NoriskVersionsConfig } from '$lib/types/noriskVersions';
    
    let standardProfiles: NoriskVersionProfile[] = $state([]);
    let isLoading = $state(true);
    let errorMessage: string | null = $state(null);
    let debugInfo = $state<string[]>([]);
    let showDebugInfo = $state(true); // Always show debug info for troubleshooting
    
    function addDebugLog(message: string) {
        console.log(`[NoRiskVersions] ${message}`);
        debugInfo = [...debugInfo, `${new Date().toLocaleTimeString()}: ${message}`];
    }
    
    onMount(async () => {
        try {
            addDebugLog("Component mounted, fetching standard profiles config...");
            isLoading = true;
            
            addDebugLog("Calling invoke('get_standard_profiles')");
            const config = await invoke<NoriskVersionsConfig>("get_standard_profiles");
            
            addDebugLog(`Received config type: ${typeof config}`);
            
            if (config === undefined || config === null) {
                addDebugLog("WARNING: Config is undefined/null, initializing profiles to empty array");
                standardProfiles = [];
            } else {
                addDebugLog(`Config object: ${JSON.stringify(config)}`);
                
                // Check if the config has the standard_profiles property
                if (config.profiles && Array.isArray(config.profiles)) {
                    addDebugLog(`Config contains ${config.profiles.length} standard profiles`);
                    standardProfiles = config.profiles;
                    
                    if (config.profiles.length > 0) {
                        addDebugLog(`First profile: ${JSON.stringify(config.profiles[0])}`);
                    } else {
                        addDebugLog("Received empty array of standard profiles");
                    }
                } else {
                    addDebugLog("WARNING: Config does not contain standard_profiles array, using empty array");
                    standardProfiles = [];
                }
            }
            
            addDebugLog(`State updated with ${standardProfiles.length} profiles (array: ${Array.isArray(standardProfiles)})`);
        } catch (error) {
            console.error("[NoRiskVersions] Failed to load standard profiles:", error);
            const errorStr = error instanceof Error ? error.message : String(error);
            errorMessage = errorStr;
            addDebugLog(`Error loading profiles: ${errorStr}`);
            addDebugLog(`Error object: ${JSON.stringify(error, Object.getOwnPropertyNames(error))}`);
            
            // Initialize to empty array on error
            standardProfiles = [];
        } finally {
            isLoading = false;
            addDebugLog(`Loading completed. isLoading set to false. standardProfiles length: ${standardProfiles?.length ?? 'undefined'}`);
        }
    });
    
    async function launchStandardProfile(id: string) {
        try {
            addDebugLog(`Launching standard profile with ID: ${id}`);
            await invoke("launch_standard_profile", { id });
            addDebugLog(`Launch command sent for profile ${id}`);
        } catch (error) {
            console.error("[NoRiskVersions] Failed to launch standard profile:", error);
            errorMessage = error instanceof Error ? error.message : String(error);
            addDebugLog(`Error launching profile: ${errorMessage}`);
        }
    }
    
    async function copyStandardProfile(id: string) {
        try {
            addDebugLog(`Copying standard profile with ID: ${id}`);
            await invoke("copy_standard_profile", { id });
            addDebugLog(`Copy command sent for profile ${id}`);
        } catch (error) {
            console.error("[NoRiskVersions] Failed to copy standard profile:", error);
            errorMessage = error instanceof Error ? error.message : String(error);
            addDebugLog(`Error copying profile: ${errorMessage}`);
        }
    }
    
    // Function to manually test with mock data
    async function addTestProfiles() {
        addDebugLog("Adding test profiles for debugging");
        standardProfiles = [
            {
                id: "test-1",
                display_name: "Test NoRisk 1.8.9",
                mc_version: "1.8.9",
                loader: "forge",
                description: "Test profile for debugging"
            },
            {
                id: "test-2",
                display_name: "Test NoRisk 1.12.2",
                mc_version: "1.12.2",
                loader: "forge",
                description: "Another test profile for debugging"
            }
        ];
        addDebugLog(`Added ${standardProfiles.length} test profiles`);
    }
</script>

<div class="norisk-versions">
    <h3>NoRisk Standard Versionen</h3>
    
    {#if isLoading}
        <div class="loading">Lade NoRisk Versionen...</div>
    {:else if errorMessage}
        <div class="error-message">
            <strong>Fehler beim Laden:</strong> {errorMessage}
        </div>
    {:else if !standardProfiles || standardProfiles.length === 0}
        <div class="no-versions">
            <p>Keine NoRisk Standard Versionen verfügbar.</p>
            <button class="debug-btn" on:click={addTestProfiles}>
                Test-Profile hinzufügen (Debug)
            </button>
        </div>
    {:else}
        <div class="profiles-grid">
            {#each standardProfiles as profile (profile.id)}
                <div class="profile-card">
                    <div class="profile-header">
                        <h4>{profile.display_name}</h4>
                        <span class="mc-version">{profile.mc_version} • {profile.loader}</span>
                    </div>
                    <p class="description">{profile.description}</p>
                    <div class="actions">
                        <button class="launch-btn" on:click={() => launchStandardProfile(profile.id)}>
                            Starten
                        </button>
                        <button class="copy-btn" on:click={() => copyStandardProfile(profile.id)}>
                            Als Profil kopieren
                        </button>
                    </div>
                </div>
            {/each}
        </div>
    {/if}
    
    {#if showDebugInfo && debugInfo.length > 0}
        <div class="debug-info">
            <details open>
                <summary>Debug Information ({debugInfo.length} logs)</summary>
                <ul>
                    {#each debugInfo as log}
                        <li>{log}</li>
                    {/each}
                </ul>
            </details>
        </div>
    {/if}
</div>

<style>
    .norisk-versions {
        margin-bottom: 30px;
        padding: 20px;
        border: 1px solid #ddd;
        border-radius: 4px;
    }
    
    h3 {
        margin-top: 0;
        margin-bottom: 15px;
        color: #333;
    }
    
    .loading {
        padding: 15px;
        color: #666;
        font-style: italic;
        text-align: center;
    }
    
    .error-message {
        padding: 10px;
        background-color: #fbeae8;
        color: #e74c3c;
        border: 1px solid #e74c3c;
        border-radius: 4px;
        margin-bottom: 15px;
    }
    
    .no-versions {
        padding: 15px;
        color: #666;
        font-style: italic;
        text-align: center;
    }
    
    .debug-btn {
        margin-top: 10px;
        background-color: #f39c12;
        color: white;
        padding: 5px 10px;
        font-size: 0.8em;
    }
    
    .debug-btn:hover {
        background-color: #e67e22;
    }
    
    .profiles-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
        gap: 15px;
    }
    
    .profile-card {
        border: 1px solid #eee;
        border-radius: 6px;
        padding: 15px;
        background-color: #f9f9f9;
        transition: box-shadow 0.2s, transform 0.2s;
    }
    
    .profile-card:hover {
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
        transform: translateY(-2px);
    }
    
    .profile-header {
        margin-bottom: 10px;
    }
    
    .profile-header h4 {
        margin: 0 0 5px 0;
        color: #333;
    }
    
    .mc-version {
        font-size: 0.8em;
        color: #666;
        background-color: #eee;
        padding: 2px 6px;
        border-radius: 4px;
    }
    
    .description {
        margin: 10px 0;
        font-size: 0.9em;
        color: #555;
        line-height: 1.4;
    }
    
    .actions {
        display: flex;
        gap: 10px;
        margin-top: 15px;
    }
    
    button {
        flex: 1;
        padding: 8px 12px;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 0.9em;
        transition: background-color 0.2s;
    }
    
    .launch-btn {
        background-color: #2ecc71;
        color: white;
    }
    
    .launch-btn:hover {
        background-color: #27ae60;
    }
    
    .copy-btn {
        background-color: #3498db;
        color: white;
    }
    
    .copy-btn:hover {
        background-color: #2980b9;
    }
    
    .debug-info {
        margin-top: 20px;
        padding: 10px;
        background-color: #f7f7f7;
        border: 1px dashed #ccc;
        border-radius: 4px;
        font-family: monospace;
        font-size: 12px;
    }
    
    .debug-info summary {
        cursor: pointer;
        font-weight: bold;
        margin-bottom: 8px;
    }
    
    .debug-info ul {
        margin: 0;
        padding-left: 20px;
        max-height: 300px;
        overflow-y: auto;
    }
    
    .debug-info li {
        margin-bottom: 3px;
    }
</style> 