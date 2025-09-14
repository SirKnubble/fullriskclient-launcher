use crate::integrations::curseforge;
use crate::integrations::modrinth;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub enum ModPlatform {
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

    pub fn from_curseforge_class_id(class_id: u32) -> Option<Self> {
        match class_id {
            6 => Some(UnifiedProjectType::Mod), // Minecraft Mods
            4471 => Some(UnifiedProjectType::Modpack), // Minecraft Modpacks
            12 => Some(UnifiedProjectType::ResourcePack), // Minecraft Resource Packs
            6552 => Some(UnifiedProjectType::Shader), // Minecraft Shaders
            119 => Some(UnifiedProjectType::Datapack), // Minecraft Data Packs
            _ => None,
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
    pub source: ModPlatform,
    pub title: String, // Name field used in UI
    pub slug: String,
    pub description: String,
    pub author: String,
    pub categories: Vec<String>,
    pub display_categories: Vec<String>,
    pub client_side: Option<String>,
    pub server_side: Option<String>,
    pub downloads: u64,
    pub follows: Option<u64>,
    pub icon_url: Option<String>,
    pub project_url: String,
    pub project_type: Option<String>, // "mod", "modpack", etc.
    pub latest_version: Option<String>,
    pub date_created: Option<String>,
    pub date_modified: Option<String>,
    pub license: Option<String>,
    pub gallery: Vec<String>,
    pub versions: Option<Vec<String>>,
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
    pub source: ModPlatform,
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
pub struct UnifiedModVersionsParams {
    pub source: ModPlatform,
    pub project_id: String,
    pub loaders: Option<Vec<String>>,
    pub game_versions: Option<Vec<String>>,
    pub limit: Option<u32>,
    pub offset: Option<u32>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct UnifiedModSearchResponse {
    pub results: Vec<UnifiedModSearchResult>,
    pub pagination: UnifiedPagination,
}

// Unified version/file structure for both platforms
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct UnifiedVersion {
    pub id: String,
    pub project_id: String,
    pub source: ModPlatform,
    pub name: String,
    pub version_number: String,
    pub changelog: Option<String>,
    pub game_versions: Vec<String>,
    pub loaders: Vec<String>,
    pub files: Vec<UnifiedVersionFile>,
    pub date_published: String,
    pub downloads: u64,
    pub release_type: UnifiedVersionType,
    pub url: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct UnifiedVersionFile {
    pub filename: String,
    pub url: String,
    pub size: u64,
    pub hashes: HashMap<String, String>,
    pub primary: bool,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum UnifiedVersionType {
    Release,
    Beta,
    Alpha,
}

// Response structure for unified version requests
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct UnifiedVersionResponse {
    pub versions: Vec<UnifiedVersion>,
    pub total_count: u64,
}

impl From<modrinth::ModrinthSearchHit> for UnifiedModSearchResult {
    fn from(hit: modrinth::ModrinthSearchHit) -> Self {
        let slug = hit.slug.clone();
        let project_type = hit.project_type.clone();

        UnifiedModSearchResult {
            project_id: hit.project_id,
            source: ModPlatform::Modrinth,
            title: hit.title,
            slug: hit.slug,
            description: hit.description,
            author: hit.author.unwrap_or_else(|| "Unknown".to_string()),
            categories: hit.categories,
            display_categories: hit.display_categories,
            client_side: Some(hit.client_side),
            server_side: Some(hit.server_side),
            downloads: hit.downloads,
            follows: Some(hit.follows),
            icon_url: hit.icon_url,
            project_url: format!("https://modrinth.com/{}/{}", project_type, slug),
            project_type: Some(hit.project_type),
            latest_version: hit.latest_version,
            date_created: Some(hit.date_created),
            date_modified: Some(hit.date_modified),
            license: Some(hit.license),
            gallery: hit.gallery,
            versions: None, // ModrinthSearchHit doesn't provide versions in search results
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

        // Map CurseForge classId to unified project type
        let project_type = mod_info.classId
            .and_then(|class_id| UnifiedProjectType::from_curseforge_class_id(class_id))
            .map(|pt| pt.to_string());

        UnifiedModSearchResult {
            project_id: mod_info.id.to_string(),
            source: ModPlatform::CurseForge,
            title: mod_info.name,
            slug: mod_info.slug,
            description: mod_info.summary,
            author,
            categories: categories.clone(),
            display_categories: categories, // Use same as categories for CurseForge
            client_side: None, // CurseForge doesn't provide this
            server_side: None, // CurseForge doesn't provide this
            downloads: mod_info.downloadCount,
            follows: None, // CurseForge doesn't provide this
            icon_url: mod_info.logo.map(|logo| logo.url),
            project_url: mod_info.links.websiteUrl,
            project_type, // Now properly mapped from classId
            latest_version: None, // CurseForge doesn't provide this
            date_created: None, // CurseForge doesn't provide this
            date_modified: None, // CurseForge doesn't provide this
            license: None, // CurseForge doesn't provide this
            gallery: vec![], // CurseForge doesn't provide this
            versions: None, // CurseForge doesn't provide this
        }
    }
}

impl From<modrinth::ModrinthVersion> for UnifiedVersion {
    fn from(version: modrinth::ModrinthVersion) -> Self {
        let unified_files: Vec<UnifiedVersionFile> = version.files
            .into_iter()
            .map(|file| {
                let mut hashes_map = HashMap::new();
                if let Some(sha1) = &file.hashes.sha1 {
                    hashes_map.insert("sha1".to_string(), sha1.clone());
                }
                if let Some(sha512) = &file.hashes.sha512 {
                    hashes_map.insert("sha512".to_string(), sha512.clone());
                }

                UnifiedVersionFile {
                    filename: file.filename,
                    url: file.url,
                    size: file.size,
                    hashes: hashes_map,
                    primary: file.primary,
                }
            })
            .collect();

        let project_id_clone = version.project_id.clone();
        let id_clone = version.id.clone();

        UnifiedVersion {
            id: version.id,
            project_id: version.project_id,
            source: ModPlatform::Modrinth,
            name: version.name,
            version_number: version.version_number,
            changelog: version.changelog,
            game_versions: version.game_versions,
            loaders: version.loaders,
            files: unified_files,
            date_published: version.date_published,
            downloads: version.downloads,
            release_type: match version.version_type {
                modrinth::ModrinthVersionType::Release => UnifiedVersionType::Release,
                modrinth::ModrinthVersionType::Beta => UnifiedVersionType::Beta,
                modrinth::ModrinthVersionType::Alpha => UnifiedVersionType::Alpha,
            },
            url: format!("https://modrinth.com/mod/{}/version/{}", project_id_clone, id_clone),
        }
    }
}

impl From<curseforge::CurseForgeFile> for UnifiedVersion {
    fn from(file: curseforge::CurseForgeFile) -> Self {
        let mut hashes_map = HashMap::new();
        for hash in &file.hashes {
            if let Some(algo) = curseforge::CurseForgeHashAlgo::from_u32(hash.algo) {
                hashes_map.insert(algo.to_string(), hash.value.clone());
            } else {
                hashes_map.insert("unknown".to_string(), hash.value.clone());
            }
        }

        // Create unified file for this CurseForge file
        let unified_file = UnifiedVersionFile {
            filename: file.fileName.clone(),
            url: file.downloadUrl.clone(),
            size: file.fileLength,
            hashes: hashes_map,
            primary: true, // CurseForge doesn't have primary flag, assume single file is primary
        };

        let unified_files = vec![unified_file];

        // Convert release type from CurseForge (1=Release, 2=Beta, 3=Alpha)
        let release_type = match file.releaseType {
            1 => UnifiedVersionType::Release,
            2 => UnifiedVersionType::Beta,
            3 => UnifiedVersionType::Alpha,
            _ => UnifiedVersionType::Release,
        };

        // Extract loaders from gameVersions array (CurseForge puts loaders in gameVersions)
        let loaders: Vec<String> = extract_loaders_from_game_versions(&file.gameVersions);

        let display_name_clone = file.displayName.clone();
        let download_url_clone = file.downloadUrl.clone();

        UnifiedVersion {
            id: file.id.to_string(),
            project_id: file.modId.to_string(),
            source: ModPlatform::CurseForge,
            name: file.displayName,
            version_number: display_name_clone, // CurseForge uses displayName as version
            changelog: None, // CurseForge doesn't provide changelog
            game_versions: file.gameVersions,
            loaders, // Now properly mapped from modLoader field
            files: unified_files,
            date_published: file.fileDate,
            downloads: file.downloadCount,
            release_type,
            url: download_url_clone,
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
        ModPlatform::CurseForge => {
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
        ModPlatform::Modrinth => {
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

// Function to get versions/files for a specific mod from unified platforms
pub async fn get_mod_versions_unified(
    params: UnifiedModVersionsParams,
) -> Result<UnifiedVersionResponse, crate::error::AppError> {
    let mut all_versions = Vec::new();
    let mut total_count = 0u64;

    match params.source {
        ModPlatform::Modrinth => {
            // Convert string loaders to Modrinth loaders if needed
            let modrinth_loaders = params.loaders.as_ref().map(|loaders_vec| {
                loaders_vec.into_iter().map(|l| l.to_lowercase()).collect()
            });

            match modrinth::get_mod_versions(
                params.project_id.clone(),
                modrinth_loaders,
                params.game_versions.clone(),
            ).await {
                Ok(versions) => {
                    log::info!("Modrinth versions successful: {} versions", versions.len());
                    total_count += versions.len() as u64;
                    let unified_versions: Vec<UnifiedVersion> = versions
                        .into_iter()
                        .map(|version| version.into())
                        .collect();
                    all_versions.extend(unified_versions);
                }
                Err(e) => {
                    log::error!("Modrinth versions failed: {}", e);
                    return Err(e);
                }
            }
        }
        ModPlatform::CurseForge => {
            // Parse project_id as u32 for CurseForge
            let mod_id = match params.project_id.parse::<u32>() {
                Ok(id) => id,
                Err(_) => {
                    return Err(crate::error::AppError::Other(format!(
                        "Invalid CurseForge project ID: {}", params.project_id
                    )));
                }
            };

            // Convert string loaders to CurseForge loader types
            let curseforge_loader = if let Some(ref loaders_vec) = &params.loaders {
                if loaders_vec.is_empty() {
                    None
                } else {
                    // Try to match the first loader to CurseForge enum
                    match loaders_vec[0].to_lowercase().as_str() {
                        "forge" => Some(curseforge::CurseForgeModLoaderType::Forge),
                        "fabric" => Some(curseforge::CurseForgeModLoaderType::Fabric),
                        "quilt" => Some(curseforge::CurseForgeModLoaderType::Quilt),
                        "neoforge" => Some(curseforge::CurseForgeModLoaderType::NeoForge),
                        "liteloader" => Some(curseforge::CurseForgeModLoaderType::LiteLoader),
                        "cauldron" => Some(curseforge::CurseForgeModLoaderType::Cauldron),
                        _ => None, // Default to Any if no match
                    }
                }
            } else {
                None
            };

            // Use first game version if provided
            let game_version = params.game_versions
                .as_ref()
                .and_then(|versions| versions.first())
                .cloned();

            match curseforge::get_mod_files(
                mod_id,
                game_version,
                curseforge_loader,
                None, // game_version_type_id - not used in unified interface for now
                params.offset,
                params.limit,
            ).await {
                Ok(response) => {
                    log::info!("CurseForge files successful: {} files", response.data.len());
                    let unified_versions: Vec<UnifiedVersion> = response.data
                        .into_iter()
                        .map(|file| file.into())
                        .collect();
                    all_versions.extend(unified_versions);
                    total_count += response.pagination.totalCount as u64;
                }
                Err(e) => {
                    log::error!("CurseForge files failed: {}", e);
                    return Err(e);
                }
            }
        }
    }

    Ok(UnifiedVersionResponse {
        versions: all_versions,
        total_count,
    })
}

/// Extract loader names from CurseForge gameVersions array
pub fn extract_loaders_from_game_versions(game_versions: &[String]) -> Vec<String> {
    game_versions
        .iter()
        .filter_map(|version| {
            let version_lower = version.to_lowercase();
            if version_lower.contains("forge") && !version_lower.contains("neoforge") {
                Some("forge".to_string())
            } else if version_lower.contains("fabric") {
                Some("fabric".to_string())
            } else if version_lower.contains("quilt") {
                Some("quilt".to_string())
            } else if version_lower.contains("neoforge") {
                Some("neoforge".to_string())
            } else if version_lower.contains("liteloader") {
                Some("liteloader".to_string())
            } else if version_lower.contains("cauldron") {
                Some("cauldron".to_string())
            } else {
                None // Not a loader, probably a game version like "1.21"
            }
        })
        .collect()
}
