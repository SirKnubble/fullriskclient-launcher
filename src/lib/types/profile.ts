export interface Profile {
    id: string;
    name: string;
    game_version: string;
    loader: 'fabric' | 'forge' | 'neoforge' | 'quilt' | string;
    java_path?: string;
    created_at?: string;
    last_launched?: string;
} 
