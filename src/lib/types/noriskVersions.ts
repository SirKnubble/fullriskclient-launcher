export interface NoriskVersionProfile {
    id: string;
    display_name: string;
    description: string;
    mc_version: string;
    loader: string;
    norisk_pack?: string;
    created_at?: string;
    last_updated?: string;
}

export interface NoriskVersionsConfig {
    profiles: NoriskVersionProfile[];
} 