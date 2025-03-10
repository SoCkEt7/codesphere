#!/usr/bin/env node

/**
 * Codesphere - Interactive Coding Assistant
 * 
 * A lightweight, terminal-based coding assistant that helps you
 * generate code, navigate files, and work efficiently from the command line.
 * 
 * Version: 1.0.0
 * License: MIT
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const readline = require('readline');
const { execSync, spawn } = require('child_process');
const util = require('util');

// ANSI escape codes for terminal styling
const style = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  italic: '\x1b[3m',
  underline: '\x1b[4m',
  // Colors
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
  // Backgrounds
  bgBlack: '\x1b[40m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgCyan: '\x1b[46m',
  bgWhite: '\x1b[47m',
};

// System constants
const CONFIG_DIR = path.join(os.homedir(), '.codesphere');
const HISTORY_FILE = path.join(CONFIG_DIR, 'history.json');
const SESSION_FILE = path.join(CONFIG_DIR, 'session.json');
const TEMPLATES_DIR = path.join(CONFIG_DIR, 'templates');
const VERSION = '1.0.0';

// Command map with help text
const commands = {
  help: {
    description: 'Show available commands',
    usage: '/help'
  },
  exit: {
    description: 'Exit the CLI',
    usage: '/exit'
  },
  clear: {
    description: 'Clear the terminal screen',
    usage: '/clear'
  },
  ls: {
    description: 'List files in directory',
    usage: '/ls [directory]'
  },
  cat: {
    description: 'Display file contents',
    usage: '/cat <filename>'
  },
  edit: {
    description: 'Edit or create a file',
    usage: '/edit <filename>'
  },
  search: {
    description: 'Search file contents',
    usage: '/search <pattern> [file-pattern]'
  },
  find: {
    description: 'Find files by name pattern',
    usage: '/find <pattern>'
  },
  save: {
    description: 'Save generated code to a file',
    usage: '/save <filename>'
  },
  run: {
    description: 'Execute a shell command',
    usage: '/run <command>'
  },
  cd: {
    description: 'Change directory',
    usage: '/cd <directory>'
  },
  pwd: {
    description: 'Show current working directory',
    usage: '/pwd'
  },
  version: {
    description: 'Show Codesphere version',
    usage: '/version'
  },
  about: {
    description: 'Show information about Codesphere',
    usage: '/about'
  }
};

// Initialize environment
function init() {
  // Create main config directory if it doesn't exist
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }

  // Create templates directory if it doesn't exist
  if (!fs.existsSync(TEMPLATES_DIR)) {
    fs.mkdirSync(TEMPLATES_DIR, { recursive: true });
  }

  // Initialize history file if it doesn't exist
  if (!fs.existsSync(HISTORY_FILE)) {
    fs.writeFileSync(HISTORY_FILE, JSON.stringify([]));
  }

  // Initialize session file if it doesn't exist
  if (!fs.existsSync(SESSION_FILE)) {
    const newSession = {
      id: Date.now(),
      start: new Date().toISOString(),
      prompts: []
    };
    fs.writeFileSync(SESSION_FILE, JSON.stringify(newSession, null, 2));
  }
  
  // Check if we should copy the file to config directory
  // Only do this if explicitly requested via environment variable
  if (process.env.CODESPHERE_INSTALL === '1') {
    try {
      const sourcePath = process.argv[1] || __filename;
      fs.copyFileSync(sourcePath, path.join(CONFIG_DIR, 'codesphere.js'));
    } catch (error) {
      // Don't fail if copy fails - not critical
      console.error('Note: Could not copy script to config directory:', error.message);
    }
  }
}

// Print styled banner
function printBanner() {
  console.log(`
${style.bold}${style.cyan}┌────────────────────────────────────────┐
│                                        │
│  ${style.green}C O D E S P H E R E ${style.cyan}                  │
│  ${style.white}v${VERSION}${style.cyan}                                │
│                                        │
│  ${style.dim}Type${style.reset}${style.cyan} ${style.green}/help${style.cyan} ${style.dim}for available commands${style.reset}${style.cyan}     │
│                                        │
└────────────────────────────────────────┘${style.reset}
`);
}

// Display available commands
function printHelp() {
  console.log(`\n${style.bold}${style.cyan}Available Commands:${style.reset}\n`);
  
  Object.entries(commands).forEach(([cmd, info]) => {
    console.log(`${style.bold}${style.green}${info.usage}${style.reset}`);
    console.log(`  ${info.description}\n`);
  });
}

// Execute a shell command safely
function executeCommand(command) {
  try {
    return execSync(command, { 
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      stdio: ['pipe', 'pipe', 'pipe']
    }).toString();
  } catch (error) {
    if (error.stdout) return error.stdout.toString();
    if (error.stderr) return error.stderr.toString();
    return `Error: ${error.message}`;
  }
}

// Add to history
function addToHistory(input, output) {
  try {
    const history = JSON.parse(fs.readFileSync(HISTORY_FILE));
    history.push({
      timestamp: new Date().toISOString(),
      input,
      output: typeof output === 'string' ? output.substring(0, 500) : String(output).substring(0, 500)
    });
    
    // Keep only the last 100 entries
    if (history.length > 100) {
      history.shift();
    }
    
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
  } catch (err) {
    console.error('Failed to update history:', err);
  }
}

// Update current session
function updateSession(prompt, response) {
  try {
    const session = JSON.parse(fs.readFileSync(SESSION_FILE));
    session.prompts.push({
      timestamp: new Date().toISOString(),
      prompt,
      response
    });
    fs.writeFileSync(SESSION_FILE, JSON.stringify(session, null, 2));
  } catch (err) {
    console.error('Failed to update session:', err);
  }
}

// Create simple fake code generation
function generateCode(description) {
  const language = guessLanguage(description);
  
  const templates = {
    javascript: `/**
 * ${description}
 */
