//! Platform-specific implementations.
//!
//! This module provides platform-specific functionality for Windows, macOS, and Linux.

#[cfg(target_os = "windows")]
pub mod windows;

#[cfg(target_os = "macos")]
pub mod macos;

#[cfg(target_os = "linux")]
pub mod linux;

/// Platform-independent active window information
#[derive(Debug, Clone)]
pub struct ActiveWindow {
    pub title: String,
    pub app_name: String,
    pub process_id: Option<u32>,
}

/// Get the currently active window
pub fn get_active_window() -> Option<ActiveWindow> {
    #[cfg(target_os = "windows")]
    {
        windows::get_active_window()
    }

    #[cfg(target_os = "macos")]
    {
        macos::get_active_window()
    }

    #[cfg(target_os = "linux")]
    {
        linux::get_active_window()
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        None
    }
}

/// Check if the system is idle
pub fn is_system_idle(threshold_seconds: u64) -> bool {
    #[cfg(target_os = "windows")]
    {
        windows::is_system_idle(threshold_seconds)
    }

    #[cfg(target_os = "macos")]
    {
        macos::is_system_idle(threshold_seconds)
    }

    #[cfg(target_os = "linux")]
    {
        linux::is_system_idle(threshold_seconds)
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        false
    }
}

/// Get the system idle time in seconds
pub fn get_idle_time() -> u64 {
    #[cfg(target_os = "windows")]
    {
        windows::get_idle_time()
    }

    #[cfg(target_os = "macos")]
    {
        macos::get_idle_time()
    }

    #[cfg(target_os = "linux")]
    {
        linux::get_idle_time()
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        0
    }
}
