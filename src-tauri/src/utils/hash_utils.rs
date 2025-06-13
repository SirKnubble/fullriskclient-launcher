use sha1::{Digest, Sha1};
use std::io;
use std::path::PathBuf;
use tokio::fs::File;
use tokio::io::AsyncReadExt; // Import the trait for read()

/// Asynchronously calculates the SHA1 hash of a file.
pub async fn calculate_sha1(path: &PathBuf) -> Result<String, io::Error> {
    let mut file = File::open(path).await?; // Use tokio::fs::File and await
    let mut hasher = Sha1::new();
    let mut buffer = [0; 1024]; // Read in chunks

    loop {
        let n = file.read(&mut buffer).await?; // Use await for reading
        if n == 0 {
            break;
        }
        hasher.update(&buffer[..n]);
    }

    let hash_bytes = hasher.finalize();
    Ok(format!("{:x}", hash_bytes)) // Format as hex string
}

/// Calculates the SHA1 hash of a byte slice.
pub fn calculate_sha1_from_bytes(bytes: &[u8]) -> String {
    let mut hasher = Sha1::new();
    hasher.update(bytes);
    let hash_bytes = hasher.finalize();
    format!("{:x}", hash_bytes) // Format as hex string
}
