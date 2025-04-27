export type ProcessState = 'Starting' | 'Running' | 'Stopping' | 'Stopped' | 'Crashed';

export interface ProcessMetadata {
    id: string;
    profile_id: string;
    start_time: string;
    state: ProcessState;
    pid: number;
}

export interface EventPayload {
    event_id: string;
    event_type: 'installing_java' | 'downloading_libraries' | 'extracting_natives' | 'downloading_assets' | 'reusing_minecraft_assets' | 'copying_norisk_client_assets' | 'downloading_norisk_client_assets' | 'downloading_client' | 'installing_fabric' | 'installing_quilt' | 'installing_forge' | 'installing_neoforge' | 'patching_forge' | 'downloading_mods' | 'syncing_mods' | 'launching_minecraft' | 'minecraft_output' | 'account_login' | 'account_refresh' | 'account_logout' | 'profile_update' | 'trigger_profile_update' | 'minecraft_process_exited' | 'error';
    target_id: string | null;
    message: string;
    progress: number | null;
    error: string | null;
}

export interface ParsedExitPayload {
    profile_id: string;
    process_id: string;
    exit_code: number | null;
    success: boolean;
}

export interface LauncherConfig {
    version: number;
    is_experimental: boolean;
    auto_check_updates: boolean;
    concurrent_downloads: number;
}