use crate::error::{AppError, Result};
use log::{debug, error, info, warn};
use std::path::Path;
use sysinfo::{Disks, RefreshKind};

/// Disk space information
#[derive(Debug, Clone)]
pub struct DiskSpaceInfo {
    /// Available space in bytes
    pub available_bytes: u64,
    /// Total space in bytes
    pub total_bytes: u64,
    /// Used space in bytes (calculated)
    pub used_bytes: u64,
}

impl DiskSpaceInfo {
    /// Get available space in human readable format
    pub fn available_human(&self) -> String {
        format_bytes(self.available_bytes)
    }

    /// Get total space in human readable format
    pub fn total_human(&self) -> String {
        format_bytes(self.total_bytes)
    }

    /// Get used space in human readable format
    pub fn used_human(&self) -> String {
        format_bytes(self.used_bytes)
    }

    /// Check if there's enough space for the required bytes with a buffer
    pub fn has_enough_space(&self, required_bytes: u64, buffer_percentage: f64) -> bool {
        let buffer_bytes = (required_bytes as f64 * buffer_percentage) as u64;
        let total_required = required_bytes + buffer_bytes;
        self.available_bytes >= total_required
    }
}

/// Utility for checking disk space
pub struct DiskSpaceUtils;

impl DiskSpaceUtils {
    /// Get disk space information for a given path using sysinfo
    pub async fn get_disk_space<P: AsRef<Path>>(path: P) -> Result<DiskSpaceInfo> {
        let path = path.as_ref();
        debug!("Getting disk space for path: {:?}", path);

        // Create a new Disks instance and refresh the list
        let mut disks = Disks::new_with_refreshed_list();
        
        // Find the disk that contains the given path
        let mut target_disk = None;
        let mut longest_match = 0;
        
        for disk in disks.list() {
            let mount_point = disk.mount_point();
            
            // Check if the path starts with this mount point
            if path.starts_with(mount_point) {
                let match_length = mount_point.as_os_str().len();
                if match_length > longest_match {
                    longest_match = match_length;
                    target_disk = Some(disk);
                }
            }
        }
        
        let disk = target_disk.ok_or_else(|| {
            let error_msg = format!("No disk found for path: {:?}", path);
            error!("{}", error_msg);
            AppError::Other(error_msg)
        })?;

        let available_bytes = disk.available_space();
        let total_bytes = disk.total_space();
        let used_bytes = total_bytes.saturating_sub(available_bytes);

        debug!(
            "Disk space for {:?}: {} available / {} total",
            path,
            format_bytes(available_bytes),
            format_bytes(total_bytes)
        );

        Ok(DiskSpaceInfo {
            available_bytes,
            total_bytes,
            used_bytes,
        })
    }

    /// Check if there's enough space for a download with buffer
    pub async fn check_space_for_download<P: AsRef<Path>>(
        path: P, 
        required_bytes: u64,
        buffer_percentage: f64,
    ) -> Result<bool> {
        let space_info = Self::get_disk_space(path).await?;
        let has_space = space_info.has_enough_space(required_bytes, buffer_percentage);
        
        if has_space {
            info!(
                "Disk space check passed: {} available, {} required (+{}% buffer)",
                space_info.available_human(),
                format_bytes(required_bytes),
                (buffer_percentage * 100.0) as u32
            );
        } else {
            warn!(
                "Insufficient disk space: {} available, {} required (+{}% buffer)",
                space_info.available_human(),
                format_bytes(required_bytes),
                (buffer_percentage * 100.0) as u32
            );
        }
        
        Ok(has_space)
    }

    /// Check space and return detailed error if insufficient
    pub async fn ensure_space_for_download<P: AsRef<Path>>(
        path: P,
        required_bytes: u64,
        buffer_percentage: f64,
    ) -> Result<()> {
        let path = path.as_ref();
        let space_info = Self::get_disk_space(path).await?;
        
        if !space_info.has_enough_space(required_bytes, buffer_percentage) {
            let buffer_bytes = (required_bytes as f64 * buffer_percentage) as u64;
            let total_required = required_bytes + buffer_bytes;
            let shortfall = total_required - space_info.available_bytes;
            
            let error_msg = format!(
                "Insufficient disk space on {:?}. Required: {} (+{}% buffer = {}), Available: {}, Shortfall: {}",
                path,
                format_bytes(required_bytes),
                (buffer_percentage * 100.0) as u32,
                format_bytes(total_required),
                space_info.available_human(),
                format_bytes(shortfall)
            );
            
            error!("{}", error_msg);
            return Err(AppError::InsufficientDiskSpace {
                path: path.to_path_buf(),
                required_mb: total_required / 1024 / 1024,
                available_mb: space_info.available_bytes / 1024 / 1024,
                shortfall_mb: shortfall / 1024 / 1024,
            });
        }
        
        Ok(())
    }
}

/// Format bytes in human readable format
fn format_bytes(bytes: u64) -> String {
    const UNITS: &[&str] = &["B", "KB", "MB", "GB", "TB"];
    
    if bytes == 0 {
        return "0 B".to_string();
    }
    
    let mut size = bytes as f64;
    let mut unit_index = 0;
    
    while size >= 1024.0 && unit_index < UNITS.len() - 1 {
        size /= 1024.0;
        unit_index += 1;
    }
    
    if unit_index == 0 {
        format!("{} {}", bytes, UNITS[unit_index])
    } else {
        format!("{:.1} {}", size, UNITS[unit_index])
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_format_bytes() {
        assert_eq!(format_bytes(0), "0 B");
        assert_eq!(format_bytes(512), "512 B");
        assert_eq!(format_bytes(1024), "1.0 KB");
        assert_eq!(format_bytes(1536), "1.5 KB");
        assert_eq!(format_bytes(1048576), "1.0 MB");
        assert_eq!(format_bytes(1073741824), "1.0 GB");
    }

    #[test]
    fn test_has_enough_space() {
        let disk_info = DiskSpaceInfo {
            available_bytes: 1000,
            total_bytes: 2000,
            used_bytes: 1000,
        };
        
        // Without buffer should work
        assert!(disk_info.has_enough_space(800, 0.0));
        
        // With 25% buffer: 800 + 200 = 1000, exactly available
        assert!(disk_info.has_enough_space(800, 0.25));
        
        // With 25% buffer: 850 + 212.5 = 1062.5, exceeds available
        assert!(!disk_info.has_enough_space(850, 0.25));
    }
} 