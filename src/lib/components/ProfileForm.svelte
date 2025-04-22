<script lang="ts">
    import { invoke } from "@tauri-apps/api/core";
    import { createEventDispatcher, onMount, tick } from 'svelte';
    // Import Profile without state if possible, or handle Partial correctly
    import type { Profile as ProfileFromStore } from "$lib/stores/profileStore"; 
    // Import Norisk Pack types from the new file
    import type { NoriskModpacksConfig, NoriskPackDefinition } from '$lib/types/noriskPacks';
    // Import the new settings types from the correct file
    import type { ProfileSettings, MemorySettings } from '$lib/types/settings';
    import type { FabricVersionInfo } from '$lib/types/fabric'; // Import Fabric type

    // Local interface matching the expected prop type
    interface MinecraftVersion {
        id: string;
        type: string;
        // Remove url, time, releaseTime if not strictly needed by this component
    }

    // Define Props type using the local MinecraftVersion interface
    interface Props {
        minecraftVersions: MinecraftVersion[]; // Use local interface
        isEditing: boolean;
        // Use Partial to make all fields optional, including state if it were present
        // Ensure editingProfile might contain settings with memory_mb
        editingProfile: Partial<ProfileFromStore & { settings: ProfileSettings }> | null; 
    }

    // Get props using $props()
    const { 
        minecraftVersions = [], 
        isEditing = false,     
        editingProfile = null  
    }: Props = $props();
    
    const dispatch = createEventDispatcher<{
        success: void;
        cancel: void;
    }>();

    // --- Initial State Calculation ---
    // Determine initial type and version *before* creating state variables
    // This helps avoid effects overwriting initial edit values immediately.
    let calculatedInitialType = 'release';
    let calculatedInitialVersion = '';

    if (isEditing && editingProfile?.game_version && minecraftVersions.length > 0) {
        const initialFoundVersion = minecraftVersions.find(v => v.id === editingProfile.game_version);
        if (initialFoundVersion) {
            calculatedInitialType = initialFoundVersion.type;
            calculatedInitialVersion = initialFoundVersion.id;
            console.log(`Edit mode: Initializing with found version: ${calculatedInitialVersion} (Type: ${calculatedInitialType})`);
        } else {
            console.warn(`Edit mode: Version ${editingProfile.game_version} not found in list. Falling back.`);
            // Fallback logic (e.g., latest release)
            const latestRelease = minecraftVersions.find(v => v.type === 'release');
            calculatedInitialVersion = latestRelease?.id ?? (minecraftVersions[0]?.id ?? '');
            calculatedInitialType = latestRelease?.type ?? (minecraftVersions[0]?.type ?? 'release');
        }
    } else if (minecraftVersions.length > 0) {
        // Default for new profile: latest release
        const latestRelease = minecraftVersions.find(v => v.type === 'release');
        calculatedInitialVersion = latestRelease?.id ?? (minecraftVersions[0]?.id ?? '');
        calculatedInitialType = latestRelease?.type ?? (minecraftVersions[0]?.type ?? 'release');
        console.log(`New mode: Initializing with latest release: ${calculatedInitialVersion} (Type: ${calculatedInitialType})`);
    }

    // Form state - initialized using props OR defaults
    let profileName = $state(editingProfile?.name ?? "");
    let selectedType = $state(calculatedInitialType);
    let selectedVersion = $state(calculatedInitialVersion);
    let selectedModLoader = $state(editingProfile?.loader ?? "vanilla");
    let loaderVersion = $state(editingProfile?.loader_version ?? null);
    let selectedNoriskPackId = $state(editingProfile?.selected_norisk_pack_id ?? ""); // Initialize with profile or empty string for "Keine"
    // Use separate state variables for min and max memory, initialize from editingProfile or defaults
    let memoryMinMB = $state(editingProfile?.settings?.memory?.min ?? 1024); // Default to 1024 MB min RAM
    let memoryMaxMB = $state(editingProfile?.settings?.memory?.max ?? 2048); // Default to 2048 MB max RAM
    let isCreating = $state(false);
    let isSubmitting = $state(false);
    let errorMessage = $state<string | null>(null);

    // State for available loader versions
    let availableLoaderVersions = $state<string[]>([]);
    let isLoadingLoaderVersions = $state(false);
    let loaderVersionsError = $state<string | null>(null);

    // *NEW* State to track last fetched combination
    let lastFetchedLoader: string | null = $state(null);
    let lastFetchedMcVersion: string | null = $state(null);

    // --- System RAM State ---
    let totalSystemRamMB = $state<number | null>(null);
    let systemRamError = $state<string | null>(null);

    // Norisk Packs state
    let noriskPacksConfig = $state<NoriskModpacksConfig | null>(null);
    let isLoadingPacks = $state(true);
    let packLoadError = $state<string | null>(null);
    let hasMounted = false; // Flag to check if initial mount is complete

    // Lifecycle and Data Loading
    onMount(async () => {
        await loadNoriskPacks();
        await fetchSystemRam(); // Fetch system RAM on mount
        hasMounted = true; // Set hasMounted *after* initial loads
        // Initial fetch is handled by the effect now, checking hasMounted
    });

    async function loadNoriskPacks() {
        isLoadingPacks = true;
        packLoadError = null;
        try {
            console.log("Fetching Norisk packs config...");
            const config: NoriskModpacksConfig = await invoke("get_norisk_packs");
            noriskPacksConfig = config;
            console.log("Norisk packs config loaded:", config);
        } catch (error) {
            console.error("Fehler beim Laden der Norisk Packs:", error);
            packLoadError = `Failed to load Norisk packs: ${error instanceof Error ? error.message : String(error)}`;
            noriskPacksConfig = null; // Reset on error
        } finally {
            isLoadingPacks = false;
            hasMounted = true; // Set flag after all initial loading
        }
    }

    // --- Function to fetch system RAM ---
    async function fetchSystemRam() {
        systemRamError = null;
        try {
            const ram: number = await invoke("get_system_ram_mb");
            totalSystemRamMB = ram;
            console.log(`Total system RAM detected: ${ram} MB`);
        } catch (error) {
            console.error("Failed to fetch system RAM:", error);
            systemRamError = `Could not determine system RAM: ${error instanceof Error ? error.message : String(error)}`;
            // Fallback max if detection fails? Or leave it unbound?
            // totalSystemRamMB = 16384; // Example fallback
        }
    }

    // Initialisiere die Versionen wenn die Komponente geladen wird
    $effect(() => {
        console.log('ProfileForm received versions:', minecraftVersions);
        if (minecraftVersions && minecraftVersions.length > 0) {
            if (isEditing && editingProfile) {
                // Wenn wir ein Profil bearbeiten, verwende dessen Version
                const version = minecraftVersions.find(
                    (v: MinecraftVersion) => v.id === editingProfile?.game_version
                );
                if (version) {
                    selectedType = version.type;
                    selectedVersion = version.id;
                }
            } else {
                // Für neue Profile, setze die neueste Release-Version
                updateSelectedVersion();
            }
        }
    });

    // Keep the $effect that reacts to manual type changes
    $effect(() => {
        if (minecraftVersions && minecraftVersions.length > 0 && hasMounted) { 
            console.log(`Type Change Effect (Mounted): Type=${selectedType}, Initial=${calculatedInitialType}`);
            updateSelectedVersion();
        }
    });

    // *MODIFIED* Effect: Fetch loader versions only when combination changes after mount
    $effect(() => {
        const currentLoader = selectedModLoader;
        const currentMcVersion = selectedVersion;

        // Only run after mount and if MC version is selected
        if (!hasMounted || !currentMcVersion) {
            return; 
        }

        console.log(`Effect Check: Loader=${currentLoader}, MCVersion=${currentMcVersion}, LastLoader=${lastFetchedLoader}, LastMCVersion=${lastFetchedMcVersion}`);

        const needsFetching = (currentLoader === 'fabric' || currentLoader === 'forge' || currentLoader === 'neoforge');
        const combinationChanged = (currentLoader !== lastFetchedLoader || currentMcVersion !== lastFetchedMcVersion);

        if (needsFetching && combinationChanged) {
            console.log(`--> Fetching loader versions for ${currentLoader} / ${currentMcVersion}`);
            // Update last fetched *before* the async call
            lastFetchedLoader = currentLoader;
            lastFetchedMcVersion = currentMcVersion;
            fetchAvailableLoaderVersions(currentLoader, currentMcVersion);
        } else if (!needsFetching && (lastFetchedLoader !== null || lastFetchedMcVersion !== null)) {
             // Reset if switching away from fabric/forge to vanilla, etc.
             console.log(`--> Resetting loader versions (Switched from ${lastFetchedLoader}/${lastFetchedMcVersion} to ${currentLoader}/${currentMcVersion})`);
             lastFetchedLoader = null; // Clear last fetched state
             lastFetchedMcVersion = null;
             resetLoaderVersionsState();
        }
    });

    function resetLoaderVersionsState() {
        availableLoaderVersions = [];
        loaderVersion = null; 
        isLoadingLoaderVersions = false;
        loaderVersionsError = null;
    }

    async function fetchAvailableLoaderVersions(loaderType: string, minecraftVersion: string) {
        resetLoaderVersionsState(); // Reset first
        isLoadingLoaderVersions = true;
        let currentSelectedLoaderVersion = loaderVersion; // Store current selection before fetch

        try {
            let fetchedVersions: string[] = [];
            if (loaderType.toLowerCase() === 'fabric') {
                const versionsResult: FabricVersionInfo[] = await invoke('get_fabric_loader_versions', {
                    minecraftVersion: minecraftVersion
                });
                fetchedVersions = versionsResult.map(v => `${v.loader.version}${v.loader.stable ? ' (stable)' : ''}`);
                // Fabric API might return empty array for unsupported versions, not error
            } else if (loaderType.toLowerCase() === 'forge') {
                fetchedVersions = await invoke('get_forge_versions', {
                    minecraftVersion: minecraftVersion
                });
            } else if (loaderType.toLowerCase() === 'neoforge') {
                fetchedVersions = await invoke('get_neoforge_versions', {
                    minecraftVersion: minecraftVersion
                });
            }

            availableLoaderVersions = fetchedVersions;
            console.log('Available loader versions:', availableLoaderVersions);

            if (availableLoaderVersions.length === 0) {
                loaderVersionsError = `No ${loaderType} versions found for ${minecraftVersion}.`;
                loaderVersion = null; // Ensure selection is cleared
            } else {
                // Attempt to re-select the previously selected version *if* it exists in the new list
                // Or default to the first (latest) if no previous selection or previous is invalid
                if (currentSelectedLoaderVersion && availableLoaderVersions.includes(currentSelectedLoaderVersion)) {
                    loaderVersion = currentSelectedLoaderVersion;
                } else {
                    loaderVersion = availableLoaderVersions[0]; // Default to first/latest
                }
            }

        } catch (error: any) {
            console.error(`Error fetching ${loaderType} versions:`, error);
            loaderVersionsError = `Error fetching versions: ${error.message || error}`;
            availableLoaderVersions = [];
            loaderVersion = null; // Ensure selection is cleared on error
        } finally {
            isLoadingLoaderVersions = false;
            await tick(); // Allow UI to update
        }
    }

    function updateSelectedVersion() {
        const filtered = getFilteredVersions();
        console.log('Filtered versions:', filtered);
        
        if (filtered.length > 0) {
            // Setze die neueste Version des ausgewählten Typs
            const latestVersion = filtered[0]; // Die Versionen sind bereits nach Zeit sortiert
            console.log('Setting latest version for type:', selectedType, latestVersion.id);
            selectedVersion = latestVersion.id;
        }
    }

    function getFilteredVersions() {
        // Filter should now work with the simplified local type
        return minecraftVersions
            .filter((version: MinecraftVersion) => version.type === selectedType)
            // Remove sort if releaseTime is no longer available
            // .sort((a: MinecraftVersion, b: MinecraftVersion) => { ... });
    }

    // Convert packs HashMap to array for easy iteration in template
    let packEntries = $derived(noriskPacksConfig?.packs 
        ? Object.entries(noriskPacksConfig.packs)
        : []);

    // Log packEntries whenever it changes for debugging
    $effect(() => {
        console.log("Pack Entries for Dropdown:", packEntries);
    });

    async function submitProfile() {
        if (!profileName) {
            errorMessage = "Bitte einen Profilnamen eingeben.";
            return;
        }
        errorMessage = null; // Clear previous errors
        isSubmitting = true;

        // Ensure the ID is correctly set to null if "Keine" is selected
        const packIdToSend = selectedNoriskPackId === "" ? null : selectedNoriskPackId;

        // Prepare settings object with the correct memory structure
        const settingsToSend: ProfileSettings = {
            ...(editingProfile?.settings ?? {}), // Keep existing settings like java_path etc.
            memory: {                         // Update memory field
                min: 1024, // Set min RAM to a fixed default (e.g., 1024MB)
                max: memoryMaxMB
            },
            // Ensure other fields expected by ProfileSettings have defaults if not in editingProfile
            java_path: editingProfile?.settings?.java_path ?? null,
            resolution: editingProfile?.settings?.resolution ?? null,
            fullscreen: editingProfile?.settings?.fullscreen ?? false,
            extra_args: editingProfile?.settings?.extra_args ?? [],
        };

        try {
            const profileParams = {
                name: profileName,
                game_version: selectedVersion,
                loader: selectedModLoader,
                // *** Send the selected loaderVersion ***
                loader_version: (selectedModLoader === 'fabric' || selectedModLoader === 'forge' || selectedModLoader === 'neoforge') ? loaderVersion : null, 
                selected_norisk_pack_id: packIdToSend,
                settings: settingsToSend 
            };

            if (isEditing && editingProfile?.id) {
                console.log("Updating profile:", editingProfile.id, profileParams);
                await invoke("update_profile", { id: editingProfile.id, params: profileParams });
            } else {
                console.log("Creating profile:", profileParams);
                await invoke("create_profile", { params: profileParams });
            }
            dispatch('success');
        } catch (error: unknown) {
            console.error("Fehler beim Speichern des Profils:", error);
            errorMessage = `Fehler: ${error instanceof Error ? error.message : String(error)}`;
        } finally {
            isSubmitting = false;
            selectedModLoader = "vanilla";
            loaderVersion = null;
            selectedNoriskPackId = ""; // Reset to "Keine"
            memoryMaxMB = 2048; // Reset RAM max to 2048 MB
            if (minecraftVersions.length > 0) updateSelectedVersion(); // Set default version
        }
    }

    function handleSubmit() {
        submitProfile();
    }

    function handleCancel() {
        dispatch('cancel');
    }

    function resetFormDefaults() {
        profileName = "";
        selectedType = "release";
        selectedVersion = "";
        selectedModLoader = "vanilla";
        loaderVersion = null;
        availableLoaderVersions = [];
        loaderVersionsError = null;
        isLoadingLoaderVersions = false;
        // Also reset last fetched state on full form reset
        lastFetchedLoader = null;
        lastFetchedMcVersion = null;
        selectedNoriskPackId = "";
        memoryMaxMB = 2048;
        if (minecraftVersions.length > 0) updateSelectedVersion();
    }
