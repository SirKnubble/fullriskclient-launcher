// src-tauri/tests/mrpack_test.rs

use noriskclient_launcher_v3_lib::error::{AppError, Result}; // Use your crate name
use noriskclient_launcher_v3_lib::integrations::mrpack::{process_mrpack, resolve_manifest_files};
use std::env;
use std::path::PathBuf;

//cargo test --package noriskclient-launcher-v3 --test mrpack_test -- --ignored --show-output

// Kombinierter Test: Findet, parst und löst Mods auf
#[tokio::test] // Async Test
#[ignore] // Benötigt Datei und Netzwerk
async fn test_full_mrpack_processing() -> Result<()> {
    println!("Starting full mrpack processing test.");

    // --- Robuste Pfadberechnung ---
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let project_root = manifest_dir
        .parent()
        .expect("Failed to get parent directory of CARGO_MANIFEST_DIR");
    println!("Calculated Project Root: {:?}", project_root);

    let relative_pack_path = "minecraft-data/modrinth/cc-community.mrpack"; // Relativ zum Projekt-Root
    let absolute_pack_path = project_root.join(relative_pack_path);

    println!(
        "Calculated absolute path for .mrpack: {:?}",
        absolute_pack_path
    );

    // --- Existenzprüfung (optional, aber gut zur Fehlersuche) ---
    if !absolute_pack_path.exists() {
        let err_msg = format!(
            "Test prerequisite failed: Hardcoded .mrpack file not found at calculated path: {:?}. Check relative path '{}' and project structure.",
            absolute_pack_path,
            relative_pack_path
        );
        eprintln!("Error: {}", err_msg);
        // Test fehlschlagen lassen statt assert!, da es eine Voraussetzung ist
        return Err(AppError::Other(err_msg));
    }
    println!("Found .mrpack file at: {:?}", absolute_pack_path);

    // --- Datei verarbeiten: Profil-Basis und Manifest holen ---
    println!("Calling process_mrpack...");
    let (mut profile, manifest) = process_mrpack(absolute_pack_path.clone()).await?; // Klonen, falls Pfad nochmal gebraucht wird
    println!(
        "process_mrpack successful. Profile Name: '{}', MC Version: {}",
        profile.name, profile.game_version
    );
    assert!(
        !profile.name.is_empty(),
        "Profile name should not be empty after process_mrpack"
    );

    // --- Mods auflösen ---
    println!("Calling resolve_manifest_files...");
    let resolved_mods = resolve_manifest_files(&manifest).await?;
    println!(
        "resolve_manifest_files successful. Resolved {} mods.",
        resolved_mods.len()
    );

    // --- Mods zuweisen und abschließende Prüfung ---
    profile.mods = resolved_mods;

    println!("Profile: {:#?}", profile);

    // Print the resolved mods (now part of the profile)
    println!("Resolved mods details: {:#?}", profile.mods.first());

    // Print the final profile struct
    //println!("Final profile object: {:#?}", profile); // Use {:#?} for pretty-printing

    // Assertions
    assert!(
        !profile.name.is_empty(),
        "Profile name should not be empty after process_mrpack"
    );
    assert!(
        !profile.mods.is_empty(),
        "Expected to resolve at least one mod."
    );
    println!(
        "Successfully processed mrpack and resolved mods for profile '{}'. Found {} mods.",
        profile.name,
        profile.mods.len()
    );

    Ok(()) // Test erfolgreich
}
