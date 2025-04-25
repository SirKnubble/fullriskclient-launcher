// --- Enums ---

export type ModLoader = 'vanilla' | 'forge' | 'fabric' | 'quilt' | 'neoforge';

export type ProfileState = 'not_installed' | 'installing' | 'installed' | 'running' | 'error';

// --- Dependent Structs/Interfaces ---

export interface MemorySettings {
  min: number; // u32 -> number
  max: number; // u32 -> number
}

export interface WindowSize {
  width: number; // u32 -> number
  height: number; // u32 -> number
}

export interface ProfileSettings {
  java_path: string | null;       // Option<String> -> string | null
  memory: MemorySettings;
  resolution: WindowSize | null; // Option<WindowSize> -> WindowSize | null
  fullscreen: boolean;
  extra_args: string[];           // Vec<String> -> string[]
}

// Base interfaces for ModSource discriminated union
interface ModSourceBase {
  type: 'local' | 'url' | 'maven' | 'embedded' | 'modrinth';
}

export interface ModSourceLocal extends ModSourceBase {
  type: 'local';
  file_name: string;
}

export interface ModSourceUrl extends ModSourceBase {
  type: 'url';
  url: string;
  file_name: string | null;
}

export interface ModSourceMaven extends ModSourceBase {
  type: 'maven';
  coordinates: string;
  repository_url: string | null;
}

export interface ModSourceEmbedded extends ModSourceBase {
  type: 'embedded';
  name: string;
}

export interface ModSourceModrinth extends ModSourceBase {
  type: 'modrinth';
  project_id: string;
  version_id: string;
  file_name: string;
  download_url: string;
  file_hash_sha1: string | null;
}

// Discriminated Union for ModSource
export type ModSource =
  | ModSourceLocal
  | ModSourceUrl
  | ModSourceMaven
  | ModSourceEmbedded
  | ModSourceModrinth;


export interface Mod {
  id: string; // Uuid -> string
  source: ModSource;
  enabled: boolean;
  display_name: string | null;
  version: string | null;
  game_versions: string[] | null; // Option<Vec<String>> -> string[] | null
  file_name_override: string | null;
  associated_loader: ModLoader | null; // Option<ModLoader> -> ModLoader | null
}

export interface NoriskModIdentifier {
  pack_id: string;
  mod_id: string;
  game_version: string;
  loader: ModLoader;
}

export interface NoriskInformation {
}


// --- Main Profile Interface ---

export interface Profile {
  id: string;                      // Uuid -> string
  name: string;
  path: string;
  game_version: string;
  loader: ModLoader;
  loader_version: string | null;   // Option<String> -> string | null
  created: string;                 // DateTime<Utc> -> string (ISO 8601)
  last_played: string | null;      // Option<DateTime<Utc>> -> string | null
  settings: ProfileSettings;
  state: ProfileState;
  mods: Mod[];                     // Vec<Mod> -> Mod[]
  selected_norisk_pack_id: string | null; // Option<String> -> string | null
  disabled_norisk_mods_detailed: NoriskModIdentifier[]; // HashSet -> Array
  source_standard_profile_id: string | null; // Option<Uuid> -> string | null
  group: string | null;             // Option<String> -> string | null
  is_standard_version: boolean;
  description: string | null;
  norisk_information: NoriskInformation | null; // Option<NoriskInformation> -> NoriskInformation | null
}