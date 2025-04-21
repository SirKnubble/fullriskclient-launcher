<script lang="ts">
  import { invoke } from '@tauri-apps/api/core';
  // import { open } from '@tauri-apps/api/shell'; // Removed import
  import { onMount } from 'svelte';
  import { loadProfiles, selectedProfile, profiles } from '$lib/stores/profileStore'; // Import selectedProfile store
  import ProfileSelect from '$lib/components/ProfileSelect.svelte'; // Import ProfileSelect

  // --- Props --- 
  // targetProfileId is now implicitly handled via the selectedProfile store
  // export let targetProfileId: string | null = null; 

  // --- Interfaces matching Rust structs --- 

  interface ModrinthSearchHit {
    project_id: string;
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
  let searchResults: ModrinthSearchHit[] = []; // Renamed from 'results'
  let searchLoading = false; // Renamed from 'isLoading'
  let searchError: string | null = null; // Renamed from 'error'

  let selectedProjectId: string | null = null; // Track which project's versions are shown
  let modVersions: ModrinthVersion[] = [];
  let versionsLoading = false;
  let versionsError: string | null = null;
  let currentlySelectedHit: ModrinthSearchHit | null = null; // Store the hit for context
  let addingModState: { [versionId: string]: 'idle' | 'adding' | 'error' | 'success' } = {}; // Track adding state per version
  let addError: string | null = null;

  // Filter state (could be made interactive later)
  let filterByProfile = true; // Control whether to use profile filters

  // --- Derived Values --- 
  // Get filter values reactively from the selected profile
  $: currentGameVersionFilter = filterByProfile ? $selectedProfile?.game_version : undefined;
  $: currentLoaderFilter = filterByProfile ? $selectedProfile?.loader : undefined;

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
  async function performSearch() {
    searchLoading = true;
    searchError = null;

    const gameVersion = currentGameVersionFilter; // Use derived value
    const loader = currentLoaderFilter; // Use derived value

    console.log(`Performing search: query='${searchTerm.trim()}', gameVersion=${gameVersion ?? 'N/A'}, loader=${loader ?? 'N/A'}`);

    try {
      const resultsData = await invoke<ModrinthSearchHit[]>('search_modrinth_mods', {
        query: searchTerm.trim(),
        limit: 25,
        gameVersion: gameVersion,
        loader: loader
      });
      searchResults = resultsData;
      // Clear version display when performing a new search
      selectedProjectId = null;
      modVersions = [];
      versionsError = null;
    } catch (err) {
      console.error("Modrinth search failed:", err);
      searchError = `Search failed: ${err instanceof Error ? err.message : String(err)}`;
      searchResults = [];
    } finally {
      searchLoading = false;
    }
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

      const gameVersions = currentGameVersionFilter ? [currentGameVersionFilter] : undefined;
      const loaders = currentLoaderFilter ? [currentLoaderFilter] : undefined;

      console.log(`Fetching versions for ${projectId}: gameVersions=${gameVersions?.join(',') ?? 'N/A'}, loaders=${loaders?.join(',') ?? 'N/A'}`);

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

  // Function to add mod to profile
  async function addModVersionToProfile(version: ModrinthVersion, file: ModrinthFile) {
      // Use the ID from the store directly
      const currentProfileId = $selectedProfile?.id; 

      if (!currentProfileId) {
          alert('Please select a profile first before adding mods.');
          console.error('Cannot add mod: targetProfileId (from store) is not set.');
          return;
      }

      addingModState = { ...addingModState, [version.id]: 'adding' };
      addError = null;

      const payload = {
          profileId: currentProfileId, // Use ID from store
          // Extract details needed by the backend command
          projectId: version.project_id,
          versionId: version.id,
          fileName: file.filename,
          downloadUrl: file.url, // Ensure this field exists in ModrinthFile interface if needed by backend
          fileHashSha1: file.hashes.sha1, // Send SHA1 hash
          modName: version.search_hit?.title ?? file.filename, // Best guess for mod name
          versionNumber: version.version_number,
          loaders: version.loaders, // Pass loaders array
          gameVersions: version.game_versions // Pass game versions array
      };

      console.log("Invoking add_modrinth_mod_to_profile with payload:", payload);

      try {
          await invoke('add_modrinth_mod_to_profile', payload);
          
          console.log(`Successfully invoked add_mod_to_profile for ${file.filename}`);
          addingModState = { ...addingModState, [version.id]: 'success' };
          // Optional: Provide visual feedback like changing button text or showing a temporary message
          setTimeout(() => {
              addingModState = { ...addingModState, [version.id]: 'idle' }; // Reset after a delay
          }, 2000); 

      } catch (err) {
          console.error(`Failed to add mod ${file.filename}:`, err);
          addError = `Failed to add mod: ${err instanceof Error ? err.message : String(err)}`;
          addingModState = { ...addingModState, [version.id]: 'error' };
          // Keep error state until user interacts again or reset after delay
          setTimeout(() => {
              if (addingModState[version.id] === 'error') {
                 addingModState = { ...addingModState, [version.id]: 'idle' }; 
                 addError = null; // Clear general error message too
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
  <h2>Search Mods on Modrinth</h2>

  <div class="search-bar">
    <input
      type="text"
      bind:value={searchTerm}
      on:input={debouncedSearch}
      on:keydown={handleKeydown}
      placeholder="Enter mod name (or leave empty for popular)"
      aria-busy={searchLoading}
      aria-describedby="search-status"
      class:loading={searchLoading}
       />
    <button on:click={performSearch} disabled={searchLoading}>
      {#if searchLoading} Searching... {:else} Search {/if}
    </button>
    {#if searchLoading}
      <span id="search-status" role="status" class="loading-indicator"> Loading...</span>
    {/if}
  </div>

  <!-- Profile Selector integrated here -->
  <ProfileSelect /> 

  <!-- Display selected profile or prompt -->
  <div class="profile-status">
    {#if $selectedProfile}
      <p>Adding mods to profile: <strong>{$selectedProfile.name}</strong></p>
    {:else}
      <p class="info-message">Select a profile from the dropdown to enable adding mods.</p>
    {/if}
  </div>

  <!-- Display active filters -->
  <div class="filter-status">
    {#if filterByProfile && (currentGameVersionFilter || currentLoaderFilter)}
      Filtering for: 
      {#if currentGameVersionFilter}<span>MC {currentGameVersionFilter}</span>{/if}
      {#if currentGameVersionFilter && currentLoaderFilter},{/if}
      {#if currentLoaderFilter}<span>{currentLoaderFilter}</span>{/if}
      <!-- TODO: Add button/checkbox to disable filtering -->
    {:else if filterByProfile}
      (Select a profile to apply filters)
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
                              <button 
                                  class="add-button {currentAddState}" 
                                  on:click={() => addModVersionToProfile(version, primaryFile)}
                                  disabled={!$selectedProfile || currentAddState === 'adding' || currentAddState === 'success'}
                              >
                                  {#if currentAddState === 'adding'}
                                    Adding...
                                  {:else if currentAddState === 'success'}
                                    Added!
                                  {:else if currentAddState === 'error'}
                                    Retry Add
                                  {:else}
                                    Add <!-- {downloadFilename} -->
                                  {/if}
                              </button>
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
   {:else if !searchLoading && !searchError}
     {#if searchTerm.trim()}
       <p>No results found for "{searchTerm}".</p>
     {:else}
       <p>Enter a search term or browse popular mods.</p>
     {/if}
   {/if}
</div>

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
      background-color: #28a745;
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
</style> 