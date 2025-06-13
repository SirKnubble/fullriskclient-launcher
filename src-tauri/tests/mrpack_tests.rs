// tests/mrpack_tests.rs

// Import items from your main crate (replace with your actual crate name)
// The crate name is defined in src-tauri/Cargo.toml -> [package] -> name
use log::{error, info};
use noriskclient_launcher_v3_lib::error::{AppError, Result}; // Assuming these are pub
use noriskclient_launcher_v3_lib::integrations::mrpack::{process_mrpack, resolve_manifest_files};
use std::path::PathBuf; // Import log macros

// Optional: setup logging for tests
fn setup_logging() {
    // Using env_logger::builder() requires the env_logger dev-dependency
    // You might need to add `env_logger = "0.11"` to [dev-dependencies] in src-tauri/Cargo.toml
    let _ = env_logger::builder().is_test(true).try_init();
}

// This test requires network access to Modrinth API and the hardcoded file to exist.
#[tokio::test]
#[ignore] // Ignore by default as it requires setup and network
async fn test_dummy_parsing_integration() -> Result<()> {
    // Return Result for easy error handling
    setup_logging(); // Initialize logging

    // --- Logic moved from dummy_parsing ---
    // Path relative to the root of the src-tauri crate
    let hardcoded_pack_path = PathBuf::from("../minecraft-data/modrinth/cc-community.mrpack");
    // Adjust if minecraft-data is elsewhere relative to src-tauri during test execution.
    // Sometimes tests run from the crate root (src-tauri), sometimes from workspace root.
    // Consider using env::current_dir() and joining paths robustly if needed.
    info!(
        "Integration Test: Parsing hardcoded mrpack: {:?}",
        hardcoded_pack_path
    );

    if !hardcoded_pack_path.exists() {
        let err_msg = format!("Hardcoded dummy mrpack file not found at: {:?}. Please ensure the path is correct relative to the execution directory (likely src-tauri/).", hardcoded_pack_path);
        error!("{}", err_msg);
        return Err(AppError::Other(err_msg));
    }

    // Process the pack to get profile stub and manifest
    let (mut profile, manifest) = process_mrpack(hardcoded_pack_path).await?;
    info!(
        "Integration Test: Initial profile created: '{}'",
        profile.name
    );

    // Resolve the mods from the manifest
    let resolved_mods = resolve_manifest_files(&manifest).await?;
    info!("Integration Test: Resolved {} mods.", resolved_mods.len());

    // Assign resolved mods to the profile
    profile.mods = resolved_mods;

    info!(
        "Integration Test: Parsing finished for profile '{}'",
        profile.name
    );
    // --- End of moved logic ---

    // Assertions on the resulting profile
    assert!(
        !profile.mods.is_empty(),
        "Integration test: Expected dummy parsing to resolve some mods."
    );
    info!(
        "Integration test: Dummy parsing successful. Found {} mods for profile '{}'.",
        profile.mods.len(),
        profile.name
    );
    // Add more specific assertions if needed
    // assert_eq!(profile.name, "Expected Pack Name");

    Ok(()) // Indicate test success
}
