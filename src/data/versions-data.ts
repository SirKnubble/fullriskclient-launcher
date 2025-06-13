import type { ModLoader } from "../types/profile";

export type VersionType = "release" | "snapshot" | "old-beta" | "old-alpha";

// Group versions by type - only newest for each major release
export const versionsByType: Record<VersionType, string[]> = {
  release: [
    "1.21.4",
    "1.20.6",
    "1.19.4",
    "1.18.2",
    "1.17.1",
    "1.16.5",
    "1.15.2",
    "1.14.4",
    "1.13.2",
    "1.12.2",
    "1.11.2",
    "1.10.2",
    "1.9.4",
    "1.8.9",
    "1.7.10",
    "1.6.4",
    "1.5.2",
    "1.4.7",
    "1.3.2",
    "1.2.5",
    "1.1",
    "1.0",
  ],
  snapshot: [
    "23w51a",
    "23w50a",
    "23w49a",
    "23w48a",
    "23w47a",
    "23w46a",
    "23w45a",
    "23w44a",
    "23w43a",
    "23w42a",
    "23w41a",
    "23w40a",
    "23w39a",
    "23w38a",
    "23w37a",
    "23w36a",
    "23w35a",
    "23w34a",
    "23w33a",
    "23w32a",
    "23w31a",
    "23w30a",
    "23w29a",
    "23w28a",
    "23w27a",
    "23w26a",
    "23w25a",
    "23w24a",
    "23w23a",
    "23w22a",
    "23w21a",
    "23w20a",
    "23w19a",
    "23w18a",
    "23w17a",
    "23w16a",
    "23w15a",
    "23w14a",
    "23w13a",
    "23w12a",
    "23w11a",
    "23w10a",
    "23w09a",
    "23w08a",
    "23w07a",
    "23w06a",
    "23w05a",
    "23w04a",
    "23w03a",
  ],
  "old-beta": [
    "b1.9-pre6",
    "b1.9-pre5",
    "b1.9-pre4",
    "b1.9-pre3",
    "b1.9-pre2",
    "b1.9-pre1",
    "b1.8.1",
    "b1.8",
    "b1.7.3",
    "b1.7.2",
    "b1.7",
    "b1.6.6",
    "b1.6.5",
    "b1.6.4",
    "b1.6.3",
    "b1.6.2",
    "b1.6.1",
    "b1.6",
    "b1.5_01",
    "b1.5",
    "b1.4_01",
    "b1.4",
    "b1.3_01",
    "b1.3b",
    "b1.3",
    "b1.2_02",
    "b1.2_01",
    "b1.2",
    "b1.1_02",
    "b1.1_01",
    "b1.1",
    "b1.0.2",
    "b1.0_01",
    "b1.0",
  ],
  "old-alpha": [
    "a1.2.6",
    "a1.2.5",
    "a1.2.4_01",
    "a1.2.3_04",
    "a1.2.3_02",
    "a1.2.3_01",
    "a1.2.3",
    "a1.2.2b",
    "a1.2.2a",
    "a1.2.2",
    "a1.2.1_01",
    "a1.2.1",
    "a1.2.0_02",
    "a1.2.0_01",
    "a1.2.0",
    "a1.1.2_01",
    "a1.1.2",
    "a1.1.0",
    "a1.0.17_04",
    "a1.0.17_02",
    "a1.0.16",
    "a1.0.15",
    "a1.0.14",
    "a1.0.11",
    "a1.0.5_01",
    "a1.0.4",
  ],
};

