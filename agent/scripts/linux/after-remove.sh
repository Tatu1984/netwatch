#!/bin/bash
# NetWatch Agent - Post-removal script for Linux

set -e

# Remove symlink
rm -f /usr/local/bin/netwatch-agent 2>/dev/null || true

# Remove autostart entry
rm -f /etc/xdg/autostart/netwatch-agent.desktop 2>/dev/null || true

# Remove desktop entry
rm -f /usr/share/applications/netwatch-agent.desktop 2>/dev/null || true

# Update desktop database
update-desktop-database /usr/share/applications 2>/dev/null || true

# Remove data directory (optional - leave user data)
# rm -rf ~/.netwatch 2>/dev/null || true

echo "NetWatch Agent removed successfully"