</script>

<div class="form-group">
    <input
        type="text"
        placeholder="Profilname"
        bind:value={profileName}
        aria-label="Profilname"
    />
    <div class="version-selectors">
        <select bind:value={selectedType} class="version-select" aria-label="Minecraft Versionstyp">
            <option value="release">Release</option>
            <option value="snapshot">Snapshot</option>
            <option value="old_beta">Old Beta</option>
            <option value="old_alpha">Old Alpha</option>
        </select>
        <select bind:value={selectedVersion} class="version-select" aria-label="Minecraft Version" disabled={getFilteredVersions().length === 0}>
            {#if getFilteredVersions().length > 0}
                {#each getFilteredVersions() as version (version.id)}
                    <option value={version.id}>{version.id}</option>
                {/each}
            {:else}
                <option value="" disabled>Keine Versionen für diesen Typ</option>
            {/if}
        </select>
    </div>
    <div class="loader-selectors"> <!-- Group loader selects -->
        <select bind:value={selectedModLoader} aria-label="Modloader" class="loader-select">
            <option value="vanilla">Vanilla</option>
            <option value="fabric">Fabric</option>
            <option value="forge">Forge</option>
            <option value="neoforge">NeoForge</option>
            <option value="quilt">Quilt</option>
        </select>

        <!-- *NEW* Loader Version Selector -->
        {#if selectedModLoader === 'fabric' || selectedModLoader === 'forge' || selectedModLoader === 'neoforge'}
            <select 
                bind:value={loaderVersion} 
                aria-label="Loader Version" 
                disabled={isLoadingLoaderVersions || availableLoaderVersions.length === 0}
                class="loader-version-select"
            >
                <option value={null}>-- Select Version --</option>
                {#if isLoadingLoaderVersions}
                    <option value={null} disabled>Loading...</option>
                {:else if availableLoaderVersions.length > 0}
                    {#each availableLoaderVersions as version (version)}
                        <option value={version}>{version}</option>
                    {/each}
                {:else if loaderVersionsError}
                    <option value={null} disabled>{loaderVersionsError}</option>
                {:else}
                    <option value={null} disabled>No versions found</option> 
                {/if}
            </select>
        {/if}
    </div>
    {#if loaderVersionsError && (selectedModLoader === 'fabric' || selectedModLoader === 'forge' || selectedModLoader === 'neoforge')}
         <p class="error-message small">Loader Version Error: {loaderVersionsError}</p>
    {/if}

    <!-- Norisk Pack Selector -->
    <select bind:value={selectedNoriskPackId} aria-label="Norisk Pack" disabled={isLoadingPacks} class="full-width-select">
        <option value="">Kein Norisk Pack</option> 
        {#if isLoadingPacks}
            <option disabled>Lade Packs...</option>
        {:else if packLoadError}
             <option disabled>Fehler beim Laden der Packs</option>
        {:else if packEntries.length > 0}
             {#each packEntries as [id, pack] (id)} 
                 <option value={id}>{pack.displayName}</option>
             {/each}
         {:else}
             <option disabled>Keine Norisk Packs gefunden</option>
         {/if}
     </select>
    {#if packLoadError} <p class="error-message small">{packLoadError}</p> {/if}

    <!-- RAM Allocation Section -->
    <div class="ram-setting">
        <label for="ram-max-slider">Maximaler RAM (MB):</label>
        {#if systemRamError}<p class="error-message small">{systemRamError}</p>{/if}
        <div class="ram-control"> 
            <input 
                type="range" 
                id="ram-max-slider"
                min="512" 
                max={totalSystemRamMB ?? 16384}
                step="512" 
                bind:value={memoryMaxMB} 
                aria-label="Maximale RAM Zuweisung Slider"
                class="ram-slider"
            />
            <input 
                type="number" 
                min="512" 
                max={totalSystemRamMB ?? 16384}
                step="512" 
                bind:value={memoryMaxMB} 
                aria-label="Maximale RAM Zuweisung Eingabe (MB)"
                class="ram-input"
            />
            <span class="ram-display">{memoryMaxMB} MB</span>
        </div> 
    </div>

    <div class="form-actions">
        <button
            on:click={handleSubmit}
            disabled={isSubmitting || !profileName || !selectedVersion}
            class:loading={isSubmitting}
        >
            {#if isSubmitting}
                {#if isEditing}
                    Speichere...
                {:else}
                    Erstelle...
                {/if}
            {:else}
                {#if isEditing}
                    Profil speichern
                {:else}
                    Profil erstellen
                {/if}
            {/if}   
        </button>
        {#if isEditing}
            <button type="button" on:click={handleCancel} disabled={isSubmitting} class="cancel-button">
                Abbrechen
            </button>
        {/if}

        <!-- Import Button (only shown when creating) -->
        {#if !isEditing}
            <button 
                type="button" 
                class="import-button" 
                on:click={async () => {
                    errorMessage = null; // Clear previous errors
                    isSubmitting = true; // Show loading state maybe?
                    try {
                        console.log('Attempting to import profile from file...');
                        await invoke('import_profile_from_file');
                        console.log('Import command finished successfully (check backend logs for details).');
                        // Optionally dispatch success or trigger refresh
                        // dispatch('success'); // Might close the modal prematurely if processing takes time
                    } catch (error: unknown) {
                        console.error("Fehler beim Importieren des Profils:", error);
                        errorMessage = `Import Fehler: ${error instanceof Error ? error.message : String(error)}`;
                    } finally {
                        isSubmitting = false;
                    }
                }}
                disabled={isSubmitting}
            >
                 Import from File (.mrpack)
            </button>
        {/if}

    </div>

    {#if errorMessage} <p class="error-message">{errorMessage}</p> {/if}

    <!-- Debug Info -->
    <div class="debug-info">
        <h4>Debug</h4>
        <p><strong>Type:</strong> {selectedType}</p>
        <p><strong>Version:</strong> {selectedVersion}</p>
        <p><strong>ModLoader:</strong> {selectedModLoader}</p>
        <p><strong>Loader Version:</strong> {loaderVersion || 'None'}</p>
        <p><strong>Name:</strong> {profileName}</p>
        <p><strong>Norisk Pack ID:</strong> {selectedNoriskPackId || 'None'}</p>
        <p><strong>Memory Max (MB):</strong> {memoryMaxMB}</p>
        <p><strong>Packs Loading:</strong> {isLoadingPacks}</p>
        <!-- <p><strong>Pack Entries:</strong> {JSON.stringify(packEntries)}</p> --> 
    </div>
</div>

<style>
    .form-group {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        padding: 1rem 0;
    }

    .version-selectors, .loader-selectors { /* Apply to both groups */
        display: flex;
        gap: 1rem;
    }

    .version-select, .loader-select, .loader-version-select { /* Style all selects similarly */
        flex: 1; /* Make selects share space */
        min-width: 100px; /* Prevent them getting too small */
    }

    .loader-version-select { /* Specific style if needed */
        flex-basis: 50%; /* Example: give it equal space */
    }

    .full-width-select {
        width: 100%; /* Make norisk pack select full width */
    }

    .form-actions {
        display: flex;
        gap: 1rem;
        margin-top: 0.5rem;
    }

    button {
        padding: 0.5rem 1rem;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        transition: background-color 0.2s, opacity 0.2s;
    }

    button:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }

    button.loading {
        opacity: 0.8;
    }

    button.cancel-button {
        background-color: #f44336;
    }
     button.cancel-button:hover:not(:disabled) {
        background-color: #d32f2f; 
    }

    /* Style for the new import button */
    button.import-button {
        background-color: #5bc0de; /* Info blue */
        color: white;
    }
    button.import-button:hover:not(:disabled) {
        background-color: #31b0d5;
    }

    input, select {
        padding: 0.5rem;
        border: 1px solid var(--input-border-color, #ccc);
        border-radius: 4px;
        background-color: var(--input-bg-color, white);
        color: var(--text-color, inherit);
    }

     select:disabled {
        opacity: 0.6;
        background-color: var(--input-disabled-bg-color, #eee);
     }

    .debug-info {
        margin-top: 1rem;
        padding: 1rem;
        background-color: #f5f5f5;
        border: 1px solid #ddd;
        border-radius: 4px;
        font-family: monospace;
        font-size: 12px;
    }

    .debug-info h4 {
        margin: 0 0 0.5rem 0;
        color: #333;
    }

    .debug-info p {
        margin: 0.25rem 0;
    }

    .error-message {
        color: #f44336;
        font-size: 0.9em;
        margin-top: 0.5rem;
    }

    .error-message.small {
        font-size: 0.85em;
        padding: 0.3rem 0.6rem;
        margin-top: 0;
        margin-bottom: 0.5rem;
    }

    .ram-setting {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .ram-setting > label { /* Target the main label */
        font-weight: bold;
        margin-bottom: 0.5rem; /* More space before the group */
    }

    .ram-control { /* A single row (min or max) */
        display: flex;
        align-items: center;
        gap: 1rem;
    }

    .ram-control label { /* Label for Min/Max */
        min-width: 40px; /* Give labels some space */
        font-weight: normal;
        text-align: right;
    }

    .ram-slider {
        flex-grow: 1;
    }

    .ram-input {
        width: 80px; /* Fixed width for the number input */
        text-align: right;
    }

    .ram-display {
        font-weight: bold;
        min-width: 70px; /* Ensure space for text */
        text-align: right;
    }
</style> 