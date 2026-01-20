//! System Tray Module
//!
//! Provides system tray icon and menu functionality for the NetWatch agent.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tray_icon::{
    menu::{Menu, MenuEvent, MenuItem, PredefinedMenuItem},
    TrayIcon, TrayIconBuilder,
};

/// System tray manager
pub struct SystemTray {
    _tray: TrayIcon,
    status_item: MenuItem,
    server_item: MenuItem,
    exit_item: MenuItem,
    exit_requested: Arc<AtomicBool>,
}

impl SystemTray {
    /// Create a new system tray with icon and menu
    pub fn new(server_url: &str, exit_requested: Arc<AtomicBool>) -> Result<Self, Box<dyn std::error::Error>> {
        // Create menu items
        let status_item = MenuItem::new("Status: Connecting...", false, None);
        let server_item = MenuItem::new(format!("Server: {}", truncate_url(server_url)), false, None);
        let about_item = MenuItem::new("About NetWatch", true, None);
        let exit_item = MenuItem::new("Exit", true, None);

        // Build menu
        let menu = Menu::new();
        let _ = menu.append(&status_item);
        let _ = menu.append(&server_item);
        let _ = menu.append(&PredefinedMenuItem::separator());
        let _ = menu.append(&about_item);
        let _ = menu.append(&PredefinedMenuItem::separator());
        let _ = menu.append(&exit_item);

        // Load icon
        let icon = load_icon()?;

        // Create tray icon
        let tray = TrayIconBuilder::new()
            .with_menu(Box::new(menu))
            .with_tooltip("NetWatch Agent")
            .with_icon(icon)
            .build()?;

        Ok(Self {
            _tray: tray,
            status_item,
            server_item,
            exit_item,
            exit_requested,
        })
    }

    /// Update the connection status displayed in the tray
    pub fn set_status(&self, status: &str) {
        let _ = self.status_item.set_text(format!("Status: {}", status));
    }

    /// Update the server URL displayed in the tray
    #[allow(dead_code)]
    pub fn set_server(&self, url: &str) {
        let _ = self.server_item.set_text(format!("Server: {}", truncate_url(url)));
    }

    /// Check if exit was requested via menu
    pub fn check_exit(&self) -> bool {
        self.exit_requested.load(Ordering::SeqCst)
    }

    /// Process menu events (call this in your event loop)
    pub fn handle_menu_event(&self, event: &MenuEvent) {
        // Check if exit was clicked
        if event.id() == self.exit_item.id() {
            self.exit_requested.store(true, Ordering::SeqCst);
            return;
        }

        // Check for about click (compare with about_item would need to store it)
        // For now, we'll check by exclusion - if it's not status, server, or exit, it's about
        if event.id() != self.status_item.id()
            && event.id() != self.server_item.id()
            && event.id() != self.exit_item.id()
        {
            show_about_dialog();
        }
    }
}

/// Truncate URL for display
fn truncate_url(url: &str) -> String {
    if url.len() > 40 {
        format!("{}...", &url[..37])
    } else {
        url.to_string()
    }
}

/// Load the tray icon
fn load_icon() -> Result<tray_icon::Icon, Box<dyn std::error::Error>> {
    // Load embedded RGBA icon data (32x32)
    let icon_data = include_bytes!("../assets/icon.rgba");
    let icon = tray_icon::Icon::from_rgba(icon_data.to_vec(), 32, 32)?;
    Ok(icon)
}

/// Show about dialog
#[allow(dead_code)]
fn show_about_dialog() {
    #[cfg(target_os = "windows")]
    {
        use std::ffi::OsStr;
        use std::iter::once;
        use std::os::windows::ffi::OsStrExt;
        use std::ptr::null_mut;

        let title: Vec<u16> = OsStr::new("About NetWatch Agent")
            .encode_wide()
            .chain(once(0))
            .collect();
        let message: Vec<u16> = OsStr::new(
            "NetWatch Employee Monitoring Agent\n\n\
             Version 1.0.0\n\n\
             This agent monitors computer activity as per company policy.\n\n\
             Monitoring includes:\n\
             - Screen captures\n\
             - Application usage\n\
             - Website visits\n\
             - Process activity",
        )
        .encode_wide()
        .chain(once(0))
        .collect();

        unsafe {
            winapi::um::winuser::MessageBoxW(
                null_mut(),
                message.as_ptr(),
                title.as_ptr(),
                winapi::um::winuser::MB_OK | winapi::um::winuser::MB_ICONINFORMATION,
            );
        }
    }

    #[cfg(target_os = "macos")]
    {
        // Use osascript for macOS dialog
        let _ = std::process::Command::new("osascript")
            .args([
                "-e",
                r#"display dialog "NetWatch Employee Monitoring Agent

Version 1.0.0

This agent monitors computer activity as per company policy.

Monitoring includes:
- Screen captures
- Application usage
- Website visits
- Process activity" with title "About NetWatch Agent" buttons {"OK"} default button "OK" with icon note"#,
            ])
            .spawn();
    }

    #[cfg(target_os = "linux")]
    {
        // Try zenity, then kdialog, then notify-send
        let _ = std::process::Command::new("zenity")
            .args([
                "--info",
                "--title=About NetWatch Agent",
                "--text=NetWatch Employee Monitoring Agent\n\nVersion 1.0.0\n\nThis agent monitors computer activity as per company policy.",
            ])
            .spawn()
            .or_else(|_| {
                std::process::Command::new("kdialog")
                    .args([
                        "--msgbox",
                        "NetWatch Employee Monitoring Agent\n\nVersion 1.0.0\n\nThis agent monitors computer activity as per company policy.",
                        "--title",
                        "About NetWatch Agent",
                    ])
                    .spawn()
            })
            .or_else(|_| {
                std::process::Command::new("notify-send")
                    .args(["NetWatch Agent", "Version 1.0.0 - Monitoring Active"])
                    .spawn()
            });
    }
}

/// Run the tray event loop (Windows-specific message pump)
#[cfg(target_os = "windows")]
pub fn run_event_loop<F>(mut callback: F)
where
    F: FnMut() -> bool,
{
    use std::mem::MaybeUninit;
    use winapi::um::winuser::{DispatchMessageW, PeekMessageW, TranslateMessage, MSG, PM_REMOVE};

    loop {
        // Process Windows messages
        unsafe {
            let mut msg = MaybeUninit::<MSG>::uninit();
            while PeekMessageW(msg.as_mut_ptr(), std::ptr::null_mut(), 0, 0, PM_REMOVE) != 0 {
                let msg = msg.assume_init();
                TranslateMessage(&msg);
                DispatchMessageW(&msg);
            }
        }

        // Run callback - if it returns false, exit
        if !callback() {
            break;
        }

        // Sleep a bit to avoid busy-waiting
        std::thread::sleep(std::time::Duration::from_millis(100));
    }
}

/// Run the tray event loop (macOS/Linux)
#[cfg(not(target_os = "windows"))]
pub fn run_event_loop<F>(mut callback: F)
where
    F: FnMut() -> bool,
{
    loop {
        // Run callback - if it returns false, exit
        if !callback() {
            break;
        }

        // Sleep a bit to avoid busy-waiting
        std::thread::sleep(std::time::Duration::from_millis(100));
    }
}
