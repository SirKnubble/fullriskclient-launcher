<script lang="ts">
    import type { Profile, Mod, NoriskModIdentifier } from '$lib/stores/profileStore';
    import type { ModrinthVersion } from '$lib/types/modrinth';
    import type { NoriskModpacksConfig, NoriskPackDefinition } from '$lib/types/noriskPacks'; // Assuming these types are needed
    import type { FileNode } from '$lib/types/fileSystem'; // Add FileNode import
    import ProfileContent from './ProfileContent.svelte'; // Import ProfileContent
    import FileNodeViewer from './FileNodeViewer.svelte'; // Import FileNodeViewer
    import Modal from './Modal.svelte'; // Import Modal component
    import { invoke } from '@tauri-apps/api/core';
    import { copyProfile } from '$lib/api/profiles';

    // Local definition until $lib/types is fixed
    interface CustomModInfo {
        filename: string;
        is_enabled: boolean;
        path: string;
    }

    // Local definition for EventPayload
    interface EventPayload {
        event_id: string;
        event_type: string;
        target_id: string | null;
        message: string;
        progress: number | null;
        error: string | null;
    }

    // Define props passed from ProfileManager
    let { 
        profile,
        noriskPacksConfig, // Needed for pack name/mods
        profileCustomMods, // Direct list for this profile
        profileCustomModsLoading,
        profileCustomModsError,
        profileUpdates, // Set of mod IDs with updates for this profile
        // Props related to the globally active version dropdown
        activeVersionDropdown, // { profileId, modId } | null 
        versionsForCurrentDropdown, // ModrinthVersion[]
        errorForCurrentDropdown, // string | null
        hasAlternativeVersions, // boolean
        // NEW: Prop to check if THIS profile's dropdown is open
        isDropdownOpenForThisMod,
        // NEW: Prop to check if alternatives exist for THIS mod
        doAlternativesExistForThisMod,
        profileEvents // Added prop for events
    } = $props<{ 
        profile: Profile & { path?: string };
        noriskPacksConfig: NoriskModpacksConfig | null;
        profileCustomMods: CustomModInfo[] | undefined;
        profileCustomModsLoading: boolean;
        profileCustomModsError: string | null;
        profileUpdates: Set<string>;
        activeVersionDropdown: { profileId: string, modId: string } | null;
        versionsForCurrentDropdown: ModrinthVersion[];
        errorForCurrentDropdown: string | null;
        hasAlternativeVersions: boolean; // Kept for potential template logic if needed
        isDropdownOpenForThisMod: (modId: string) => boolean;
        doAlternativesExistForThisMod: (modId: string) => boolean;
        profileEvents: EventPayload[]; // Added prop for events
    }>();

    // State for FileNodeViewer
    let directoryStructure = $state<FileNode | null>(null);
    let directoryStructureLoading = $state(false);
    let directoryStructureError = $state<string | null>(null);
    let selectedFiles = $state(new Set<string>());
    
    // State for Modal
    let showFileViewerModal = $state(false);

    // Event dispatcher
    import { createEventDispatcher, onMount } from 'svelte';
    const dispatch = createEventDispatcher();

    // Neue Variablen für das Kopier-Modal
    let showCopyProfileModal = $state(false);
    let newProfileName = $state('');
    let copyProfileLoading = $state(false);
    let copyProfileError = $state<string | null>(null);

    // Manuelle Logging-Funktion für den Status
    function logStatus() {
        console.log("[FileNodeViewer Debug] Structure state:", { 
            directoryStructure, 
            directoryStructureLoading, 
            directoryStructureError, 
            selectedFiles: selectedFiles.size,
            hasRootNode: directoryStructure !== null,
            rootNodeDetails: directoryStructure ? {
                name: directoryStructure.name,
                path: directoryStructure.path,
                isDir: directoryStructure.is_dir,
                childrenCount: directoryStructure.children?.length || 0
            } : 'null'
        });
    }

    // --- Helper Functions (moved or adapted from ProfileManager) ---

    function getModDisplayName(mod: Mod): string {
        if (mod.display_name) return mod.display_name;
        switch (mod.source.type) {
            case 'modrinth': return mod.source.file_name ?? mod.source.project_id ?? 'Modrinth Mod';
            case 'local': return mod.source.file_name ?? 'Local Mod';
            case 'url': return mod.source.file_name ?? mod.source.url ?? 'URL Mod';
            case 'maven': return mod.source.coordinates ?? 'Maven Mod';
            case 'embedded': return mod.source.name ?? 'Embedded Mod';
            default: return `Unknown Mod (${mod.id})`;
        }
    }

    function getNoriskPackName(packId: string | null): string {
        if (!packId || !noriskPacksConfig?.packs) {
            return "Kein Norisk Pack";
        }
        const packDefinition = noriskPacksConfig.packs[packId];
        return packDefinition ? packDefinition.displayName : `Unbekannt (${packId})`;
    }

    function getNoriskPackDefinition(packId: string | null): NoriskPackDefinition | null {
        if (!packId || !noriskPacksConfig?.packs) {
            return null;
        }
        return noriskPacksConfig.packs[packId] ?? null;
    }

    function isNoriskModDisabled(packModId: string): boolean {
        if (!profile.selected_norisk_pack_id || !profile.disabled_norisk_mods_detailed) {
            return false; 
        }
        return profile.disabled_norisk_mods_detailed.some((identifier: NoriskModIdentifier) => 
            identifier.pack_id === profile.selected_norisk_pack_id &&
            identifier.mod_id === packModId &&
            identifier.game_version === profile.game_version &&
            identifier.loader === profile.loader
        );
    }

    // Shape alias needed by getModrinthVersionId
    type ModrinthSourceShape = { 
        type: 'modrinth'; 
        project_id: string; 
        version_id: string; 
        file_name: string;
        download_url: string;
        file_hash_sha1: string | null | undefined;
    };

    function getModrinthVersionId(source: Mod['source']): string | null {
        if (source.type === 'modrinth') {
            return (source as ModrinthSourceShape).version_id;
        }
        return null;
    }

    // --- Component Logic / Event Handlers ---

    // Helper to get the last event from the passed list
    function getLastEvent(events: EventPayload[]): EventPayload | null {
        return events[events.length - 1] || null;
    }

    // Example: Dispatch event when delete button is clicked
    function handleDeleteMod(modId: string) {
        dispatch('deleteMod', { modId });
    }
    
    function handleToggleMod(modId: string, event: Event) {
        dispatch('toggleMod', { modId, originalEvent: event });
    }

    function handleToggleNoriskMod(packModId: string, event: Event) {
        dispatch('toggleNoriskMod', { packModId, originalEvent: event });
    }

    function handleToggleCustomMod(filename: string, event: Event) {
        dispatch('toggleCustomMod', { filename, originalEvent: event });
    }

    function handleOpenVersionDropdown(modId: string) {
        dispatch('openVersionDropdown', { modId });
    }

    function handleVersionChange(mod: Mod, event: Event) {
        dispatch('changeVersion', { mod, originalEvent: event });
    }

    function handleCancelVersionChange() {
        dispatch('cancelVersionChange');
    }

    // Load directory structure and open modal
    async function openFileViewerModal() {
        showFileViewerModal = true;
        
        if (!directoryStructure) {
            await loadDirectoryStructure();
        }
    }
    
    // Close modal
    function closeFileViewerModal() {
        showFileViewerModal = false;
    }

    // New function to load directory structure using Tauri's invoke directly
    async function loadDirectoryStructure() {
        console.log("[FileNodeViewer Debug] Loading directory structure for profile:", profile.id);
        
        if (!profile.id) {
            console.error("[FileNodeViewer Debug] Cannot load structure - missing profile ID");
            directoryStructureError = 'Profile ID is missing';
            return;
        }
        
        directoryStructureLoading = true;
        directoryStructure = null;
        directoryStructureError = null;
        
        try {
            // Call the method using Tauri's invoke directly with generics
            console.log("[FileNodeViewer Debug] Calling Tauri command with args:", { profileId: profile.id });
            
            // Hier wird der Typ automatisch aus FileNode abgeleitet
            const result = await invoke<FileNode>('get_profile_directory_structure', { 
                profileId: profile.id 
            });
            
            console.log("[FileNodeViewer Debug] Received raw result:", result);
            
            // Prüfe und konvertiere das Ergebnis
            if (result) {
                directoryStructure = result;
                console.log("[FileNodeViewer Debug] Structure assigned to directoryStructure:", directoryStructure);
            } else {
                directoryStructureError = "Response was empty";
                console.error("[FileNodeViewer Debug] Empty response from Tauri");
            }
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'An unknown error occurred';
            console.error("[FileNodeViewer Debug] Exception while loading structure:", errorMsg, error);
            directoryStructureError = errorMsg;
        } finally {
            directoryStructureLoading = false;
            logStatus(); // Log status nach Statusänderung
            
            // Zusätzliche Prüfung nach einiger Zeit, um zu sehen, ob die Werte korrekt gesetzt wurden
            setTimeout(() => {
                console.log("[FileNodeViewer Debug] State after delay:", { 
                    directoryStructure,
                    directoryStructureLoading,
                    directoryStructureError
                });
            }, 500);
        }
    }

    // Handle file selection change
    function handleFileSelectionChange(event: CustomEvent) {
        console.log("[FileNodeViewer Debug] File selection changed:", event.detail);
        selectedFiles = new Set(event.detail.selectedFiles);
        dispatch('fileSelectionChange', { 
            profileId: profile.id,
            selectedFiles: [...selectedFiles]
        });
        logStatus(); // Log status nach Statusänderung
    }

    // Funktion zum Kopieren des Profils mit ausgewählten Dateien
    async function handleCopyProfile() {
        if (!newProfileName || !profile || selectedFiles.size === 0) {
            copyProfileError = 'Bitte einen Namen eingeben und Dateien auswählen';
            return;
        }
        
        copyProfileError = null;
        copyProfileLoading = true;
        
        try {
            // Konvertiere Set<string> zu Array für den Tauri-Aufruf
            const includeFilesArray = Array.from(selectedFiles);
            const profileNameToUse = newProfileName.trim();
            
            // Rufe den copy_profile Command auf
            const newProfileId = await copyProfile({
                source_profile_id: profile.id,
                new_profile_name: profileNameToUse,
                include_files: includeFilesArray
            });
            
            console.log('Neues Profil erstellt mit ID:', newProfileId);
            
            // Modal schließen und Reset
            showCopyProfileModal = false;
            newProfileName = '';
            
            // Optional: Redirect zur neuen Profilseite oder zeige eine Erfolgsmeldung
            showSuccessMessage(`Profil "${profileNameToUse}" erfolgreich erstellt`);
            
        } catch (error) {
            console.error('Fehler beim Kopieren des Profils:', error);
            copyProfileError = `Fehler beim Erstellen des Profils: ${error}`;
        } finally {
            copyProfileLoading = false;
        }
    }
    
    function showSuccessMessage(message: string) {
        // Hier könntest du eine Toast-Nachricht oder eine andere Benachrichtigung anzeigen
        console.log(message);
        // TODO: Implementiere eine richtige Erfolgsbenachrichtigung
    }
