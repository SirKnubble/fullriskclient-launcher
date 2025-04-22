export interface NoriskPackMod {
    id: string;
    displayName: string;
    source: { 
        type: string;
        projectId?: string;
        projectSlug?: string;
        repositoryRef?: string;
        groupId?: string;
        artifactId?: string;
    };

    compatibility?: Record<string, 
        Record<string, {
            identifier: string;
            filename: string | null;
            // Potentially add other fields like required java version etc.
        }>
    >;
}

export interface NoriskPackDefinition {
    displayName: string;
    description: string;
    mods?: NoriskPackMod[];
}

export interface NoriskModpacksConfig {
    packs: Record<string, NoriskPackDefinition>;
    repositories: Record<string, string>;
}