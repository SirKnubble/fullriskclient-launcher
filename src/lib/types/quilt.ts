export interface QuiltLoaderVersion {
    separator: string;
    build: number;
    maven: string;
    version: string;
    stable: boolean;
}

export interface QuiltIntermediary {
    maven: string;
    version: string;
    stable: boolean;
}

export interface QuiltMainClass {
    client: string;
    server: string;
}

export interface QuiltLibrary {
    name: string;
    url?: string;
    md5?: string;
    sha1?: string;
    sha256?: string;
    sha512?: string;
    size?: number;
}

export interface QuiltLibraries {
    client: QuiltLibrary[];
    common: QuiltLibrary[];
    server: QuiltLibrary[];
    development?: QuiltLibrary[];
}

export interface QuiltLauncherMeta {
    version: number;
    min_java_version?: number;
    libraries: QuiltLibraries;
    mainClass: string | QuiltMainClass;
}

export interface QuiltVersionInfo {
    loader: QuiltLoaderVersion;
    intermediary: QuiltIntermediary;
    launcherMeta: QuiltLauncherMeta;
} 