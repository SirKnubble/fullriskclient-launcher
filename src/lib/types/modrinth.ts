export interface ModrinthFileHash {
    sha512: string;
    sha1: string;
}

export interface ModrinthFile {
    hashes: ModrinthFileHash;
    url: string;
    filename: string;
    primary: boolean;
    size: number;
    file_type: string | null; // e.g., \"required-resource-pack\"
}

// Keep simple for now, adjust if needed
export enum ModrinthDependencyType {
    Required = 'required',
    Optional = 'optional',
    Incompatible = 'incompatible',
    Embedded = 'embedded',
}

export interface ModrinthDependency {
    version_id: string | null;
    project_id: string | null;
    file_name: string | null;
    dependency_type: ModrinthDependencyType;
}

export interface ModrinthVersion {
    id: string; // Version ID (e.g., \"tFw0iWAk\")
    project_id: string; // Project ID (e.g., \"AANobbMI\")
    name: string; // Version title (e.g., \"Sodium 0.5.3\")
    version_number: string; // Version number (e.g., \"0.5.3\")
    changelog: string | null;
    dependencies: ModrinthDependency[];
    game_versions: string[]; // e.g., [\"1.20.1\"]
    version_type: 'release' | 'beta' | 'alpha';
    loaders: string[]; // e.g., [\"fabric\", \"quilt\"]
    featured: boolean;
    status: string; // e.g., \"listed\"
    requested_status: string | null;
    date_published: string; // ISO 8601 date string
    downloads: number;
    files: ModrinthFile[];
}

// Add the context type for frontend use
export interface ModrinthProjectContext {
    project_id: string;
    loader: string;
    game_version: string;
}

// Structure for results from get_all_modrinth_versions_for_contexts
export interface ModrinthAllVersionsResult {
    context: ModrinthProjectContext;
    versions: ModrinthVersion[] | null;
    error: string | null; 
} 