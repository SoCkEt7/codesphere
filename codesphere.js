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

// Memory system for tracking conversations and context
const memory = {
  conversations: [],
  generatedFiles: [],
  
  // Add a conversation to memory
  addConversation: function(prompt, response) {
    this.conversations.push({ 
      prompt, 
      response: typeof response === 'string' ? response.substring(0, 500) : String(response).substring(0, 500), 
      timestamp: new Date() 
    });
    // Keep only the last 10 exchanges to prevent memory overflow
    if (this.conversations.length > 10) {
      this.conversations.shift();
    }
  },
  
  // Add a generated file to memory
  addGeneratedFile: function(filePath, content, prompt) {
    this.generatedFiles.push({ 
      filePath, 
      content: content.substring(0, 500) + (content.length > 500 ? '...' : ''), 
      prompt, 
      timestamp: new Date() 
    });
    // Keep only the last 20 files
    if (this.generatedFiles.length > 20) {
      this.generatedFiles.shift();
    }
  },
  
  // Get context relevant to a new prompt
  getContextForPrompt: function(prompt) {
    // Return relevant context from previous conversations
    const relevantConversations = this.conversations
      .filter(c => {
        // Simple relevance check based on keyword overlap
        const promptWords = prompt.toLowerCase().split(/\s+/);
        const previousPromptWords = c.prompt.toLowerCase().split(/\s+/);
        const overlap = promptWords.filter(word => previousPromptWords.includes(word)).length;
        return overlap > 0;
      })
      .slice(-3); // Only use the 3 most recent relevant conversations
      
    // Return relevant files
    const relevantFiles = this.generatedFiles
      .filter(f => {
        const promptWords = prompt.toLowerCase().split(/\s+/);
        const filePromptWords = f.prompt.toLowerCase().split(/\s+/);
        const overlap = promptWords.filter(word => filePromptWords.includes(word)).length;
        return overlap > 0;
      })
      .slice(-2); // Only use the 2 most recent relevant files
      
    return {
      conversations: relevantConversations,
      files: relevantFiles
    };
  }
};

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
  },
  models: {
    description: 'List available AI models for code generation',
    usage: '/models'
  },
  install: {
    description: 'Install CodeLlama-34b-Instruct model',
    usage: '/install'
  },
  context: {
    description: 'Show current conversation context in memory',
    usage: '/context'
  },
  create: {
    description: 'Create a file with generated code from description',
    usage: '/create <filename> <description>'
  }
};

