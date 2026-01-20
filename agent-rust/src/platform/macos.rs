//! macOS-specific implementations.

use super::ActiveWindow;
use std::process::Command;

/// Get the currently active window on macOS
pub fn get_active_window() -> Option<ActiveWindow> {
    let script = r#"
        tell application "System Events"
            set frontApp to first application process whose frontmost is true
            set appName to name of frontApp
            set windowTitle to ""
            try
                set windowTitle to name of front window of frontApp
            end try
            return appName & "|" & windowTitle
        end tell
    "#;

    let output = Command::new("osascript").args(["-e", script]).output().ok()?;

    if !output.status.success() {
        return None;
    }

    let result = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let parts: Vec<&str> = result.splitn(2, '|').collect();

    if parts.len() >= 2 {
        Some(ActiveWindow {
            app_name: parts[0].to_string(),
            title: parts[1].to_string(),
            process_id: None,
        })
    } else if !parts.is_empty() {
        Some(ActiveWindow {
            app_name: parts[0].to_string(),
            title: String::new(),
            process_id: None,
        })
    } else {
        None
    }
}

/// Check if the system is idle
pub fn is_system_idle(threshold_seconds: u64) -> bool {
    get_idle_time() >= threshold_seconds
}

/// Get the system idle time in seconds
pub fn get_idle_time() -> u64 {
    // Use ioreg to get idle time on macOS
    let output = Command::new("ioreg")
        .args(["-c", "IOHIDSystem"])
        .output()
        .ok();

    if let Some(output) = output {
        if output.status.success() {
            let result = String::from_utf8_lossy(&output.stdout);

            // Look for HIDIdleTime
            for line in result.lines() {
                if line.contains("HIDIdleTime") {
                    // Extract the number
                    if let Some(start) = line.find('=') {
                        let value_str = line[start + 1..].trim();
                        if let Ok(idle_ns) = value_str.parse::<u64>() {
                            // Convert from nanoseconds to seconds
                            return idle_ns / 1_000_000_000;
                        }
                    }
                }
            }
        }
    }

    0
}

/// Get screen dimensions
pub fn get_screen_dimensions() -> Option<(u32, u32)> {
    let output = Command::new("system_profiler")
        .args(["SPDisplaysDataType"])
        .output()
        .ok()?;

    if !output.status.success() {
        return None;
    }

    let result = String::from_utf8_lossy(&output.stdout);

    // Parse resolution from output
    for line in result.lines() {
        if line.contains("Resolution:") {
            // Format: "Resolution: 2560 x 1440"
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() >= 4 {
                let width = parts[1].parse::<u32>().ok()?;
                let height = parts[3].parse::<u32>().ok()?;
                return Some((width, height));
            }
        }
    }

    None
}

/// Lock the screen
pub fn lock_screen() -> Result<(), std::io::Error> {
    Command::new("osascript")
        .args([
            "-e",
            r#"tell application "System Events" to keystroke "q" using {control down, command down}"#,
        ])
        .spawn()?;
    Ok(())
}

/// Get battery information
pub fn get_battery_info() -> Option<(u32, bool)> {
    let output = Command::new("pmset")
        .args(["-g", "batt"])
        .output()
        .ok()?;

    if !output.status.success() {
        return None;
    }

    let result = String::from_utf8_lossy(&output.stdout);

    // Parse battery percentage and charging status
    for line in result.lines() {
        if line.contains('%') {
            // Format: "-InternalBattery-0 (id=...)    85%; charging; ..."
            let parts: Vec<&str> = line.split(';').collect();
            if !parts.is_empty() {
                // Extract percentage
                for part in line.split_whitespace() {
                    if part.ends_with('%') {
                        if let Ok(percent) = part.trim_end_matches('%').parse::<u32>() {
                            let is_charging = line.contains("charging") && !line.contains("discharging");
                            return Some((percent, is_charging));
                        }
                    }
                }
            }
        }
    }

    None
}
