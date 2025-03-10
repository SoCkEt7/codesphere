#!/bin/bash
# Codesphere Installation Script
# Installs codesphere globally on your system

# Make sure we use the current directory
cd "$(dirname "$0")" || exit 1

set -e # Exit on error

# ANSI color codes for pretty output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Print banner
echo -e "${CYAN}"
echo "╔════════════════════════════════════════════╗"
echo "║                                            ║"
echo "║            Codesphere Installer            ║"
echo "║                                            ║"
echo "╚════════════════════════════════════════════╝"
echo -e "${NC}"

# Get the current directory where install.sh is being run from
SCRIPT_DIR="$(pwd)"
CODESPHERE_JS="$SCRIPT_DIR/codesphere.js"

# Check if codesphere.js exists
if [ ! -f "$CODESPHERE_JS" ]; then
    echo -e "${RED}Error: codesphere.js not found in $SCRIPT_DIR${NC}"
    echo "Please run this installer from the directory containing codesphere.js"
    exit 1
fi

echo -e "${BLUE}Installing Codesphere...${NC}"

# Create config directory
CONFIG_DIR="$HOME/.codesphere"
mkdir -p "$CONFIG_DIR"
echo -e "${GREEN}✓${NC} Created config directory at $CONFIG_DIR"

# Determine appropriate binary directory
BIN_DIRS=("/usr/local/bin" "$HOME/.local/bin")
INSTALL_DIR=""

for dir in "${BIN_DIRS[@]}"; do
    if [ -d "$dir" ] && [ -w "$dir" ]; then
        INSTALL_DIR="$dir"
        break
    fi
done

if [ -z "$INSTALL_DIR" ]; then
    # Create ~/.local/bin if it doesn't exist
    INSTALL_DIR="$HOME/.local/bin"
    mkdir -p "$INSTALL_DIR"
    
    # Check if ~/.local/bin is in PATH, if not, suggest adding it
    if [[ ":$PATH:" != *":$INSTALL_DIR:"* ]]; then
        echo -e "${YELLOW}Warning: $INSTALL_DIR is not in your PATH${NC}"
        echo -e "You may need to add the following line to your ~/.bashrc or ~/.profile:"
        echo -e "  ${CYAN}export PATH=\"\$HOME/.local/bin:\$PATH\"${NC}"
    fi
fi

# Create executable wrapper script
WRAPPER_PATH="$INSTALL_DIR/codesphere"

cat > "$WRAPPER_PATH" << EOF
#!/bin/bash
# Codesphere - AI Coding Assistant

# Check if the config file exists
CONFIG_JS="$CONFIG_DIR/codesphere.js"
if [ -f "\$CONFIG_JS" ]; then
  exec node "\$CONFIG_JS" "\$@" 
else
  # Fallback to the original location if config file is missing
  exec node "$CODESPHERE_JS" "\$@"
fi
EOF

# Make the wrapper executable
chmod +x "$WRAPPER_PATH"
echo -e "${GREEN}✓${NC} Created executable at $WRAPPER_PATH"

# Copy codesphere.js to the config directory
echo -e "${BLUE}Installing script to $CONFIG_DIR...${NC}"
CODESPHERE_INSTALL=1 node "$CODESPHERE_JS" --version > /dev/null 2>&1 || true
cp "$CODESPHERE_JS" "$CONFIG_DIR/codesphere.js" 
chmod +x "$CONFIG_DIR/codesphere.js"
echo -e "${GREEN}✓${NC} Installed codesphere.js to $CONFIG_DIR"

# Create a simple uninstaller
UNINSTALLER="$CONFIG_DIR/uninstall.sh"
cat > "$UNINSTALLER" << EOF
#!/bin/bash
# Uninstall Codesphere
rm -f "$WRAPPER_PATH"
rm -rf "$CONFIG_DIR"
echo "Codesphere has been uninstalled"
EOF

chmod +x "$UNINSTALLER"
echo -e "${GREEN}✓${NC} Created uninstaller at $UNINSTALLER"

# Check if node is installed
if ! command -v node &> /dev/null; then
    echo -e "${YELLOW}Warning: Node.js is not installed${NC}"
    echo -e "Codesphere requires Node.js to run. Please install it using your package manager."
    echo -e "For example, on Ubuntu/Debian: ${CYAN}sudo apt install nodejs${NC}"
    echo -e "Or visit ${CYAN}https://nodejs.org/${NC} for installation instructions."
fi

echo ""
echo -e "${GREEN}Installation complete!${NC}"
echo -e "You can now run '${CYAN}codesphere${NC}' from anywhere in your terminal."
echo -e "To uninstall, run: ${CYAN}~/.codesphere/uninstall.sh${NC}"
echo ""