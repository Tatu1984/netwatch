#!/bin/bash
# NetWatch Agent - Post-installation script for Linux

set -e

# Create symlink for command-line access
ln -sf /opt/netwatch-agent/netwatch-agent /usr/local/bin/netwatch-agent 2>/dev/null || true

# Set up autostart
AUTOSTART_DIR="/etc/xdg/autostart"
AUTOSTART_FILE="${AUTOSTART_DIR}/netwatch-agent.desktop"

mkdir -p "${AUTOSTART_DIR}"

cat > "${AUTOSTART_FILE}" << EOF
[Desktop Entry]
Type=Application
Name=NetWatch Agent
Comment=Employee Monitoring Agent
Exec=/opt/netwatch-agent/netwatch-agent
Icon=/opt/netwatch-agent/resources/app/assets/icon.png
Terminal=false
StartupNotify=false
Categories=Utility;
X-GNOME-Autostart-enabled=true
EOF

chmod 644 "${AUTOSTART_FILE}"

# Create desktop entry for application menu
DESKTOP_FILE="/usr/share/applications/netwatch-agent.desktop"

cat > "${DESKTOP_FILE}" << EOF
[Desktop Entry]
Type=Application
Name=NetWatch Agent
Comment=Employee Monitoring Agent
Exec=/opt/netwatch-agent/netwatch-agent
Icon=/opt/netwatch-agent/resources/app/assets/icon.png
Terminal=false
Categories=Utility;System;
EOF

chmod 644 "${DESKTOP_FILE}"

# Update desktop database
update-desktop-database /usr/share/applications 2>/dev/null || true

echo "NetWatch Agent installed successfully"