// All versions for the "show all" functionality
export const allVersionsByType: Record<VersionType, string[]> = {
  release: [
    "1.21.4",
    "1.21.3",
    "1.21.2",
    "1.21.1",
    "1.21",
    "1.20.6",
    "1.20.5",
    "1.20.4",
    "1.20.3",
    "1.20.2",
    "1.20.1",
    "1.20",
    "1.19.4",
    "1.19.3",
    "1.19.2",
    "1.19.1",
    "1.19",
    "1.18.2",
    "1.18.1",
    "1.18",
    "1.17.1",
    "1.17",
    "1.16.5",
    "1.16.4",
    "1.16.3",
    "1.16.2",
    "1.16.1",
    "1.16",
    "1.15.2",
    "1.15.1",
    "1.15",
    "1.14.4",
    "1.14.3",
    "1.14.2",
    "1.14.1",
    "1.14",
    "1.13.2",
    "1.13.1",
    "1.13",
    "1.12.2",
    "1.12.1",
    "1.12",
    "1.11.2",
    "1.11.1",
    "1.11",
    "1.10.2",
    "1.10.1",
    "1.10",
    "1.9.4",
    "1.9.3",
    "1.9.2",
    "1.9.1",
    "1.9",
    "1.8.9",
    "1.8.8",
    "1.8.7",
    "1.8.6",
    "1.8.5",
    "1.8.4",
    "1.8.3",
    "1.8.2",
    "1.8.1",
    "1.8",
    "1.7.10",
    "1.7.9",
    "1.7.8",
    "1.7.7",
    "1.7.6",
    "1.7.5",
    "1.7.4",
    "1.7.3",
    "1.7.2",
    "1.6.4",
    "1.6.2",
    "1.6.1",
    "1.5.2",
    "1.5.1",
    "1.5",
    "1.4.7",
    "1.4.6",
    "1.4.5",
    "1.4.4",
    "1.4.2",
    "1.3.2",
    "1.3.1",
    "1.2.5",
    "1.2.4",
    "1.2.3",
    "1.2.2",
    "1.2.1",
    "1.1",
    "1.0",
  ],
  snapshot: versionsByType.snapshot,
  "old-beta": versionsByType["old-beta"],
  "old-alpha": versionsByType["old-alpha"],
};

// Major versions for the wizard (only x.y, no patch versions)
export const majorVersions = [
  "1.21",
  "1.20",
  "1.19",
  "1.18",
  "1.17",
  "1.16",
  "1.15",
  "1.14",
  "1.13",
  "1.12",
  "1.11",
  "1.10",
  "1.9",
  "1.8",
  "1.7",
  "1.6",
  "1.5",
  "1.4",
  "1.3",
  "1.2",
  "1.1",
  "1.0",
];

// Define version compatibility with mod loaders
const modLoaderCompatibility: Record<ModLoader, string[]> = {
  fabric: ["1.14", "1.15", "1.16", "1.17", "1.18", "1.19", "1.20", "1.21"],
  forge: [
    "1.1",
    "1.2",
    "1.3",
    "1.4",
    "1.5",
    "1.6",
    "1.7",
    "1.8",
    "1.9",
    "1.10",
    "1.11",
    "1.12",
    "1.13",
    "1.14",
    "1.15",
    "1.16",
    "1.17",
    "1.18",
    "1.19",
    "1.20",
    "1.21",
  ],
  quilt: ["1.14", "1.15", "1.16", "1.17", "1.18", "1.19", "1.20", "1.21"],
  neoforge: ["1.20", "1.21"],
  vanilla: ["*"], // Vanilla works with all versions
};

// Mod loader versions
export const fabricVersions = [
  "0.15.7",
  "0.15.6",
  "0.15.5",
  "0.15.4",
  "0.15.3",
];

