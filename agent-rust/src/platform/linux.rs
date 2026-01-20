//! Linux-specific implementations.

use super::ActiveWindow;
use std::process::Command;

/// Get the currently active window on Linux
pub fn get_active_window() -> Option<ActiveWindow> {
    // Try xdotool first (X11)
    if let Some(window) = get_active_window_x11() {
        return Some(window);
    }

    // Try alternative methods
    None
}

/// Get active window using xdotool (X11)
fn get_active_window_x11() -> Option<ActiveWindow> {
    // Get window ID
    let window_id = Command::new("xdotool")
        .args(["getactivewindow"])
        .output()
        .ok()?;

    if !window_id.status.success() {
        return None;
    }

    let window_id = String::from_utf8_lossy(&window_id.stdout).trim().to_string();

    // Get window title
    let title_output = Command::new("xdotool")
        .args(["getactivewindow", "getwindowname"])
        .output()
        .ok()?;

    let title = if title_output.status.success() {
        String::from_utf8_lossy(&title_output.stdout).trim().to_string()
    } else {
        String::new()
    };

    // Get window PID
    let pid_output = Command::new("xdotool")
        .args(["getactivewindow", "getwindowpid"])
        .output()
        .ok();

    let (process_id, app_name) = if let Some(output) = pid_output {
        if output.status.success() {
            let pid = String::from_utf8_lossy(&output.stdout)
                .trim()
                .parse::<u32>()
                .ok();

            let app_name = pid
                .map(|p| get_process_name(p))
                .flatten()
                .unwrap_or_else(|| "Unknown".to_string());

            (pid, app_name)
        } else {
            (None, "Unknown".to_string())
        }
    } else {
        (None, "Unknown".to_string())
    };

    Some(ActiveWindow {
        title,
        app_name,
        process_id,
    })
}

/// Get process name from PID
fn get_process_name(pid: u32) -> Option<String> {
    let output = Command::new("ps")
        .args(["-p", &pid.to_string(), "-o", "comm="])
        .output()
        .ok()?;

    if output.status.success() {
        Some(String::from_utf8_lossy(&output.stdout).trim().to_string())
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
    // Try xprintidle (X11)
    if let Ok(output) = Command::new("xprintidle").output() {
        if output.status.success() {
            if let Ok(idle_ms) = String::from_utf8_lossy(&output.stdout)
                .trim()
                .parse::<u64>()
            {
                return idle_ms / 1000;
            }
        }
    }

    // Try reading from /proc for TTY idle time
    if let Ok(entries) = std::fs::read_dir("/dev/pts") {
        let mut min_idle = u64::MAX;

        for entry in entries.flatten() {
            if let Ok(metadata) = entry.metadata() {
                if let Ok(accessed) = metadata.accessed() {
                    if let Ok(duration) = accessed.elapsed() {
                        min_idle = min_idle.min(duration.as_secs());
                    }
                }
            }
        }

        if min_idle != u64::MAX {
            return min_idle;
        }
    }

    0
}

/// Get screen dimensions using xrandr
pub fn get_screen_dimensions() -> Option<(u32, u32)> {
    let output = Command::new("xrandr")
        .args(["--current"])
        .output()
        .ok()?;

    if !output.status.success() {
        return None;
    }

    let result = String::from_utf8_lossy(&output.stdout);

    // Parse current resolution
    for line in result.lines() {
        if line.contains('*') {
            // Line with asterisk contains current resolution
            // Format: "   1920x1080     60.00*+"
            let parts: Vec<&str> = line.split_whitespace().collect();
            if !parts.is_empty() {
                let res_parts: Vec<&str> = parts[0].split('x').collect();
                if res_parts.len() == 2 {
                    let width = res_parts[0].parse::<u32>().ok()?;
                    let height = res_parts[1].parse::<u32>().ok()?;
                    return Some((width, height));
                }
            }
        }
    }

    None
}

/// Lock the screen
pub fn lock_screen() -> Result<(), std::io::Error> {
    // Try different lock commands
    if Command::new("loginctl")
        .args(["lock-session"])
        .spawn()
        .is_ok()
    {
        return Ok(());
    }

    if Command::new("xdg-screensaver")
        .args(["lock"])
        .spawn()
        .is_ok()
    {
        return Ok(());
    }

    if Command::new("gnome-screensaver-command")
        .args(["-l"])
        .spawn()
        .is_ok()
    {
        return Ok(());
    }

    Err(std::io::Error::new(
        std::io::ErrorKind::NotFound,
        "No lock command available",
    ))
}

/// Get battery information
pub fn get_battery_info() -> Option<(u32, bool)> {
    // Try reading from /sys/class/power_supply
    let battery_path = std::path::Path::new("/sys/class/power_supply/BAT0");

    if !battery_path.exists() {
        // Try BAT1
        let battery_path = std::path::Path::new("/sys/class/power_supply/BAT1");
        if !battery_path.exists() {
            return None;
        }
    }

    let capacity = std::fs::read_to_string(battery_path.join("capacity"))
        .ok()?
        .trim()
        .parse::<u32>()
        .ok()?;

    let status = std::fs::read_to_string(battery_path.join("status"))
        .ok()?
        .trim()
        .to_lowercase();

    let is_charging = status == "charging";

    Some((capacity, is_charging))
}
