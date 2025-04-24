use crate::config::{ProjectDirsExt, LAUNCHER_DIRECTORY};
use crate::error::{AppError, Result};
use crate::minecraft::minecraft_auth::MinecraftAuthStore;
use crate::state::event_state::{EventPayload, EventState};
use crate::state::norisk_packs_state::{default_norisk_packs_path, NoriskPackManager};
use crate::state::process_state::{default_processes_path, ProcessManager};
use crate::state::profile_state::ProfileManager;
use crate::state::norisk_versions_state::{default_norisk_versions_path, NoriskVersionManager};
use std::sync::Arc;
use tokio::sync::OnceCell;

// Global state that will be initialized once
static LAUNCHER_STATE: OnceCell<Arc<State>> = OnceCell::const_new();

pub struct State {
    // Basic state properties will be added here
    pub initialized: bool,
    pub profile_manager: ProfileManager,
    pub event_state: EventState,
    pub process_manager: ProcessManager,
    pub minecraft_account_manager_v2: MinecraftAuthStore,
    pub norisk_pack_manager: NoriskPackManager,
    pub norisk_version_manager: NoriskVersionManager,
}

impl State {
    // Initialize the global state
    pub async fn init(app: Arc<tauri::AppHandle>) -> Result<()> {
        let state = LAUNCHER_STATE
            .get_or_try_init(|| async {
                Ok::<Arc<State>, AppError>(Arc::new(Self {
                    initialized: true,
                    profile_manager: ProfileManager::new(
                        LAUNCHER_DIRECTORY.root_dir().join("profiles.json"),
                    )
                    .await?,
                    event_state: EventState::new(Some(app)),
                    process_manager: ProcessManager::new(default_processes_path()).await?,
                    minecraft_account_manager_v2: MinecraftAuthStore::new().await?,
                    norisk_pack_manager: NoriskPackManager::new(default_norisk_packs_path())
                        .await?,
                    norisk_version_manager: NoriskVersionManager::new(default_norisk_versions_path())
                        .await?,
                }))
            })
            .await?;

        if let Ok(state) = crate::state::State::get().await {
            state.norisk_pack_manager.print_current_config().await;
            state.norisk_version_manager.print_current_config().await;
        }

        Ok(())
    }

    // Get the current state instance
    pub async fn get() -> Result<Arc<Self>> {
        if !LAUNCHER_STATE.initialized() {
            tracing::error!("Attempted to get state before initialization");
            while !LAUNCHER_STATE.initialized() {
                tokio::time::sleep(std::time::Duration::from_millis(100)).await;
            }
        }

        Ok(Arc::clone(
            LAUNCHER_STATE.get().expect("State is not initialized!"),
        ))
    }

    // Check if state is initialized
    pub fn initialized() -> bool {
        LAUNCHER_STATE.initialized()
    }

    // Emit an event to the frontend
    pub async fn emit_event(&self, payload: EventPayload) -> Result<()> {
        self.event_state.emit(payload).await
    }
}
