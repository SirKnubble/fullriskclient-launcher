import { useState, useEffect } from 'react';
import * as LauncherConfigService from '../services/launcher-config-service';

/**
 * Hook to determine if debug mode should be enabled
 * Debug mode is enabled if:
 * - Vite development mode (import.meta.env.DEV)
 * - OR localhost development server
 * - OR experimental mode is enabled in launcher config
 */
export function useDebugMode(): boolean {
  const [isDebugMode, setIsDebugMode] = useState(false);

  useEffect(() => {
    const checkDebugMode = async () => {
      try {
        // Multiple ways to detect development mode
        const isViteDevMode = import.meta.env.DEV;
        const isLocalhost = typeof window !== 'undefined' &&
          window.location.host.startsWith('localhost:');
        const isTauriDev = typeof window !== 'undefined' &&
          ((window as any).__TAURI__ || (window as any).__TAURI_INTERNALS__ || (window as any).__TAURI_METADATA__);

        // Check experimental mode in launcher config
        let isExperimentalMode = false;
        try {
          const config = await LauncherConfigService.getLauncherConfig();
          isExperimentalMode = config.is_experimental || false;
        } catch (error) {
          console.warn('[DebugMode] Could not fetch launcher config:', error);
        }

        // Debug mode is enabled if any of these conditions are true
        const debugEnabled = isViteDevMode || isLocalhost || isTauriDev || isExperimentalMode;
        setIsDebugMode(debugEnabled);

        if (debugEnabled) {
          console.log('[DebugMode] Debug mode enabled:', {
            isViteDevMode,
            isLocalhost,
            isTauriDev,
            isExperimentalMode
          });
        }
      } catch (error) {
        console.warn('[DebugMode] Error checking debug mode:', error);
        setIsDebugMode(false);
      }
    };

    checkDebugMode();
  }, []);

  return isDebugMode;
}

/**
 * Utility function to check debug mode synchronously (for non-React contexts)
 * This is async because it needs to check launcher config
 */
export async function isDebugModeEnabled(): Promise<boolean> {
  try {
    // Multiple ways to detect development mode
    const isViteDevMode = import.meta.env.DEV;
    const isLocalhost = typeof window !== 'undefined' &&
      window.location.host.startsWith('localhost:');
    const isTauriDev = typeof window !== 'undefined' &&
      ((window as any).__TAURI__ || (window as any).__TAURI_INTERNALS__ || (window as any).__TAURI_METADATA__);

    // Check experimental mode in launcher config
    let isExperimentalMode = false;
    try {
      const config = await LauncherConfigService.getLauncherConfig();
      isExperimentalMode = config.is_experimental || false;
    } catch (error) {
      console.warn('[DebugMode] Could not fetch launcher config for sync check:', error);
    }

    return isViteDevMode || isLocalhost || isTauriDev || isExperimentalMode;
  } catch (error) {
    console.warn('[DebugMode] Error in debug mode check:', error);
    return false;
  }
}

/**
 * Synchronous function to check if we're in a development environment
 * This only checks for development indicators, not launcher config
 * Useful for cases where async operations are not possible
 */
export function isDevelopmentEnvironment(): boolean {
  try {
    // Multiple ways to detect development mode (sync only)
    const isViteDevMode = import.meta.env.DEV;
    const isLocalhost = typeof window !== 'undefined' &&
      window.location.host.startsWith('localhost:');
    const isTauriDev = typeof window !== 'undefined' &&
      ((window as any).__TAURI__ || (window as any).__TAURI_INTERNALS__ || (window as any).__TAURI_METADATA__);

    return isViteDevMode || isLocalhost || isTauriDev;
  } catch (error) {
    console.warn('[DebugMode] Error in sync development check:', error);
    return false;
  }
}
