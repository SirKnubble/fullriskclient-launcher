export interface ModSource {
    type: 'local' | 'url' | 'maven' | 'embedded' | 'modrinth';
    file_name?: string;
    url?: string;
    coordinates?: string;
    name?: string;
    project_id?: string;
}

export interface Mod {
    id: string;
    source: ModSource;
    enabled: boolean;
    display_name: string | null;
    version: string | null;
    game_versions: string[] | null;
    associated_loader: string | null;
}

export interface WindowSize {
    width: number;
    height: number;
}

export interface MemorySettings {
    min: number;
    max: number;
}

export interface ProfileSettings {
    java_path: string | null;
    memory: MemorySettings;
    resolution: WindowSize | null;
    fullscreen: boolean;
    extra_args: string[];
}

export type ProfileState = 'not_installed' | 'installing' | 'installed' | 'running' | 'error';

export interface NoriskModIdentifier {
    pack_id: string;
    mod_id: string;
    game_version: string; 
    loader: string;
}

export interface Profile {
    id: string; 
    name: string;
    path: string;
    game_version: string;
    loader: string; 
    loader_version: string | null;
    created: string; 
    last_played: string | null;
    mods: Mod[];
    settings: ProfileSettings;
    state: ProfileState;
    selected_norisk_pack_id: string | null;
    disabled_norisk_mods_detailed?: NoriskModIdentifier[];
}