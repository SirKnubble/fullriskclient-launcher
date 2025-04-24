/**
 * Defines the structure for memory allocation settings.
 */
export interface MemorySettings {
    min: number; // Minimum RAM in MB
    max: number; // Maximum RAM in MB
}

/**
 * Defines the structure for overall profile settings.
 */
export interface ProfileSettings {
    memory: MemorySettings;
    java_path?: string | null; // Optional path to specific Java executable
    resolution?: { width: number; height: number } | null; // Optional window resolution
    fullscreen?: boolean; // Optional fullscreen flag
    extra_args?: string[]; // Optional extra JVM or game arguments
    // Add other settings fields as needed
} 