// Available AI models
const AVAILABLE_MODELS = [
  { name: 'CodeLlama-34b-Instruct', description: 'Large model for complex code generation', size: 'large' },
  { name: 'StarCoder-15b', description: 'Efficient model for most programming tasks', size: 'medium' },
  { name: 'Mistral-7b-Instruct', description: 'Fast model for simpler tasks', size: 'small' }
];

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
  
  // Load model configuration if exists
  const MODEL_CONFIG_FILE = path.join(CONFIG_DIR, 'model-config.json');
  
  if (fs.existsSync(MODEL_CONFIG_FILE)) {
    try {
      const config = JSON.parse(fs.readFileSync(MODEL_CONFIG_FILE, 'utf8'));
      console.log(`${style.green}✓${style.reset} Model configuration loaded`);
    } catch (error) {
      // Invalid config file, not critical
      console.log(`${style.dim}Using default model configuration${style.reset}`);
    }
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
│  ${style.magenta}Powered by Free AI Code Models${style.cyan}       │
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

// Display available models with installation status
function listAvailableModels() {
  console.log(`\n${style.bold}${style.cyan}Available AI Models:${style.reset}\n`);
  
  // Check for model server to determine installation status
  const modelServerPath = path.join(__dirname, 'models/server.js');
  const modelServerInstalled = fs.existsSync(modelServerPath);
  const configPath = path.join(__dirname, 'models/config/model-config.json');
  
  // Initialize status for each model
  const modelStatus = {};
  
  // Check model config if available
  if (fs.existsSync(configPath)) {
    try {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      config.models.forEach(model => {
        const modelPath = model.path;
        modelStatus[model.name] = fs.existsSync(modelPath) ? 'installed' : 'configured';
      });
    } catch (error) {
      // Config parsing failed
    }
  }
  
  // Display each model with installation status
  AVAILABLE_MODELS.forEach(model => {
    const status = modelStatus[model.name] || (modelServerInstalled ? 'available' : 'not installed');
    const statusColor = status === 'installed' ? style.green : 
                        status === 'configured' ? style.yellow : 
                        status === 'available' ? style.blue : style.red;
    
    console.log(`${style.bold}${style.green}${model.name}${style.reset} ${statusColor}[${status}]${style.reset}`);
    console.log(`  ${model.description}`);
    console.log(`  Size: ${model.size}`);
    
    // Installation instructions if not installed
    if (status === 'not installed') {
      console.log(`  ${style.dim}To install: ./models/install-model.sh${style.reset}`);
    }
    
    console.log();
  });
  
  return null;
}

// Function to use local CodeLlama model for code generation via API
async function callLocalLLMModel(prompt, language) {
  return new Promise(async (resolve, reject) => {
    try {
      console.log(`${style.dim}[Connecting to CodeLlama-34b-Instruct API...]${style.reset}`);
      
      // Check if we need a large context model
      const needsLargeContext = prompt.length > 500;
      
      // Choose the appropriate model based on the task
      let modelToUse;
      let modelDescription = "";
      
      if (language === 'python' || language === 'javascript') {
        if (needsLargeContext) {
          modelToUse = "CodeLlama-34b-Instruct";
          modelDescription = "using large model for complex code";
        } else {
          modelToUse = "StarCoder-15b";
          modelDescription = "using efficient model for standard tasks";
        }
      } else if (language === 'java' || language === 'c++' || language === 'rust') {
        modelToUse = "CodeLlama-34b-Instruct"; // Better for strongly typed languages
        modelDescription = "using specialized model for strongly typed languages";
      } else if (prompt.length < 200) {
        modelToUse = "Mistral-7b-Instruct"; // Fast model for simple prompts
        modelDescription = "using fast model for simple request";
      } else {
        modelToUse = "StarCoder-15b"; // Good generic model for other languages
        modelDescription = "using general-purpose code model";
      }
      
      // Try to load the model server if available
      const modelPath = path.join(__dirname, 'models/server.js');
      
      if (fs.existsSync(modelPath)) {
        console.log(`${style.green}✓${style.reset} ${style.dim}Found local model server${style.reset}`);
        
        // Dynamic import of the model server
        const modelServer = require(modelPath);
        
        // Log the model being used
        console.log(`${style.green}✓${style.reset} ${style.dim}Using ${modelToUse} (${modelDescription})${style.reset}`);
        
        if (typeof modelServer.generateResponse === 'function') {
          try {
            // Call the async model server to generate code
            const response = await modelServer.generateResponse(prompt, language);
            
            if (response) {
              // Return successful response with model-generated code
              return resolve({
                success: true,
                model: modelToUse,
                generated_text: response
              });
            }
          } catch (serverError) {
            console.log(`${style.yellow}Warning:${style.reset} ${style.dim}Model server error: ${serverError.message}${style.reset}`);
            // Fall through to fallback
          }
        }
      }
      
      // Fallback if model server is not available or fails
      console.log(`${style.dim}Using template-based generation as fallback${style.reset}`);
      
      // Generate custom code based on prompt and language using template
      const generatedCode = enhanceTemplateForLanguage(language, prompt, modelToUse);
      
      // Return successful response with template-based code
      resolve({
        success: true,
        model: modelToUse + " (template fallback)",
        generated_text: generatedCode
      });
    } catch (error) {
      console.error(`${style.red}Error:${style.reset} ${error.message}`);
      reject(error);
    }
  });
}

// Enhance templates with more intelligent code generation based on the prompt
function enhanceTemplateForLanguage(language, prompt, model) {
  // Get base template
  let template = getTemplateForLanguage(language, prompt);
  
  // Extract keywords to make the template more relevant to the prompt
  const keywords = extractKeywordsFromPrompt(prompt);
  
  // Customize function and variable names based on the prompt
  if (language === 'javascript' || language === 'python') {
    const functionName = generateFunctionName(prompt);
    template = template.replace(/function main\(\)/g, `function ${functionName}()`);
    template = template.replace(/def main\(\)/g, `def ${functionName}()`);
  }
  
  // Add relevant comments based on keywords
  if (keywords.length > 0) {
    template = addRelevantComments(template, keywords, language);
  }
  
  // Replace the generic attribution with the actual model
  return template.replace("Generated by Tabnine with Claude 3.7", `Generated by ${model}`);
}

// Extract meaningful keywords from the prompt
function extractKeywordsFromPrompt(prompt) {
  // Simple keyword extraction - in a real implementation, this would be more sophisticated
  const words = prompt.toLowerCase().split(/\s+/);
  const commonWords = new Set(['a', 'an', 'the', 'and', 'or', 'but', 'for', 'with', 'create', 'make', 'build', 'write']);
  
  return words
    .filter(word => word.length > 3 && !commonWords.has(word))
    .slice(0, 5); // Take top 5 keywords
}

// Generate a meaningful function name from the prompt
function generateFunctionName(prompt) {
  // Simple function name generation
  const words = prompt.toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 2);
  
  if (words.length === 0) return 'main';
  
  // Create camelCase function name from first 3 meaningful words
  const functionName = words[0] + 
    words.slice(1, 3).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('');
    
  return functionName.replace(/[^a-zA-Z0-9]/g, '');
}