</script>

<!-- Moved HTML structure for a single profile item here -->
<div class="profile-item">
    <div class="profile-info">
        <div class="profile-details">
            <h4>{profile.name}</h4>
            <p>Version: {profile.game_version}</p>
            <p>Mod Loader: {profile.loader}</p>
            {#if profile.loader !== 'vanilla'}
                <p>Loader Version: {profile.loader_version || 'Default (Latest)'}</p>
            {/if}
            <p>Erstellt: {new Date(profile.created).toLocaleDateString()}</p>
            <p>Norisk Pack: {getNoriskPackName(profile.selected_norisk_pack_id)}</p>
            <p>Pfad: {profile.path || 'Unbekannt'}</p>
            {#if profile.last_played}
                <p>Zuletzt gespielt: {new Date(profile.last_played).toLocaleDateString()}</p>
            {/if}
            
            <!-- Letztes Event für dieses Profil -->
            {#if profileEvents && profileEvents.length > 0}
                {@const lastEvent = getLastEvent(profileEvents)} 
                {#if lastEvent}
                    <div class="last-event">
                        <p class="event-message">{lastEvent.message}</p>
                        <!-- Optional: Add progress bar or error display if needed -->
                    </div>
                {/if}
            {:else}
                <div class="last-event">
                    <p class="no-event">Kein Event</p>
                </div>
            {/if}
        </div>
        <div class="profile-actions">
            <!-- Dispatch events -->
            <button on:click={() => dispatch('launch')}>Launch</button>
            <button on:click={() => dispatch('edit')}>Edit</button>
            <button on:click={() => dispatch('delete')}>Delete</button>
            <button on:click={() => dispatch('openFolder')} title="Open profile folder">Open Folder</button>
            <button on:click={() => dispatch('importLocalMods')} title="Import local .jar mods">Import Mods</button>
            <!-- Changed button to open the modal instead of loading directory structure directly -->
            <button on:click={openFileViewerModal} title="View directory structure">Copy Files</button>
        </div>
    </div>

    <!-- Display Mods for this profile -->
    {#if profile.mods && profile.mods.length > 0}
        <!-- Filter mods based on game version AND loader compatibility -->
        {@const compatibleMods = profile.mods.filter((mod: Mod) => {
            // Check 1: Game Version
            const gameVersionMatch = mod.game_versions == null || 
                                   (mod.game_versions && mod.game_versions.includes(profile.game_version));
            
            // Check 2: Loader
            const loaderMatch = mod.associated_loader != null && 
                              mod.associated_loader === profile.loader;

            // Mod is compatible only if both match
            return gameVersionMatch && loaderMatch;
        })}
        <div class="mods-section user-mods">
            <!-- Use the length of the filtered list for the count -->
            <h4>Mods ({compatibleMods.length}):</h4> 
            <ul class="mods-list">
                {#each compatibleMods as mod (mod.id)} 
                    <!-- Removed the inner #if block as filtering is done above -->
                    {@const hasUpdate = profileUpdates.has(mod.id)}
                    {@const isDropdownOpen = isDropdownOpenForThisMod(mod.id)} 
                    {@const alternativesExist = doAlternativesExistForThisMod(mod.id)}
                    <li class="mod-item {mod.enabled ? 'enabled' : 'disabled'}">
                        <input
                            type="checkbox"
                            checked={mod.enabled}
                            aria-label={`Toggle mod ${getModDisplayName(mod)}`}
                            class="mod-toggle-checkbox"
                            on:change={(event) => handleToggleMod(mod.id, event)}
                        />
                        <span class="mod-name">{getModDisplayName(mod)}</span>
                        
                        {#if hasUpdate}
                            <span class="update-indicator" title="Update available">⬆️</span>
                        {/if}

                        <!-- Modrinth Version Changer -->
                        {#if mod.source.type === 'modrinth'}
                            {@const currentVersionId = getModrinthVersionId(mod.source)!}
                            <div class="mod-version-changer">
                                {#if isDropdownOpen}
                                     <!-- Dropdown ist offen -->
                                    {#if errorForCurrentDropdown} 
                                        <span class="version-info error" title={errorForCurrentDropdown}>Error!</span>
                                        <button class="cancel-version-btn" on:click={handleCancelVersionChange} title="Abbrechen">✖</button>
                                    {:else if alternativesExist} 
                                        <select class="version-select" on:change={(event) => handleVersionChange(mod, event)} value={currentVersionId}>
                                            <option value={currentVersionId} disabled>
                                                {mod.version ?? currentVersionId} (Aktuell)
                                            </option>
                                            {#each versionsForCurrentDropdown.filter((v: ModrinthVersion) => v.id !== currentVersionId) as version (version.id)} 
                                                <option value={version.id}>
                                                    {version.name} ({version.version_number}) - {version.version_type} [{new Date(version.date_published).toLocaleDateString()}]
                                                </option>
                                            {/each}
                                        </select>
                                        <button class="cancel-version-btn" on:click={handleCancelVersionChange} title="Abbrechen">✖</button>
                                    {:else}
                                         <span class="version-info">Keine alternativen Versionen.</span>
                                         <button class="cancel-version-btn" on:click={handleCancelVersionChange} title="Abbrechen">✖</button>
                                    {/if}
                                {:else}
                                     <!-- Dropdown geschlossen -->
                                     <span class="version-info">{mod.version ?? currentVersionId}</span>
                                     {#if alternativesExist} 
                                        <button 
                                            class="change-version-btn" 
                                            title="Version ändern"
                                            on:click={() => handleOpenVersionDropdown(mod.id)}>
                                            🔄
                                        </button>
                                     {/if}
                                {/if}
                            </div>
                        {/if}
                        <!-- *** Ende: Modrinth Version Changer *** -->

                        <!-- Delete Button -->
                        <button 
                            class="delete-mod-button" 
                            title={`Delete mod ${getModDisplayName(mod)}`}
                            on:click={() => handleDeleteMod(mod.id)}>
                            🗑️
                        </button>
                    </li>
                {/each}
            </ul>
        </div>
    {:else}
        <div class="mods-section no-mods">
            <p>No mods added via Launcher yet.</p>
        </div>
    {/if}

    <!-- Display Norisk Pack Mods -->
    {#if getNoriskPackDefinition(profile.selected_norisk_pack_id)} 
        {@const packDef = getNoriskPackDefinition(profile.selected_norisk_pack_id)!}
        {@const compatiblePackMods = packDef.mods?.filter(mod => {
            const gameVersion = profile.game_version;
            const loader = profile.loader;
            return mod.compatibility?.[gameVersion]?.[loader]; 
        }) ?? []}
    
        {#if compatiblePackMods.length > 0}
            <div class="mods-section pack-mods">
                <h4>Mods from {packDef.displayName} ({compatiblePackMods.length}):</h4> 
                <ul class="mods-list">
                    {#each compatiblePackMods as packMod (packMod.id)} 
                        {@const isDisabled = isNoriskModDisabled(packMod.id)}
                        <li class="mod-item pack-mod-item {isDisabled ? 'disabled' : 'enabled'}">
                            <input 
                                type="checkbox"
                                checked={!isDisabled}
                                aria-label={`Toggle Norisk Pack mod ${packMod.displayName}`}
                                class="mod-toggle-checkbox"
                                title={isDisabled ? 'Click to enable' : 'Click to disable'}
                                on:change={(event) => handleToggleNoriskMod(packMod.id, event)}
                            />
                            <span class="mod-name">{packMod.displayName}</span> 
                        </li>
                    {/each}
                </ul>
            </div>
        {/if}
    {/if}

    <!-- Custom (Local) Mods Section -->
    <div class="mods-section custom-mods">
        <h4>Lokale Mods:</h4>
        {#if profileCustomModsLoading}
            <p class="loading-text">Lade lokale Mods...</p>
        {:else if profileCustomModsError}
            <p class="error-message small">{profileCustomModsError}</p>
        {:else if profileCustomMods && profileCustomMods.length > 0}
            <ul class="mods-list">
                {#each profileCustomMods as customMod (customMod.filename)} 
                    <li class="mod-item local-mod-item {customMod.is_enabled ? 'enabled' : 'disabled'}">
                        <input 
                            type="checkbox"
                            checked={customMod.is_enabled}
                            aria-label={`Toggle local mod ${customMod.filename}`}
                            class="mod-toggle-checkbox"
                            title={customMod.is_enabled ? 'Click to disable' : 'Click to enable'}
                            on:change={(event) => handleToggleCustomMod(customMod.filename, event)}
                        />
                        <span class="mod-name">{customMod.filename}</span> 
                        <!-- Delete Button for Custom Mod -->
                        <button 
                            class="delete-mod-button custom-delete" 
                            title={`Delete custom mod ${customMod.filename}`}
                            on:click={() => dispatch('deleteCustomMod', { filename: customMod.filename })}>
                            🗑️
                        </button>
                    </li>
                {/each}
            </ul>
        {:else}
             <p class="no-mods">Keine lokalen Mods gefunden im `custom_mods` Ordner.</p>
        {/if}
    </div>

    <!-- Add the ProfileContent component for resourcepacks and shaderpacks -->
    <div class="additional-content">
        <ProfileContent profileId={profile.id} />
    </div>
    
    <!-- Modal for file viewer -->
    <Modal 
        show={showFileViewerModal} 
        title="Dateien kopieren - {profile.name}" 
        fullWidth={false}
        fullHeight={false}
        on:close={closeFileViewerModal}
    >
        <div class="file-viewer-modal-content">
            <div class="file-actions-top">
                <button class="reload-button" on:click={loadDirectoryStructure}>
                    Struktur neu laden
                </button>
            </div>
            
            <div class="modal-file-viewer">
                <FileNodeViewer 
                    rootNode={directoryStructure}
                    loading={directoryStructureLoading}
                    error={directoryStructureError}
                    selectedFiles={selectedFiles}
                    checkboxesEnabled={true}
                    hideRootNode={true}
                    preSelectPaths={["options.txt", "shaderpacks"]}
                    selectChildrenWithParent={true}
                    on:selectionChange={handleFileSelectionChange}
                />
            </div>
            
            <div class="file-actions-bottom">
                <span class="selected-count">
                    {selectedFiles.size} Dateien ausgewählt
                </span>
                <button 
                    class="copy-button" 
                    disabled={selectedFiles.size === 0}
                    on:click={() => showCopyProfileModal = true}
                >
                    Als Profil kopieren
                </button>
                <button 
                    class="delete-button" 
                    disabled={selectedFiles.size === 0}
                >
                    Ausgewählte Dateien löschen
                </button>
            </div>
        </div>
    </Modal>

    <!-- Kopiermodal nach dem vorhandenen FileViewer Modal einfügen: -->
    {#if showCopyProfileModal}
        <Modal title="Profil kopieren" show={showCopyProfileModal} on:close={() => showCopyProfileModal = false}>
            <div class="copy-profile-modal-content">
                <p>Erstelle ein neues Profil mit nur den ausgewählten Dateien ({selectedFiles.size} ausgewählt).</p>
                
                <div class="form-group">
                    <label for="newProfileName">Name des neuen Profils:</label>
                    <input 
                        type="text" 
                        id="newProfileName" 
                        bind:value={newProfileName} 
                        placeholder="Neuer Profilname" 
                        class="form-control"
                    />
                </div>
                
                {#if copyProfileError}
                    <div class="error-message">
                        {copyProfileError}
                    </div>
                {/if}
                
                <div class="modal-actions">
                    <button 
                        class="secondary-button"
                        on:click={() => showCopyProfileModal = false}
                    >
                        Abbrechen
                    </button>
                    <button 
                        class="primary-button"
                        disabled={!newProfileName || copyProfileLoading}
                        on:click={handleCopyProfile}
                    >
                        {copyProfileLoading ? 'Kopiere...' : 'Profil erstellen'}
                    </button>
                </div>
            </div>
        </Modal>
    {/if}
</div>

<style>
    /* Moved relevant styles from ProfileManager.svelte here */
    .profile-item {
        padding: 1em;
        margin-bottom: 1em;
        border: 1px solid #ccc;
        border-radius: 5px;
        cursor: default;
    }

    .profile-info {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
    }

    .profile-details {
        flex: 1;
    }

    .profile-details h4 {
        margin: 0 0 10px 0;
        font-size: 18px;
    }

    .profile-details p {
        margin: 5px 0;
        color: #666;
    }

    .profile-actions {
        display: grid; /* Use grid */
        grid-template-columns: repeat(3, auto); /* Adjusted for button layout */
        gap: 10px;
    }

    .profile-actions button {
        padding: 8px 12px; /* Slightly adjusted padding */
    }

    .profile-actions button:first-child {
        background-color: #2ecc71;
    }

    .profile-actions button:first-child:hover {
        background-color: #27ae60;
    }

    .profile-actions button:nth-child(2) {
        background-color: #f39c12;
    }

    .profile-actions button:nth-child(2):hover {
        background-color: #d35400;
    }

    .profile-actions button:nth-child(3) {
        background-color: #e74c3c;
    }

    .profile-actions button:nth-child(3):hover {
        background-color: #c0392b;
    }

    .profile-actions button:nth-child(4) {
        background-color: #3498db; /* Blue */
    }

    .profile-actions button:nth-child(4):hover {
        background-color: #2980b9;
    }

    .profile-actions button:nth-child(5) {
        background-color: #9b59b6; /* Purple */
    }

    .profile-actions button:nth-child(5):hover {
        background-color: #8e44ad;
    }

    .profile-actions button:nth-child(6) {
        background-color: #1abc9c; /* Teal */
    }

    .profile-actions button:nth-child(6):hover {
        background-color: #16a085;
    }

    .last-event {
        margin-top: 10px;
        padding: 8px;
        background-color: #f8f9fa;
        border-radius: 4px;
    }

    .event-message {
        margin: 0;
        font-size: 14px;
        color: #333;
    }

    .no-event {
        margin: 0;
        font-size: 14px;
        color: #666;
        font-style: italic;
    }

    .mods-section {
        margin-top: 0.8em;
        padding-top: 0.8em;
        border-top: 1px dashed #ddd;
    }

    .mods-section h4 {
        margin: 0 0 0.5em 0;
        font-size: 0.95em;
        color: #333;
    }

    .mods-list {
        list-style: none;
        padding-left: 1em;
        margin: 0;
        font-size: 0.9em;
        max-height: 150px; 
        overflow-y: auto; 
        padding-right: 5px; 
    }

    .mod-item {
        margin-bottom: 0.3em;
        display: flex; 
        align-items: center; 
        gap: 0.5em; 
        flex-wrap: wrap; 
    }

    .mod-item.disabled {
        color: #888;
        font-style: italic;
    }

    .mod-item .mod-name {
        flex-grow: 1; 
        margin-right: 10px; 
    }

    .mod-toggle-checkbox {
        flex-shrink: 0; 
        margin: 0;
        cursor: pointer;
    }

    .mod-version-changer {
        display: inline-flex; 
        align-items: center;
        gap: 5px;
        margin-left: auto; 
        margin-right: 5px; 
        font-size: 0.9em;
    }

    .version-info {
        color: #555;
        padding: 2px 4px;
        background-color: #eee;
        border-radius: 3px;
        white-space: nowrap; 
    }
    .version-info.loading {
        font-style: italic;
        color: #888;
    }
    .version-info.error {
        color: #e74c3c;
        background-color: #fbeae8;
        cursor: help; 
    }


    .change-version-btn, .cancel-version-btn {
        padding: 1px 5px;
        font-size: 0.9em;
        line-height: 1;
        background-color: #eee;
        color: #333;
        border: 1px solid #ccc;
        border-radius: 4px;
        cursor: pointer;
        transition: background-color 0.2s, border-color 0.2s;
    }
    .change-version-btn:hover, .cancel-version-btn:hover {
        background-color: #ddd;
        border-color: #bbb;
    }
    .cancel-version-btn {
        color: #e74c3c;
        background-color: #fbeae8;
        border-color: #e74c3c;
    }
     .cancel-version-btn:hover {
        background-color: #f8d7da;
        border-color: #d9534f;
    }

    .version-select {
        padding: 2px 5px;
        font-size: 0.9em;
        border: 1px solid #ccc;
        border-radius: 4px;
        max-width: 250px; 
    }
    .version-select option {
        font-size: 1em; 
    }


    .delete-mod-button {
       flex-shrink: 0; 
       margin-left: 0; 
       padding: 1px 5px; /* Smaller padding */
       font-size: 0.9em;
       line-height: 1;
       background-color: #eee;
       color: #e74c3c; /* Red color */
       border: 1px solid #ccc;
       border-radius: 4px;
       cursor: pointer;
       transition: background-color 0.2s, border-color 0.2s, color 0.2s;
    }

    .delete-mod-button:hover {
        background-color: #fbeae8; 
        border-color: #e74c3c;
        color: #c0392b; 
    }

    .mod-item.disabled .mod-name {
        color: #888;
        font-style: italic;
        text-decoration: line-through; 
    }

    .mods-section.no-mods p {
        font-style: italic;
        color: #666;
        font-size: 0.9em;
        margin: 0;
    }

    .mod-item {

    }
    .mod-name {

    }
    .update-indicator {

    }
    .mod-version-changer {
       margin-left: 0; 
    }
    .delete-mod-button {
        margin-left: 5px; 
    }

    .mods-section.custom-mods {
        margin-top: 0.5em; 
        padding-top: 0.5em;
        border-top: 1px dotted #aaa; 
    }

    .mods-section.custom-mods h4 {
        font-size: 0.9em;
        font-style: italic;
        color: #444;
    }

    .mod-item.local-mod-item {

    }
    
    .mod-item.local-mod-item.disabled .mod-name {
        color: #888;
        font-style: italic;
        text-decoration: line-through; 
    }

    .loading-text {
        font-style: italic;
        color: #666;
    }
    .error-message.small {
        font-size: 0.9em;
        padding: 5px 8px;
    }

    .additional-content {
        margin-top: 2rem;
        border-top: 1px solid #ddd;
        padding-top: 1rem;
    }

    /* File structure section styles */
    .file-structure-section {
        margin-top: 1rem;
        padding-top: 1rem;
        border-top: 1px solid #ddd;
    }

    .file-actions {
        margin-top: 0.5rem;
        display: flex;
        justify-content: flex-end;
    }

    .file-actions button {
        background-color: #e74c3c;
        color: white;
        border: none;
        padding: 0.5rem 1rem;
        border-radius: 4px;
        cursor: pointer;
        font-size: 0.9rem;
    }

    .file-actions button:hover {
        background-color: #c0392b;
    }

    /* Debug styles */
    .debug-info {
        background-color: #f8f9fa;
        border: 1px solid #ddd;
        border-radius: 4px;
        padding: 0.5rem;
        margin-bottom: 1rem;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .reload-button {
        background-color: #3498db;
        color: white;
        border: none;
        padding: 0.25rem 0.6rem; /* Reduziert */
        border-radius: 4px;
        cursor: pointer;
        font-size: 0.85rem; /* Reduziert */
    }

    .reload-button:hover {
        background-color: #2980b9;
    }

    .debug-status {
        font-family: monospace;
        background-color: #eee;
        padding: 0.5rem;
        border-radius: 4px;
        color: #333;
        font-size: 0.9rem;
        white-space: pre-wrap;
        margin: 0;
    }

    /* Modal content styles */
    .file-viewer-modal-content {
        display: flex;
        flex-direction: column;
        height: 100%;
        max-height: 500px; /* Begrenzte Höhe für das Popup */
    }

    .file-actions-top {
        display: flex;
        justify-content: flex-end;
        margin-bottom: 0.5rem; /* Reduziert von 1rem */
    }

    .modal-file-viewer {
        flex: 1;
        overflow: auto;
        max-height: 350px; /* Begrenzte Höhe für die Baumansicht */
        border: 1px solid #eee;
        border-radius: 4px;
        padding: 0.5rem;
        background-color: #f9f9f9;
    }

    .file-actions-bottom {
        display: flex;
        justify-content: space-between; /* Geändert von flex-end */
        align-items: center;
        margin-top: 0.5rem; /* Reduziert von 1rem */
        padding-top: 0.5rem; /* Reduziert von 1rem */
        border-top: 1px solid #eee;
        gap: 0.5rem; /* Reduziert von 1rem */
    }

    .selected-count {
        font-size: 0.85rem; /* Reduziert von 0.9rem */
        color: #666;
        white-space: nowrap;
    }

    .copy-button {
        background-color: #3498db;
        color: white;
        border: none;
        padding: 0.4rem 0.75rem; /* Reduziert von 0.5rem 1rem */
        border-radius: 4px;
        cursor: pointer;
        font-size: 0.85rem; /* Reduziert von 0.9rem */
    }

    .copy-button:hover {
        background-color: #2980b9;
    }

    .delete-button {
        background-color: #e74c3c;
        color: white;
        border: none;
        padding: 0.4rem 0.75rem; /* Reduziert von 0.5rem 1rem */
        border-radius: 4px;
        cursor: pointer;
        font-size: 0.85rem; /* Reduziert von 0.9rem */
    }

    .delete-button:hover {
        background-color: #c0392b;
    }

    /* Styles für das Kopier-Modal */
    .copy-profile-modal-content {
        padding: 1rem;
    }
    
    .form-group {
        margin-bottom: 1rem;
    }
    
    .form-group label {
        display: block;
        margin-bottom: 0.5rem;
        font-weight: bold;
    }
    
    .form-control {
        width: 100%;
        padding: 0.5rem;
        border: 1px solid #ccc;
        border-radius: 4px;
        font-size: 1rem;
    }
    
    .error-message {
        color: #e74c3c;
        background-color: #fce4e4;
        padding: 0.5rem;
        border-radius: 4px;
        margin-top: 1rem;
    }
    
    .modal-actions {
        display: flex;
        justify-content: flex-end;
        gap: 0.5rem;
        margin-top: 1.5rem;
    }
    
    .primary-button, .secondary-button {
        padding: 0.5rem 1rem;
        border-radius: 4px;
        cursor: pointer;
    }
    
    .primary-button {
        background-color: #3498db;
        color: white;
        border: none;
    }
    
    .primary-button:hover {
        background-color: #2980b9;
    }
    
    .primary-button:disabled {
        background-color: #95a5a6;
        cursor: not-allowed;
    }
    
    .secondary-button {
        background-color: #ecf0f1;
        color: #2c3e50;
        border: 1px solid #bdc3c7;
    }
    
    .secondary-button:hover {
        background-color: #bdc3c7;
    }
</style> 