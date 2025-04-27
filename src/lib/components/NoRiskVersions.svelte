<script lang="ts">
    import { invoke } from "@tauri-apps/api/core";
    import { convertFileSrc } from "@tauri-apps/api/core";
    import { onMount, onDestroy } from "svelte";
    import type { NoriskVersionsConfig } from '$lib/types/noriskVersions';
    import type { Profile } from '$lib/types/profile';
    import ProfileCopy from './ProfileCopy.svelte';
    import Modal from './Modal.svelte';
    import { appLocalDataDir } from '@tauri-apps/api/path';
    import { listen } from '@tauri-apps/api/event';
    import { notificationStore } from '$lib/stores/notificationStore';

    interface EventPayload {
        event_id: string;
        event_type: string;
        target_id: string | null;
        message: string;
        progress: number | null;
        error: string | null;
    }
    
    let standardProfiles: Profile[] = $state([]);
    let isLoading = $state(true);
    let debugInfo = $state<string[]>([]);
    let showDebugInfo = $state(true);
    let launcherDir: string | null = $state(null);
    let resolvedImages = $state<Record<string, string>>({});
    
    let launchingProfiles = $state<Set<string>>(new Set());
    let profileEvents = $state<Record<string, EventPayload[]>>({});
    
    let showCopyModal = $state(false);
    let selectedProfileForCopy: Profile | null = $state(null);
    
    let launchCheckInterval: number | undefined = undefined;
    
    function addDebugLog(message: string) {
        console.log(`[NoRiskVersions] ${message}`);
        debugInfo = [...debugInfo, `${new Date().toLocaleTimeString()}: ${message}`];
    }
    
    async function resolveImageSource(profile: Profile): Promise<string> {
        if (!profile.banner || !profile.banner.source) {
            return 'linear-gradient(135deg, #2c3e50, #3498db)';
        }
        
        try {
            const resolved = await invoke<string>('resolve_image_path', {
                imageSource: profile.banner.source,
                profileId: profile.id
            });
            
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
    
    async function getProfileBackground(profile: Profile): Promise<string> {
        if (resolvedImages[profile.id]) {
            return `url("${resolvedImages[profile.id]}")`;
        }
        
        const resolvedImage = await resolveImageSource(profile);
        
        if (resolvedImage.startsWith('linear-gradient')) {
            return resolvedImage;
        }
        
        resolvedImages[profile.id] = resolvedImage;
        return `url("${resolvedImage}") center / cover no-repeat`;
    }
    
    function isProfileLaunching(profileId: string): boolean {
        return launchingProfiles.has(profileId);
    }
    
    async function checkAllProfileLaunchStatuses() {
        if (standardProfiles.length === 0) return;

        const currentlyLaunching = new Set<string>();
        const promises = standardProfiles.map(async (profile) => {
            try {
                const isLaunching = await invoke<boolean>("is_profile_launching", {
                    profileId: profile.id
                });
                if (isLaunching) {
                    currentlyLaunching.add(profile.id);
                }
            } catch (error) {
                addDebugLog(`Error checking launch status for ${profile.id}: ${error}`);
            }
        });

        await Promise.all(promises);

        if (currentlyLaunching.size !== launchingProfiles.size || 
            ![...currentlyLaunching].every(id => launchingProfiles.has(id))) {
            addDebugLog(`Updating launching profiles. New set: ${JSON.stringify([...currentlyLaunching])}`);
            launchingProfiles = currentlyLaunching;
        }
    }
    
    async function setupEventListeners() {
        addDebugLog('Setting up state event listeners for messages...');
        
        await listen<EventPayload>('state_event', (event) => {
            const payload = event.payload;
            if (payload.target_id) {
                const profileId = payload.target_id;
                addDebugLog(`Received state_event for display: target=${profileId}, message=${payload.message}`);
                
                const currentEvents = profileEvents[profileId] || [];
                profileEvents = {
                    ...profileEvents,
                    [profileId]: [...currentEvents, payload]
                };
            }
        });
    }

    function getLastEvent(profileId: string): EventPayload | null {
        const events = profileEvents[profileId] || [];
        return events.length > 0 ? events[events.length - 1] : null;
    }
    
    onMount(async () => {
        try {
            await setupEventListeners();
            
            addDebugLog("Component mounted, fetching standard profiles config...");
            isLoading = true;
            
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
            
            if (standardProfiles.length > 0) {
                addDebugLog("Pre-resolving profile backgrounds...");
                for (const profile of standardProfiles) {
                    await getProfileBackground(profile);
                }
                addDebugLog("Background resolution complete");
            }
            
            addDebugLog(`State updated with ${standardProfiles.length} profiles (array: ${Array.isArray(standardProfiles)})`);

            await checkAllProfileLaunchStatuses();

            addDebugLog("Starting periodic launch status check timer...");
            launchCheckInterval = setInterval(checkAllProfileLaunchStatuses, 1000);

        } catch (error) {
            console.error("[NoRiskVersions] Failed to load standard profiles:", error);
            const errorStr = error instanceof Error ? error.message : String(error);
            addDebugLog(`Error loading profiles: ${errorStr}`);
            notificationStore.error(`Fehler beim Laden der Standard Profile: ${errorStr}`);
            standardProfiles = [];
        } finally {
            isLoading = false;
            addDebugLog(`Loading completed. isLoading set to false. standardProfiles length: ${standardProfiles?.length ?? 'undefined'}`);
        }
    });

    onDestroy(() => {
        if (launchCheckInterval) {
            addDebugLog("Clearing launch status check interval.");
            clearInterval(launchCheckInterval);
        }
    });
    
    async function handleProfileAction(id: string) {
        const isLaunching = isProfileLaunching(id);
        if (isLaunching) {
            // Optimistically set state to NOT launching
            addDebugLog(`Optimistically setting profile ${id} to NOT launching`);
            const originalLaunchingProfiles = new Set(launchingProfiles); // Store original state for potential revert
            const newLaunchingProfiles = new Set(launchingProfiles);
            newLaunchingProfiles.delete(id);
            launchingProfiles = newLaunchingProfiles;
            
            try {
                addDebugLog(`Aborting launch for profile ID: ${id}`);
                await invoke("abort_profile_launch", { profileId: id });
                addDebugLog(`Abort command sent for profile ${id}`);
                // Timer will eventually confirm or correct the state if needed
            } catch (error) {
                // Revert optimistic update on immediate failure
                addDebugLog(`Reverting optimistic cancel state for profile ${id} due to error`);
                launchingProfiles = originalLaunchingProfiles; // Restore original set
                
                const errorMsg = error instanceof Error ? error.message : String(error);
                console.error("[NoRiskVersions] Failed to abort profile launch:", error);
                addDebugLog(`Error aborting launch: ${errorMsg}`);
                notificationStore.error(`Fehler beim Abbrechen des Profilstarts: ${errorMsg}`);
            }
        } else {
            // Optimistically set launching state
            addDebugLog(`Optimistically setting profile ${id} to launching`);
            launchingProfiles = new Set(launchingProfiles).add(id);
            
            try {
                addDebugLog(`Launching standard profile with ID: ${id}`);
                await invoke("launch_profile", { id });
                addDebugLog(`Launch command sent for profile ${id}`);
                // Timer will eventually confirm or correct the state
            } catch (error) {
                // Revert optimistic update on immediate failure
                addDebugLog(`Reverting optimistic launch state for profile ${id} due to error`);
                const newLaunchingProfiles = new Set(launchingProfiles);
                newLaunchingProfiles.delete(id);
                launchingProfiles = newLaunchingProfiles;
                
                const errorMsg = error instanceof Error ? error.message : String(error);
                console.error("[NoRiskVersions] Failed to launch standard profile:", error);
                addDebugLog(`Error launching profile: ${errorMsg}`);
                notificationStore.error(`Fehler beim Starten des Profils: ${errorMsg}`);
            }
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
        notificationStore.success('Profil erfolgreich kopiert!');
        closeCopyProfileModal();
    }
    
    async function addTestProfiles() {
        addDebugLog("Adding test profiles for debugging");
        addDebugLog(`Added ${standardProfiles.length} test profiles`);
    }
</script>

<div class="norisk-versions">
    <h3>NoRisk Standard Versionen</h3>
    
    {#if isLoading}
        <div class="loading">Lade NoRisk Versionen...</div>
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
                {@const isLaunching = isProfileLaunching(profile.id)}
                {@const lastEvent = getLastEvent(profile.id)}
                <div class="profile-card" style={bgStyle}>
                    <div class="profile-header">
                        <h4>{profile.name}</h4>
                        <span class="mc-version">{profile.game_version} • {profile.loader}</span>
                    </div>
                    <p class="description">{profile.description}</p>
                    
                    {#if lastEvent}
                        <div class="profile-event">
                            <p class="event-message" title={lastEvent.message}>
                                {lastEvent.message}
                            </p>
                        </div>
                    {/if}
                    
                    <div class="actions">
                        <button 
                            class={isLaunching ? "cancel-button" : "launch-button"}
                            on:click={() => handleProfileAction(profile.id)}
                        >
                            {isLaunching ? "Abbrechen" : "Starten"}
                            {#if isLaunching}
                                <span class="loading-spinner"></span>
                            {/if}
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
        color: white;
        text-shadow: 0 1px 3px rgba(0, 0, 0, 0.6);
        min-height: 180px;
        display: flex;
        flex-direction: column;
        transition: box-shadow 0.2s, transform 0.2s;
    }
    
    .profile-card:hover {
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
        transform: translateY(-2px);
    }
    
    .profile-card::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.3);
        z-index: 1;
        pointer-events: none;
    }
    
    .profile-card > * {
        position: relative;
        z-index: 2;
    }
    
    .profile-header {
        margin-bottom: 10px;
    }
    
    .profile-header h4 {
        margin: 0 0 5px 0;
        color: inherit;
        font-size: 1.2rem;
    }
    
    .mc-version {
        font-size: 0.8em;
        color: inherit;
        background-color: rgba(0, 0, 0, 0.3);
        padding: 2px 6px;
        border-radius: 4px;
    }
    
    .description {
        margin: 10px 0;
        font-size: 0.9em;
        color: inherit;
        line-height: 1.4;
        flex-grow: 1;
    }
    
    .actions {
        display: flex;
        gap: 10px;
        margin-top: auto;
        padding-top: 15px;
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
    
    .launch-button {
        background-color: #2ecc71 !important;
        color: white;
        font-weight: bold;
    }
    
    .launch-button:hover {
        background-color: #27ae60 !important;
    }
    
    .cancel-button {
        background-color: #e74c3c !important;
        color: white !important;
        animation: pulse 1.5s infinite;
    }
    
    .cancel-button:hover {
        background-color: #c0392b !important;
        animation: none;
    }
    
    @keyframes pulse {
        0% { opacity: 1; }
        50% { opacity: 0.7; }
        100% { opacity: 1; }
    }
    
    .loading-spinner {
        display: inline-block;
        width: 12px;
        height: 12px;
        margin-left: 8px;
        border: 2px solid rgba(255, 255, 255, 0.3);
        border-radius: 50%;
        border-top-color: #fff;
        animation: spin 1s linear infinite;
        vertical-align: middle;
    }
    
    @keyframes spin {
        to { transform: rotate(360deg); }
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
    
    .profile-event {
        background-color: rgba(0, 0, 0, 0.15);
        border-radius: 4px;
        padding: 8px;
        margin-bottom: 10px;
    }
    
    .event-message {
        margin: 0;
        font-size: 0.9em;
        color: inherit;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
</style> 