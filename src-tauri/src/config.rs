use directories::ProjectDirs;
use once_cell::sync::Lazy;
use reqwest::Client;
use std::path::PathBuf;

pub static LAUNCHER_DIRECTORY: Lazy<ProjectDirs> =
    Lazy::new(
        || match ProjectDirs::from("gg", "norisk", "NoRiskClientV3") {
            Some(proj_dirs) => proj_dirs,
            None => panic!("Failed to get application directory"),
        },
    );

static APP_USER_AGENT: &str = concat!(env!("CARGO_PKG_NAME"), "/", env!("CARGO_PKG_VERSION"),);

/// HTTP Client with launcher agent
pub static HTTP_CLIENT: Lazy<Client> = Lazy::new(|| {
    let client = reqwest::ClientBuilder::new()
        .user_agent(APP_USER_AGENT)
        .build()
        .unwrap_or_else(|_| Client::new());
    client
});

// Extension trait for ProjectDirs to add meta_dir functionality
pub trait ProjectDirsExt {
    fn meta_dir(&self) -> PathBuf;
    fn root_dir(&self) -> PathBuf;
}

impl ProjectDirsExt for ProjectDirs {
    fn meta_dir(&self) -> PathBuf {
        if cfg!(target_os = "windows") {
            // Windows: Alte Logik (wie sie war)
            self.data_dir().parent().unwrap().join("meta")
        } else {
            // macOS (und andere): Platziere 'meta' INNERHALB des data_dir
            self.data_dir().join("meta")
        }
    }

    fn root_dir(&self) -> PathBuf {
        if cfg!(target_os = "windows") {
            // Windows: Alte Logik (wie sie war)
            self.data_dir().parent().unwrap().to_path_buf()
        } else {
            // macOS (und andere): Setze root_dir auf data_dir
            self.data_dir().to_path_buf()
        }
    }
}
