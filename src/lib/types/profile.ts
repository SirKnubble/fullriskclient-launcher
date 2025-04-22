export interface MemorySettings {
    min: number; // in MB
    max: number; // in MB
}

export interface WindowSize {
    width: number;
    height: number;
}

export interface ProfileSettings {
    java_path?: string | null;
    memory: MemorySettings;
    resolution?: WindowSize | null;
    fullscreen: boolean;
    extra_args: string[];
}