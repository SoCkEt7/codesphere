#!/bin/bash
# Simple script to run codesphere directly from the project directory

# Change to the directory containing this script
cd "$(dirname "$0")" || exit 1

# Run the main script
node codesphere.js "$@"