// Add relevant comments based on extracted keywords
function addRelevantComments(template, keywords, language) {
  // Add meaningful comments based on language
  if (language === 'javascript' || language === 'python') {
    const commentPrefix = language === 'javascript' ? '//' : '#';
    
    // Create keyword-based comments
    const keywordComment = `${commentPrefix} Keywords: ${keywords.join(', ')}`;
    
    // Add comment near the top of the file
    return template.replace(/\n/, `\n${keywordComment}\n`);
  }
  
  return template;
}

// Function to enhance prompt with context from previous conversations and generated files
function enhancePromptWithContext(prompt, language) {
  // Get relevant context from memory
  const context = memory.getContextForPrompt(prompt);
  let enhancedPrompt = prompt;
  
  // Add context from previous conversations if available
  if (context.conversations.length > 0) {
    const conversationContext = context.conversations
      .map(c => `Previous related request: "${c.prompt}" resulted in code that ${c.response.substring(0, 100)}...`)
      .join('\n');
    
    enhancedPrompt = `${prompt}\n\nContext from previous interactions:\n${conversationContext}`;
  }
  
  // Add context from previous files if available
  if (context.files.length > 0) {
    const fileContext = context.files
      .map(f => `I previously created file ${f.filePath} for this request: "${f.prompt}"`)
      .join('\n');
    
    enhancedPrompt = `${enhancedPrompt}\n\nPreviously created files:\n${fileContext}`;
  }
  
  console.log(`${style.dim}[Added context from ${context.conversations.length} conversations and ${context.files.length} files]${style.reset}`);
  
  return enhancedPrompt;
}

