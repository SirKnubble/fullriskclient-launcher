<script lang="ts">
  import { invoke } from '@tauri-apps/api/core';
  import { loadProfiles, profiles } from '$lib/stores/profileStore';
  
  // Typen aus der Hauptkomponente
  export let currentContentToInstall: { 
    version: {
      id: string;
      project_id: string;
      version_number: string;
      loaders: string[];
      game_versions: string[];
      files: Array<{
        hashes: { sha1: string | null, sha512: string | null };
        url: string;
        filename: string;
        primary: boolean;
      }>;
      search_hit?: {
        title: string;
        project_type: string;
      }
    },
    file: {
      hashes: { sha1: string | null, sha512: string | null };
      url: string;
      filename: string;
      primary: boolean;
    }
  } | null = null;
  
  export let show = false;
  
  // Tracking für erfolgreiche Installationen pro Profil
  let successfulInstallations: {[profileId: string]: boolean} = {};
  let addingModState: { [key: string]: 'idle' | 'adding' | 'error' | 'success' } = {};
  let addError: string | null = null;
  let hoveringProfileId: string | null = null;
  
  // Event-Dispatcher für Schließen
  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher<{close: void}>();
  
  function closeDropdown() {
    dispatch('close');
    // Zurücksetzen der Zustände
    successfulInstallations = {};
    addingModState = {};
    addError = null;
  }
  
  // Funktion zum Installieren in einem bestimmten Profil
  async function installContentToSpecificProfile(profileId: string) {
    if (!currentContentToInstall) return;
    
    const { version, file } = currentContentToInstall;
    const hit = version.search_hit;
    
    if (!hit) {
      console.error("Missing search hit context");
      return;
    }
    
    // Setup state für dieses Profil
    const profileInstallState = `${version.id}-${profileId}`;
    addingModState = { ...addingModState, [profileInstallState]: 'adding' };
    addError = null;
    
    try {
      // Handle different content types
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
        
        await invoke('add_modrinth_content_to_profile', payload);
      }
      
      console.log(`Successfully added ${hit.project_type} to profile ${profileId}`);
      addingModState = { ...addingModState, [profileInstallState]: 'success' };
      
      // Markiere das Profil als erfolgreich installiert
      successfulInstallations = { ...successfulInstallations, [profileId]: true };
      
      setTimeout(() => {
        addingModState = { ...addingModState, [profileInstallState]: 'idle' };
      }, 3000);
      
    } catch (err) {
      console.error(`Failed to add to profile ${profileId}:`, err);
      addError = `Failed to add: ${err instanceof Error ? err.message : String(err)}`;
      addingModState = { ...addingModState, [profileInstallState]: 'error' };
      
      setTimeout(() => {
        if (addingModState[profileInstallState] === 'error') {
          addingModState = { ...addingModState, [profileInstallState]: 'idle' };
        }
      }, 5000);
    }
  }
</script>

