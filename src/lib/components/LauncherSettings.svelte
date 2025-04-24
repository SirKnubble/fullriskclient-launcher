<script lang="ts">
  import { invoke } from "@tauri-apps/api/core";
  import { onMount } from "svelte";

  interface LauncherConfig {
    version: number;
    is_experimental: boolean;
    auto_check_updates: boolean;
    concurrent_downloads: number;
  }

  let config: LauncherConfig | null = $state(null);
  let tempConfig: LauncherConfig | null = $state(null); // Temporäre Konfiguration für Änderungen
  let loading = $state(true);
  let error: string | null = $state(null);
  let saving = $state(false);
  let saveSuccess = $state(false);

  onMount(async () => {
    await loadConfig();
  });

  async function loadConfig() {
    loading = true;
    error = null;
    try {
      const loadedConfig = await invoke<LauncherConfig>("get_launcher_config");
      config = loadedConfig;
      
      // Type-Assertion verwenden, um den Compiler zu beruhigen
      tempConfig = { ...loadedConfig } as LauncherConfig;
      console.log("Loaded launcher config:", config);
    } catch (err) {
      console.error("Failed to load launcher config:", err);
      error = err instanceof Error ? err.message : String(err);
      config = null;
      tempConfig = null;
    } finally {
      loading = false;
    }
  }

  // Methode zum Speichern der gesamten Konfiguration
  async function saveConfig() {
    if (!tempConfig) return;
    
    saving = true;
    saveSuccess = false;
    error = null;
    
    try {
      // Ganze Konfiguration auf einmal speichern
      config = await invoke<LauncherConfig>("set_launcher_config", { config: tempConfig });
      console.log("Configuration saved successfully:", config);
      saveSuccess = true;
      setTimeout(() => saveSuccess = false, 3000);
    } catch (err) {
      console.error("Failed to save configuration:", err);
      error = err instanceof Error ? err.message : String(err);
      // Änderungen zurücksetzen
      if (config) {
        tempConfig = { ...config };
      }
    } finally {
      saving = false;
    }
  }

  function handleConcurrentDownloadsChange(event: Event) {
    if (!tempConfig) return;
    
    const input = event.target as HTMLInputElement;
    const value = parseInt(input.value);
    if (!isNaN(value)) {
      tempConfig.concurrent_downloads = value;
    }
  }
</script>

<div class="launcher-settings">
  <h3>Launcher Einstellungen</h3>
  
  {#if loading}
    <p>Lade Einstellungen...</p>
  {:else if error}
    <p class="error-message">{error}</p>
    <button on:click={loadConfig}>Erneut versuchen</button>
  {:else if config && tempConfig}
    <div class="settings-grid">
      <div class="setting">
        <label for="experimental-mode">Experimenteller Modus</label>
        <div class="setting-control">
          <input 
            type="checkbox" 
            id="experimental-mode" 
            bind:checked={tempConfig.is_experimental}
            disabled={saving}
          />
          <span class="setting-description">Aktiviert experimentelle NoRisk Client Funktionen</span>
        </div>
      </div>
      
      <div class="setting">
        <label for="auto-updates">Automatische Updates</label>
        <div class="setting-control">
          <input 
            type="checkbox" 
            id="auto-updates" 
            bind:checked={tempConfig.auto_check_updates}
            disabled={saving}
          />
          <span class="setting-description">Automatisch nach Updates suchen</span>
        </div>
      </div>
      
      <div class="setting">
        <label for="concurrent-downloads">Gleichzeitige Downloads</label>
        <div class="setting-control">
          <input 
            type="number" 
            id="concurrent-downloads" 
            min="1" 
            max="10" 
            value={tempConfig.concurrent_downloads}
            on:change={handleConcurrentDownloadsChange}
            disabled={saving}
          />
          <span class="setting-description">Anzahl der gleichzeitigen Downloads (1-10)</span>
        </div>
      </div>
    </div>
    
    <div class="actions">
      <button 
        on:click={saveConfig}
        disabled={saving || JSON.stringify(config) === JSON.stringify(tempConfig)}
      >
        Einstellungen speichern
      </button>
      
      <button 
        on:click={() => { tempConfig = { ...config }; }}
        disabled={saving || JSON.stringify(config) === JSON.stringify(tempConfig)}
      >
        Änderungen zurücksetzen
      </button>
    </div>
    
    {#if saving}
      <p class="status-message saving">Speichere Einstellungen...</p>
    {:else if saveSuccess}
      <p class="status-message success">Einstellungen gespeichert!</p>
    {/if}
  {/if}
  
  <div class="config-info">
    {#if config}
      <p class="version-info">Konfigurationsversion: {config.version}</p>
    {/if}
  </div>
</div>

<style>
  .launcher-settings {
    background-color: #f7f7f7;
    border-radius: 8px;
    padding: 15px;
    margin-top: 20px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }
  
  h3 {
    margin-top: 0;
    margin-bottom: 15px;
    color: #333;
    font-size: 1.2em;
  }
  
  .settings-grid {
    display: flex;
    flex-direction: column;
    gap: 15px;
    margin-bottom: 20px;
  }
  
  .setting {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
    padding-bottom: 10px;
    border-bottom: 1px solid #eee;
  }
  
  .setting label {
    font-weight: bold;
    min-width: 180px;
    margin-right: 10px;
  }
  
  .setting-control {
    display: flex;
    align-items: center;
    gap: 10px;
    flex: 1;
  }
  
  .setting-description {
    color: #666;
    font-size: 0.9em;
  }
  
  input[type="checkbox"] {
    width: 18px;
    height: 18px;
    cursor: pointer;
  }
  
  input[type="number"] {
    width: 60px;
    padding: 5px;
    border: 1px solid #ccc;
    border-radius: 4px;
  }
  
  .error-message {
    color: #e74c3c;
    background-color: #fbeae8;
    border: 1px solid #e74c3c;
    padding: 10px;
    border-radius: 4px;
    margin: 10px 0;
  }
  
  .status-message {
    margin-top: 15px;
    padding: 8px;
    border-radius: 4px;
    text-align: center;
  }
  
  .status-message.saving {
    background-color: #f5f5f5;
    color: #333;
  }
  
  .status-message.success {
    background-color: #d4edda;
    color: #155724;
  }
  
  .config-info {
    margin-top: 15px;
    font-size: 0.8em;
    color: #888;
    text-align: right;
  }
  
  button {
    background-color: #3498db;
    color: white;
    border: none;
    padding: 8px 15px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.9em;
    margin-right: 10px;
  }
  
  button:disabled {
    background-color: #ccc;
    cursor: not-allowed;
  }
  
  button:hover:not(:disabled) {
    background-color: #2980b9;
  }
  
  .actions {
    display: flex;
    gap: 10px;
    margin-top: 15px;
  }
  
  .actions button:nth-child(2) {
    background-color: #e74c3c;
  }
  
  .actions button:nth-child(2):hover:not(:disabled) {
    background-color: #c0392b;
  }
</style> 