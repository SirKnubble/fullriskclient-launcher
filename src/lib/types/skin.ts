export interface MinecraftProfile {
    id: string,
    name: string,
    properties: MinecraftProfileProperties[]
}

export interface MinecraftProfileProperties {
    name: string,
    value: string,
    signature?: string
}

export interface MinecraftSkin {
    id: string,
    name: string,
    base64Data: string,
    variant: 'slim' | 'classic',
    description?: string,
    added_at: string
}