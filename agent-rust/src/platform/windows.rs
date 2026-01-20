//! Windows-specific implementations.

use super::ActiveWindow;

/// Get the currently active window on Windows
pub fn get_active_window() -> Option<ActiveWindow> {
    #[cfg(target_os = "windows")]
    {
        use std::ffi::OsString;
        use std::os::windows::ffi::OsStringExt;
        use winapi::um::winuser::{GetForegroundWindow, GetWindowTextW, GetWindowThreadProcessId};

        unsafe {
            let hwnd = GetForegroundWindow();
            if hwnd.is_null() {
                return None;
            }

            // Get window title
            let mut title_buffer: [u16; 512] = [0; 512];
            let len = GetWindowTextW(hwnd, title_buffer.as_mut_ptr(), title_buffer.len() as i32);
            let title = if len > 0 {
                OsString::from_wide(&title_buffer[..len as usize])
                    .to_string_lossy()
                    .to_string()
            } else {
                String::new()
            };

            // Get process ID
            let mut process_id: u32 = 0;
            GetWindowThreadProcessId(hwnd, &mut process_id);

            // Get process name
            let app_name = get_process_name(process_id).unwrap_or_else(|| "Unknown".to_string());

            Some(ActiveWindow {
                title,
                app_name,
                process_id: Some(process_id),
            })
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        None
    }
}

/// Get the process name from a process ID
#[cfg(target_os = "windows")]
fn get_process_name(process_id: u32) -> Option<String> {
    use std::ffi::OsString;
    use std::os::windows::ffi::OsStringExt;
    use winapi::um::handleapi::CloseHandle;
    use winapi::um::processthreadsapi::OpenProcess;
    use winapi::um::psapi::GetModuleBaseNameW;
    use winapi::um::winnt::PROCESS_QUERY_INFORMATION;

    unsafe {
        let handle = OpenProcess(PROCESS_QUERY_INFORMATION, 0, process_id);
        if handle.is_null() {
            return None;
        }

        let mut name_buffer: [u16; 256] = [0; 256];
        let len = GetModuleBaseNameW(
            handle,
            std::ptr::null_mut(),
            name_buffer.as_mut_ptr(),
            name_buffer.len() as u32,
        );

        CloseHandle(handle);

        if len > 0 {
            Some(
                OsString::from_wide(&name_buffer[..len as usize])
                    .to_string_lossy()
                    .to_string(),
            )
        } else {
            None
        }
    }
}

/// Check if the system is idle
pub fn is_system_idle(threshold_seconds: u64) -> bool {
    get_idle_time() >= threshold_seconds
}

/// Get the system idle time in seconds
pub fn get_idle_time() -> u64 {
    #[cfg(target_os = "windows")]
    {
        use winapi::um::winuser::{GetLastInputInfo, LASTINPUTINFO};

        unsafe {
            let mut last_input = LASTINPUTINFO {
                cbSize: std::mem::size_of::<LASTINPUTINFO>() as u32,
                dwTime: 0,
            };

            if GetLastInputInfo(&mut last_input) != 0 {
                let tick_count = winapi::um::sysinfoapi::GetTickCount();
                let idle_ms = tick_count.saturating_sub(last_input.dwTime);
                idle_ms as u64 / 1000
            } else {
                0
            }
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        0
    }
}
