<script lang="ts">
  import { invoke } from '@tauri-apps/api/core';
  // import { open } from '@tauri-apps/api/shell'; // Removed import
  import { onMount } from 'svelte';
  import { loadProfiles, selectedProfile, profiles } from '$lib/stores/profileStore'; // Import selectedProfile store
  import ProfileSelect from '$lib/components/ProfileSelect.svelte'; // Import ProfileSelect
  import ModrinthProfileDropdown from '$lib/components/ModrinthProfileDropdown.svelte';

  // --- Props --- 
  // targetProfileId is now implicitly handled via the selectedProfile store
  // export let targetProfileId: string | null = null; 

  // --- Interfaces matching Rust structs --- 

  // Project types enum matching backend
  type ModrinthProjectType = "mod" | "modpack" | "resourcepack" | "shader" | "datapack";

  // Sort type enum matching backend
  type ModrinthSortType = "relevance" | "downloads" | "follows" | "newest" | "updated";

  interface ModrinthSearchResponse {
    hits: ModrinthSearchHit[];
    offset: number;
    limit: number;
    total_hits: number;
  }

  interface ModrinthSearchHit {
    project_id: string;
    project_type: string;
    slug: string;
    title: string;
    description: string;
    author: string | null;
    icon_url: string | null;
    downloads: number;
    follows: number;
    latest_version: string | null;
    versions?: string[] | null;
    // Add other fields if needed
  }

  // Based on src-tauri/src/integrations/modrinth.rs
  interface ModrinthHashes {
      sha512: string | null;
      sha1: string | null;
  }

  interface ModrinthFile {
      hashes: ModrinthHashes;
      url: string;
      filename: string;
      primary: boolean;
      size: number; // u64 in Rust might exceed JS Number limits, but ok for typical file sizes
      file_type: string | null;
  }

  // Use string literals for enums for simplicity in TS
  type ModrinthVersionType = "release" | "beta" | "alpha";
  type ModrinthDependencyType = "required" | "optional" | "incompatible" | "embedded";

  interface ModrinthDependency {
      version_id: string | null;
      project_id: string | null;
      file_name: string | null;
      dependency_type: ModrinthDependencyType;
  }

  interface ModrinthVersion {
      id: string;
      project_id: string;
      author_id: string | null;
      featured: boolean;
      name: string;
      version_number: string;
      changelog: string | null;
      dependencies: ModrinthDependency[];
      game_versions: string[];
      version_type: ModrinthVersionType;
      loaders: string[];
      files: ModrinthFile[];
      date_published: string;
      downloads: number; // u64 in Rust
      search_hit?: ModrinthSearchHit;
  }

  // --- Component State --- 

  let searchTerm = '';
  let searchResults: ModrinthSearchHit[] = []; // Results from search
  let searchResponse: ModrinthSearchResponse | null = null; // Full response including pagination info
  let searchLoading = false;
  let searchError: string | null = null;

  // Project type tabs
  let selectedProjectType: ModrinthProjectType = "mod"; // Default to mods
  const projectTypes: {type: ModrinthProjectType, label: string}[] = [
    { type: "mod", label: "Mods" },
    { type: "modpack", label: "Modpacks" },
    { type: "resourcepack", label: "Resource Packs" },
    { type: "datapack", label: "Datapacks" },
    { type: "shader", label: "Shaders" }
  ];

  // Sorting options
  let selectedSortType: ModrinthSortType = "relevance"; // Default to relevance
  const sortOptions: {type: ModrinthSortType, label: string}[] = [
    { type: "relevance", label: "Relevance" },
    { type: "downloads", label: "Downloads" },
    { type: "follows", label: "Followers" },
    { type: "newest", label: "Newest" },
    { type: "updated", label: "Recently Updated" }
  ];

  // Pagination
  let currentPage = 0;
  let pageSize = 20; // Items per page
  let totalPages = 0;

  let selectedProjectId: string | null = null; // Track which project's versions are shown
  let modVersions: ModrinthVersion[] = [];
  let versionsLoading = false;
  let versionsError: string | null = null;
  let currentlySelectedHit: ModrinthSearchHit | null = null; // Store the hit for context
  let addingModState: { [versionId: string]: 'idle' | 'adding' | 'error' | 'success' } = {}; // Track adding state per version
  let addError: string | null = null;

  // Filter state (could be made interactive later)
  let filterByProfile = true; // Control whether to use profile filters

  // Profile dropdown state - für die neue Komponente
  let showProfileDropdown = false;
  let currentContentToInstall: { version: ModrinthVersion, file: ModrinthFile } | null = null;

  // --- Derived Values --- 
  // Get filter values reactively from the selected profile
  $: currentGameVersionFilter = filterByProfile ? $selectedProfile?.game_version : undefined;
  $: currentLoaderFilter = filterByProfile ? $selectedProfile?.loader : undefined;
  $: totalPages = searchResponse ? Math.ceil(searchResponse.total_hits / pageSize) : 0;

  // --- Functions --- 

  // Function to handle image loading errors
  function handleImageError(event: Event) {
    const imgElement = event.currentTarget as HTMLImageElement;
    imgElement.style.display = 'none';
    const fallback = imgElement.nextElementSibling as HTMLElement | null;
    if (fallback) {
        fallback.style.display = 'block';
    }
  }

  // Search function
  async function performSearch(resetPagination = true) {
    searchLoading = true;
    searchError = null;
    
    // Reset pagination if this is a new search
    if (resetPagination) {
      currentPage = 0;
    }

    // Für Modpacks werden keine Filter angewendet
    const gameVersion = selectedProjectType === "modpack" ? undefined : currentGameVersionFilter;
    
    // Nur für Mods den Loader-Filter anwenden
    const loader = selectedProjectType === "mod" ? currentLoaderFilter : undefined;
    
    const offset = currentPage * pageSize;

    console.log(`Performing search: query='${searchTerm.trim()}', type=${selectedProjectType}, gameVersion=${gameVersion ?? 'N/A'}, loader=${loader ?? 'N/A'}, page=${currentPage}, sort=${selectedSortType}`);

    try {
      // Use the new command with pagination and sorting
      const response = await invoke<ModrinthSearchResponse>('search_modrinth_projects', {
        query: searchTerm.trim(),
        projectType: selectedProjectType,
        gameVersion: gameVersion,
        loader: loader,
        limit: pageSize,
        offset: offset,
        sort: selectedSortType
      });
      
      searchResponse = response;
      searchResults = response.hits;
      
      // Clear version display when performing a new search
      selectedProjectId = null;
      modVersions = [];
      versionsError = null;
      
      console.log(`Found ${response.total_hits} total results, showing ${response.hits.length} items (page ${currentPage + 1}/${totalPages})`);
    } catch (err) {
      console.error("Modrinth search failed:", err);
      searchError = `Search failed: ${err instanceof Error ? err.message : String(err)}`;
      searchResults = [];
      searchResponse = null;
    } finally {
      searchLoading = false;
    }
  }

  // Function to handle pagination
  function changePage(newPage: number) {
    if (newPage < 0 || newPage >= totalPages) return;
    currentPage = newPage;
    performSearch(false); // Don't reset pagination when changing pages
  }
  
  // Function to change project type
  function changeProjectType(newType: ModrinthProjectType) {
    if (selectedProjectType === newType) return;
    selectedProjectType = newType;
    performSearch(true); // Reset pagination when changing project type
  }
  
  // Function to change sort type
  function changeSortType(newSort: ModrinthSortType) {
    if (selectedSortType === newSort) return;
    selectedSortType = newSort;
    performSearch(true); // Reset pagination when changing sort
  }

  // Fetch and display versions for a project
  async function fetchAndShowVersions(hit: ModrinthSearchHit) {
      const projectId = hit.project_id;
      if (selectedProjectId === projectId) {
          selectedProjectId = null;
          modVersions = [];
          versionsError = null;
          currentlySelectedHit = null; // Clear context
          return;
      }

      selectedProjectId = projectId;
      currentlySelectedHit = hit; // Store context
      versionsLoading = true;
      versionsError = null;
      modVersions = [];

      // Für Modpacks verwenden wir keine Filter für Gameversion und Loader
      const gameVersions = hit.project_type === "modpack" 
          ? undefined 
          : (currentGameVersionFilter ? [currentGameVersionFilter] : undefined);
      
      // Nur für Mods Loader-Filter anwenden
      const loaders = (hit.project_type === "mod" && currentLoaderFilter) 
          ? [currentLoaderFilter] 
          : undefined;

      console.log(`Fetching versions for ${projectId} (type: ${hit.project_type}): gameVersions=${gameVersions?.join(',') ?? 'N/A'}, loaders=${loaders?.join(',') ?? 'N/A'}`);

      try {
          const versionData = await invoke<ModrinthVersion[]>('get_modrinth_mod_versions', {
              projectIdOrSlug: projectId,
              gameVersions: gameVersions, 
              loaders: loaders 
          });
          // Add the search hit context to each version for later use
          modVersions = versionData.map(v => ({ ...v, search_hit: hit }));
      } catch (err) {
          console.error(`Failed to fetch versions for ${projectId}:`, err);
          versionsError = `Failed to load versions: ${err instanceof Error ? err.message : String(err)}`;
          modVersions = [];
      } finally {
          versionsLoading = false;
      }
  }

  // Funktion zum Öffnen des Profil-Dropdowns oder direktes Installieren
  function handleContentInstall(version: ModrinthVersion, file: ModrinthFile) {
    // Wenn es ein ModPack ist, immer direkt installieren
    if (version.search_hit?.project_type === 'modpack') {
      installModpack(version, file);
      return;
    }
    
    // Wenn ein Profil ausgewählt ist, direkt in dieses installieren
    const currentProfileId = $selectedProfile?.id;
    if (currentProfileId) {
      directInstallToProfile(version, file, currentProfileId);
    } else {
      // Ansonsten Dropdown anzeigen
      currentContentToInstall = { version, file };
      showProfileDropdown = true;
    }
  }
  
  // Direktes Installieren in ein spezifisches Profil
  async function directInstallToProfile(version: ModrinthVersion, file: ModrinthFile, profileId: string) {
    const versionId = version.id;
    addingModState = { ...addingModState, [versionId]: 'adding' };
    addError = null;
    
    try {
      const hit = version.search_hit;
      if (!hit) {
        throw new Error("Missing search hit context");
      }
      
      // Use different methods for different project types
      if (hit.project_type === "mod") {
        const payload = {
          profileId: profileId,
          projectId: version.project_id,
          versionId: version.id,
          fileName: file.filename,
          downloadUrl: file.url,
          fileHashSha1: file.hashes.sha1,
          modName: hit.title ?? file.filename,
          versionNumber: version.version_number,
          loaders: version.loaders,
          gameVersions: version.game_versions
        };
        
        console.log(`Installing mod to profile ${profileId}`);
        await invoke('add_modrinth_mod_to_profile', payload);
      } 
      else if (["resourcepack", "shader", "datapack"].includes(hit.project_type)) {
        const payload = {
          profileId: profileId,
          projectId: version.project_id,
          versionId: version.id,
          fileName: file.filename,
          downloadUrl: file.url,
          fileHashSha1: file.hashes.sha1,
          contentName: hit.title ?? file.filename,
          versionNumber: version.version_number,
          projectType: hit.project_type
        };
        
        console.log(`Installing ${hit.project_type} to profile ${profileId}`);
        await invoke('add_modrinth_content_to_profile', payload);
      }
      
      console.log(`Successfully added ${hit.project_type} ${file.filename}`);
      addingModState = { ...addingModState, [versionId]: 'success' };
      
      setTimeout(() => {
        addingModState = { ...addingModState, [versionId]: 'idle' };
      }, 2000);
      
    } catch (err) {
      console.error(`Failed to add ${version.search_hit?.project_type ?? "content"} ${file.filename}:`, err);
      addError = `Failed to add: ${err instanceof Error ? err.message : String(err)}`;
      addingModState = { ...addingModState, [versionId]: 'error' };
      
      setTimeout(() => {
        if (addingModState[versionId] === 'error') {
          addingModState = { ...addingModState, [versionId]: 'idle' };
          addError = null;
        }
      }, 5000);
    }
  }

  // Funktion zum Schließen des Dropdowns
  function handleCloseDropdown() {
    showProfileDropdown = false;
    currentContentToInstall = null;
  }

  // Füge die neue Funktion für Modpack-Installation hinzu
  async function installModpack(version: ModrinthVersion, file: ModrinthFile) {
      // Status für die UI aktualisieren
      addingModState = { ...addingModState, [version.id]: 'adding' };
      addError = null;
      
      try {
          const hit = version.search_hit;
          if (!hit) {
              throw new Error("Missing search hit context");
          }

          console.log(`Installing modpack ${hit.title} (${version.version_number})...`);
          
          // Rufe den Tauri-Befehl zum Herunterladen und Installieren auf
          const payload = {
              projectId: version.project_id,
              versionId: version.id,
              fileName: file.filename,
              downloadUrl: file.url
          };
          
          console.log("Invoking download_and_install_modrinth_modpack with payload:", payload);
          const profileId = await invoke<string>('download_and_install_modrinth_modpack', payload);
          
          console.log(`Successfully installed modpack as profile with ID: ${profileId}`);
          addingModState = { ...addingModState, [version.id]: 'success' };
          
          // Nach dem Erfolg den Status zurücksetzen
          setTimeout(() => {
              addingModState = { ...addingModState, [version.id]: 'idle' };
              // Aktualisiere die Profilliste, damit das neue Profil angezeigt wird
              loadProfiles();
          }, 2000);
          
      } catch (err) {
          console.error(`Failed to install modpack: ${err instanceof Error ? err.message : String(err)}`);
          addError = `Failed to install: ${err instanceof Error ? err.message : String(err)}`;
          addingModState = { ...addingModState, [version.id]: 'error' };
          
          setTimeout(() => {
              if (addingModState[version.id] === 'error') {
                  addingModState = { ...addingModState, [version.id]: 'idle' };
                  addError = null;
              }
          }, 5000);
      }
  }

  // Keyboard handler for search
  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      performSearch();
    }
  }

  // Debounce function for search
  let debounceTimer: number;
  function debouncedSearch() {
      clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(() => {
          performSearch();
      }, 500);
  }

  // Perform initial search and load profiles on mount
  onMount(() => {
      loadProfiles(); // Load profiles when this component mounts
      performSearch(); // Perform initial mod search
      return () => {
          clearTimeout(debounceTimer);
      };
  });