<!-- Modal-Popup für Profilauswahl -->
{#if show && currentContentToInstall}
  <div class="profile-dropdown-overlay" on:click={closeDropdown}>
    <div class="profile-dropdown-container" on:click|stopPropagation>
      <h3>Wähle ein Profil zur Installation</h3>
      
      {#if currentContentToInstall.version.search_hit?.project_type}
        <p class="content-title">
          {currentContentToInstall.version.search_hit.title} 
          <span class="content-version">v{currentContentToInstall.version.version_number}</span>
        </p>
      {/if}
      
      {#if $profiles && $profiles.length > 0}
        <ul class="profile-list">
          {#each $profiles as profile (profile.id)}
            <li class="profile-list-item" 
                on:mouseenter={() => hoveringProfileId = profile.id}
                on:mouseleave={() => hoveringProfileId = null}
            >
              <div class="profile-info">
                <strong>{profile.name}</strong>
                <span class="profile-meta">
                  MC {profile.game_version}
                  {#if profile.loader}
                    • {profile.loader}
                  {/if}
                </span>
              </div>
              
              <!-- Installation button with status -->
              {#if currentContentToInstall?.version?.id}
                {@const profileInstallState = `${currentContentToInstall.version.id}-${profile.id}`}
                {@const installState = addingModState[profileInstallState] || 'idle'}
                {@const wasSuccessful = successfulInstallations[profile.id] || false}
                
                {#if wasSuccessful}
                  <button 
                    class="install-to-profile-btn success"
                    disabled={true}
                  >
                    Installed ✓
                  </button>
                {:else if installState === 'adding'}
                  <button 
                    class="install-to-profile-btn adding"
                    disabled={true}
                  >
                    Installing...
                  </button>
                {:else if installState === 'error'}
                  <button 
                    class="install-to-profile-btn error"
                    on:click={() => installContentToSpecificProfile(profile.id)}
                  >
                    Retry
                  </button>
                {:else}
                  <button 
                    class="install-to-profile-btn"
                    on:click={() => installContentToSpecificProfile(profile.id)}
                    class:hovering={hoveringProfileId === profile.id}
                  >
                    Install
                  </button>
                {/if}
              {:else}
                <button 
                  class="install-to-profile-btn"
                  on:click={() => installContentToSpecificProfile(profile.id)}
                  class:hovering={hoveringProfileId === profile.id}
                >
                  Install
                </button>
              {/if}
            </li>
          {/each}
        </ul>
      {:else}
        <p class="no-profiles">Keine Profile gefunden. Erstelle zuerst ein Profil.</p>
      {/if}
      
      <!-- Anzeige zur Orientierung -->
      <div class="installation-summary">
        {#if Object.keys(successfulInstallations).length > 0}
          <p class="success-message">
            Installation in {Object.keys(successfulInstallations).length} 
            {Object.keys(successfulInstallations).length === 1 ? 'Profil' : 'Profilen'} erfolgreich!
          </p>
        {:else if addError}
          <p class="error-message">{addError}</p>
        {/if}
      </div>
      
      <!-- Button je nach Status -->
      {#if Object.keys(successfulInstallations).length > 0}
        <button class="close-dropdown-btn success" on:click={closeDropdown}>Fertig</button>
      {:else}
        <button class="close-dropdown-btn" on:click={closeDropdown}>Abbrechen</button>
      {/if}
    </div>
  </div>
{/if}

<style>
  /* Profile dropdown styles */
  .profile-dropdown-overlay {
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

  .profile-dropdown-container {
    background: white;
    padding: 1.5rem;
    border-radius: 8px;
    max-width: 500px;
    width: 90%;
    max-height: 80vh;
    overflow-y: auto;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }

  .profile-dropdown-container h3 {
    margin-top: 0;
    margin-bottom: 1rem;
    text-align: center;
    color: #333;
  }

  .content-title {
    text-align: center;
    font-weight: bold;
    margin-bottom: 1.5rem;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid #eee;
  }

  .content-version {
    font-weight: normal;
    color: #666;
    font-size: 0.9em;
  }

  .profile-list {
    list-style: none;
    padding: 0;
    margin: 0 0 1rem 0;
  }

  .profile-list-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.8rem;
    border: 1px solid #eee;
    border-radius: 4px;
    margin-bottom: 0.5rem;
    transition: background-color 0.2s;
  }

  .profile-list-item:hover {
    background-color: #f5f5f5;
  }

  .profile-info {
    display: flex;
    flex-direction: column;
  }

  .profile-meta {
    font-size: 0.8em;
    color: #666;
    margin-top: 0.3rem;
  }

  .install-to-profile-btn {
    background-color: #28a745;
    color: white;
    border: none;
    border-radius: 4px;
    padding: 0.5rem 1rem;
    cursor: pointer;
    transition: background-color 0.2s;
  }

  .install-to-profile-btn:hover, 
  .install-to-profile-btn.hovering {
    background-color: #218838;
  }

  .close-dropdown-btn {
    display: block;
    width: 100%;
    background-color: #f8f9fa;
    border: 1px solid #ddd;
    padding: 0.7rem;
    border-radius: 4px;
    color: #555;
    font-weight: bold;
    cursor: pointer;
    transition: background-color 0.2s;
    margin-top: 1rem;
  }

  .close-dropdown-btn:hover {
    background-color: #e9ecef;
  }

  .no-profiles {
    text-align: center;
    color: #666;
    font-style: italic;
    padding: 1rem 0;
  }

  .installation-summary {
    margin-top: 1rem;
    text-align: center;
  }

  .success-message {
    color: #28a745;
    font-weight: bold;
  }

  .error-message {
    color: #dc3545;
  }

  .install-to-profile-btn.success {
    background-color: #28a745;
    cursor: default;
  }

  .install-to-profile-btn.adding {
    background-color: #ffc107;
    color: #212529;
    cursor: progress;
  }

  .install-to-profile-btn.error {
    background-color: #dc3545;
  }

  .install-to-profile-btn.error:hover {
    background-color: #c82333;
  }

  .close-dropdown-btn.success {
    background-color: #28a745;
    color: white;
    border-color: #28a745;
  }

  .close-dropdown-btn.success:hover {
    background-color: #218838;
  }
</style> 