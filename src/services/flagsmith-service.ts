import flagsmith from 'flagsmith';
import { invoke } from '@tauri-apps/api/core';

/**
 * Configuration for blocked mods that cause crashes or compatibility issues.
 */
export interface BlockedModsConfig {
  exact_filenames: string[];
  filename_patterns: string[];
  mod_ids: string[];
  description: string;
}

// Initialize flagsmith with the same configuration as in App.tsx
const FLAGSMITH_ENVIRONMENT_ID = "eNSibjDaDW2nNJQvJnjj9y";

let flagsmithInitialized = false;

const initializeFlagsmith = async () => {
  try {
    console.log('Initializing Flagsmith service...');
    await flagsmith.init({
      environmentID: FLAGSMITH_ENVIRONMENT_ID,
      api: 'https://flagsmith-staging.norisk.gg/api/v1/',
    });
    flagsmithInitialized = true;
    console.log('Flagsmith service initialized successfully');
  } catch (error) {
    console.error('Failed to initialize Flagsmith service:', error);
    throw error;
  }
};

// Initialize flagsmith when the module is loaded
const initPromise = initializeFlagsmith();

/**
 * Fetches the blocked mods configuration from Flagsmith.
 *
 * @returns A promise that resolves to the BlockedModsConfig object.
 * @throws If the flag is not available or parsing fails.
 */
export const getBlockedModsConfig = async (): Promise<BlockedModsConfig> => {
  try {
    // Wait for initialization if not done yet
    if (!flagsmithInitialized) {
      console.log('Waiting for Flagsmith initialization...');
      await initPromise;
    }

    console.log('Attempting to get blocked_mods_config flag...');
    const flagValue = flagsmith.getValue('blocked_mods_config');
    
    console.log('Raw flag value:', flagValue);
    
    if (!flagValue) {
      // Log all available flags for debugging
      const allFlags = flagsmith.getAllFlags();
      console.log('Available flags:', allFlags);
      throw new Error('blocked_mods_config flag not found');
    }

    // Parse the JSON value
    const config: BlockedModsConfig = JSON.parse(flagValue as string);
    console.log('Parsed blocked mods config:', config);
    
    // Send the config to Rust backend for caching
    try {
      await invoke('set_blocked_mods_config', { config });
      console.log('Successfully sent blocked mods config to Rust backend');
    } catch (error) {
      console.error('Failed to send blocked mods config to Rust backend:', error);
      // Don't throw here - the config is still valid for frontend use
    }
    
    return config;
  } catch (error) {
    console.error('Failed to fetch blocked mods config from Flagsmith:', error);
    throw error;
  }
}; 