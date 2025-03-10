#!/bin/bash
# Run codesphere with the free CodeLlama model by default

# Change to the directory containing this script
cd "$(dirname "$0")" || exit 1

# Run the main script with model preference set to free
node codesphere.js --model free "$@"