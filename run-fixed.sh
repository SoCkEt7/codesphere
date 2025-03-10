#!/bin/bash

# Run the enhanced Codesphere CLI with multi-language support
# and syntax highlighting

echo "Starting Enhanced Codesphere CLI with multi-language support..."
echo "Use /lang <language> to set the default language"
echo "Use /save <filename> to save generated code"
echo ""

# Run without Node.js warnings
NODE_OPTIONS='--no-warnings' node codesphere-fixed.js