</script>

<div class="modrinth-search-container">
  <h2>Search on Modrinth</h2>

  <div class="search-bar">
    <input
      type="text"
      bind:value={searchTerm}
      on:input={debouncedSearch}
      on:keydown={handleKeydown}
      placeholder="Enter search term (or leave empty for popular)"
      aria-busy={searchLoading}
      aria-describedby="search-status"
      class:loading={searchLoading}
       />
    <button on:click={() => performSearch(true)} disabled={searchLoading}>
      {#if searchLoading} Searching... {:else} Search {/if}
    </button>
    {#if searchLoading}
      <span id="search-status" role="status" class="loading-indicator"> Loading...</span>
    {/if}
  </div>

  <!-- Project Type Tabs -->
  <div class="project-type-tabs">
    {#each projectTypes as tab}
      <button 
        class="tab-button {selectedProjectType === tab.type ? 'active' : ''}"
        data-type={tab.type}
        on:click={() => changeProjectType(tab.type)}
      >
        {tab.label}
      </button>
    {/each}
  </div>

  <!-- Sorting Options -->
  <div class="sort-options">
    <label for="sort-select">Sort by: </label>
    <select id="sort-select" bind:value={selectedSortType} on:change={() => performSearch(true)}>
      {#each sortOptions as option}
        <option value={option.type}>{option.label}</option>
      {/each}
    </select>
  </div>

  <!-- Profile Selector integrated here -->
  <ProfileSelect /> 

  <!-- Display selected profile or prompt -->
  <div class="profile-status">
    {#if selectedProjectType === "modpack"}
      <p>Modpacks werden direkt als neue Profile installiert, keine Profilauswahl erforderlich.</p>
    {:else if $selectedProfile}
      <p>Adding to profile: <strong>{$selectedProfile.name}</strong></p>
    {:else}
      <p class="info-message">Select a profile from the dropdown to enable adding mods.</p>
    {/if}
  </div>

  <!-- Display active filters -->
  <div class="filter-status">
    {#if filterByProfile}
      {#if currentGameVersionFilter || (selectedProjectType === "mod" && currentLoaderFilter)}
        Filtering for: 
        {#if currentGameVersionFilter}<span>MC {currentGameVersionFilter}</span>{/if}
        {#if currentGameVersionFilter && selectedProjectType === "mod" && currentLoaderFilter},{/if}
        {#if selectedProjectType === "mod" && currentLoaderFilter}<span>{currentLoaderFilter}</span>{/if}
      {:else}
        (Select a profile to apply filters)
      {/if}
    {/if}
  </div>

  {#if searchError}
    <p class="error-message">{searchError}</p>
  {/if}

  {#if searchResults.length > 0}
    <ul class="results-list">
      {#each searchResults as hit (hit.project_id)}
        <li class="result-item">
          <img
            src={hit.icon_url ?? 'default-icon.png'}
            alt={`${hit.title} icon`}
            class="mod-icon"
            loading="lazy"
            on:error={handleImageError}
          >
          <div class="fallback-icon" style="display:none;">📦</div>
          <div class="mod-details">
            <h3>{hit.title} <span class="mod-author">by {hit.author ?? 'Unknown'}</span></h3>
            <p class="mod-description">{hit.description}</p>
            <div class="mod-meta">
              <span>Downloads: {hit.downloads.toLocaleString()}</span>
              <span>Follows: {hit.follows.toLocaleString()}</span>
              {#if hit.latest_version}
                <span>Latest: {hit.latest_version}</span>
              {/if}
            </div>
            <div class="mod-actions">
              <button
                on:click={() => fetchAndShowVersions(hit)}
                disabled={versionsLoading && selectedProjectId === hit.project_id}
                class="versions-button"
              >
                {#if selectedProjectId === hit.project_id}
                  {#if versionsLoading}
                    Loading Versions...
                  {:else}
                    Hide Versions
                  {/if}
                {:else}
                  Show Versions
                {/if}
              </button>
            </div>

            {#if selectedProjectId === hit.project_id}
              <div class="versions-container">
                {#if versionsLoading}
                  <p>Loading versions...</p>
                {:else if versionsError}
                  <p class="error-message versions-error">{versionsError}</p>
                {:else if modVersions.length > 0}
                  <h4>Available Versions:</h4>
                  <ul class="versions-list">
                    {#each modVersions as version (version.id)}
                      {@const primaryFile = version.files.find(f => f.primary) ?? version.files[0]}
                      {@const downloadUrl = primaryFile?.url}
                      {@const downloadFilename = primaryFile?.filename ?? 'Unknown File'}
                      {@const currentAddState = addingModState[version.id] ?? 'idle'}

                      <li class="version-list-item">
                        <div class="version-info">
                            <strong>{version.version_number}</strong> <span class="version-type">({version.version_type})</span>
                            <div class="version-compatibility">
                                <span>MC: {version.game_versions.join(', ')}</span>
                                <span>Loaders: {version.loaders.join(', ')}</span>
                            </div>
                        </div>
                        
                        <div class="version-actions">
                          {#if downloadUrl && primaryFile}
                              {#if version.search_hit?.project_type === 'modpack'}
                                <!-- Spezielle Darstellung für Modpacks -->
                                <button 
                                  class="add-button modpack {currentAddState}" 
                                  data-content-type="modpack"
                                  on:click={() => handleContentInstall(version, primaryFile)}
                                  disabled={currentAddState === 'adding' || currentAddState === 'success'}
                                >
                                  {#if currentAddState === 'adding'}
                                    Installing...
                                  {:else if currentAddState === 'success'}
                                    Installed!
                                  {:else if currentAddState === 'error'}
                                    Retry
                                  {:else}
                                    Install Modpack
                                  {/if}
                                </button>
                              {:else}
                                <!-- Standard-Darstellung für andere Projektarten -->
                                <button 
                                  class="add-button {currentAddState}" 
                                  data-content-type={version.search_hit?.project_type}
                                  on:click={() => handleContentInstall(version, primaryFile)}
                                  disabled={currentAddState === 'adding' || currentAddState === 'success'}
                                >
                                  {#if currentAddState === 'adding'}
                                    Adding...
                                  {:else if currentAddState === 'success'}
                                    Added!
                                  {:else if currentAddState === 'error'}
                                    Retry
                                  {:else}
                                    <!-- Show different text based on project type -->
                                    {#if version.search_hit?.project_type === 'mod'}
                                      Install Mod
                                    {:else if version.search_hit?.project_type === 'resourcepack'}
                                      Install Resource Pack
                                    {:else if version.search_hit?.project_type === 'shader'}
                                      Install Shader
                                    {:else if version.search_hit?.project_type === 'datapack'}
                                      Install Datapack
                                    {:else}
                                      Install
                                    {/if}
                                  {/if}
                                </button>
                              {/if}
                              
                              <a 
                                href={downloadUrl} 
                                target="_blank"
                                rel="noopener noreferrer"
                                class="download-link"
                                title={`Download ${downloadFilename}`}
                              >
                                  Download
                              </a>
                          {:else}
                              <span class="no-file">(No file found)</span>
                          {/if}
                        </div>
                        
                      </li>
                    {/each}
                  </ul>
                {:else}
                  <p>No versions found matching the criteria.</p>
                {/if}
              </div>
            {/if}
          </div>
        </li>
      {/each}
    </ul>

    <!-- Pagination Controls -->
    {#if searchResponse && searchResponse.total_hits > pageSize}
      <div class="pagination-controls">
        <button 
          on:click={() => changePage(0)} 
          disabled={currentPage === 0 || searchLoading}
          class="pagination-button"
        >
          First
        </button>
        <button 
          on:click={() => changePage(currentPage - 1)} 
          disabled={currentPage === 0 || searchLoading}
          class="pagination-button"
        >
          Previous
        </button>
        
        <span class="pagination-info">Page {currentPage + 1} of {totalPages}</span>
        
        <button 
          on:click={() => changePage(currentPage + 1)} 
          disabled={currentPage >= totalPages - 1 || searchLoading}
          class="pagination-button"
        >
          Next
        </button>
        <button 
          on:click={() => changePage(totalPages - 1)} 
          disabled={currentPage >= totalPages - 1 || searchLoading}
          class="pagination-button"
        >
          Last
        </button>
      </div>
      <div class="pagination-summary">
        Showing {searchResponse.offset + 1}-{Math.min(searchResponse.offset + searchResponse.hits.length, searchResponse.total_hits)} of {searchResponse.total_hits} results
      </div>
    {/if}

   {:else if !searchLoading && !searchError}
     {#if searchTerm.trim()}
       <p>No results found for "{searchTerm}".</p>
     {:else}
       <p>Enter a search term or browse popular content.</p>
     {/if}
   {/if}
</div>

<!-- Ersetze das alte Dropdown durch die neue Komponente -->
<ModrinthProfileDropdown 
  show={showProfileDropdown}
  currentContentToInstall={currentContentToInstall}
  on:close={handleCloseDropdown}
/>

<style lang="css">
  .modrinth-search-container {
    font-family: sans-serif;
    padding: 1em;
    max-width: 800px;
    margin: auto;
  }
  .search-bar {
    display: flex;
    gap: 0.5em;
    margin-bottom: 1em;
    align-items: center; /* Align items vertically */
  }
  .search-bar input {
    flex-grow: 1;
    padding: 0.5em;
    border: 1px solid #ccc;
    border-radius: 4px;
  }
  .search-bar button {
    padding: 0.5em 1em;
    border: none;
    background-color: #007bff;
    color: white;
    border-radius: 4px;
    cursor: pointer;
    transition: background-color 0.2s;
  }
  .search-bar button:disabled {
    background-color: #aaa;
    cursor: not-allowed;
  }
  .search-bar button:hover:not(:disabled) {
    background-color: #0056b3;
  }
  
  /* Project Type Tabs */
  .project-type-tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 0.2em;
    margin-bottom: 1em;
    border-bottom: 1px solid #ddd;
  }
  .tab-button {
    padding: 0.5em 1em;
    border: 1px solid #ddd;
    border-bottom: none;
    border-radius: 4px 4px 0 0;
    background-color: #f8f9fa;
    cursor: pointer;
    transition: background-color 0.2s;
  }
  .tab-button.active {
    background-color: #007bff;
    color: white;
    border-color: #007bff;
  }
  .tab-button:hover:not(.active) {
    background-color: #e9ecef;
  }
  
  /* Sort Options */
  .sort-options {
    display: flex;
    align-items: center;
    gap: 0.5em;
    margin-bottom: 1em;
  }
  .sort-options label {
    font-size: 0.9em;
    white-space: nowrap;
  }
  .sort-options select {
    padding: 0.3em 0.5em;
    border: 1px solid #ccc;
    border-radius: 4px;
    background-color: white;
  }
  
  /* Pagination Controls */
  .pagination-controls {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 0.5em;
    margin-top: 1em;
    flex-wrap: wrap;
  }
  .pagination-button {
    padding: 0.3em 0.6em;
    border: 1px solid #ddd;
    border-radius: 4px;
    background-color: #f8f9fa;
    cursor: pointer;
    transition: background-color 0.2s;
  }
  .pagination-button:hover:not(:disabled) {
    background-color: #e9ecef;
  }
  .pagination-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .pagination-info {
    padding: 0.3em 0.6em;
    font-size: 0.9em;
  }
  .pagination-summary {
    text-align: center;
    font-size: 0.85em;
    color: #666;
    margin-top: 0.5em;
  }
  
  .error-message {
    color: #d9534f;
    margin-top: 1em;
  }
  .results-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 1em;
  }
  .result-item {
    display: flex;
    gap: 1em;
    padding: 1em;
    border: 1px solid #eee;
    border-radius: 4px;
    background-color: #f9f9f9;
  }
  .mod-icon {
    width: 64px;
    height: 64px;
    object-fit: contain;
    flex-shrink: 0;
    border-radius: 4px;
    background-color: #eee; /* Placeholder background */
  }
  .fallback-icon {
      width: 64px;
      height: 64px;
      font-size: 48px; /* Adjust size as needed */
      display: flex;
      align-items: center;
      justify-content: center;
      background-color: #eee;
      border-radius: 4px;
      flex-shrink: 0;
  }
  .mod-details {
    display: flex;
    flex-direction: column;
    gap: 0.3em;
    flex-grow: 1;
    overflow: hidden; /* Prevent long descriptions from breaking layout */
  }
  .mod-details h3 {
    margin: 0;
    font-size: 1.1em;
    display: flex;
    justify-content: space-between;
    flex-wrap: wrap; /* Allow author to wrap on small screens */
  }
  .mod-author {
      font-size: 0.9em;
      color: #555;
      font-weight: normal;
  }
  .mod-description {
    margin: 0;
    font-size: 0.9em;
    color: #333;
    /* Optional: Limit description lines */
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    text-overflow: ellipsis;
  }
   .mod-meta {
        font-size: 0.8em;
        color: #666;
        display: flex;
        gap: 1em;
        flex-wrap: wrap; /* Wrap meta items if needed */
    }
    .mod-meta span {
        white-space: nowrap;
    }
  .loading-indicator {
      font-size: 0.9em;
      color: #555;
      margin-left: 0.5em;
  }
  .search-bar input.loading {
      opacity: 0.8;
      /* Add a subtle background or border change if desired */
  }

  .mod-actions {
      margin-top: 0.5em;
  }
  .versions-button {
      padding: 0.3em 0.6em;
      font-size: 0.85em;
      background-color: #6c757d;
      color: white;
      border: none;
      border-radius: 3px;
      cursor: pointer;
      transition: background-color 0.2s;
  }
  .versions-button:hover:not(:disabled) {
      background-color: #5a6268;
  }
   .versions-button:disabled {
       opacity: 0.7;
       cursor: not-allowed;
   }

  .versions-container {
      margin-top: 0.8em;
      padding-top: 0.8em;
      border-top: 1px solid #eee;
  }
  .versions-container h4 {
      margin: 0 0 0.5em 0;
      font-size: 1em;
  }
  .versions-list {
      list-style: none;
      padding: 0.5em;
      margin: 0;
  }
  .version-list-item {
      margin-bottom: 0.6em;
      padding-bottom: 0.6em;
      border-bottom: 1px dashed #ddd;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 0.5em;
  }
  .version-list-item:last-child {
      border-bottom: none;
      margin-bottom: 0;
      padding-bottom: 0;
  }
  .version-info {
      flex-grow: 1;
      display: flex;
      flex-direction: column;
      gap: 0.2em;
      min-width: 0;
  }
  .version-type {
      font-size: 0.9em;
      color: #555;
  }
  .version-compatibility {
       font-size: 0.85em;
       color: #777;
       display: flex;
       flex-direction: column;
   }
   .version-compatibility span {
       white-space: normal;
   }

  .version-actions {
      display: flex;
      align-items: center;
      gap: 0.5em;
      flex-shrink: 0;
  }
  .add-button {
      padding: 0.3em 0.6em;
      font-size: 0.9em;
      background-color: #28a745; /* Default green for mods */
      color: white;
      border: none;
      border-radius: 3px;
      cursor: pointer;
      transition: background-color 0.2s;
      white-space: nowrap;
  }
  .add-button:hover {
      background-color: #218838;
  }
  
  /* Different colors for different content types */
  .tab-button[data-type="resourcepack"],
  .add-button[data-content-type="resourcepack"] {
      background-color: #17a2b8; /* Blue for resource packs */
  }
  .tab-button[data-type="resourcepack"]:hover,
  .add-button[data-content-type="resourcepack"]:hover {
      background-color: #138496;
  }
  
  .tab-button[data-type="shader"],
  .add-button[data-content-type="shader"] {
      background-color: #6f42c1; /* Purple for shaders */
  }
  .tab-button[data-type="shader"]:hover,
  .add-button[data-content-type="shader"]:hover {
      background-color: #5e37a6;
  }
  
  .tab-button[data-type="datapack"],
  .add-button[data-content-type="datapack"] {
      background-color: #fd7e14; /* Orange for datapacks */
  }
  .tab-button[data-type="datapack"]:hover,
  .add-button[data-content-type="datapack"]:hover {
      background-color: #e76b02;
  }

  .download-link {
      font-size: 0.9em;
      color: #007bff;
      text-decoration: none;
      white-space: nowrap;
      padding: 0.3em 0.6em;
      border: 1px solid #007bff;
      border-radius: 3px;
      transition: background-color 0.2s, color 0.2s;
  }
  .download-link:hover {
      background-color: #007bff;
      color: white;
      text-decoration: none;
  }
  .no-file {
      font-size: 0.9em;
      color: #999;
      flex-shrink: 0;
  }

  .versions-error {
      font-size: 0.9em;
      margin-top: 0.5em;
  }

  .info-message {
      padding: 0.5em 1em;
      background-color: #d1ecf1;
      border: 1px solid #bee5eb;
      color: #0c5460;
      border-radius: 4px;
      margin-bottom: 1em;
      text-align: center;
  }

  .add-button.adding {
      background-color: #ffc107; /* Yellow */
      color: #333;
      cursor: progress;
  }
  .add-button.success {
      background-color: #28a745; /* Green */
      cursor: default;
  }
   .add-button.error {
       background-color: #dc3545; /* Red */
   }

  .profile-status {
      margin-bottom: 1em;
      padding: 0.5em; 
      text-align: center; 
      border: 1px solid transparent; /* Base border */
      border-radius: 4px;
  }

  .profile-status strong {
      color: #0056b3; /* Or your theme color */
  }
  
  /* Reuse info-message style or create specific style */
  .profile-status .info-message {
      margin: 0; /* Reset margin if nested */
      padding: 0.5em 1em;
      background-color: #fff3cd; /* Light yellow */
      border-color: #ffeeba;
      color: #856404;
  }

  .filter-status {
      font-size: 0.85em;
      color: #666;
      margin-bottom: 1em;
      padding: 0.3em 0.5em;
      background-color: #f0f0f0;
      border: 1px solid #e0e0e0;
      border-radius: 4px;
      text-align: center;
  }
  .filter-status span {
      font-weight: bold;
      margin: 0 0.2em;
      padding: 0.1em 0.4em;
      background-color: #e9ecef;
      border-radius: 3px;
  }

  /* Modpack Button Style */
  .add-button.modpack {
      background-color: #dc3545; /* Rote Farbe für Modpacks */
  }
  .add-button.modpack:hover {
      background-color: #c82333;
  }
  
  .tab-button[data-type="modpack"],
  .add-button[data-content-type="modpack"] {
      background-color: #dc3545; /* Rote Farbe für Modpacks */
  }
  .tab-button[data-type="modpack"]:hover,
  .add-button[data-content-type="modpack"]:hover {
      background-color: #c82333;
  }
</style> 