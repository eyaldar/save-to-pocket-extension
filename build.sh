#!/bin/bash

# Make sure we're in the right directory
cd "$(dirname "$0")"

# Install dependencies
echo "Installing dependencies..."
cd src2
npm install

# Build the extension
echo "Building extension..."
npm run build

echo "Build complete!"
echo "The extension is now available in the dist/ directory"
echo ""
echo "To load the extension in Chrome:"
echo "1. Go to chrome://extensions/"
echo "2. Enable 'Developer mode'"
echo "3. Click 'Load unpacked'"
echo "4. Select the dist/ directory" 