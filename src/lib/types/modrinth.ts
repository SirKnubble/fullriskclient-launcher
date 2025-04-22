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

export interface ModrinthDependency {
    version_id: string | null;
    project_id: string | null;
    file_name: string | null;
    dependency_type: 'required' | 'optional' | 'incompatible' | 'embedded';
}

export interface ModrinthVersion {
    id: string;
    project_id: string;
    name: string;
    version_number: string;
    changelog: string | null;
    dependencies: ModrinthDependency[];
    game_versions: string[]; // e.g., [\"1.20.1\"]
    version_type: 'release' | 'beta' | 'alpha';
    loaders: string[]; // e.g., [\"fabric\", \"quilt\"]
    featured: boolean;
    status: 'listed' | 'archived' | 'draft' | 'unlisted' | 'scheduled' | 'unknown';
    requested_status: string | null;
    date_published: string; // ISO 8601 date string
    downloads: number;
    files: ModrinthFile[];
}

export interface ModrinthProjectContext {
    project_id: string;
    loader: string;
    game_version: string;
}

export interface ModrinthAllVersionsResult {
    context: ModrinthProjectContext;
    versions: ModrinthVersion[] | null;
    error: string | null; 
} 