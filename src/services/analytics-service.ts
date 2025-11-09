import { invoke } from '@tauri-apps/api/core';

const ANALYTICS_API_URL = 'https://track.norisk.gg/api/track';

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

export const initializeAnalytics = async (): Promise<void> => {
    sessionId = generateSessionId();
    userId = await getOrCreateUserId();
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
        minecraft_version: minecraftVersion,
        loader,
    });
};

export const trackTabClicked = async (tabName: string): Promise<void> => {
    console.log('[Analytics] Tracking tab click:', tabName);
    try {
        await trackEvent('tab_clicked', {
            tab_name: tabName,
        });
        console.log('[Analytics] Tab click tracked successfully:', tabName);
    } catch (error) {
        console.error('[Analytics] Failed to track tab click:', tabName, error);
    }
};

export const trackSkinAdded = async (
    skinName: string,
    sourceType: 'username' | 'uuid' | 'url' | 'file',
    sourceValue?: string
): Promise<void> => {
    await trackEvent('skin_added', {
        skin_name: skinName,
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
    await trackEvent('color_changed', {
        color: colorName,
    });
};

export const trackBorderRadiusChanged = async (radius: number): Promise<void> => {
    await trackEvent('border_radius_changed', {
        radius,
    });
};

export const trackBetaUpdatesToggled = async (enabled: boolean): Promise<void> => {
    await trackEvent('beta_updates_toggled', {
        enabled,
    });
};