export const forgeVersions: Record<string, string[]> = {
  "1.21.4": ["47.2.0", "47.1.0", "47.0.35", "47.0.19", "47.0.1"],
  "1.20.6": ["46.2.0", "46.1.0", "46.0.14"],
  "1.20.4": ["45.1.0", "45.0.66", "45.0.43", "45.0.23", "45.0.9"],
  "1.19.4": ["45.1.0", "45.0.66", "45.0.43", "45.0.23", "45.0.9"],
  "1.18.2": [
    "40.2.10",
    "40.2.0",
    "40.1.80",
    "40.1.60",
    "40.1.30",
    "40.1.0",
    "40.0.54",
    "40.0.32",
    "40.0.12",
  ],
  "1.17.1": [
    "37.1.1",
    "37.1.0",
    "37.0.112",
    "37.0.97",
    "37.0.75",
    "37.0.59",
    "37.0.34",
    "37.0.9",
  ],
  "1.16.5": [
    "36.2.39",
    "36.2.34",
    "36.2.23",
    "36.2.8",
    "36.2.0",
    "36.1.65",
    "36.1.32",
    "36.1.16",
    "36.1.0",
    "36.0.42",
    "36.0.14",
  ],
  "1.15.2": [
    "31.2.57",
    "31.2.45",
    "31.2.31",
    "31.2.15",
    "31.2.0",
    "31.1.93",
    "31.1.79",
    "31.1.63",
    "31.1.49",
    "31.1.37",
    "31.1.18",
    "31.1.0",
    "31.0.14",
  ],
  "1.14.4": [
    "28.2.26",
    "28.2.16",
    "28.2.0",
    "28.1.116",
    "28.1.104",
    "28.1.90",
    "28.1.76",
    "28.1.61",
    "28.1.56",
    "28.1.45",
    "28.1.0",
    "28.0.55",
    "28.0.45",
    "28.0.23",
  ],
  "1.12.2": [
    "14.23.5.2860",
    "14.23.5.2847",
    "14.23.5.2838",
    "14.23.5.2768",
    "14.23.4.2759",
    "14.23.3.2655",
    "14.23.2.2611",
    "14.23.1.2555",
    "14.23.0.2491",
  ],
  "1.7.10": [
    "10.13.4.1614",
    "10.13.3.1403",
    "10.13.2.1291",
    "10.13.1.1217",
    "10.13.0.1180",
  ],
};

export const neoforgeVersions: Record<string, string[]> = {
  "1.21.4": [
    "20.4.147",
    "20.4.138",
    "20.4.116",
    "20.4.91",
    "20.4.72",
    "20.4.47",
    "20.4.19",
  ],
  "1.20.6": [
    "20.4.147",
    "20.4.138",
    "20.4.116",
    "20.4.91",
    "20.4.72",
    "20.4.47",
    "20.4.19",
  ],
  "1.20.4": [
    "20.4.147",
    "20.4.138",
    "20.4.116",
    "20.4.91",
    "20.4.72",
    "20.4.47",
    "20.4.19",
  ],
  "1.20.1": [
    "47.1.79",
    "47.1.65",
    "47.1.54",
    "47.1.43",
    "47.1.34",
    "47.1.23",
    "47.1.0",
    "47.0.19",
  ],
};

export const quiltVersions: Record<string, string[]> = {
  "1.21.4": ["0.25.1", "0.25.0", "0.24.0", "0.23.0", "0.22.0"],
  "1.20.6": ["0.25.1", "0.25.0", "0.24.0", "0.23.0", "0.22.0"],
  "1.20.1": ["0.21.2", "0.21.1", "0.21.0", "0.20.2", "0.20.1", "0.20.0"],
  "1.19.4": ["0.19.2", "0.19.1", "0.19.0", "0.18.10", "0.18.5", "0.18.1"],
  "1.19.2": [
    "0.17.8",
    "0.17.6",
    "0.17.5",
    "0.17.4",
    "0.17.3",
    "0.17.2",
    "0.17.1",
  ],
  "1.18.2": ["0.17.0", "0.16.1", "0.16.0", "0.15.2", "0.15.1", "0.15.0"],
  "1.17.1": [
    "0.14.19",
    "0.14.17",
    "0.14.16",
    "0.14.13",
    "0.14.11",
    "0.14.9",
    "0.14.8",
    "0.14.6",
    "0.14.5",
    "0.14.3",
  ],
};

// Version type icons (using pixel-style icons)
export const versionTypeIcons = {
  release: "/icons/version/release.png",
  snapshot: "/icons/version/snapshot.png",
  "old-beta": "/icons/version/old-beta.png",
  "old-alpha": "/icons/version/old-alpha.png",
};

// Version type labels
export const versionTypeLabels: Record<VersionType, string> = {
  release: "Release",
  snapshot: "Snapshot",
  "old-beta": "Old Beta",
  "old-alpha": "Old Alpha",
};

