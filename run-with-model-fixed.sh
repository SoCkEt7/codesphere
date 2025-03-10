#!/bin/bash
# Run Codesphere with Mistral AI code generation

# Change to the directory containing this script
cd "$(dirname "$0")" || exit 1

# ANSI color codes
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

# Print a nice banner
echo -e "${CYAN}"
echo "╔════════════════════════════════════════════╗"
echo "║                                            ║"
echo "║        Advanced Code Generation Tool       ║"
echo "║           Mistral AI Integration           ║"
echo "║                                            ║"
echo "╚════════════════════════════════════════════╝"
echo -e "${NC}"

# Run the fixed version
echo -e "${GREEN}Starting code generator with Mistral AI...${NC}"
echo ""
node codesphere-fixed.js "$@"