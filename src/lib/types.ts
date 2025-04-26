export interface ProcessMetadata {
    id: string;
    profile_id: string;
    start_time: string;
    state: ProcessState;
    pid: number;
    account_uuid?: string;
    account_name?: string;
    minecraft_version?: string;
    modloader?: string;
    modloader_version?: string;
    norisk_pack?: string;
    profile_name?: string;
}

export type ProcessState = 'Starting' | 'Running' | 'Stopping' | 'Stopped' | 'Crashed';

export interface ParsedExitPayload {
  profile_id: string;
  process_id: string;
  exit_code: number | null;
  success: boolean;
}

// Füge hier bei Bedarf weitere globale Typdefinitionen hinzu 