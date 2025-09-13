use crate::integrations::curseforge;
use crate::integrations::modrinth;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub enum ModSource {
    Modrinth,
    CurseForge,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub enum UnifiedProjectType {
    Mod,
    Modpack,
    ResourcePack,
    Shader,
    Datapack,
}

impl UnifiedProjectType {
    pub fn to_string(&self) -> String {
        match self {
            UnifiedProjectType::Mod => "mod".to_string(),
            UnifiedProjectType::Modpack => "modpack".to_string(),
            UnifiedProjectType::ResourcePack => "resourcepack".to_string(),
            UnifiedProjectType::Shader => "shader".to_string(),
            UnifiedProjectType::Datapack => "datapack".to_string(),
        }
    }

    pub fn to_curseforge_class_id(&self) -> Option<u32> {
        match self {
            UnifiedProjectType::Mod => Some(6), // Minecraft Mods
            UnifiedProjectType::Modpack => Some(4471), // Minecraft Modpacks
            UnifiedProjectType::ResourcePack => Some(12), // Minecraft Resource Packs
            UnifiedProjectType::Shader => Some(6552), // Minecraft Shaders
            UnifiedProjectType::Datapack => Some(119), // Minecraft Data Packs
        }
    }

    pub fn to_modrinth_project_type(&self) -> modrinth::ModrinthProjectType {
        match self {
            UnifiedProjectType::Mod => modrinth::ModrinthProjectType::Mod,
            UnifiedProjectType::Modpack => modrinth::ModrinthProjectType::Modpack,
            UnifiedProjectType::ResourcePack => modrinth::ModrinthProjectType::ResourcePack,
            UnifiedProjectType::Shader => modrinth::ModrinthProjectType::Shader,
            UnifiedProjectType::Datapack => modrinth::ModrinthProjectType::Datapack,
        }
    }
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub enum UnifiedSortType {
    Relevance,
    Downloads,
    Follows,
    Newest,
    Updated,
    Name,
    Author,
    Featured,
    Popularity,
    Category,
    GameVersion,
}

impl UnifiedSortType {
    pub fn to_string(&self) -> String {
        match self {
            UnifiedSortType::Relevance => "relevance".to_string(),
            UnifiedSortType::Downloads => "downloads".to_string(),
            UnifiedSortType::Follows => "follows".to_string(),
            UnifiedSortType::Newest => "newest".to_string(),
            UnifiedSortType::Updated => "updated".to_string(),
            UnifiedSortType::Name => "name".to_string(),
            UnifiedSortType::Author => "author".to_string(),
            UnifiedSortType::Featured => "featured".to_string(),
            UnifiedSortType::Popularity => "popularity".to_string(),
            UnifiedSortType::Category => "category".to_string(),
            UnifiedSortType::GameVersion => "game_version".to_string(),
        }
    }

    pub fn to_modrinth_sort_type(&self) -> Option<modrinth::ModrinthSortType> {
        match self {
            UnifiedSortType::Relevance => Some(modrinth::ModrinthSortType::Relevance),
            UnifiedSortType::Downloads => Some(modrinth::ModrinthSortType::Downloads),
            UnifiedSortType::Follows => Some(modrinth::ModrinthSortType::Follows),
            UnifiedSortType::Newest => Some(modrinth::ModrinthSortType::Newest),
            UnifiedSortType::Updated => Some(modrinth::ModrinthSortType::Updated),
            // These don't have direct Modrinth equivalents, so use Relevance as fallback
            UnifiedSortType::Name | UnifiedSortType::Author | UnifiedSortType::Featured |
            UnifiedSortType::Popularity | UnifiedSortType::Category | UnifiedSortType::GameVersion => {
                Some(modrinth::ModrinthSortType::Relevance)
            }
        }
    }

    pub fn to_curseforge_sort_field_and_order(&self) -> (Option<curseforge::CurseForgeModSearchSortField>, Option<curseforge::CurseForgeSortOrder>) {
        match self {
            UnifiedSortType::Relevance => (Some(curseforge::CurseForgeModSearchSortField::Popularity), Some(curseforge::CurseForgeSortOrder::Desc)),
            UnifiedSortType::Downloads => (Some(curseforge::CurseForgeModSearchSortField::TotalDownloads), Some(curseforge::CurseForgeSortOrder::Desc)),
            UnifiedSortType::Newest => (Some(curseforge::CurseForgeModSearchSortField::LastUpdated), Some(curseforge::CurseForgeSortOrder::Desc)),
            UnifiedSortType::Updated => (Some(curseforge::CurseForgeModSearchSortField::LastUpdated), Some(curseforge::CurseForgeSortOrder::Desc)),
            UnifiedSortType::Name => (Some(curseforge::CurseForgeModSearchSortField::Name), Some(curseforge::CurseForgeSortOrder::Asc)),
            UnifiedSortType::Author => (Some(curseforge::CurseForgeModSearchSortField::Author), Some(curseforge::CurseForgeSortOrder::Asc)),
            UnifiedSortType::Featured => (Some(curseforge::CurseForgeModSearchSortField::Featured), Some(curseforge::CurseForgeSortOrder::Desc)),
            UnifiedSortType::Popularity => (Some(curseforge::CurseForgeModSearchSortField::Popularity), Some(curseforge::CurseForgeSortOrder::Desc)),
            UnifiedSortType::Category => (Some(curseforge::CurseForgeModSearchSortField::Category), Some(curseforge::CurseForgeSortOrder::Asc)),
            UnifiedSortType::GameVersion => (Some(curseforge::CurseForgeModSearchSortField::GameVersion), Some(curseforge::CurseForgeSortOrder::Desc)),
            // Follows doesn't have a direct CurseForge equivalent, use Popularity as fallback
            UnifiedSortType::Follows => (Some(curseforge::CurseForgeModSearchSortField::Popularity), Some(curseforge::CurseForgeSortOrder::Desc)),
        }
    }
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
pub struct UnifiedModSearchParams {
    pub query: String,
    pub source: ModSource,
    pub project_type: UnifiedProjectType,
    pub game_version: Option<String>,
    pub categories: Option<Vec<String>>,
    pub mod_loader: Option<String>,
    pub limit: Option<u32>,
    pub offset: Option<u32>,
    pub sort: Option<UnifiedSortType>,
    pub client_side_filter: Option<String>,
    pub server_side_filter: Option<String>,
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
            project_type: None, // CurseForge classId mapping would require additional logic
        }
    }
}

pub async fn search_mods_unified(
    params: UnifiedModSearchParams,
) -> Result<UnifiedModSearchResponse, crate::error::AppError> {
    let mut all_results = Vec::new();
    let mut total_count = 0u64;

    // Execute search based on source
    match params.source {
        ModSource::CurseForge => {
            // Convert unified sort to CurseForge sort parameters
            let (sort_field, sort_order) = if let Some(unified_sort) = params.sort {
                unified_sort.to_curseforge_sort_field_and_order()
            } else {
                // Default fallback
                (Some(curseforge::CurseForgeModSearchSortField::Popularity), Some(curseforge::CurseForgeSortOrder::Desc))
            };

            match curseforge::search_mods(
                432, // Minecraft game ID
                Some(params.query.clone()),
                params.project_type.to_curseforge_class_id(), // class_id based on project type
                None, // category_id
                params.game_version.clone(),
                sort_field,
                sort_order,
                None, // mod_loader_type
                None, // game_version_type_id
                params.offset, // index for pagination
                params.limit, // page_size
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
            let modrinth_sort = if let Some(unified_sort) = params.sort {
                unified_sort.to_modrinth_sort_type()
            } else {
                // Default fallback
                Some(modrinth::ModrinthSortType::Relevance)
            };

            match modrinth::search_projects(
                params.query,
                params.project_type.to_modrinth_project_type(),
                params.game_version,
                params.mod_loader,
                params.limit,
                params.offset,
                modrinth_sort,
                params.categories.as_ref().map(|cats| cats.into_iter().map(|c| c.to_lowercase()).collect()),
                params.client_side_filter,
                params.server_side_filter,
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
            index: params.offset.unwrap_or(0),
            page_size: params.limit.unwrap_or(20),
            result_count,
            total_count,
        },
    })
}
