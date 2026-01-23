#!/bin/bash
# Check if running on macOS
if [[ "$OSTYPE" == "darwin"* ]]; then
    echo "Installing Google Cloud SDK for macOS..."
    # Check if Homebrew is installed
    if command -v brew &> /dev/null; then
        echo "Using Homebrew to install Google Cloud SDK..."
        brew install --cask google-cloud-sdk
    else
        echo "Homebrew not found. Please install Google Cloud SDK manually:"
        echo "1. Download from: https://cloud.google.com/sdk/docs/install"
        echo "2. Or install Homebrew first: /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
        echo "3. Then run: brew install --cask google-cloud-sdk"
    fi
else
    echo "Please install Google Cloud SDK manually from: https://cloud.google.com/sdk/docs/install"
fi
