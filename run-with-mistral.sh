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

# Check if Mistral setup documentation exists
if [ ! -f "./models/MISTRAL_SETUP.md" ]; then
  echo -e "${YELLOW}Warning: Mistral setup documentation not found.${NC}"
  echo "Make sure you've properly set up the Mistral AI integration."
fi

# Prompt for Mistral API key if not already configured
REAL_API_HANDLER="./real-api-handler.js"
if [ -f "$REAL_API_HANDLER" ]; then
  # Check if using the default placeholder key
  if grep -q "const MISTRAL_API_KEY = 'your-mistral-api-key-here'" "$REAL_API_HANDLER"; then
    echo -e "${YELLOW}Mistral API key not configured yet.${NC}"
    echo -e "To use Mistral AI, you need to update the API key in $REAL_API_HANDLER"
    echo -e "Check models/MISTRAL_SETUP.md for detailed instructions."
    echo
    read -p "Enter your Mistral API key (leave empty to continue with fallback): " API_KEY
    
    if [ -n "$API_KEY" ]; then
      # Replace the placeholder with the provided key
      if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        sed -i '' "s/const MISTRAL_API_KEY = 'your-mistral-api-key-here'/const MISTRAL_API_KEY = '$API_KEY'/" "$REAL_API_HANDLER"
      else
        # Linux
        sed -i "s/const MISTRAL_API_KEY = 'your-mistral-api-key-here'/const MISTRAL_API_KEY = '$API_KEY'/" "$REAL_API_HANDLER"
      fi
      echo -e "${GREEN}API key updated. Mistral AI integration is now configured.${NC}"
    else
      echo -e "${YELLOW}Continuing with fallback code generation.${NC}"
    fi
  fi
fi

# Run the main script
echo -e "${GREEN}Starting code generator with Mistral AI...${NC}"
echo ""
node codesphere.js "$@"