<script lang="ts">
    import { invoke } from "@tauri-apps/api/core";
    import { onMount } from "svelte";
    import { listen } from '@tauri-apps/api/event';
    import ProfileForm from './ProfileForm.svelte';
    import ProcessList from './ProcessList.svelte';
    import AccountManager from './AccountManager.svelte';
    import ModrinthSearch from "./ModrinthSearch.svelte";
    import DebugEvents from './DebugEvents.svelte'; // Import the new component
    import ProfileView from './ProfileView.svelte'; // Import the new component
    import { profiles, loadProfiles as loadProfilesFromStore, selectedProfileId } from '$lib/stores/profileStore';
    import type { Profile, Mod, NoriskModIdentifier } from '$lib/stores/profileStore';
    // Import Norisk Pack types from the new file
    import type { NoriskModpacksConfig, NoriskPackDefinition } from '$lib/types/noriskPacks';
    // Import Modrinth types
    import type { ModrinthVersion, ModrinthProjectContext, ModrinthAllVersionsResult } from '$lib/types/modrinth';
    // REMOVED: import type { CustomModInfo } from '$lib/types'; // Assuming CustomModInfo is moved or copied to $lib/types

    // --- Local Definition for CustomModInfo ---
    interface CustomModInfo {
        filename: string;
        is_enabled: boolean;
        path: string; // Note: PathBuf in Rust becomes string in JS/TS via Tauri
    }
    // --- End Local Definition ---

    interface EventPayload {
        event_id: string;
        event_type: string;
        target_id: string | null;
        message: string;
        progress: number | null;
        error: string | null;
    }

    interface DebugEvent {
        timestamp: string;
        message: string;
    }

    interface MinecraftVersion {
        id: string;
        type: string;
        url: string;
        time: string;
        releaseTime: string;
    }

    let minecraftVersions: MinecraftVersion[] = $state([]);
    let selectedType = $state<string>("release");
    let selectedVersion = $state<string>("");
    let selectedModLoader = $state<string>("vanilla");
    let profileName = $state<string>("");
    let isLoading = $state(true);
    let isCreating = $state(false);
    let activeEvents = $state<Map<string, EventPayload>>(new Map());
    let newProfile = {
        name: "",
        minecraft_version: "",
        java_version: 8,
        modloader: "vanilla",
    };
    let editingProfile: Profile | null = $state(null);
    let isEditing = $state(false);
    let dummyProfile: Partial<Profile> = {
        id: '',
        name: '',
        game_version: '',
        loader: 'vanilla',
    };
    let showDebug = $state(false);
    let debugEvents = $state<EventPayload[]>([]);
    let errorMessage: string | null = $state(null);
    let showCreateForm = $state(false);
    let showModrinthSearch = $state(false);
    let noriskPacksConfig = $state<NoriskModpacksConfig | null>(null);
    let isLoadingPacks = $state(true);

    // --- Custom Mods State ---
    let customModsMap = $state<Map<string, CustomModInfo[]>>(new Map());
    let loadingCustomMods = $state<Set<string>>(new Set());
    let customModsErrorMap = $state<Map<string, string | null>>(new Map());
    // --- End Custom Mods State ---

    // --- State für Mod-Version-Dropdown ---
    let activeVersionDropdown: { profileId: string, modId: string } | null = $state(null);
    let versionsForCurrentDropdown: ModrinthVersion[] = $state([]); // Defined as state
    let errorForCurrentDropdown: string | null = $state(null); // Defined as state
    let isLoadingVersions = $state(false); // ADDED: Need this state variable
    let hasAlternativeVersions = $state(false); 
    // --- Ende: State für Mod-Version-Dropdown ---

    // --- Neuer State für Profil-Update-Check ---
    let checkingProfileUpdates = $state<string | null>(null); // ID of profile being checked
    let profileUpdateCheckError = $state<Map<string, string | null>>(new Map()); // profileId -> error message
    let modsWithUpdates = $state<Map<string, Set<string>>>(new Map()); // profileId -> Set<modInstanceId>
    let isLoadingInitialVersions = $state(false); // Renamed from isLoadingInitialUpdateStatus
    let initialCheckError: string | null = $state(null); // Renamed from initialUpdateCheckError
    // --- Ende: Neuer State --- 

    // Derived state for sorted profiles - Correct Svelte 5 syntax
    let sortedProfiles = $derived(
        [...$profiles].sort((a, b) => {
            const dateA = a.last_played ? new Date(a.last_played) : null;
            const dateB = b.last_played ? new Date(b.last_played) : null;

            if (dateB === null && dateA === null) return 0; // Both null, keep order
            if (dateB === null) return -1; // B is null, A comes first
            if (dateA === null) return 1;  // A is null, B comes first

            // Both dates are valid, sort descending
            return dateB.getTime() - dateA.getTime();
        })
    );

    // Define the shape alias needed by the helper function
    type ModrinthSourceShape = { 
        type: 'modrinth'; 
        project_id: string; 
        version_id: string; 
        file_name: string;
        download_url: string;
        file_hash_sha1: string | null | undefined;
    };

    let allFetchedVersions = $state<Map<string, Map<string, ModrinthVersion[] | string>>>(new Map());

    // --- Helper functions for props passed to ProfileView ---
    function isDropdownOpenForMod(profileId: string, modId: string): boolean {
        return activeVersionDropdown?.profileId === profileId && activeVersionDropdown?.modId === modId;
    }

    function checkAlternativesForMod(profileId: string, modId: string): boolean {
        return checkIfAlternativesExistInCache(profileId, modId); // Reuse existing logic
    }

    function getProfileEvents(profileId: string): EventPayload[] {
        return Array.from(activeEvents.values())
            .filter(event => event.target_id === profileId);
    }
    // --- End Helper functions ---

    onMount(async () => {
        console.log('ProfileManager mounted, loading initial data...');
        isLoading = true; // Set loading true initially
        await loadMinecraftVersions();
        console.log('Versions loading attempted.');
        await loadProfilesFromStore(); // Load profiles first
        console.log('Profiles loaded into store');
        await loadNoriskPacks(); // Load Norisk packs
        
        // --- Load initial data AFTER profiles are available ---
        if ($profiles.length > 0) {
            console.log("Initial load: Loading custom mods and version checks...");
            await Promise.all([
                 loadAllCustomMods($profiles), // Load custom mods once
                 runInitialVersionCheck($profiles) // Load initial version/update status
            ]);
        } else {
            console.log("Initial load: No profiles found, skipping custom mods/version checks.");
        }

        // --- Setup Event Listeners ---
         setupEventListeners(); // Keep state_event listener if needed for other things
        // setupCustomModEventListener(); // REMOVED: Setup the listener for custom mods

        isLoading = false;
        console.log("Initial data loading and setup complete.");
    });

    async function setupEventListeners() {
        console.log('Setting up event listeners...');
        
        await listen<EventPayload>('state_event', (event) => {
            console.log('Received state_event:', event);
            const payload = event.payload;

            // Handle generic active events display if target_id is present 
            if (payload.target_id) {
                const newMap = new Map(activeEvents);
                newMap.set(payload.event_id, payload);
                activeEvents = newMap;
                console.log('Updated activeEvents:', Array.from(activeEvents.values()));
            }

            // --- Handle specific TriggerProfileUpdate event --- 
            if (payload.event_type === 'trigger_profile_update') {
                const profileId = payload.target_id;
                if (profileId) {
                    console.log(`Received TriggerProfileUpdate for profile ${profileId}. Reloading data...`);
                    // Find the profile object to pass to loadAllCustomMods
                    const profileToUpdate = $profiles.find(p => p.id === profileId);
                    if (profileToUpdate) {
                        // Reload custom mods specifically for this profile
                        loadAllCustomMods([profileToUpdate]); 
                    } else {
                        console.warn(`Profile ${profileId} not found in store for custom mod reload.`);
                    }
                    // Reload all profiles from backend (might contain updated mods list)
                    loadProfilesFromStore(); 
                }
            }
            // --- End TriggerProfileUpdate handling ---

        });

        await listen<EventPayload>('event', (event) => {
            console.log('Received event:', event);
            const payload = event.payload;
            if (payload.target_id) {
                // Create a new Map to trigger reactivity
                const newMap = new Map(activeEvents);
                newMap.set(payload.event_id, payload);
                activeEvents = newMap;
                console.log('Updated activeEvents:', Array.from(activeEvents.values()));
            }
        });

        // Log initial state
        console.log('Initial activeEvents:', Array.from(activeEvents.values()));
    }

    function getEventTypeDisplay(eventType: string): string {
        switch (eventType) {
            case 'installing_java':
                return 'Java Installation';
            default:
                return eventType;
        }
    }

    async function loadMinecraftVersions() {
        try {
            console.log('Calling invoke get_minecraft_versions...');
            const versionsData = await invoke<{ versions: MinecraftVersion[] }>(
                "get_minecraft_versions"
            );
            console.log('Received versions data:', versionsData);
            // Assign to the reactive variable
            minecraftVersions = versionsData.versions;

            if (minecraftVersions.length > 0) {
                // Set default selection based on loaded versions
                const latestRelease = minecraftVersions.find((v) => v.type === "release");
                if (latestRelease) {
                    selectedVersion = latestRelease.id;
                } else {
                    selectedVersion = minecraftVersions[0].id; 
                }
            } else {
                 selectedVersion = ""; // Reset if no versions found
            }
        } catch (error) {
            console.error("Fehler beim Laden der Minecraft-Versionen:", error);
            minecraftVersions = []; // Clear on error
            selectedVersion = "";
            errorMessage = `Failed to load Minecraft versions: ${error instanceof Error ? error.message : String(error)}`;
        }
    }

    async function createProfile() {
        if (!profileName) {
            alert("Bitte geben Sie einen Profilnamen ein");
            return;
        }

        try {
            isCreating = true;
            const result = await invoke("create_profile", {
                params: {
                    name: profileName,
                    game_version: selectedVersion,
                    loader: selectedModLoader,
                    loader_version: "null",
                },
            });
            console.log("Profil erstellt:", result);

            // Reset form
            profileName = "";
            selectedType = "release";
            selectedModLoader = "vanilla";

            // Reload versions and profiles
            await loadMinecraftVersions();
            await loadProfilesFromStore();
        } catch (error: unknown) {
            console.error("Fehler beim Erstellen des Profils:", error);
            if (error instanceof Error) {
                alert("Fehler beim Erstellen des Profils: " + error.message);
            } else {
                alert("Ein unbekannter Fehler ist aufgetreten");
            }
        } finally {
            isCreating = false;
        }
    }

    async function deleteProfile(id: string) {
        errorMessage = null;
        console.log(`Attempting to delete profile: ${id}. Showing confirm dialog...`);
        if (!confirm("Möchten Sie dieses Profil wirklich löschen?")) return;

        try {
            await invoke("delete_profile", { id });
            await loadProfilesFromStore();
        } catch (error: unknown) {
            console.error("Fehler beim Löschen des Profils:", error);
            if (error instanceof Error) {
                alert("Fehler beim Löschen des Profils: " + error.message);
            } else {
                alert("Ein unbekannter Fehler ist aufgetreten");
            }
        }
    }

    async function launchProfile(id: string) {
        try {
            await invoke("launch_profile", { id });
        } catch (error: unknown) {
            console.error("Fehler beim Starten des Profils:", error);
            if (error instanceof Error) {
                alert("Fehler beim Starten des Profils: " + error.message);
            } else {
                alert("Ein unbekannter Fehler ist aufgetreten");
            }
        }
    }

    function getFilteredVersions() {
        return minecraftVersions.filter((v) => v.type === selectedType);
    }

    $effect(() => {
        if (!isLoading && minecraftVersions.length > 0) {
            const filtered = getFilteredVersions();
            if (filtered.length > 0) {
                // Wenn der Typ geändert wird oder die aktuelle Version nicht mehr verfügbar ist
                if (!filtered.some((v) => v.id === selectedVersion)) {
                    selectedVersion = filtered[0].id;
                }
            }
        }
    });

    $effect(() => {
        newProfile.minecraft_version = selectedVersion;
        newProfile.modloader = selectedModLoader;
        newProfile.name = profileName;
    });

    function getLastEvent(profileId: string): EventPayload | null {
        const events = Array.from(activeEvents.values())
            .filter(event => event.target_id === profileId);
        return events[events.length - 1] || null;
    }

    function editProfile(profile: Profile) {
        editingProfile = profile;
        isEditing = true;
        showCreateForm = true;
    }

    function handleFormSuccess() {
        showCreateForm = false;
        editingProfile = null;
        loadProfilesFromStore();
    }

    function handleFormCancel() {
        isEditing = false;
        editingProfile = null;
    }

    function getModDisplayName(mod: Mod): string {
        if (mod.display_name) return mod.display_name;
        // Fallback based on source type
        switch (mod.source.type) {
            case 'modrinth': return mod.source.file_name ?? mod.source.project_id ?? 'Modrinth Mod';
            case 'local': return mod.source.file_name ?? 'Local Mod';
            case 'url': return mod.source.file_name ?? mod.source.url ?? 'URL Mod';
            case 'maven': return mod.source.coordinates ?? 'Maven Mod';
            case 'embedded': return mod.source.name ?? 'Embedded Mod';
            default: return `Unknown Mod (${mod.id})`;
        }
    }

    async function launchGame(profileId: string) {
        errorMessage = null;
        console.log(`Attempting to launch profile: ${profileId}`);
        try {
            const profileToLaunch = $profiles.find((p: Profile) => p.id === profileId);
            if (!profileToLaunch) {
                console.error("Profile not found in store for launch!");
                errorMessage = "Profile not found.";
                return;
            }
            await invoke('launch_profile', { id: profileId });
        } catch (error) {
            console.error(`Failed to launch profile ${profileId}:`, error);
            errorMessage = `Failed to launch profile: ${error instanceof Error ? error.message : String(error)}`;
        }
    }

    async function toggleModEnabled(profileId: string, modId: string, event: Event) {
        const checkbox = event.target as HTMLInputElement;
        const isEnabled = checkbox.checked;

        console.log(`Toggling mod ${modId} for profile ${profileId} to ${isEnabled}`);

        // Optimistic update
        profiles.update(currentProfiles => {
            return currentProfiles.map(p => {
                if (p.id === profileId) {
                    return {
                        ...p,
                        mods: p.mods.map(m => {
                            if (m.id === modId) {
                                return { ...m, enabled: isEnabled };
                            }
                            return m;
                        })
                    };
                }
                return p;
            });
        });

        try {
            await invoke('set_profile_mod_enabled', {
                profileId: profileId,
                modId: modId,
                enabled: isEnabled
            });
            console.log(`Successfully toggled mod ${modId} for profile ${profileId}`);
            // Optional: reload profiles from backend if needed after successful update
            // await loadProfilesFromStore();
        } catch (error) {
            console.error(`Failed to toggle mod ${modId} for profile ${profileId}:`, error);
            errorMessage = `Failed to update mod status: ${error instanceof Error ? error.message : String(error)}`;

            // Revert optimistic update on error
            checkbox.checked = !isEnabled; // Revert checkbox visual state
            profiles.update(currentProfiles => {
                return currentProfiles.map(p => {
                    if (p.id === profileId) {
                        return {
                            ...p,
                            mods: p.mods.map(m => {
                                if (m.id === modId) {
                                    return { ...m, enabled: !isEnabled }; // Revert in store
                                }
                                return m;
                            })
                        };
                    }
                    return p;
                });
            });
        }
    }

    async function deleteMod(profileId: string, modId: string) {
        errorMessage = null;
        const modToDelete = $profiles.find(p => p.id === profileId)?.mods.find(m => m.id === modId);
        const modName = modToDelete ? getModDisplayName(modToDelete) : `Mod ID ${modId}`;

        if (!confirm(`Möchten Sie die Mod "${modName}" wirklich aus diesem Profil entfernen?`)) {
            return;
        }

        console.log(`Attempting to delete mod ${modId} from profile ${profileId}`);
        try {
            await invoke('delete_mod_from_profile', {
                profileId: profileId,
                modId: modId
            });
            console.log(`Successfully deleted mod ${modId} from profile ${profileId}`);
            // Reload profiles from the backend to reflect the change
            await loadProfilesFromStore(); 
        } catch (error) {
            console.error(`Failed to delete mod ${modId} from profile ${profileId}:`, error);
            errorMessage = `Failed to delete mod: ${error instanceof Error ? error.message : String(error)}`;
        }
    }

    async function loadNoriskPacks() {
        isLoadingPacks = true;
        try {
            console.log("ProfileManager: Fetching Norisk packs config...");
            const config: NoriskModpacksConfig = await invoke("get_norisk_packs");
            noriskPacksConfig = config;
            console.log("ProfileManager: Norisk packs config loaded:", config);
        } catch (error) {
            console.error("ProfileManager: Fehler beim Laden der Norisk Packs:", error);
            // Handle error appropriately, maybe set an error message
            noriskPacksConfig = null;
        } finally {
            isLoadingPacks = false;
        }
    }

    // Helper function to get Norisk Pack name from ID
    function getNoriskPackName(packId: string | null): string {
        if (isLoadingPacks) {
            return "Lade..."; // Indicate that packs are still loading
        }
        if (!packId || !noriskPacksConfig?.packs) {
            return "Kein Norisk Pack";
        }
        const packDefinition = noriskPacksConfig.packs[packId];
        return packDefinition ? packDefinition.displayName : `Unbekannt (${packId})`;
    }

    // Helper to get the actual pack definition object
    function getNoriskPackDefinition(packId: string | null): NoriskPackDefinition | null {
        if (!packId || !noriskPacksConfig?.packs) {
            return null;
        }
        return noriskPacksConfig.packs[packId] ?? null;
    }

    // Helper function to get compatible mods for a profile from its selected pack
    function getCompatiblePackMods(profile: Profile): import('$lib/types/noriskPacks').NoriskPackMod[] {
        const packDef = getNoriskPackDefinition(profile.selected_norisk_pack_id);
        if (!packDef?.mods) {
            return []; // No pack or no mods defined in the pack
        }

        const gameVersion = profile.game_version;
        const loader = profile.loader; // Assuming keys match profile.loader

        const compatibleMods = packDef.mods.filter(mod => {
            // Check if compatibility exists for the profile's game version and loader
            return mod.compatibility?.[gameVersion]?.[loader]; 
        });
        
        return compatibleMods;
    }

    // Helper function to check if a specific Norisk Pack mod is disabled for the current profile context
    function isNoriskModDisabled(profile: Profile, packModId: string): boolean {
        if (!profile.selected_norisk_pack_id || !profile.disabled_norisk_mods_detailed) {
            return false; // Not disabled if no pack selected or no disabled info
        }
        // Check if an identifier matching the current context exists in the array
        return profile.disabled_norisk_mods_detailed.some(identifier => 
            identifier.pack_id === profile.selected_norisk_pack_id &&
            identifier.mod_id === packModId &&
            identifier.game_version === profile.game_version &&
            identifier.loader === profile.loader // Compare loader strings
        );
    }

    // Function to handle toggling the disabled state of a Norisk Pack mod
    async function toggleNoriskModDisabled(profile: Profile, packModId: string, event: Event) {
        const checkbox = event.target as HTMLInputElement;
        const isDisabled = !checkbox.checked; // If checked, it's NOT disabled
        errorMessage = null;

        if (!profile.selected_norisk_pack_id) {
            console.error("Cannot toggle Norisk mod status without a selected pack.");
            errorMessage = "Error: No Norisk pack selected.";
            // Revert checkbox optimistically if needed, although it shouldn't be checkable without a pack
            checkbox.checked = !isDisabled;
            return;
        }

        console.log(
            `Toggling Norisk Mod ${packModId} for profile ${profile.id} (Pack: ${profile.selected_norisk_pack_id}, ` +
            `MC: ${profile.game_version}, Loader: ${profile.loader}) to disabled=${isDisabled}`
        );

        // Optimistic Update (optional but improves UX)
        // We need to carefully add/remove the correct identifier from the array
        const identifierToToggle: NoriskModIdentifier = {
            pack_id: profile.selected_norisk_pack_id,
            mod_id: packModId,
            game_version: profile.game_version,
            loader: profile.loader,
        };

        profiles.update(currentProfiles => {
            return currentProfiles.map(p => {
                if (p.id === profile.id) {
                    let currentDisabled = p.disabled_norisk_mods_detailed ? [...p.disabled_norisk_mods_detailed] : [];
                    if (isDisabled) {
                        // Add if not present
                        if (!currentDisabled.some(id => 
                            id.pack_id === identifierToToggle.pack_id &&
                            id.mod_id === identifierToToggle.mod_id &&
                            id.game_version === identifierToToggle.game_version &&
                            id.loader === identifierToToggle.loader
                        )) {
                            currentDisabled.push(identifierToToggle);
                        }
                    } else {
                        // Remove if present
                        currentDisabled = currentDisabled.filter(id => 
                            !(id.pack_id === identifierToToggle.pack_id &&
                              id.mod_id === identifierToToggle.mod_id &&
                              id.game_version === identifierToToggle.game_version &&
                              id.loader === identifierToToggle.loader)
                        );
                    }
                    return { ...p, disabled_norisk_mods_detailed: currentDisabled };
                }
                return p;
            });
        });


        try {
            await invoke('set_norisk_mod_status', { // Use the correct command name
                profileId: profile.id,
                packId: profile.selected_norisk_pack_id,
                modId: packModId,
                gameVersion: profile.game_version,
                loaderStr: profile.loader, // Send loader as string
                disabled: isDisabled,
            });
            console.log("Successfully updated Norisk mod status on backend.");
            // Optional: Reload profiles from backend to ensure sync, or rely on optimistic update
            // await loadProfilesFromStore(); 
        } catch (error) {
            console.error("Failed to update Norisk mod status:", error);
            errorMessage = `Failed to update Norisk mod status: ${error instanceof Error ? error.message : String(error)}`;
            // Revert optimistic update on error
            checkbox.checked = !isDisabled; // Revert checkbox visual state
            // Revert store change (more complex, maybe just reload)
            await loadProfilesFromStore(); // Reload to revert complex optimistic update
        }
    }

    // --- Hilfsfunktion für Modrinth version_id ---
    function getModrinthVersionId(source: Mod['source']): string | null {
        if (source.type === 'modrinth') {
            // Define the expected shape directly for the assertion
            type ModrinthSourceShape = { 
                type: 'modrinth'; 
                project_id: string; 
                version_id: string; 
                file_name: string;
                download_url: string;
                file_hash_sha1: string | null | undefined; // Correct TypeScript equivalent for Option<String>
            };
            return (source as ModrinthSourceShape).version_id;
        }
        return null;
    }
    // --- Ende: Hilfsfunktion ---

    // --- Function to open profile folder ---
    async function openProfileFolder(profileId: string) {
        errorMessage = null;
        console.log(`Attempting to open folder for profile: ${profileId}`);
        try {
            await invoke('open_profile_folder', { profileId: profileId });
            console.log(`Successfully requested to open folder for profile ${profileId}`);
        } catch (error) {
            console.error(`Failed to open folder for profile ${profileId}:`, error);
            errorMessage = `Failed to open profile folder: ${error instanceof Error ? error.message : String(error)}`;
        }
    }

    // --- Neue Funktionen für Mod-Version-Wechsel ---
    async function fetchAndShowVersions(profile: Profile, mod: Mod) {
        if (mod.source.type !== 'modrinth') return;

        activeVersionDropdown = { profileId: profile.id, modId: mod.id }; 
        versionsForCurrentDropdown = []; // Use correct state
        errorForCurrentDropdown = null;   // Use correct state
        isLoadingVersions = true;        // Use correct state
        hasAlternativeVersions = false; // Reset

        try {
            console.log(`Fetching versions for mod ${mod.id} (Project: ${mod.source.project_id}) in profile ${profile.id}`);
            const versions: ModrinthVersion[] = await invoke('get_modrinth_mod_versions', {
                projectIdOrSlug: mod.source.project_id,
                gameVersions: [profile.game_version],
                loaders: [profile.loader]
            });
            console.log(`Found ${versions.length} compatible versions.`);
            versionsForCurrentDropdown = versions; // Use correct state
            // Prüfen, ob es Alternativen zur aktuell installierten Version gibt
            const currentInstalledVersionId = getModrinthVersionId(mod.source);
            hasAlternativeVersions = versionsForCurrentDropdown.some((v: ModrinthVersion) => v.id !== currentInstalledVersionId); // Use correct state, added type

        } catch (error) {
            console.error("Failed to fetch mod versions:", error);
            errorForCurrentDropdown = `Error fetching versions: ${error instanceof Error ? error.message : String(error)}`; // Use correct state
            activeVersionDropdown = null; 
        } finally {
            isLoadingVersions = false; // Use correct state
        }
    }

    // --- handleVersionChange --- (Single Correct Definition - Keep this one)
    async function handleVersionChange(profile: Profile, mod: Mod, event: Event) {
        if (mod.source.type !== 'modrinth') return;

        const selectElement = event.target as HTMLSelectElement;
        const newVersionId = selectElement.value;
        if (!newVersionId) return; 

        const selectedVersionObject = versionsForCurrentDropdown.find((v: ModrinthVersion) => v.id === newVersionId); // Use correct state, added type

        if (!selectedVersionObject) { 
            console.error(`Selected version object not found in dropdown cache for ${newVersionId}`);
            errorMessage = "Error selecting version: Details not found.";
            return; 
        }

        console.log(`Attempting to update mod ${mod.id} in profile ${profile.id} to version ${newVersionId}`);
        errorMessage = null; 
        activeVersionDropdown = null; // Close dropdown optimistically
        versionsForCurrentDropdown = []; // Clear dropdown state
        errorForCurrentDropdown = null;

        // Show some kind of loading indicator if desired...

        try {
            await invoke('update_modrinth_mod_version', { 
                profileId: profile.id, 
                modInstanceId: mod.id, 
                newVersionDetails: selectedVersionObject 
            });
            console.log("Successfully requested mod version update.");
            
            // Reload profiles to get the updated profile state from backend
            await loadProfilesFromStore(); 
            
            // Manually remove the update indicator for this mod
            const currentUpdateMap = modsWithUpdates; // Read the current map
            const profileSet = currentUpdateMap.get(profile.id);
            let mapChanged = false;
            if (profileSet?.has(mod.id)) {
                console.log(`Manually removing update indicator for mod ${mod.id}`);
                profileSet.delete(mod.id);
                mapChanged = true;
                 // If the set becomes empty, we could optionally remove the profile key too
                 if (profileSet.size === 0) {
                     currentUpdateMap.delete(profile.id);
                 }
            }

            // Assign a new Map only if changes were made to trigger reactivity
            if (mapChanged) {
                modsWithUpdates = new Map(currentUpdateMap);
            }

            // No longer trigger a full re-check here:
            // initialCheckDone = false; 

        } catch (error) { 
            console.error(`Failed to update mod ${mod.id} version:`, error);
            errorMessage = `Failed to update mod version: ${error instanceof Error ? error.message : String(error)}`;
            // Potentially revert optimistic UI changes if needed
        } 
    }

    // --- cancelVersionChange --- (Single Correct Definition - Keep this one)
    function cancelVersionChange() {
        activeVersionDropdown = null;
        versionsForCurrentDropdown = []; // Use correct state
        errorForCurrentDropdown = null;  // Use correct state
    }

    // --- NEUE Funktion zum Prüfen von Updates für ein Profil ---
    async function checkProfileUpdates(profile: Profile) {
        const profileId = profile.id;
        checkingProfileUpdates = profileId;
        profileUpdateCheckError.set(profileId, null);
        modsWithUpdates.set(profileId, new Set()); // Reset previous results for this profile
        errorMessage = null; // Clear global error

        // Define the shape locally for assertion
        type ModrinthSourceShape = { 
            type: 'modrinth'; 
            project_id: string; 
            version_id: string; 
            file_name: string;
            download_url: string;
            file_hash_sha1: string | null | undefined;
        };

        // 1. Collect contexts
        const contextsToCheck: ModrinthProjectContext[] = [];
        const modInstanceIdToCurrentVersionId = new Map<string, string>();

        for (const mod of profile.mods) {
            if (mod.source.type === 'modrinth') {
                // Use direct assertion
                const modrinthSource = mod.source as ModrinthSourceShape;
                contextsToCheck.push({
                    project_id: modrinthSource.project_id,
                    loader: profile.loader, 
                    game_version: profile.game_version 
                });
                modInstanceIdToCurrentVersionId.set(mod.id, modrinthSource.version_id);
            }
        }

        if (contextsToCheck.length === 0) {
            console.log(`No Modrinth mods to check in profile ${profileId}`);
            checkingProfileUpdates = null;
            return; // Nothing to check
        }

        try {
            // 2. Call backend command
            console.log(`Invoking check updates for profile ${profileId} with ${contextsToCheck.length} contexts`);
            const results: { context: ModrinthProjectContext, latest_version: ModrinthVersion | null }[] = 
                await invoke('get_latest_modrinth_versions_for_contexts', { 
                    contexts: contextsToCheck 
                });
            
            console.log(`Received update check results for profile ${profileId}:`, results);

            // 3. Process results and compare versions
            const updatedModIds = new Set<string>();
            for (const result of results) {
                if (result.latest_version) {
                     for (const mod of profile.mods) {
                        if (mod.source.type === 'modrinth' && mod.source.project_id === result.context.project_id) {
                            // Use direct assertion again
                            const modrinthSource = mod.source as ModrinthSourceShape;
                            const currentVersionId = modrinthSource.version_id; 
                            if (result.latest_version.id !== currentVersionId) {
                                console.log(`Update found for mod ${mod.id} (Project: ${result.context.project_id}): ${currentVersionId} -> ${result.latest_version.id}`);
                                updatedModIds.add(mod.id);
                            }
                        }
                    }
                } 
            }

            // Update the state map to trigger UI changes
            modsWithUpdates = new Map(modsWithUpdates.set(profileId, updatedModIds)); 
            console.log(`Mods with updates for profile ${profileId}:`, updatedModIds);

        } catch (error) {
            console.error(`Failed to check updates for profile ${profileId}:`, error);
            const errorMsg = `Update check failed: ${error instanceof Error ? error.message : String(error)}`;
            profileUpdateCheckError = new Map(profileUpdateCheckError.set(profileId, errorMsg));
            errorMessage = errorMsg; // Show globally as well?
        } finally {
            checkingProfileUpdates = null; // Finished checking this profile
        }
    }
    // --- Ende: NEUE Funktion ---

    // Helper function to get mod source as ModrinthSourceShape or null
    function getModrinthSourceShape(source: Mod['source']): ModrinthSourceShape | null {
        if (source.type === 'modrinth') {
            return source as ModrinthSourceShape;
        }
        return null;
    }

    // Run initial update check after profiles are loaded
    let initialCheckDone = false;
    $effect(() => {
        // Rerun when profiles change
        const currentProfiles = $profiles;
        if (currentProfiles.length > 0 && !initialCheckDone) {
             console.log("Profiles loaded, running initial check for all versions...");
             runInitialVersionCheck(currentProfiles); // Renamed function
             initialCheckDone = true; 
        }
    });

    async function runInitialVersionCheck(currentProfiles: Profile[]) {
        // Only run if not already loading
        if (isLoadingInitialVersions) return;

        isLoadingInitialVersions = true;
        initialCheckError = null;
        console.log("Running initial version check...");

        const contextsToFetch: ModrinthProjectContext[] = [];
        const contextKeyToModDetails = new Map<string, { profileId: string, modId: string, currentVersionId: string }[]>(); 
        const uniqueContextKeysToFetch = new Set<string>(); // Track unique contexts we need to fetch

        // 1. Identify missing contexts
        for (const profile of currentProfiles) {
            const profileCache = allFetchedVersions.get(profile.id); // Check existing cache for this profile
            for (const mod of profile.mods) {
                const modrinthSource = getModrinthSourceShape(mod.source);
                if (modrinthSource) {
                    // Check if this specific mod instance is already cached
                    const isCached = profileCache?.has(mod.id) ?? false;

                    if (!isCached) {
                        // Data not cached for this mod instance, mark its context for fetching
                        const context: ModrinthProjectContext = {
                            project_id: modrinthSource.project_id,
                            loader: profile.loader,
                            game_version: profile.game_version
                        };
                        const contextKey = `${context.project_id}::${context.loader}::${context.game_version}`;
                        
                        // Add context to fetch list only if it's the first time we see this *key* needing fetch
                        if (!uniqueContextKeysToFetch.has(contextKey)) {
                            contextsToFetch.push(context);
                            uniqueContextKeysToFetch.add(contextKey);
                        }

                        // Map context key back to this specific mod instance (even if key is repeated)
                        if (!contextKeyToModDetails.has(contextKey)) {
                            contextKeyToModDetails.set(contextKey, []);
                        }
                        contextKeyToModDetails.get(contextKey)?.push({ 
                            profileId: profile.id,
                            modId: mod.id,
                            currentVersionId: modrinthSource.version_id
                        });
                    }
                }
            }
        }

        if (contextsToFetch.length === 0) {
            console.log("Initial check: No missing Modrinth mod versions to fetch.");
            isLoadingInitialVersions = false;
            initialCheckDone = true; // Mark as done if nothing needed fetching
            return;
        }

        try {
            // 2. Call backend command only for missing contexts
            console.log(`Initial check: Fetching versions for ${contextsToFetch.length} unique missing contexts...`);
            const results: ModrinthAllVersionsResult[] = 
                await invoke('get_all_modrinth_versions_for_contexts', { 
                    contexts: contextsToFetch 
                });
            console.log(`Initial check: Received ${results.length} results for missing contexts.`);

            // 3. Process results and update cache and update status incrementally
            // Create copies to modify and then assign back to trigger reactivity
            const newAllFetchedVersions = new Map(allFetchedVersions); 
            const newModsWithUpdates = new Map(modsWithUpdates);

            for (const result of results) {
                const contextKey = `${result.context.project_id}::${result.context.loader}::${result.context.game_version}`;
                const associatedMods = contextKeyToModDetails.get(contextKey);

                if (associatedMods) {
                    for (const modDetails of associatedMods) {
                        // Ensure profile map exists in the new cache copy
                        let profileCache = newAllFetchedVersions.get(modDetails.profileId);
                        if (!profileCache) {
                            profileCache = new Map<string, ModrinthVersion[] | string>();
                            newAllFetchedVersions.set(modDetails.profileId, profileCache);
                        }

                        // Store result (versions array or error string) for this mod instance
                        let updateFound = false;
                        if (result.error) {
                            profileCache.set(modDetails.modId, result.error);
                        } else if (result.versions && result.versions.length > 0) {
                            profileCache.set(modDetails.modId, result.versions);
                            
                            // Check for updates *only for this newly fetched data*
                            let latestVersion = result.versions.reduce((latest, current) => {
                                return new Date(current.date_published) > new Date(latest.date_published) ? current : latest;
                            });
                            
                            if (latestVersion && latestVersion.id !== modDetails.currentVersionId) {
                                updateFound = true;
                            }
                        } else {
                            profileCache.set(modDetails.modId, "No versions found");
                        }

                        // Update modsWithUpdates incrementally
                        let profileUpdateSet = newModsWithUpdates.get(modDetails.profileId);
                        if (!profileUpdateSet) {
                            profileUpdateSet = new Set<string>();
                            newModsWithUpdates.set(modDetails.profileId, profileUpdateSet);
                        }

                        if (updateFound) {
                            if (!profileUpdateSet.has(modDetails.modId)) { // Avoid redundant logging if already marked
                                console.log(`Initial check: Update found for newly checked mod ${modDetails.modId}`);
                                profileUpdateSet.add(modDetails.modId);
                            }
                        } else {
                            // Ensure it's removed if it was previously marked (e.g., error resolved?)
                            // This part might be less relevant now if we only check missing ones, 
                            // but keep for safety.
                            if (profileUpdateSet.has(modDetails.modId)) {
                                console.log(`Initial check: Removing update mark for mod ${modDetails.modId} (no longer applicable).`);
                                profileUpdateSet.delete(modDetails.modId);
                            }
                        }
                    }
                }
            }
            
            // Update state variables reactively with the modified copies
            allFetchedVersions = newAllFetchedVersions;
            modsWithUpdates = newModsWithUpdates;
            console.log("Initial check: Incremental update complete. Caches:", allFetchedVersions, modsWithUpdates);

        } catch (error) {
            console.error("Incremental initial version check failed:", error);
            initialCheckError = `Incremental version check failed: ${error instanceof Error ? error.message : String(error)}`;
            // Don't clear the whole cache on incremental failure
        } finally {
            isLoadingInitialVersions = false;
            initialCheckDone = true; // Mark check as completed (even if partial fetch failed)
        }
    }

    // --- Function to open dropdown using cached data --- 
    function openVersionDropdown(profileId: string, modId: string) {
        const profileCache = allFetchedVersions.get(profileId);
        const modResult = profileCache?.get(modId);

        activeVersionDropdown = { profileId, modId }; // Open dropdown state

        if (Array.isArray(modResult)) { // Success: Versions array found
            versionsForCurrentDropdown = modResult; // Use correct state
            errorForCurrentDropdown = null;   // Use correct state
            const mod = $profiles.find(p => p.id === profileId)?.mods.find(m => m.id === modId);
            const currentVersionId = mod ? getModrinthVersionId(mod.source) : null;
            hasAlternativeVersions = versionsForCurrentDropdown.some((v: ModrinthVersion) => v.id !== currentVersionId); // Use correct state, added type
            console.log(`Opening dropdown for ${modId}. Alternatives found: ${hasAlternativeVersions}`);
        } else if (typeof modResult === 'string') { // Potential error or specific message found
             versionsForCurrentDropdown = []; // Use correct state
             hasAlternativeVersions = false;
             // Distinguish between 'No versions found' and actual errors
             if (modResult === "No versions found") {
                 errorForCurrentDropdown = null; // Not an error, just no alternatives
                 // hasAlternativeVersions is already false, so the template will show the correct message
                 console.log(`Opening dropdown for ${modId}. Result: No versions found.`);
             } else {
                 // Assume other strings are actual error messages from the initial fetch
                 errorForCurrentDropdown = modResult; 
                 console.log(`Opening dropdown for ${modId}. Cached error: ${modResult}`);
             }
        } else {
             // Data not cached or unexpected type
             console.warn(`Version data for mod ${modId} not found in cache.`);
             errorForCurrentDropdown = "Version data not available in cache.";
             versionsForCurrentDropdown = [];
             hasAlternativeVersions = false;
        }
    }

    // --- Helper to check cache for alternative versions --- 
    function checkIfAlternativesExistInCache(profileId: string, modId: string): boolean {
        const profileCache = allFetchedVersions.get(profileId);
        if (!profileCache) return false; // No cache for profile

        const modResult = profileCache.get(modId);
        if (!Array.isArray(modResult)) { 
            // Not an array (could be error string or 'No versions found') -> no known alternatives
            return false; 
        }
        
        // Array exists, check if it contains versions different from the current one
        const profile = $profiles.find(p => p.id === profileId);
        const mod = profile?.mods.find(m => m.id === modId);
        if (!mod) return false; // Should not happen

        const currentVersionId = getModrinthVersionId(mod.source);
        if (!currentVersionId) return false; // Mod is not Modrinth or version_id missing

        // Return true if there is at least one version in the cache with a different ID
        return modResult.some(v => v.id !== currentVersionId);
    }

    // --- Function to load custom mods for all profiles ---
    async function loadAllCustomMods(profilesToLoad: Profile[]) {
        // Reset errors for profiles being loaded
        customModsErrorMap = new Map(customModsErrorMap);
        profilesToLoad.forEach(p => customModsErrorMap.delete(p.id));

        // Mark profiles as loading
        loadingCustomMods = new Set(profilesToLoad.map(p => p.id));
        console.log("Loading custom mods for IDs:", Array.from(loadingCustomMods));

        const promises = profilesToLoad.map(async (profile) => {
            try {
                const mods: CustomModInfo[] = await invoke("get_custom_mods", { profileId: profile.id });
                // Use functional update for the map
                customModsMap = new Map(customModsMap.set(profile.id, mods));
            } catch (error) {
                console.error(`Failed to load custom mods for profile ${profile.id}:`, error);
                const errorMsg = error instanceof Error ? error.message : String(error);
                // Use functional update for the error map
                customModsErrorMap = new Map(customModsErrorMap.set(profile.id, `Failed to load custom mods: ${errorMsg}`));
            } finally {
                // Use functional update to remove from loading set
                loadingCustomMods = new Set(loadingCustomMods);
                loadingCustomMods.delete(profile.id);
                 loadingCustomMods = new Set(loadingCustomMods); // Reassign to trigger reactivity
            }
        });

        await Promise.all(promises);
        console.log("Finished loading custom mods for all profiles.");
    }

    // --- NEU: Function to toggle Custom Mod Enabled State --- 
    async function toggleCustomModEnabled(profileId: string, filename: string, event: Event) {
        const checkbox = event.target as HTMLInputElement;
        const setEnabled = checkbox.checked;
        errorMessage = null; // Clear global error
        customModsErrorMap = new Map(customModsErrorMap.set(profileId, null)); // Clear specific error

        console.log(`Toggling custom mod ${filename} for profile ${profileId} to ${setEnabled}`);

        // Optimistic Update
        let originalState = false;
        customModsMap = new Map(customModsMap.set(profileId, 
            (customModsMap.get(profileId) ?? []).map(mod => {
                if (mod.filename === filename) {
                    originalState = mod.is_enabled;
                    return { ...mod, is_enabled: setEnabled };
                }
                return mod;
            })
        ));

        try {
            await invoke('set_custom_mod_enabled', { // Use the correct command name
                profileId: profileId,
                filename: filename,
                enabled: setEnabled
            });
            console.log(`Successfully set custom mod ${filename} state for profile ${profileId}`);
            // No need to reload, optimistic update is enough if backend call succeeds
        } catch (error) { 
            console.error(`Failed to set custom mod ${filename} state for profile ${profileId}:`, error);
            const errorMsg = `Failed to toggle mod: ${error instanceof Error ? error.message : String(error)}`;
            errorMessage = errorMsg; // Show global error
            customModsErrorMap = new Map(customModsErrorMap.set(profileId, errorMsg)); // Show specific error

            // Revert optimistic update on error
            checkbox.checked = !setEnabled; // Revert checkbox visual state
            customModsMap = new Map(customModsMap.set(profileId, 
                (customModsMap.get(profileId) ?? []).map(mod => {
                    if (mod.filename === filename) {
                        return { ...mod, is_enabled: originalState }; // Revert in map
                    }
                    return mod;
                })
            ));
        }
    }

    async function handleDeleteCustomMod(profileId: string, filename: string) {
        errorMessage = null; // Clear global error
        customModsErrorMap = new Map(customModsErrorMap.set(profileId, null)); // Clear specific error

        if (!confirm(`Möchtest du die lokale Mod-Datei "${filename}" wirklich löschen?`)) {
            return;
        }

        console.log(`Attempting to delete custom mod ${filename} from profile ${profileId}`);
        try {
            await invoke('delete_custom_mod', { profileId: profileId, filename: filename });
            console.log(`Successfully deleted custom mod ${filename} from profile ${profileId}`);
            
            // Reload custom mods for this specific profile after successful deletion
            const profileToUpdate = $profiles.find(p => p.id === profileId);
            if (profileToUpdate) {
                await loadAllCustomMods([profileToUpdate]);
            } else {
                console.warn(`Profile ${profileId} not found in store after custom mod deletion.`);
            }
        } catch (error) {
            console.error(`Failed to delete custom mod ${filename} from profile ${profileId}:`, error);
            const errorMsg = `Failed to delete mod: ${error instanceof Error ? error.message : String(error)}`;
            errorMessage = errorMsg; // Show global error
            customModsErrorMap = new Map(customModsErrorMap.set(profileId, errorMsg)); // Show specific error
        }
    }

    async function handleImportLocalMods(profileId: string) {
        errorMessage = null;
        console.log(`Attempting to import local mods for profile: ${profileId}`);
        try {
            await invoke('import_local_mods', { profileId: profileId });
            // Optional: Show a success message or trigger a refresh
            // We might need an event from the backend or a delay before reloading
            // For now, let's just log success
            console.log(`Successfully initiated local mod import for profile ${profileId}`);
            // Consider reloading custom mods after a short delay or via backend event:
            // setTimeout(() => loadAllCustomMods([$profiles.find(p => p.id === profileId)!]), 1000); 
        } catch (error) {
            console.error(`Failed to import local mods for profile ${profileId}:`, error);
            errorMessage = `Failed to import mods: ${error instanceof Error ? error.message : String(error)}`;
        }
    }

