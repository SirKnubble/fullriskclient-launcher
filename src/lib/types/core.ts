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
    event_type: string;
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