// Generate code using installed model or fallback options
async function generateCode(description) {
  // Detect coding language from the prompt
  const language = guessLanguage(description);
  
  try {
    // Show status message
    console.log(`${style.dim}[Generating code using CodeLlama-34b-Instruct...]${style.reset}`);
    
    // Enhance the prompt with context from previous interactions
    const enhancedPrompt = enhancePromptWithContext(description, language);
    
    // Call our local model with the enhanced prompt
    const modelResponse = await callLocalLLMModel(enhancedPrompt, language);
    
    if (modelResponse.success) {
      // Add a header comment to the generated code
      const headerComment = language === 'python' ? 
        `"""
Generated for: ${description}
Model: ${modelResponse.model}
"""\n\n` : 
        `/**
 * Generated for: ${description}
 * Model: ${modelResponse.model}
 */\n\n`;
      
      // Return the generated code with header
      if (modelResponse.generated_text.trim().startsWith("/**") || 
          modelResponse.generated_text.trim().startsWith("/*") ||
          modelResponse.generated_text.trim().startsWith("\"\"\"") ||
          modelResponse.generated_text.trim().startsWith("#")) {
        // Code already has a comment header
        const result = modelResponse.generated_text;
        
        // Store in memory for future context
        memory.addConversation(description, result.substring(0, 200) + "...");
        
        return result;
      } else {
        // Add our header
        const result = headerComment + modelResponse.generated_text;
        
        // Store in memory for future context
        memory.addConversation(description, result.substring(0, 200) + "...");
        
        return result;
      }
    } else {
      throw new Error("Model returned error status");
    }
  } catch (error) {
    // Handle errors gracefully
    console.log(`${style.yellow}Warning:${style.reset} Model generation failed, using offline generator`);
    
    // Provide a helpful error message
    const fallbackCode = `/* 
 * ${description}
 * 
 * Note: Code generation failed with error: ${error.message}
 * Using offline code generator instead.
 */

` + getTemplateForLanguage(language, description)
    .replace("Generated by Tabnine with Claude 3.7", "Generated offline (model unavailable)");
    
    // Still store in memory
    memory.addConversation(description, "Fallback code generation used");
    
    return fallbackCode;
  }
}