</script>

<div class="profile-manager">    
    <h2>Profile</h2>

    <!-- Debug Events Section - Replaced with component -->
    <DebugEvents {activeEvents} />

    <div class="process-section">
        <ProcessList />
    </div>

    <ModrinthSearch />
    <AccountManager />

    <div class="new-profile">
        <h3>Neues Profil</h3>
        {#if isLoading}
            <p>Lade Minecraft-Versionen...</p>
        {:else if minecraftVersions.length > 0}
            <ProfileForm
                minecraftVersions={minecraftVersions}
                isEditing={false}
                editingProfile={dummyProfile}
                on:success={handleFormSuccess}
            />
        {:else}
            <p>Keine Minecraft-Versionen verfügbar</p>
            {#if errorMessage}<p class="error-message">{errorMessage}</p>{/if}
        {/if}
    </div>
    {#if errorMessage}<p class="error-message">{errorMessage}</p>{/if}

    {#if isLoadingInitialVersions}
        <p>Loading initial mod version data...</p>
    {/if}
    {#if initialCheckError}
        <p class="error-message">{initialCheckError}</p>
    {/if}

    <div class="profile-list">
        <h3>Bestehende Profile</h3>
        {#if $profiles.length === 0 && !isLoading}
            <p>Keine Profile vorhanden</p>
        {:else if isLoading}
            <p>Loading profiles...</p>
        {:else}
            <div class="profile-list">
                {#each sortedProfiles as profile (profile.id)}
                    <!-- Remove old HTML block -->
                    {@const profileUpdates = modsWithUpdates.get(profile.id) ?? new Set()}
                    {@const profileCustomMods = customModsMap.get(profile.id)}
                    {@const profileCustomModsLoading = loadingCustomMods.has(profile.id)}
                    {@const profileCustomModsError = customModsErrorMap.get(profile.id)}

                    <ProfileView 
                        profile={profile}
                        noriskPacksConfig={noriskPacksConfig}
                        profileCustomMods={profileCustomMods}
                        profileCustomModsLoading={profileCustomModsLoading}
                        profileCustomModsError={profileCustomModsError ?? null}
                        profileUpdates={profileUpdates}
                        activeVersionDropdown={activeVersionDropdown}
                        versionsForCurrentDropdown={versionsForCurrentDropdown} 
                        errorForCurrentDropdown={errorForCurrentDropdown}
                        hasAlternativeVersions={hasAlternativeVersions}
                        isDropdownOpenForThisMod={(modId) => isDropdownOpenForMod(profile.id, modId)}
                        doAlternativesExistForThisMod={(modId) => checkAlternativesForMod(profile.id, modId)}
                        profileEvents={getProfileEvents(profile.id)}
                        
                        on:launch={() => launchGame(profile.id)}
                        on:edit={() => editProfile(profile)}
                        on:delete={() => deleteProfile(profile.id)}
                        on:openFolder={() => openProfileFolder(profile.id)}
                        on:toggleMod={(event) => toggleModEnabled(profile.id, event.detail.modId, event.detail.originalEvent)}
                        on:deleteMod={(event) => deleteMod(profile.id, event.detail.modId)}
                        on:toggleNoriskMod={(event) => toggleNoriskModDisabled(profile, event.detail.packModId, event.detail.originalEvent)}
                        on:toggleCustomMod={(event) => toggleCustomModEnabled(profile.id, event.detail.filename, event.detail.originalEvent)}
                        on:openVersionDropdown={(event) => openVersionDropdown(profile.id, event.detail.modId)}
                        on:changeVersion={(event) => handleVersionChange(profile, event.detail.mod, event.detail.originalEvent)}
                        on:cancelVersionChange={cancelVersionChange}
                        on:importLocalMods={() => handleImportLocalMods(profile.id)}
                        on:deleteCustomMod={(event) => handleDeleteCustomMod(profile.id, event.detail.filename)}
                    />
                {/each} 
            </div>
        {/if}
    </div>

    <!-- Edit Profile Modal -->
    {#if isEditing && editingProfile}
        <div class="modal-overlay" on:click={handleFormCancel}>
            <div class="modal-content" on:click|stopPropagation>
                <h3>Profil bearbeiten</h3>
                <ProfileForm
                    minecraftVersions={minecraftVersions}
                    isEditing={true}
                    editingProfile={editingProfile}
                    on:success={handleFormSuccess}
                    on:cancel={handleFormCancel}
                />
            </div>
        </div>
    {/if}
</div>

<style>
    .profile-manager {
        padding: 20px;
        max-width: 800px;
        margin: 0 auto;
    }

    .profile-manager h2 {
        font-size: 24px;
        margin-bottom: 20px;
    }

    .new-profile {
        margin-bottom: 30px;
        padding: 20px;
        border: 1px solid #ddd;
        border-radius: 4px;
    }

    .new-profile h3 {
        margin-bottom: 15px;
    }

    .form-group {
        display: flex;
        flex-direction: column;
        gap: 10px;
    }

    .version-selectors {
        display: flex;
        gap: 10px;
    }

    .version-selectors select {
        flex: 1;
    }

    input,
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
        transition: background-color 0.2s;
    }

    button:hover:not(:disabled) {
        background-color: #357abd;
    }

    button:disabled {
        background-color: #ccc;
        cursor: not-allowed;
    }

    button.loading {
        background-color: #357abd;
        cursor: wait;
    }

    .debug-info {
        margin-top: 20px;
        padding: 10px;
        background-color: #f5f5f5;
        border-radius: 4px;
        font-family: monospace;
        font-size: 12px;
    }

    .profile-list {
        padding: 0;
        margin-top: 30px;
    }

    .profile-list h3 {
        margin-bottom: 15px;
    }

    .profile-item {
        padding: 1em;
        margin-bottom: 1em;
        border: 1px solid #ccc;
        border-radius: 5px;
        cursor: default;
    }

    .profile-item.selected {
        background-color: transparent;
        border-color: #ccc;
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
        grid-template-columns: repeat(3, auto); /* Max 3 columns, auto width */
        gap: 10px;
    }

    .profile-actions button {
        /* Adjust padding/margins if needed */
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

    /* 4th button (Open Folder) - specific style */
    .profile-actions button:nth-child(4) {
        background-color: #3498db; /* Blue */
    }

    .profile-actions button:nth-child(4):hover {
        background-color: #2980b9;
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

    .modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: rgba(0, 0, 0, 0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
    }

    .modal-content {
        background-color: white;
        padding: 20px;
        border-radius: 8px;
        width: 90%;
        max-width: 500px;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
    }

    .modal-actions {
        display: flex;
        gap: 10px;
        margin-top: 20px;
    }

    .modal-actions button {
        flex: 1;
    }

    .modal-actions button:last-child {
        background-color: #e74c3c;
    }

    .modal-actions button:last-child:hover {
        background-color: #c0392b;
    }

    .process-section {
        margin-top: 1rem;
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
        max-height: 150px; /* Optional: Limit height and make scrollable */
        overflow-y: auto; /* Optional: Add scrollbar if list is long */
        padding-right: 5px; /* Space for scrollbar */
    }

    .mod-item {
        margin-bottom: 0.3em;
        display: flex; /* Use flex for alignment */
        align-items: center; /* Align checkbox and text vertically */
        gap: 0.5em; /* Space between checkbox and text */
         /* Make flex container wrap if needed, though less likely here */
        flex-wrap: wrap; 
    }

    .mod-item.disabled {
        color: #888;
        font-style: italic;
    }

    .mod-item .mod-name {
        flex-grow: 1; /* Allow name to take remaining space */
         margin-right: 10px; /* Add space before version changer/delete button */
    }

    .mod-toggle-checkbox {
        flex-shrink: 0; /* Prevent checkbox from shrinking */
        margin: 0;
        cursor: pointer;
    }

    .mod-version-changer {
        display: inline-flex; /* Changed to inline-flex */
        align-items: center;
        gap: 5px;
        margin-left: auto; /* Push to the right, after name */
        margin-right: 5px; /* Space before delete button */
        font-size: 0.9em;
    }

    .version-info {
        color: #555;
        padding: 2px 4px;
        background-color: #eee;
        border-radius: 3px;
        white-space: nowrap; /* Prevent wrapping */
    }
    .version-info.loading {
        font-style: italic;
        color: #888;
    }
    .version-info.error {
        color: #e74c3c;
        background-color: #fbeae8;
        cursor: help; /* Indicate hover for title */
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
        max-width: 250px; /* Limit width */
    }
    .version-select option {
        font-size: 1em; /* Reset font size for options if needed */
    }


    .delete-mod-button {
       /* Keep existing style, ensure it doesn't interfere with version changer */
       flex-shrink: 0; /* Prevent shrinking */
       margin-left: 0; /* Remove margin-left: auto if version changer is present */
    }

    .delete-mod-button:hover {
        background-color: #fbeae8; /* Light red background on hover */
        border-color: #e74c3c;
        color: #c0392b; /* Darker red on hover */
    }

    .mod-item.disabled .mod-name {
        /* Keep existing disabled style */
        color: #888;
        font-style: italic;
        text-decoration: line-through; /* Add line-through for clarity */
    }

    .mods-section.no-mods p {
        font-style: italic;
        color: #666;
        font-size: 0.9em;
        margin: 0;
    }

    .mods-section.user-mods {
        /* Existing styles apply, maybe add slight distinction if needed */
        /* border-color: #eee; */ 
    }

    .mods-section.pack-mods {
        margin-top: 0.5em; /* Smaller gap before pack mods */
        padding-top: 0.5em;
        border-top: 1px dotted #ccc; /* Dotted border to differentiate */
    }

    .mods-section.pack-mods h4 {
        font-size: 0.9em; /* Slightly smaller heading */
        font-style: italic;
        color: #555;
    }

    .mod-item.pack-mod-item {
        /* Specific styles for pack mods if needed */
    }
    
    .mod-item.pack-mod-item.disabled .mod-name {
        /* Style for disabled pack mod names */
        color: #888;
        font-style: italic;
        text-decoration: line-through; 
    }

    .mod-item.pack-mod-item .mod-name {
        /* Style for pack mod names */
    }

    .error-message {
        color: #e74c3c;
        background-color: #fbeae8;
        border: 1px solid #e74c3c;
        padding: 10px;
        border-radius: 4px;
        margin-bottom: 15px;
    }

    .update-check-btn {
        background-color: #f39c12; /* Orange perhaps? */
        font-size: 0.9em;
        padding: 6px 10px;
    }
    .update-check-btn:hover:not(:disabled) {
        background-color: #e67e22;
    }
    .update-check-btn:disabled {
        background-color: #f9e79f;
        cursor: wait;
    }

    .update-indicator {
        color: #2ecc71; /* Green for update */
        font-weight: bold;
        margin-left: 5px;
        cursor: default; /* Or help if title is useful */
    }

    .error-message.profile-error {
        font-size: 0.9em;
        padding: 5px 10px;
        margin-top: 10px;
        margin-bottom: 0;
    }

    /* Ensure spacing in mod item */
    .mod-item {
        /* existing styles like display:flex, gap, align-items */
    }
    .mod-name {
        /* existing flex-grow */
    }
    .update-indicator {
        /* order might need adjustment or use margin */
        margin-left: auto; /* Try pushing indicator before version changer/delete */
        margin-right: 5px;
    }
    .mod-version-changer {
       margin-left: 0; /* Remove margin-left: auto */
    }
    .delete-mod-button {
        margin-left: 5px; /* Adjust spacing */
    }

    .mods-section.custom-mods {
        margin-top: 0.5em; /* Smaller gap */
        padding-top: 0.5em;
        border-top: 1px dotted #aaa; /* Different border */
    }

    .mods-section.custom-mods h4 {
        font-size: 0.9em;
        font-style: italic;
        color: #444;
    }

    .mod-item.local-mod-item {
        /* Specific styles if needed */
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

</style>
