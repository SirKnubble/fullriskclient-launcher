use lazy_static::lazy_static;
use regex::Regex;

/// Masks sensitive information in log content and other strings.
/// This includes tokens, passwords, and other sensitive data that should not be exposed in logs or UI.
///
/// # Arguments
/// * `content` - The content string to mask
///
/// # Returns
/// A string with sensitive information masked with asterisks
pub fn mask_sensitive_data(content: &str) -> String {
    lazy_static! {
        // Mask NoRisk client tokens
        static ref NORISK_TOKEN_REGEX: Regex = Regex::new(r"-Dnorisk\.token=[^\s]+").unwrap();
        // Mask Minecraft access tokens
        static ref ACCESS_TOKEN_REGEX: Regex = Regex::new(r"--accessToken\s+[^\s]+").unwrap();
        // Mask JWT tokens (eyJ... format)
        static ref JWT_REGEX: Regex = Regex::new(r"\beyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*\b").unwrap();
    }

    let mut masked_content = NORISK_TOKEN_REGEX.replace_all(content, "-Dnorisk.token=*****").to_string();
    masked_content = ACCESS_TOKEN_REGEX.replace_all(&masked_content, "--accessToken *****").to_string();
    masked_content = JWT_REGEX.replace_all(&masked_content, "*****").to_string();

    masked_content
}
