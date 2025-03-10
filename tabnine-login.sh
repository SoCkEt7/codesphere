#!/bin/bash
# Simple script to run codesphere with auto-login to Tabnine

# Change to the directory containing this script
cd "$(dirname "$0")" || exit 1

# Run the main script with auto-login flag
node codesphere.js --auto-login "$@"