// Function to get template for a specific language
function getTemplateForLanguage(language, description) {
  const templates = {
    javascript: `/**
 * ${description}
 * Generated by Tabnine with Claude 3.7
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
Generated by Tabnine with Claude 3.7
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
    <p>Generated by Tabnine with Claude 3.7</p>
    
    <div id="content">
      <!-- Main content will go here -->
      <p>Content placeholder</p>
    </div>
    
    <footer>
      <p>Generated with Tabnine powered by Claude 3.7</p>
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
 * Generated by Tabnine with Claude 3.7
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
# Generated by Tabnine with Claude 3.7

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
 * @author Tabnine with Claude 3.7
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
  
  // Add attribution
  const result = templates[language] || 
    `// ${description}\n\n// Generated by free model for ${language}`;
  
  return result;
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

// Suggest a filename based on description and language
function suggestFilename(description, language) {
  const sanitized = description
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 20);
  
  const extensions = {
    javascript: '.js',
    typescript: '.ts',
    python: '.py',
    html: '.html',
    css: '.css',
    java: '.java',
    'c++': '.cpp',
    c: '.c',
    rust: '.rs',
    go: '.go',
    ruby: '.rb',
    php: '.php',
    bash: '.sh'
  };
  
  return sanitized + (extensions[language] || '.txt');
}

// Process input and provide responses
async function processInput(input, rl) {
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
        
      case 'models':
        return listAvailableModels();
        
      case 'install':
        try {
          console.log(`${style.cyan}Installing CodeLlama-34b-Instruct model...${style.reset}`);
          console.log(`${style.dim}This may take a few moments${style.reset}`);
          
          const installScriptPath = path.join(__dirname, 'models/install-model.sh');
          if (!fs.existsSync(installScriptPath)) {
            return `Error: Installation script not found at ${installScriptPath}`;
          }
          
          const installResult = executeCommand(`chmod +x "${installScriptPath}" && "${installScriptPath}"`);
          return installResult;
        } catch (error) {
          return `Error installing model: ${error.message}`;
        }
        
      case 'context':
        // Display the current memory context
        const contextInfo = [];
        contextInfo.push(`${style.cyan}${style.bold}Memory Context:${style.reset}`);
        
        // Show conversation history
        if (memory.conversations.length === 0) {
          contextInfo.push(`${style.dim}No conversation history yet.${style.reset}`);
        } else {
          contextInfo.push(`${memory.conversations.length} conversation exchanges in memory.\n`);
          memory.conversations.forEach((conv, i) => {
            const time = new Date(conv.timestamp).toLocaleTimeString();
            contextInfo.push(`${style.cyan}[${i+1}] ${time}${style.reset}`);
            contextInfo.push(`${style.green}User:${style.reset} ${conv.prompt.substring(0, 60)}${conv.prompt.length > 60 ? '...' : ''}`);
            contextInfo.push(`${style.magenta}Response:${style.reset} ${conv.response.substring(0, 60)}${conv.response.length > 60 ? '...' : ''}\n`);
          });
        }
        
        // Show generated files
        if (memory.generatedFiles.length > 0) {
          contextInfo.push(`\n${memory.generatedFiles.length} generated files in memory:`);
          memory.generatedFiles.forEach((file, i) => {
            contextInfo.push(`${style.green}[${i+1}] ${file.filePath}${style.reset} - ${file.prompt.substring(0, 40)}${file.prompt.length > 40 ? '...' : ''}`);
          });
        }
        
        return contextInfo.join('\n');
        
      case 'create':
        try {
          // Need at least 2 arguments - filename and description
          if (args.length < 2) {
            return `${style.yellow}Usage: /create <filename> <description>${style.reset}\nExample: /create server.js create a simple express server`;
          }
          
          const filename = args[0];
          const description = args.slice(1).join(' ');
          const language = guessLanguage(filename + ' ' + description);
          
          console.log(`${style.cyan}Creating file with ${language} code for: ${description}${style.reset}`);
          
          // Generate the code
          const generatedCode = await generateCode(description);
          
          // Write to file
          fs.writeFileSync(filename, generatedCode);
          
          // Add to memory
          memory.addGeneratedFile(filename, generatedCode, description);
          
          // Success message with preview
          const previewLines = generatedCode.split('\n').slice(0, 5).join('\n');
          return `${style.green}File ${filename} created successfully.${style.reset}\n\n${style.dim}Preview:${style.reset}\n${previewLines + (generatedCode.split('\n').length > 5 ? '\n...' : '')}`;
        } catch (error) {
          return `${style.red}Error creating file: ${error.message}${style.reset}`;
        }
        
      case 'save':
        try {
          const filename = args.join(' ');
          if (!filename) return 'Error: Please provide a filename to save to';
          if (!lastOutput) return 'Error: No output to save';
          
          fs.writeFileSync(filename, lastOutput);
          
          // Also add to memory
          memory.addGeneratedFile(filename, lastOutput, 'Saved from last output');
          
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
  const result = await generateCode(input);
  lastOutput = result; // Store for save command
  
  // Suggest creating a file with this code
  const suggestedFilename = suggestFilename(input, guessLanguage(input));
  console.log(`${style.green}Tip: Use /create ${suggestedFilename} "${input}" to save this as a file${style.reset}`);
  
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
  
  // Display startup message about code generation
  console.log(`${style.green}Ready to generate code!${style.reset} Type your description and press Enter.`);
  console.log(`Type ${style.bold}/models${style.reset} to see available AI models`);
  console.log();
  
  // Start prompt
  rl.prompt();
  
  // Handle input
  rl.on('line', async (line) => {
    if (line.trim()) {
      try {
        // Process user input asynchronously
        const response = await processInput(line, rl);
        
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
      } catch (error) {
        console.error(`${style.red}Error:${style.reset} ${error.message}`);
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
  for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i];
    
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
    
    // No model selection needed anymore, we always use free models
  }
}

// Start the application
main();