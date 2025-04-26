export interface MinecraftAccount {
    id: string;
    username: string;
    minecraft_username: string;
    active: boolean;
    access_token: string;
    refresh_token?: string;
    expires_at?: string;
} 