//! System information gathering utilities.
//!
//! Collects hardware and OS information for agent identification.

use local_ip_address::local_ip;
use mac_address::get_mac_address;
use sysinfo::System;
use tracing::{debug, warn};

/// System information for agent identification
#[derive(Debug, Clone)]
pub struct SystemInfo {
    /// Unique machine identifier
    pub machine_id: String,
    /// Computer hostname
    pub hostname: String,
    /// Operating system type (WINDOWS, DARWIN, LINUX)
    pub os_type: String,
    /// Operating system version
    pub os_version: String,
    /// Primary MAC address
    pub mac_address: String,
    /// Primary IP address
    pub ip_address: String,
}

impl SystemInfo {
    /// Gather all system information
    pub async fn gather() -> Self {
        let machine_id = Self::get_machine_id();
        let hostname = Self::get_hostname();
        let (os_type, os_version) = Self::get_os_info();
        let mac_address = Self::get_mac_address();
        let ip_address = Self::get_ip_address();

        debug!(
            "System info gathered: hostname={}, os={}, ip={}",
            hostname, os_type, ip_address
        );

        Self {
            machine_id,
            hostname,
            os_type,
            os_version,
            mac_address,
            ip_address,
        }
    }

    /// Get unique machine identifier
    fn get_machine_id() -> String {
        match machine_uid::get() {
            Ok(id) => id,
            Err(e) => {
                warn!("Failed to get machine ID: {}", e);
                // Generate a fallback ID based on hostname and MAC
                let hostname = Self::get_hostname();
                let mac = Self::get_mac_address();
                format!("{}-{}", hostname, mac.replace(':', ""))
            }
        }
    }

    /// Get computer hostname
    fn get_hostname() -> String {
        hostname::get()
            .ok()
            .and_then(|h| h.into_string().ok())
            .unwrap_or_else(|| "unknown".to_string())
    }

    /// Get OS type and version
    fn get_os_info() -> (String, String) {
        let os_type = if cfg!(target_os = "windows") {
            "WINDOWS"
        } else if cfg!(target_os = "macos") {
            "DARWIN"
        } else if cfg!(target_os = "linux") {
            "LINUX"
        } else {
            "UNKNOWN"
        }
        .to_string();

        let os_version = System::long_os_version().unwrap_or_else(|| "Unknown".to_string());

        (os_type, os_version)
    }

    /// Get primary MAC address
    fn get_mac_address() -> String {
        match get_mac_address() {
            Ok(Some(addr)) => addr.to_string(),
            Ok(None) => {
                warn!("No MAC address found");
                "00:00:00:00:00:00".to_string()
            }
            Err(e) => {
                warn!("Failed to get MAC address: {}", e);
                "00:00:00:00:00:00".to_string()
            }
        }
    }

    /// Get primary IP address
    fn get_ip_address() -> String {
        match local_ip() {
            Ok(ip) => ip.to_string(),
            Err(e) => {
                warn!("Failed to get local IP: {}", e);
                "127.0.0.1".to_string()
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_gather_system_info() {
        let info = SystemInfo::gather().await;
        assert!(!info.machine_id.is_empty());
        assert!(!info.hostname.is_empty());
        assert!(!info.os_type.is_empty());
    }
}
