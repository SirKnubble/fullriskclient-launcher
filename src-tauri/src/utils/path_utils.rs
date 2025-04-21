use std::path::{Path, PathBuf};
use tokio::fs; // Verwende tokio::fs für async checks
use crate::error::{Result, AppError}; // Dein Result- und Fehlertyp
use log::{info, error, warn};
use uuid::Uuid;

/// Findet einen eindeutigen Verzeichnisnamen (Segment) in einem Basisverzeichnis.
/// Wenn "desired_segment" schon existiert, werden Suffixe wie "(1)", "(2)" usw. angehängt.
/// Gibt den eindeutigen Segmentnamen als String zurück.
pub async fn find_unique_profile_segment(
    base_profiles_dir: &Path,
    desired_segment: &str,
) -> Result<String> {
    info!(
        "Finding unique profile segment for '{}' in base dir '{}'",
        desired_segment, base_profiles_dir.display()
    );

    // Bereinigen und sicherstellen, dass der Segmentname nicht leer ist
    let clean_segment = desired_segment.trim();
    if clean_segment.is_empty() {
        error!("Desired segment name cannot be empty.");
        // Erwäge, hier einen Standardnamen oder einen eindeutigen Zeitstempel zu generieren
        return Err(AppError::Other("Desired profile segment name is empty".to_string()));
    }

    let initial_path = base_profiles_dir.join(clean_segment);

    // Prüfe zuerst den ursprünglichen Namen
    match fs::try_exists(&initial_path).await {
        Ok(false) => {
            info!("Initial segment '{}' is unique.", clean_segment);
            return Ok(clean_segment.to_string()); // Ursprünglicher Name ist frei
        }
        Ok(true) => {
            info!("Initial path '{}' already exists.", initial_path.display());
            // Fange an zu zählen
        }
        Err(e) => {
            error!(
                "Error checking existence of path '{}': {}",
                initial_path.display(), e
            );
            return Err(AppError::Io(e)); // Fehler beim Prüfen weitergeben
        }
    }

    // Beginne mit dem Zählen der Suffixe
    let mut counter = 1u32;
    loop {
        // Verwende clean_segment für die Basis des suffixed Namens
        let suffixed_segment = format!("{}({})", clean_segment, counter);
        let candidate_path = base_profiles_dir.join(&suffixed_segment);
        info!("Checking candidate path: {}", candidate_path.display());

        match fs::try_exists(&candidate_path).await {
            Ok(false) => {
                 info!("Found unique segment: '{}'", suffixed_segment);
                return Ok(suffixed_segment); // Eindeutigen Namen gefunden
            }
            Ok(true) => {
                // Dieser Name ist auch belegt, erhöhe den Zähler
                counter = counter.checked_add(1).ok_or_else(|| {
                    error!("Counter overflow while finding unique segment for '{}'", clean_segment);
                    AppError::Other(format!("Counter overflow for segment '{}'", clean_segment))
                })?;

                // Sicherheitslimit, um Endlosschleifen zu verhindern
                if counter > 1000 { // Oder ein anderer sinnvoller Wert
                    error!(
                        "Could not find unique segment for '{}' after {} attempts.",
                         clean_segment, counter
                    );
                    return Err(AppError::Other(format!(
                        "Too many profiles with similar names starting with '{}'", clean_segment
                    )));
                }
            }
             Err(e) => {
                error!(
                    "Error checking existence of candidate path '{}': {}",
                     candidate_path.display(), e
                );
                return Err(AppError::Io(e));
            }
        }
    }
}

/// Copies a source file to the custom_mods directory if it doesn't exist.
/// Logs success, skips, or errors.
pub async fn copy_as_custom_mod(
    src_path_buf: &PathBuf,
    custom_mods_dir: &PathBuf,
    profile_id: Uuid, // Keep profile_id for logging context
    custom_added_count: &mut u64, // Assuming usize or u64 is better here
    skipped_count: &mut u64,      // Assuming usize or u64 is better here
) {
     // Check extension (optional, but good safeguard)
    if src_path_buf.extension().map_or(false, |ext| ext.eq_ignore_ascii_case("jar")) {
         if let Some(filename) = src_path_buf.file_name() {
            let dest_path = custom_mods_dir.join(filename);

            if dest_path.exists() {
                 warn!("Skipping custom import: File '{}' already exists in custom_mods for profile {}.", filename.to_string_lossy(), profile_id);
                 *skipped_count += 1;
                 return;
            }

            match fs::copy(&src_path_buf, &dest_path).await { // Use fs::copy directly
                 Ok(_) => {
                    info!("Successfully imported '{}' as custom mod to profile {}.", filename.to_string_lossy(), profile_id);
                    *custom_added_count += 1;
                 }
                 Err(e) => {
                    error!("Failed to copy file '{}' as custom mod for profile {}: {}", filename.to_string_lossy(), profile_id, e);
                    *skipped_count += 1; // Count as skipped due to error
                 }
            }
         } else {
            warn!("Could not extract filename from path: {:?}", src_path_buf);
            *skipped_count += 1;
         }
    } else {
         warn!("Skipping custom import as it does not have a .jar extension: {:?}", src_path_buf);
         *skipped_count += 1;
    }
} 