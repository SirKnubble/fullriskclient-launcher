import { invoke } from '@tauri-apps/api/core';

const ANALYTICS_API_URL = 'https://analytics-api-staging.norisk.gg/';

interface AnalyticsEvent {
    event_type: string;
    timestamp: string;
    session_id: string;
    user_id: string;
    properties?: Record<string, any>;
}

let sessionId: string | null = null;
let userId: string | null = null;
let launcherStartTracked: boolean = false;
let analyticsEnabled: boolean | null = null;

export const initializeAnalytics = async (): Promise<void> => {
    sessionId = generateSessionId();
    userId = await getOrCreateUserId();
};

const checkAnalyticsEnabled = async (): Promise<boolean> => {
    try {
        // Cache the analytics enabled state to avoid repeated config calls
        if (analyticsEnabled === null) {
            const config: any = await invoke('get_launcher_config');
            analyticsEnabled = config.enable_analytics || false;
        }
        return analyticsEnabled;
    } catch (error) {
        console.warn('[Analytics] Failed to check analytics config, defaulting to disabled:', error);
        return false;
    }
};

export const invalidateAnalyticsCache = (): void => {
    analyticsEnabled = null;
};

const generateSessionId = (): string => {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

const getOrCreateUserId = async (): Promise<string> => {
    let storedUserId = localStorage.getItem('analytics_user_id');

    if (!storedUserId) {
        storedUserId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        localStorage.setItem('analytics_user_id', storedUserId);
    }

    return storedUserId;
};

export const trackEvent = async (
    eventType: string,
    properties?: Record<string, any>
): Promise<void> => {
    try {
        // Check if analytics are enabled first
        const enabled = await checkAnalyticsEnabled();
        if (!enabled) {
            console.log('[Analytics] Analytics disabled, skipping event:', eventType);
            return;
        }

        if (!sessionId || !userId) {
            await initializeAnalytics();
        }

        const event: AnalyticsEvent = {
            event_type: eventType,
            timestamp: new Date().toISOString(),
            session_id: sessionId!,
            user_id: userId!,
            properties,
        };

        console.log('[Analytics] Sending event:', event.event_type, 'with properties:', event.properties);

        await invoke('track_analytics_event', {
            event: event
        });

        console.log('[Analytics] Event sent successfully:', event.event_type);
    } catch (error) {
        console.error('[Analytics] Failed to track event:', eventType, 'Error:', error);
        throw error;
    }
};

export const trackLauncherStart = async (version?: string): Promise<void> => {
    // Prevent double-tracking in React StrictMode
    if (launcherStartTracked) {
        console.log('[Analytics] Launcher start already tracked, skipping');
        return;
    }

    try {
        launcherStartTracked = true;
        console.log('[Analytics] Tracking launcher start...');

        let launcherVersion = version;
        if (!launcherVersion) {
            try {
                launcherVersion = await invoke<string>('get_app_version');
            } catch (e) {
                launcherVersion = 'unknown';
            }
        }

        let javaVersion = 'unknown';
        try {
            const javaInfo: any = await invoke('get_java_info_command');
            javaVersion = javaInfo?.version || 'unknown';
        } catch (e) {
            console.error('[Analytics] Failed to get Java version:', e);
        }

        await trackEvent('launcher_started', {
            launcher_version: launcherVersion,
            java_version: javaVersion,
            os: getOS(),
            os_version: getOSVersion(),
        });

        console.log('[Analytics] Launcher start tracked successfully');
    } catch (error) {
        launcherStartTracked = false; // Reset on error so it can retry
        console.error('[Analytics] Failed to track launcher start:', error);
        throw error;
    }
};

export const trackMinecraftStarted = async (profileId: string, minecraftVersion: string, loader?: string): Promise<void> => {
        await trackEvent('minecraft_started', {
            profile_id: profileId,
            version: minecraftVersion,
            loader,
        });
};

export const trackTabClicked = async (tabName: string): Promise<void> => {
    console.log('[Analytics] Tracking tab click:', tabName);
    try {
        await trackEvent('sidebar_tab_clicked', {
            tab_name: tabName,
        });
        console.log('[Analytics] Tab click tracked successfully:', tabName);
    } catch (error) {
        console.error('[Analytics] Failed to track tab click:', tabName, error);
    }
};

export const trackSkinAdded = async (
    skinName: string,
    skinVariant: 'classic' | 'slim',
    sourceType: 'username' | 'uuid' | 'url' | 'file',
    sourceValue?: string
): Promise<void> => {
    await trackEvent('skin_added', {
        skin_name: skinName,
        skin_variant: skinVariant,
        skin_type: skinVariant,
        source: sourceType,
        source_type: sourceType,
        source_value: sourceValue || '',
    });
};

const getOS = (): string => {
    const platform = window.navigator.platform.toLowerCase();
    if (platform.includes('win')) return 'windows';
    if (platform.includes('mac')) return 'macos';
    if (platform.includes('linux')) return 'linux';
    return 'unknown';
};

const getOSVersion = (): string => {
    return window.navigator.platform;
};

const getJavaVersion = async (): Promise<string> => {
    try {
        const javaInfo: any = await invoke('get_java_info_command');
        return javaInfo?.version || 'unknown';
    } catch (error) {
        console.error('[Analytics] Failed to get Java version:', error);
        return 'unknown';
    }
};

export const trackColorChanged = async (colorName: string): Promise<void> => {
    const name = colorName?.trim() || 'Custom';
    await trackEvent('color_changed', {
        color: name,
        color_name: name,
    });
};

export const trackBorderRadiusChanged = async (radius: number): Promise<void> => {
    await trackEvent('border_radius_changed', {
        radius,
        radius_px: radius,
    });
};

export const trackBetaUpdatesToggled = async (enabled: boolean): Promise<void> => {
    await trackEvent('beta_update_toggled', {
        enabled,
    });
};
