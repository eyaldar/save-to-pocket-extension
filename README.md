# Pocket Saver Chrome Extension

A Chrome extension that allows you to save web pages to Pocket with tag support. The extension provides a streamlined interface for saving and tagging articles, with smart tag suggestions based on your existing Pocket tags.

## Features

- **Quick Save**: Save the current page to Pocket with one click
- **Smart Tag Suggestions**: 
  - Suggests tags based on your existing Pocket tags
  - Shows domain-based suggestions
  - Real-time tag filtering as you type
  - Common tag suggestions based on page content
- **Tag Management**:
  - Add multiple tags at once
  - Remove tags before saving
  - Update tags for existing Pocket items
  - Visual tag chips with remove buttons
- **Auto-Close**: Configurable popup auto-close timing
- **Keyboard Navigation**:
  - Enter to select suggested tags
  - Arrow keys to navigate suggestions
  - Escape to close popup
  - Customizable keyboard shortcuts
- **Background Sync**: Automatically syncs tags with Pocket every 5 hours
- **Developer Mode**: Built-in console for debugging and development
- **Tab Caching**: Efficient caching of tab information
- **Error Handling**: Comprehensive error states and user feedback
- **Status Notifications**: Visual feedback for all operations
- **Responsive Design**: Modern UI with consistent styling

## Installation

### Development Mode
1. Clone or download this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" in the top right corner
4. Click "Load unpacked" and select the `src` directory
5. The extension should now appear in your Chrome toolbar

Note: For development, you'll need to reload the extension after making changes to the code.

### Production Mode
1. Clone or download this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" in the top right corner
4. Click "Load unpacked" and select the `src` directory

Note: Currently, the extension is in development mode. A production build process will be added in future updates.

## Usage

1. Click the extension icon in your Chrome toolbar
2. The popup will open with the current page's URL
3. Add tags by:
   - Typing in the tag input box
   - Selecting from suggested tags
   - Using arrow keys to navigate suggestions
   - Pressing Enter to select a tag
4. Click "Save to Pocket" or press Enter with empty input to save
5. For existing items, click "Update Tags" to modify tags
6. Configure settings in the options page:
   - Enable/disable tag suggestions
   - Set popup auto-close timing
   - Configure keyboard shortcuts
   - Toggle developer mode

## Development

### Project Structure
```
pocket-chrome-extension/
├── src/                    # Extension source files
│   ├── manifest.json      # Extension configuration
│   ├── popup.html        # Extension popup interface
│   ├── popup.js          # Popup functionality
│   ├── background.js     # Background service worker
│   ├── options.html      # Extension options page
│   ├── options.js        # Options functionality
│   ├── auth.html         # Authentication page
│   └── icons/            # Extension icons
├── package.json          # Project configuration
└── README.md            # This file
```

### Key Components

- **Popup**: The main interface for saving and tagging items
- **Background Service**: Handles tag syncing and caching
- **Options Page**: Configure tag suggestions and Pocket connection
- **Auth Page**: Handles Pocket OAuth authentication
- **Tag System**: 
  - Caches tags locally for quick suggestions
  - Syncs with Pocket every 5 hours (when tag suggestions are enabled)
  - Updates tag cache during sync operations
  - Provides visual feedback for tag operations

### Building the Extension

1. Install dependencies:
   ```bash
   npm install
   ```

2. Build the extension:
   ```bash
   npm run build
   ```

3. Pack for distribution:
   ```bash
   npm run pack
   ```

## Technical Details

### Tag Management
- Tags are cached locally for quick suggestions
- Background sync ensures tags stay up-to-date (when enabled)
- Tag cache is updated during sync operations
- Tag suggestions are filtered in real-time
- Visual tag chips with remove functionality
- Domain-based tag suggestions

### API Integration
- Uses Pocket's v3 API
- Handles rate limiting and error cases
- Supports both adding new items and updating existing ones
- Secure OAuth2 implementation
- Efficient API communication

### Performance
- Efficient tag caching and syncing
- Minimal API calls
- Quick popup interface
- Background processing for tag updates
- Tab information caching
- Optimized tag suggestions

### Security
- Secure OAuth2 implementation
- Local storage for sensitive data
- Minimal permissions required
- Secure API communication
- No sensitive data exposure

## Development History

This extension was developed with the assistance of AI agents, specifically using Claude 3.5 Sonnet and other AI tools. The development process involved:

- AI-assisted code generation and review
- Code optimization suggestions
- Security best practices implementation
- UI/UX design recommendations
- Documentation generation

The AI agents helped ensure:
- Clean, maintainable code structure
- Comprehensive error handling
- Efficient performance optimizations
- Modern UI/UX design
- Thorough documentation
- Security best practices

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details. 