function main() {
  console.log("Starting process");
  
  // Implementation based on description
  const result = {
    success: true,
    message: "Operation completed",
    timestamp: new Date().toISOString()
  };
  
  return result;
}

// Export for use in other modules
module.exports = { main };

// Execute if run directly
if (require.main === module) {
  console.log(main());
}`,

    python: `#!/usr/bin/env python3
"""
${description}
"""
import json
from datetime import datetime


def main():
    """Main implementation function"""
    print("Starting process")
    
    # Implementation based on description
    result = {
        "success": True,
        "message": "Operation completed",
        "timestamp": datetime.now().isoformat()
    }
    
    return result


if __name__ == "__main__":
    print(json.dumps(main(), default=str, indent=2))`,

    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${description}</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      margin: 0;
      padding: 20px;
      color: #333;
    }
    .container {
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
      border: 1px solid #ddd;
      border-radius: 5px;
    }
    h1 {
      color: #2c3e50;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>${description}</h1>
    <p>This is a generated HTML template based on your description.</p>
    
    <div id="content">
      <!-- Main content will go here -->
      <p>Content placeholder</p>
    </div>
    
    <footer>
      <p>Generated with Claude Coder Local</p>
    </footer>
  </div>
  
  <script>
    // JavaScript can be added here
    document.addEventListener('DOMContentLoaded', () => {
      console.log('Page loaded');
    });
  </script>
</body>
</html>`,

    css: `/* 
 * ${description}
 * Generated by Claude Coder Local
 */

/* Base styles */
:root {
  --primary-color: #3498db;
  --secondary-color: #2ecc71;
  --text-color: #333;
  --background-color: #fff;
  --accent-color: #e74c3c;
}

body {
  font-family: 'Arial', sans-serif;
  line-height: 1.6;
  color: var(--text-color);
  background-color: var(--background-color);
  margin: 0;
  padding: 0;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

/* Typography */
h1, h2, h3, h4, h5, h6 {
  margin-top: 0;
  color: var(--primary-color);
}

a {
  color: var(--primary-color);
  text-decoration: none;
  transition: color 0.3s ease;
}

a:hover {
  color: var(--accent-color);
}

/* Custom components based on description */
.special-section {
  background-color: #f8f9fa;
  border-radius: 5px;
  padding: 20px;
  margin-bottom: 20px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

/* Media queries for responsiveness */
@media (max-width: 768px) {
  .container {
    padding: 10px;
  }
}`,

    bash: `#!/bin/bash
# ${description}

# Set up script environment
set -e
SCRIPT_DIR="$(pwd)"
LOG_FILE="$SCRIPT_DIR/script.log"

# Log function
log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log "Starting script execution"

# Main implementation
log "Performing main task"

# Example operations (modify based on description)
# Create directory if it doesn't exist
if [ ! -d "./output" ]; then
  mkdir -p "./output"
  log "Created output directory"
fi

# Example of processing files
# find . -type f -name "*.txt" | while read file; do
#   log "Processing $file"
#   # Process file here
# done

log "Script completed successfully"
exit 0`,

    java: `/**
 * ${description}
 * 
 * @author Claude Coder Local
 */
public class Main {
    public static void main(String[] args) {
        System.out.println("Starting process");
        
        // Implementation based on description
        Result result = processTask();
        
        System.out.println(result);
    }
    
    /**
     * Process the main task
     * @return Result object containing the outcome
     */
    private static Result processTask() {
        // Implementation goes here
        return new Result(true, "Operation completed", System.currentTimeMillis());
    }
    
    /**
     * Result class to hold operation outcome
     */
    static class Result {
        private final boolean success;
        private final String message;
        private final long timestamp;
        
        public Result(boolean success, String message, long timestamp) {
            this.success = success;
            this.message = message;
            this.timestamp = timestamp;
        }
        
        @Override
        public String toString() {
            return "Result{" +
                   "success=" + success +
                   ", message='" + message + '\'' +
                   ", timestamp=" + timestamp +
                   '}';
        }
    }
}`
  };
  
  return templates[language] || 
    `// ${description}\n\n// Generated code for ${language} would appear here.`;
}

