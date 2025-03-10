#!/bin/bash
# Run codesphere with the CodeLlama model

# Change to the directory containing this script
cd "$(dirname "$0")" || exit 1

# ANSI color codes
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

# Check if model is installed
if [ ! -f "./models/server.js" ]; then
  echo -e "${YELLOW}CodeLlama-34b-Instruct model not found.${NC}"
  echo -e "${CYAN}Installing model first...${NC}"
  echo ""
  
  # Run the install script
  if [ ! -f "./models/install-model.sh" ]; then
    echo -e "${YELLOW}Error: Installation script not found.${NC}"
    exit 1
  fi
  
  chmod +x ./models/install-model.sh
  ./models/install-model.sh
  
  echo ""
fi

# Print a nice banner
echo -e "${CYAN}"
echo "╔════════════════════════════════════════════╗"
echo "║                                            ║"
echo "║        Advanced Code Generation Tool       ║"
echo "║        CodeLlama-34b-Instruct Model        ║"
echo "║                                            ║"
echo "╚════════════════════════════════════════════╝"
echo -e "${NC}"

# Run the main script
echo -e "${GREEN}Starting code generator with CodeLlama model...${NC}"
echo ""
node codesphere.js "$@"