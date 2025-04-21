/**
 * Represents a game profile configuration.
 */
export interface Profile {
    id: string; // Assuming UUID as string
    name: string;
    game_version: string;
    loader: 'fabric' | 'forge' | 'neoforge' | 'quilt' | string; // Use specific literals if possible
    java_path?: string; // Optional Java path override
    created_at?: string; // Optional timestamp
    last_launched?: string; // Optional timestamp
    // Add any other relevant fields from your profile structure
} 