// Guess language from user input
function guessLanguage(input) {
  const hints = {
    javascript: ['javascript', 'js', 'node', 'npm', 'express', 'react'],
    python: ['python', 'py', 'django', 'flask', 'numpy', 'pandas'],
    html: ['html', 'webpage', 'website', 'page', 'web'],
    css: ['css', 'style', 'styling', 'stylesheet'],
    bash: ['bash', 'shell', 'script', 'sh', 'terminal', 'command'],
    java: ['java', 'spring', 'android']
  };
  
  input = input.toLowerCase();
  
  for (const [lang, keywords] of Object.entries(hints)) {
    if (keywords.some(keyword => input.includes(keyword))) {
      return lang;
    }
  }
  
  // Default to JavaScript if no language is detected
  return 'javascript';
}

// Process file operations
function handleFileOperation(command, args) {
  switch(command) {
    case 'ls':
      try {
        const dir = args.join(' ') || '.';
        return executeCommand(`ls -la ${dir}`);
      } catch (error) {
        return `Error: ${error.message}`;
      }
      
    case 'cat':
      try {
        const file = args.join(' ');
        if (!file) return 'Error: Please specify a file to view';
        if (!fs.existsSync(file)) return `Error: File not found: ${file}`;
        
        const content = fs.readFileSync(file, 'utf8');
        return content;
      } catch (error) {
        return `Error: ${error.message}`;
      }
      
    case 'edit':
      try {
        const file = args.join(' ');
        if (!file) return 'Error: Please specify a file to edit';
        
        // Create the file if it doesn't exist
        if (!fs.existsSync(file)) {
          fs.writeFileSync(file, '');
        }
        
        // Try to open with various editors
        const editors = ['code', 'vim', 'nano', 'gedit', 'notepad'];
        let editorFound = false;
        
        for (const editor of editors) {
          try {
            const child = spawn(editor, [file], {
              detached: true,
              stdio: 'ignore'
            });
            child.unref();
            editorFound = true;
            break;
          } catch (e) {
            // Try next editor
          }
        }
        
        if (!editorFound) {
          return `Error: No suitable editor found. Please install one of: ${editors.join(', ')}`;
        }
        
        return `Opened ${file} for editing. You can continue working here.`;
      } catch (error) {
        return `Error: ${error.message}`;
      }
      
    case 'search':
      try {
        if (args.length < 1) return 'Error: Please specify a pattern to search for';
        
        const pattern = args[0];
        const filePattern = args.length > 1 ? args.slice(1).join(' ') : '*';
        
        const result = executeCommand(`grep -r -n "${pattern}" --include="${filePattern}" .`);
        return result || 'No matches found';
      } catch (error) {
        return `Error: ${error.message}`;
      }
      
    case 'cd':
      try {
        const dir = args.join(' ') || os.homedir();
        process.chdir(dir);
        return `Changed directory to ${process.cwd()}`;
      } catch (error) {
        return `Error: ${error.message}`;
      }
      
    case 'pwd':
      return process.cwd();
      
    case 'run':
      try {
        const cmd = args.join(' ');
        if (!cmd) return 'Error: Please specify a command to run';
        const result = executeCommand(cmd);
        return result;
      } catch (error) {
        return `Error: ${error.message}`;
      }
  }
}

