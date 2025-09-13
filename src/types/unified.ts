export enum ModSource {
  Modrinth = "Modrinth",
  CurseForge = "CurseForge",
}

export interface UnifiedModSearchResult {
  project_id: string; // ID field used in UI
  source: ModSource;
  title: string; // Name field used in UI
  slug: string;
  description: string;
  author: string;
  categories: string[];
  downloads: number;
  follows: number | null;
  icon_url: string | null;
  project_url: string;
  project_type: string | null; // "mod", "modpack", etc.
}

export interface UnifiedPagination {
  index: number;
  page_size: number;
  result_count: number;
  total_count: number;
}

export interface UnifiedModSearchResponse {
  results: UnifiedModSearchResult[];
  pagination: UnifiedPagination;
}
