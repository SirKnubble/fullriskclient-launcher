// src/lib/types/noriskPacks.ts

// Types matching backend Rust structures for Norisk Packs

// Represents a single mod definition within a Norisk Pack
export interface NoriskPackMod {
    id: string;
    displayName: string;
    source: { 
        type: string;
        // Include other source fields if needed for display later
        projectId?: string;
        projectSlug?: string;
        repositoryRef?: string;
        groupId?: string;
        artifactId?: string;
    };
    // compatibility field structure: Record<GameVersion, Record<Loader, Details>>
    compatibility?: Record<string, 
        Record<string, {
            identifier: string;
            filename: string | null;
            // Potentially add other fields like required java version etc.
        }>
    >;
}

export interface NoriskPackDefinition {
    // name?: string; // Original field name if it might exist
    displayName: string; // Field name confirmed from console output
    description: string;
    mods?: NoriskPackMod[]; // Use the more specific type here
    // Add other potential fields like versions, logo_url etc. if available/needed
}

export interface NoriskModpacksConfig {
    packs: Record<string, NoriskPackDefinition>; // Maps pack ID (string) to definition
    repositories: Record<string, string>; // Maps repository reference (string) to URL (string)
} 