// Store last generated output for save command
let lastOutput = '';

// Process input and provide responses
function processInput(input, rl) {
  input = input.trim();
  
  // Handle command syntax (starts with /)
  if (input.startsWith('/')) {
    const [command, ...args] = input.slice(1).split(' ');
    
    switch (command) {
      case 'help':
        printHelp();
        return null; // No output to print
        
      case 'exit':
        console.log('Goodbye!');
        rl.close();
        process.exit(0);
        
      case 'clear':
        console.clear();
        return null;
        
      case 'version':
        return `Codesphere v${VERSION}`;
        
      case 'about':
        return `Codesphere v${VERSION}\n\nA lightweight, terminal-based coding assistant that helps you generate code, navigate files, and work efficiently from the command line.\n\nConfig directory: ${CONFIG_DIR}\nNode.js version: ${process.version}`;
        
      case 'save':
        try {
          const filename = args.join(' ');
          if (!filename) return 'Error: Please provide a filename to save to';
          if (!lastOutput) return 'Error: No output to save';
          
          fs.writeFileSync(filename, lastOutput);
          return `Saved output to ${filename}`;
        } catch (error) {
          return `Error saving file: ${error.message}`;
        }
        
      case 'find':
        try {
          if (args.length < 1) return 'Error: Please specify a pattern to find';
          const pattern = args.join(' ');
          return executeCommand(`find . -type f -name "${pattern}" | sort`);
        } catch (error) {
          return `Error: ${error.message}`;
        }
        
      case 'ls':
      case 'cat':
      case 'edit':
      case 'search':
      case 'cd':
      case 'pwd':
      case 'run':
        return handleFileOperation(command, args);
        
      default:
        return `Unknown command: /${command}. Type /help for available commands.`;
    }
  }
  
  // Default behavior: if not a command, generate code
  const result = generateCode(input);
  lastOutput = result; // Store for save command
  return result;
}

// Create and configure the readline interface
function createInterface() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: `${style.bold}${style.green}codesphere${style.reset}${style.bold}>${style.reset} `,
    completer: (line) => {
      const completions = Object.keys(commands).map(cmd => '/' + cmd);
      const hits = completions.filter(c => c.startsWith(line));
      return [hits.length ? hits : completions, line];
    }
  });
}

// Main application function
function main() {
  // Initialize environment
  init();
  
  // Print the welcome banner
  printBanner();
  
  // Create the readline interface
  const rl = createInterface();
  
  // Start prompt
  rl.prompt();
  
  // Handle input
  rl.on('line', (line) => {
    if (line.trim()) {
      // Process user input
      const response = processInput(line, rl);
      
      // Display the response
      if (response) {
        console.log();
        console.log(response);
        console.log();
        
        // Update lastOutput for the save command
        lastOutput = response;
        
        // Save to history and session
        addToHistory(line, response);
        updateSession(line, response);
      }
    }
    
    // Show prompt for next command
    rl.prompt();
  });
  
  // Handle CTRL+C and other closing events
  rl.on('close', () => {
    console.log('Goodbye!');
    process.exit(0);
  });
  
  // Handle SIGINT (Ctrl+C)
  process.on('SIGINT', () => {
    console.log('\nTo exit, type /exit');
    rl.prompt();
  });
}

// Process command line arguments first
if (process.argv.length > 2) {
  const arg = process.argv[2];
  if (arg === '--version' || arg === '-v') {
    console.log(`v${VERSION}`);
    process.exit(0);
  }
  if (arg === '--help' || arg === '-h') {
    console.log(`Codesphere v${VERSION} - Interactive Coding Assistant

Usage: codesphere [options]

Options:
  --version, -v      Show version number
  --help, -h         Show help information
  
For more information, run codesphere and type /help for available commands.`);
    process.exit(0);
  }
}

// Start the application
main();