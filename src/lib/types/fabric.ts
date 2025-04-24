/**
 * Matches the FabricLoaderVersion struct in Rust.
 */
export interface FabricLoaderVersionInfo {
    separator: string;
    build: number;
    maven: string;
    version: string;
    stable: boolean;
}

/**
 * Matches the FabricInstallerVersion struct in Rust.
 */
export interface FabricInstallerVersionInfo {
    url: string;
    maven: string;
    version: string;
    stable: boolean;
}

/**
 * Matches the FabricVersionInfo struct in Rust (top-level entry in the API response array).
 */
export interface FabricVersionInfo {
    loader: FabricLoaderVersionInfo;
    installer: FabricInstallerVersionInfo;
    // Note: The API actually returns an array of these objects directly.
} 