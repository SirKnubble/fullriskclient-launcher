use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub enum ModSource {
    Modrinth,
    CurseForge,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct UnifiedModSearchResult {
    pub project_id: String, // ID field used in UI
    pub source: ModSource,
    pub title: String, // Name field used in UI
    pub slug: String,
    pub description: String,
    pub author: String,
    pub categories: Vec<String>,
    pub downloads: u64,
    pub follows: Option<u64>,
    pub icon_url: Option<String>,
    pub project_url: String,
    pub project_type: Option<String>, // "mod", "modpack", etc.
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct UnifiedPagination {
    pub index: u32,
    pub page_size: u32,
    pub result_count: u32,
    pub total_count: u64,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct UnifiedModSearchResponse {
    pub results: Vec<UnifiedModSearchResult>,
    pub pagination: UnifiedPagination,
}