// Helper functions
export function isModLoaderCompatible(
  loader: ModLoader,
  version: string,
): boolean {
  if (loader === "vanilla") return true;

  // Extract major version (e.g., "1.21" from "1.21.4")
  const majorVersion = version.match(/^(\d+\.\d+)/)?.[0];

  if (!majorVersion) return false;

  return (
    modLoaderCompatibility[loader].includes(majorVersion) ||
    modLoaderCompatibility[loader].includes("*")
  );
}

export function getModLoaderIcon(loader: ModLoader): string {
  switch (loader) {
    case "fabric":
      return "/icons/modloaders/fabric.png";
    case "forge":
      return "/icons/modloaders/forge.png";
    case "quilt":
      return "/icons/modloaders/quilt.png";
    case "neoforge":
      return "/icons/modloaders/neoforge.png";
    case "vanilla":
    default:
      return "/icons/minecraft.png";
  }
}

export function getVersionTypeIcon(type: VersionType): string {
  return versionTypeIcons[type];
}

export function getVersionTypeLabel(type: VersionType): string {
  return versionTypeLabels[type];
}

export function getDefaultLoaderVersion(
  loader: ModLoader,
  gameVersion: string,
): string | null {
  if (loader === "vanilla") return null;

  if (loader === "fabric") return fabricVersions[0];

  if (loader === "forge" && forgeVersions[gameVersion]) {
    return forgeVersions[gameVersion][0];
  }

  if (loader === "neoforge" && neoforgeVersions[gameVersion]) {
    return neoforgeVersions[gameVersion][0];
  }

  if (loader === "quilt" && quiltVersions[gameVersion]) {
    return quiltVersions[gameVersion][0];
  }

  return null;
}

export function detectVersionType(version: string): VersionType {
  if (version.startsWith("a")) return "old-alpha";
  if (version.startsWith("b")) return "old-beta";
  if (version.includes("w")) return "snapshot";
  return "release";
}

export function getVersions(type: VersionType, showAll: boolean): string[] {
  return showAll ? allVersionsByType[type] : versionsByType[type];
}

export function getAllVersions(): string[] {
  return [
    ...allVersionsByType.release,
    ...allVersionsByType.snapshot,
    ...allVersionsByType["old-beta"],
    ...allVersionsByType["old-alpha"],
  ];
}

export function getVersionColor(type: VersionType): string {
  switch (type) {
    case "release":
      return "#4CAF50"; // Green
    case "snapshot":
      return "#FF9800"; // Orange
    case "old-beta":
      return "#2196F3"; // Blue
    case "old-alpha":
      return "#F44336"; // Red
    default:
      return "#757575"; // Gray
  }
}

export function formatVersionName(version: string): string {
  // Format version names for display
  if (version.startsWith("a")) {
    return `Alpha ${version.substring(1)}`;
  } else if (version.startsWith("b")) {
    return `Beta ${version.substring(1)}`;
  } else if (version.includes("w")) {
    return version;
  } else {
    return `Release ${version}`;
  }
}

// Get compatible mod loaders for a specific version
export function getCompatibleModLoaders(version: string): ModLoader[] {
  const result: ModLoader[] = ["vanilla"]; // Vanilla is always compatible

  // Extract major version (e.g., "1.21" from "1.21.4")
  const majorVersion = version.match(/^(\d+\.\d+)/)?.[0];

  if (!majorVersion) return result;

  Object.entries(modLoaderCompatibility).forEach(([loader, versions]) => {
    if (
      loader !== "vanilla" &&
      (versions.includes(majorVersion) || versions.includes("*"))
    ) {
      result.push(loader as ModLoader);
    }
  });

  return result;
}

// Get available versions for a specific mod loader
export function getModLoaderVersions(
  loader: ModLoader,
  gameVersion: string,
): string[] {
  if (loader === "vanilla") return [];

  if (loader === "fabric") return fabricVersions;

  if (loader === "forge" && forgeVersions[gameVersion]) {
    return forgeVersions[gameVersion];
  }

  if (loader === "neoforge" && neoforgeVersions[gameVersion]) {
    return neoforgeVersions[gameVersion];
  }

  if (loader === "quilt" && quiltVersions[gameVersion]) {
    return quiltVersions[gameVersion];
  }

  return [];
}

// Get only major versions for the wizard
export function getMajorVersions(): string[] {
  return majorVersions;
}
