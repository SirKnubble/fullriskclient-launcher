export interface ProcessMetadata {
    id: string;
    profile_id: string;
    start_time: string;
    state: ProcessState;
    pid: number;
}

export type ProcessState = 'Starting' | 'Running' | 'Stopping' | 'Stopped' | 'Crashed';

export interface ParsedExitPayload {
  profile_id: string;
  process_id: string;
  exit_code: number | null;
  success: boolean;
}

// Füge hier bei Bedarf weitere globale Typdefinitionen hinzu 