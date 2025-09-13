use crate::integrations::curseforge;
use crate::integrations::modrinth;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
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

impl From<modrinth::ModrinthSearchHit> for UnifiedModSearchResult {
    fn from(hit: modrinth::ModrinthSearchHit) -> Self {
        let slug = hit.slug.clone();
        let project_type = hit.project_type.clone();

        UnifiedModSearchResult {
            project_id: hit.project_id,
            source: ModSource::Modrinth,
            title: hit.title,
            slug: hit.slug,
            description: hit.description,
            author: hit.author.unwrap_or_else(|| "Unknown".to_string()),
            categories: hit.categories,
            downloads: hit.downloads,
            follows: Some(hit.follows),
            icon_url: hit.icon_url,
            project_url: format!("https://modrinth.com/{}/{}", project_type, slug),
            project_type: Some(hit.project_type),
        }
    }
}

impl From<curseforge::CurseForgeMod> for UnifiedModSearchResult {
    fn from(mod_info: curseforge::CurseForgeMod) -> Self {
        let author = mod_info.authors.first()
            .map(|a| a.name.clone())
            .unwrap_or_else(|| "Unknown".to_string());

        let categories: Vec<String> = mod_info.categories
            .iter()
            .map(|cat| cat.name.clone())
            .collect();

        UnifiedModSearchResult {
            project_id: mod_info.id.to_string(),
            source: ModSource::CurseForge,
            title: mod_info.name,
            slug: mod_info.slug,
            description: mod_info.summary,
            author,
            categories,
            downloads: mod_info.downloadCount,
            follows: None, // CurseForge doesn't provide this
            icon_url: mod_info.logo.map(|logo| logo.url),
            project_url: mod_info.links.websiteUrl,
            project_type: None, // Would need to map classId to type
        }
    }
}

pub async fn search_mods_unified(
    query: String,
    source: ModSource,
    game_version: Option<String>,
    categories: Option<Vec<String>>,
    mod_loader: Option<String>,
    limit: Option<u32>,
    offset: Option<u32>,
    sort: Option<String>, // "downloads", "newest", "updated", "relevance" etc.
) -> Result<UnifiedModSearchResponse, crate::error::AppError> {
    let mut all_results = Vec::new();
    let mut total_count = 0u64;

    // Execute search based on source
    match source {
        ModSource::CurseForge => {
            // Convert unified sort to CurseForge sort parameters
            let (sort_field, sort_order) = match sort.as_deref() {
                Some("downloads") => (Some(curseforge::CurseForgeModSearchSortField::TotalDownloads), Some(curseforge::CurseForgeSortOrder::Desc)),
                Some("newest") => (Some(curseforge::CurseForgeModSearchSortField::LastUpdated), Some(curseforge::CurseForgeSortOrder::Desc)),
                Some("updated") => (Some(curseforge::CurseForgeModSearchSortField::LastUpdated), Some(curseforge::CurseForgeSortOrder::Desc)),
                Some("relevance") => (Some(curseforge::CurseForgeModSearchSortField::Popularity), Some(curseforge::CurseForgeSortOrder::Desc)),
                Some("name") => (Some(curseforge::CurseForgeModSearchSortField::Name), Some(curseforge::CurseForgeSortOrder::Asc)),
                _ => (Some(curseforge::CurseForgeModSearchSortField::Popularity), Some(curseforge::CurseForgeSortOrder::Desc)), // default
            };

            match curseforge::search_mods(
                432, // Minecraft game ID
                Some(query.clone()),
                None, // class_id (could map mod_loader)
                None, // category_id
                game_version.clone(),
                sort_field,
                sort_order,
                None, // mod_loader_type
                None, // game_version_type_id
                offset, // index for pagination
                limit, // page_size
            ).await {
                Ok(response) => {
                    log::info!("CurseForge search successful: {} mods", response.data.len());
                    let unified_results: Vec<UnifiedModSearchResult> = response.data
                        .into_iter()
                        .map(|mod_info| mod_info.into())
                        .collect();
                    all_results.extend(unified_results);
                    total_count += response.pagination.totalCount as u64;
                }
                Err(e) => {
                    log::error!("CurseForge search failed: {}", e);
                    return Err(e);
                }
            }
        }
        ModSource::Modrinth => {
            // Convert unified sort to Modrinth sort
            let modrinth_sort = match sort.as_deref() {
                Some("downloads") => Some(modrinth::ModrinthSortType::Downloads),
                Some("newest") => Some(modrinth::ModrinthSortType::Newest),
                Some("updated") => Some(modrinth::ModrinthSortType::Updated),
                Some("relevance") => Some(modrinth::ModrinthSortType::Relevance),
                Some("follows") => Some(modrinth::ModrinthSortType::Follows),
                _ => Some(modrinth::ModrinthSortType::Relevance), // default
            };

            match modrinth::search_projects(
                query,
                modrinth::ModrinthProjectType::Mod,
                game_version,
                mod_loader,
                limit,
                offset,
                modrinth_sort,
                categories.map(|cats| cats.into_iter().map(|c| c.to_lowercase()).collect()),
                None, // client_side_filter
                None, // server_side_filter
            ).await {
                Ok(response) => {
                    log::info!("Modrinth search successful: {} mods", response.hits.len());
                    let unified_results: Vec<UnifiedModSearchResult> = response.hits
                        .into_iter()
                        .map(|hit| hit.into())
                        .collect();
                    all_results.extend(unified_results);
                    total_count += response.total_hits as u64;
                }
                Err(e) => {
                    log::error!("Modrinth search failed: {}", e);
                    return Err(e);
                }
            }
        }
    };

    let result_count = all_results.len() as u32;

    Ok(UnifiedModSearchResponse {
        results: all_results,
        pagination: UnifiedPagination {
            index: offset.unwrap_or(0),
            page_size: limit.unwrap_or(20),
            result_count,
            total_count,
        },
    })
}
