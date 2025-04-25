<script lang="ts">
    import { invoke } from "@tauri-apps/api/core";
    import { convertFileSrc } from "@tauri-apps/api/core";
    import { onMount } from "svelte";
    import type { NoriskVersionsConfig } from '$lib/types/noriskVersions';
    import type { Profile, ImageSource } from '$lib/types/profile';
    import ProfileCopy from './ProfileCopy.svelte';
    import Modal from './Modal.svelte'; // Assuming you have a Modal component
    import { appLocalDataDir } from '@tauri-apps/api/path';
    
    let standardProfiles: Profile[] = $state([]);
    let isLoading = $state(true);
    let errorMessage: string | null = $state(null);
    let debugInfo = $state<string[]>([]);
    let showDebugInfo = $state(true); // Always show debug info for troubleshooting
    let launcherDir: string | null = $state(null);
    let resolvedImages = $state<Record<string, string>>({});
    
    // State for the copy profile modal
    let showCopyModal = $state(false);
    let selectedProfileForCopy: Profile | null = $state(null);
    
    function addDebugLog(message: string) {
        console.log(`[NoRiskVersions] ${message}`);
        debugInfo = [...debugInfo, `${new Date().toLocaleTimeString()}: ${message}`];
    }
    
    // Function to resolve image source using the backend command
    async function resolveImageSource(profile: Profile): Promise<string> {
        if (!profile.banner || !profile.banner.source) {
            // Return a default gradient if no banner is specified
            return 'linear-gradient(135deg, #2c3e50, #3498db)';
        }
        
        try {
            const resolved = await invoke<string>('resolve_image_path', {
                imageSource: profile.banner.source,
                profileId: profile.id
            });
            
            // Use convertFileSrc for local file paths to handle security restrictions
            let finalPath = resolved;
            if (resolved.startsWith('file://')) {
                const localPath = resolved.replace('file://', '');
                finalPath = convertFileSrc(localPath);
                addDebugLog(`Converting ${resolved} to ${finalPath}`);
            }
            
            addDebugLog(`Resolved image for ${profile.id}: ${finalPath}`);
            return finalPath;
        } catch (error) {
            addDebugLog(`Error resolving image for ${profile.id}: ${error}`);
            return 'linear-gradient(135deg, #2c3e50, #3498db)';
        }
    }
    
    // Function to get the resolved image for a profile
    async function getProfileBackground(profile: Profile): Promise<string> {
        // Return cached resolved path if available
        if (resolvedImages[profile.id]) {
            return `url("${resolvedImages[profile.id]}")`;
        }
        
        const resolvedImage = await resolveImageSource(profile);
        
        // Check if it's a URL or a gradient (fallback)
        if (resolvedImage.startsWith('linear-gradient')) {
            return resolvedImage;
        }
        
        // Store in cache for future use
        resolvedImages[profile.id] = resolvedImage;
        return `url("${resolvedImage}") center / cover no-repeat`;
    }
    
    onMount(async () => {
        try {
            addDebugLog("Component mounted, fetching standard profiles config...");
            isLoading = true;
            
            // Get launcher directory for resolving relative paths
            try {
                launcherDir = await appLocalDataDir();
                addDebugLog(`Launcher directory: ${launcherDir}`);
            } catch (e) {
                addDebugLog(`Failed to get launcher directory: ${e}`);
            }
            
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
            
            // Pre-resolve all profile backgrounds
            if (standardProfiles.length > 0) {
                addDebugLog("Pre-resolving profile backgrounds...");
                for (const profile of standardProfiles) {
                    // Just invoke the function that caches results
                    await getProfileBackground(profile);
                }
                addDebugLog("Background resolution complete");
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
            await invoke("launch_profile", { id });
            addDebugLog(`Launch command sent for profile ${id}`);
        } catch (error) {
            console.error("[NoRiskVersions] Failed to launch standard profile:", error);
            errorMessage = error instanceof Error ? error.message : String(error);
            addDebugLog(`Error launching profile: ${errorMessage}`);
        }
    }
    
    function openCopyProfileModal(profile: Profile) {
        addDebugLog(`Opening copy modal for profile with ID: ${profile.id}`);
        selectedProfileForCopy = profile;
        showCopyModal = true;
    }
    
    function closeCopyProfileModal() {
        addDebugLog(`Closing copy profile modal`);
        showCopyModal = false;
        selectedProfileForCopy = null;
    }
    
    function handleCopySuccess() {
        addDebugLog(`Profile copied successfully`);
        closeCopyProfileModal();
        // If you have a global notification system, you could show a success message here
    }
    
    // Function to manually test with mock data
    async function addTestProfiles() {
        addDebugLog("Adding test profiles for debugging");
        /*standardProfiles = [
            {
                id: "test-1",
                name: "Test NoRisk 1.8.9",
                game_version: "1.8.9",
                loader: "forge",
                description: "Test profile for debugging"
            },
            {
                id: "test-2",
                name: "Test NoRisk 1.12.2",
                game_version: "1.12.2",
                loader: "forge",
                description: "Another test profile for debugging"
            }
        ];*/
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
                {@const bgStyle = resolvedImages[profile.id] ? 
                    `background: url("${resolvedImages[profile.id]}") center / cover no-repeat` : 
                    'background: linear-gradient(135deg, #2c3e50, #3498db)'}
                <div class="profile-card" style={bgStyle}>
                    <div class="profile-header">
                        <h4>{profile.name}</h4>
                        <span class="mc-version">{profile.game_version} • {profile.loader}</span>
                    </div>
                    <p class="description">{profile.description}</p>
                    <div class="actions">
                        <button class="launch-btn" on:click={() => launchStandardProfile(profile.id)}>
                            Starten
                        </button>
                        <button class="copy-btn" on:click={() => openCopyProfileModal(profile)}>
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
    
    <!-- Copy Profile Modal -->
    {#if showCopyModal && selectedProfileForCopy}
        <Modal>
            <ProfileCopy 
                sourceProfileId={selectedProfileForCopy.id}
                sourceProfileName={selectedProfileForCopy.name}
                onClose={closeCopyProfileModal}
                onSuccess={handleCopySuccess}
            />
        </Modal>
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
        position: relative;
        overflow: hidden;
        color: white; /* Default text color, can be overridden by style */
        text-shadow: 0 1px 3px rgba(0, 0, 0, 0.6); /* Add text shadow for better readability on image backgrounds */
        min-height: 180px; /* Ensure enough height even with minimal content */
        display: flex;
        flex-direction: column;
        transition: box-shadow 0.2s, transform 0.2s;
    }
    
    .profile-card:hover {
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
        transform: translateY(-2px);
    }
    
    /* Add a dark overlay for better text readability on image backgrounds */
    .profile-card::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.3); /* Semi-transparent overlay */
        z-index: 1;
        pointer-events: none; /* Allow clicking through to the card */
    }
    
    /* Ensure all content is above the overlay */
    .profile-card > * {
        position: relative;
        z-index: 2;
    }
    
    .profile-header {
        margin-bottom: 10px;
    }
    
    .profile-header h4 {
        margin: 0 0 5px 0;
        color: inherit; /* Use the color from the parent */
        font-size: 1.2rem;
    }
    
    .mc-version {
        font-size: 0.8em;
        color: inherit; /* Use the color from the parent */
        background-color: rgba(0, 0, 0, 0.3);
        padding: 2px 6px;
        border-radius: 4px;
    }
    
    .description {
        margin: 10px 0;
        font-size: 0.9em;
        color: inherit; /* Use the color from the parent */
        line-height: 1.4;
        flex-grow: 1; /* Allow description to expand to fill space */
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
        font-weight: bold;
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