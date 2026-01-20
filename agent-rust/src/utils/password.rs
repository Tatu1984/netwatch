//! Password hashing utilities using PBKDF2.
//!
//! Provides secure password hashing and verification for admin authentication.

use hmac::Hmac;
use pbkdf2::pbkdf2;
use sha2::Sha256;

/// Number of PBKDF2 iterations
const ITERATIONS: u32 = 100_000;

/// Salt for password hashing (should be unique per installation in production)
const SALT: &[u8] = b"netwatch-agent-salt";

/// Hash length in bytes
const HASH_LENGTH: usize = 32;

/// Hash a password using PBKDF2-SHA256
pub fn hash_password(password: &str) -> String {
    let mut hash = [0u8; HASH_LENGTH];

    pbkdf2::<Hmac<Sha256>>(password.as_bytes(), SALT, ITERATIONS, &mut hash)
        .expect("PBKDF2 should not fail with valid parameters");

    hex::encode(hash)
}

/// Verify a password against a hash
pub fn verify_password(password: &str, hash: &str) -> bool {
    let computed_hash = hash_password(password);
    constant_time_compare(&computed_hash, hash)
}

/// Constant-time string comparison to prevent timing attacks
fn constant_time_compare(a: &str, b: &str) -> bool {
    if a.len() != b.len() {
        return false;
    }

    let a_bytes = a.as_bytes();
    let b_bytes = b.as_bytes();

    let mut result = 0u8;
    for (x, y) in a_bytes.iter().zip(b_bytes.iter()) {
        result |= x ^ y;
    }

    result == 0
}

/// Generate a SHA-256 hash of a string (for simple hashing needs)
pub fn sha256_hash(input: &str) -> String {
    use sha2::{Digest, Sha256};

    let mut hasher = Sha256::new();
    hasher.update(input.as_bytes());
    let result = hasher.finalize();

    hex::encode(result)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hash_password() {
        let password = "test_password";
        let hash = hash_password(password);

        assert!(!hash.is_empty());
        assert_eq!(hash.len(), HASH_LENGTH * 2); // Hex encoding doubles length
    }

    #[test]
    fn test_verify_password() {
        let password = "test_password";
        let hash = hash_password(password);

        assert!(verify_password(password, &hash));
        assert!(!verify_password("wrong_password", &hash));
    }

    #[test]
    fn test_sha256_hash() {
        let input = "hello world";
        let hash = sha256_hash(input);

        assert!(!hash.is_empty());
        assert_eq!(hash.len(), 64); // SHA-256 produces 32 bytes = 64 hex chars
    }

    #[test]
    fn test_constant_time_compare() {
        assert!(constant_time_compare("abc", "abc"));
        assert!(!constant_time_compare("abc", "abd"));
        assert!(!constant_time_compare("abc", "ab"));
    }
}
