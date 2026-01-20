// Build script for Windows-specific resources (icon, version info)

fn main() {
    #[cfg(target_os = "windows")]
    {
        let mut res = winres::WindowsResource::new();
        res.set_icon("assets/icon.ico")
            .set("ProductName", "NetWatch Agent")
            .set("FileDescription", "NetWatch Monitoring Agent")
            .set("LegalCopyright", "Copyright © 2024 NetWatch")
            .set("CompanyName", "NetWatch");

        if let Err(e) = res.compile() {
            // Don't fail the build if icon is missing, just warn
            println!("cargo:warning=Failed to compile Windows resources: {}", e);
        }
    }
}
