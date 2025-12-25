#!/bin/bash

# NetWatch Agent Build Script
# Builds installers for all platforms

set -e

echo "========================================"
echo "  NetWatch Agent Build Script"
echo "========================================"
echo ""

# Navigate to agent directory
cd "$(dirname "$0")/.."

# Install dependencies
echo "Installing dependencies..."
npm ci

# Build TypeScript
echo "Building TypeScript..."
npm run build

# Determine platform and build accordingly
case "$(uname -s)" in
    Darwin*)
        echo "Building for macOS and optionally Windows/Linux..."

        # Build for macOS
        echo "Building macOS installers..."
        npm run package:mac

        # If Wine is available, build for Windows too
        if command -v wine64 &> /dev/null; then
            echo "Building Windows installers..."
            npm run package:win
        else
            echo "Wine not found, skipping Windows build"
        fi
        ;;

    Linux*)
        echo "Building for Linux and optionally Windows..."

        # Build for Linux
        echo "Building Linux installers..."
        npm run package:linux

        # If Wine is available, build for Windows too
        if command -v wine64 &> /dev/null; then
            echo "Building Windows installers..."
            npm run package:win
        else
            echo "Wine not found, skipping Windows build"
        fi
        ;;

    MINGW*|CYGWIN*|MSYS*)
        echo "Building for Windows..."
        npm run package:win
        ;;

    *)
        echo "Unknown platform: $(uname -s)"
        exit 1
        ;;
esac

echo ""
echo "========================================"
echo "  Build Complete!"
echo "========================================"
echo ""
echo "Installers available in: $(pwd)/release/"
echo ""

# List created files
if [ -d "release" ]; then
    echo "Created files:"
    ls -lah release/
fi
