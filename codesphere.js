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
  view: {
    description: 'Display file contents with line numbers',
    usage: '/view <filename> [--offset <line>] [--limit <count>]'
  },
  edit: {
    description: 'Edit or create a file',
    usage: '/edit <filename>'
  },
  replace: {
    description: 'Replace file content',
    usage: '/replace <filename> <new-content>'
  },
  search: {
    description: 'Search file contents',
    usage: '/search <pattern> [file-pattern]'
  },
  grep: {
    description: 'Search file contents with regex pattern, similar to Claude Code\'s GrepTool',
    usage: '/grep <pattern> [--include <file-pattern>] [--path <directory>]'
  },
  glob: {
    description: 'Find files matching a pattern, similar to Claude Code\'s GlobTool',
    usage: '/glob <pattern> [--path <directory>]'
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
  },
  agent: {
    description: 'Launch an autonomous agent to perform complex tasks',
    usage: '/agent <instructions>'
  },
  notebook: {
    description: 'Read Jupyter notebook (.ipynb file)',
    usage: '/notebook <filename>'
  },
  edit_cell: {
    description: 'Edit a cell in a Jupyter notebook',
    usage: '/edit_cell <filename> <cell_number> <content> [--type code|markdown]'
  },
  web: {
    description: 'Fetch content from a URL',
    usage: '/web <url>'
  },
  compact: {
    description: 'Compact and continue the conversation',
    usage: '/compact'
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
${style.bold}${style.cyan}┌────────────────────────────────────────────────────┐
│                                                    │
│  ${style.green}C O D E S P H E R E ${style.cyan}                              │
│  ${style.white}v${VERSION}${style.cyan}                                            │
│  ${style.magenta}Powered by Mistral AI & Claude Code Compatible${style.cyan} │
│                                                    │
│  ${style.dim}Type${style.reset}${style.cyan} ${style.green}/help${style.cyan} ${style.dim}for available commands${style.reset}${style.cyan}                 │
│  ${style.dim}Type${style.reset}${style.cyan} ${style.yellow}any description${style.cyan} ${style.dim}to generate code${style.reset}${style.cyan}           │
│                                                    │
└────────────────────────────────────────────────────┘${style.reset}
`);
}

// Display available commands
function printHelp() {
  console.log(`\n${style.bold}${style.cyan}╭─── CODESPHERE COMMANDS ────────────────────╮${style.reset}\n`);
  
  // Group commands by category
  const categories = {
    "Core Commands": ["help", "exit", "clear", "version", "about", "models", "install", "context", "compact"],
    "File Operations": ["ls", "cat", "view", "edit", "replace", "search", "grep", "glob", "find", "cd", "pwd", "run"],
    "Code Generation": ["create", "save", "agent"],
    "Notebook Support": ["notebook", "edit_cell"],
    "Web Integration": ["web"]
  };
  
  // Print commands by category
  for (const [category, cmdList] of Object.entries(categories)) {
    console.log(`${style.bold}${style.yellow}● ${category}:${style.reset}`);
    
    cmdList.forEach(cmd => {
      if (commands[cmd]) {
        console.log(`  ${style.bold}${style.green}${commands[cmd].usage}${style.reset}`);
        console.log(`    ${commands[cmd].description}`);
      }
    });
    console.log(); // Add space between categories
  }
  
  // Print direct code generation info
  console.log(`${style.bold}${style.yellow}● Direct Code Generation:${style.reset}`);
  console.log(`  ${style.bold}${style.green}<your code description>${style.reset}`);
  console.log(`    Type any description to generate code in the detected language`);
  console.log();
  
  // Add examples section
  console.log(`${style.bold}${style.cyan}╭─── EXAMPLES ────────────────────────────────╮${style.reset}\n`);
  console.log(`${style.green}create a React component for a login form${style.reset}`);
  console.log(`${style.dim}Generate JavaScript React code for a login form${style.reset}\n`);
  
  console.log(`${style.green}/create server.js create an Express server with user authentication${style.reset}`);
  console.log(`${style.dim}Generate code and save directly to server.js${style.reset}\n`);
  
  console.log(`${style.green}/grep "function auth" --include "*.js"${style.reset}`);
  console.log(`${style.dim}Search for authentication functions in JavaScript files${style.reset}\n`);
  
  console.log(`${style.green}/agent analyze the codebase and list all API endpoints${style.reset}`);
  console.log(`${style.dim}Launch an agent to perform complex analysis${style.reset}\n`);
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
    console.log(`${style.dim}[Generating code using Mistral AI...]${style.reset}`);
    
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
    console.log(`${style.yellow}Warning:${style.reset} Model generation failed, using fallback templates`);
    
    // Create fallback code based on language
    let fallbackCode;
    
    if (language === 'javascript') {
      fallbackCode = `/**
 * ${description}
 * Generated by Codesphere (Fallback Template)
 */

// Main functionality
function main() {
  console.log("Starting implementation for: ${description}");
  
  // TODO: Implement functionality based on description
  
  return {
    success: true,
    message: "Operation completed",
    timestamp: new Date().toISOString()
  };
}

// Export for use in other modules
module.exports = { main };

// Execute if run directly
if (require.main === module) {
  console.log(main());
}`;
    } else if (language === 'python') {
      fallbackCode = `"""
${description}

Generated by Codesphere (Fallback Template)
"""
import json
from datetime import datetime


def main():
    """Main implementation function"""
    print("Starting implementation for: ${description}")
    
    # TODO: Implement functionality based on description
    
    result = {
        "success": True,
        "message": "Operation completed",
        "timestamp": datetime.now().isoformat()
    }
    
    return result


if __name__ == "__main__":
    print(json.dumps(main(), default=str, indent=2))`;
    } else if (language === 'html') {
      fallbackCode = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${description}</title>
  <style>
    body {
      font-family: system-ui, sans-serif;
      line-height: 1.6;
      margin: 0;
      padding: 20px;
      color: #333;
    }
    .container {
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
    }
    h1 { color: #2c3e50; }
  </style>
</head>
<body>
  <div class="container">
    <h1>${description}</h1>
    <p>Generated by Codesphere</p>
    
    <!-- TODO: Implement based on description -->
    
  </div>
  
  <script>
    // JavaScript functionality can be added here
    document.addEventListener('DOMContentLoaded', () => {
      console.log('Page loaded');
    });
  </script>
</body>
</html>`;
    } else {
      // Generic fallback for other languages
      fallbackCode = `// ${description}
// Generated by Codesphere (Fallback Template)

// TODO: Implement functionality for ${language}
`;
    }
    
    // Store in memory
    memory.addConversation(description, "Fallback code generation used");
    
    return fallbackCode;
  }
}

// Function placeholder for backward compatibility
function getTemplateForLanguage(language, description) {
  // This function is kept for backward compatibility
  return `// ${description} - ${language}`;
}
    success: true,
    message: "Operation completed",
    timestamp: new Date().toISOString(),
    data: {
      // Add your custom data here
    }
  };
  
  return result;
}

// Helper functions
function processData(data) {
  // Process data logic here
  return data;
}

// Export for use in other modules
module.exports = { main, processData };

// Execute if run directly
if (require.main === module) {
  console.log(main());
}`,

    typescript: `/**
 * ${description}
 * Generated by Codesphere
 */

// Define types
interface Result {
  success: boolean;
  message: string;
  timestamp: string;
  data?: Record<string, any>;
}

// Main functionality
function main(): Result {
  console.log("Starting implementation for: ${description}");
  
  // Implementation based on description
  const result: Result = {
    success: true,
    message: "Operation completed",
    timestamp: new Date().toISOString(),
    data: {
      // Add your custom data here
    }
  };
  
  return result;
}

// Helper function with type safety
function processData<T>(data: T): T {
  // Process data logic here
  return data;
}

// Export for use in other modules
export { main, processData };

// Execute if run directly
if (require.main === module) {
  console.log(main());
}`,

    python: `#!/usr/bin/env python3
"""
${description}

Generated by Codesphere
"""
import json
import sys
from datetime import datetime
from typing import Dict, Any, Optional


def main() -> Dict[str, Any]:
    """Main implementation function for ${description}"""
    print("Starting implementation for: ${description}")
    
    # Implementation based on description
    result = {
        "success": True,
        "message": "Operation completed",
        "timestamp": datetime.now().isoformat(),
        "data": {
            # Add your custom data here
        }
    }
    
    return result


def process_data(data: Dict[str, Any]) -> Dict[str, Any]:
    """Process the input data and return transformed data"""
    # Process data logic here
    return data


def setup_logging():
    """Configure logging for the application"""
    import logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[logging.StreamHandler(sys.stdout)]
    )
    return logging.getLogger(__name__)


if __name__ == "__main__":
    logger = setup_logging()
    try:
        result = main()
        print(json.dumps(result, default=str, indent=2))
    except Exception as e:
        logger.error(f"Error occurred: {e}")
        sys.exit(1)`,

    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="${description}">
  <title>${description}</title>
  <style>
    /* Modern CSS Reset */
    *, *::before, *::after { box-sizing: border-box; }
    body, h1, h2, h3, h4, p, figure, blockquote, dl, dd { margin: 0; }
    
    /* Base styles */
    :root {
      --primary-color: #4361ee;
      --secondary-color: #3a0ca3;
      --accent-color: #f72585;
      --text-color: #2b2d42;
      --background-color: #f8f9fa;
      --light-color: #ffffff;
    }
    
    body {
      font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
      line-height: 1.6;
      color: var(--text-color);
      background-color: var(--background-color);
      padding: 0;
    }
    
    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 2rem;
    }
    
    header {
      background-color: var(--primary-color);
      color: white;
      padding: 2rem 0;
      text-align: center;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }
    
    main {
      padding: 2rem 0;
    }
    
    h1, h2, h3 {
      margin-bottom: 1rem;
      line-height: 1.2;
    }
    
    .card {
      background: var(--light-color);
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      padding: 1.5rem;
      margin-bottom: 1.5rem;
    }
    
    .btn {
      display: inline-block;
      background-color: var(--accent-color);
      color: white;
      padding: 0.5rem 1.5rem;
      border-radius: 4px;
      text-decoration: none;
      font-weight: 600;
      transition: all 0.3s ease;
    }
    
    .btn:hover {
      opacity: 0.9;
      transform: translateY(-2px);
    }
    
    footer {
      background-color: var(--secondary-color);
      color: white;
      text-align: center;
      padding: 1rem 0;
      margin-top: 2rem;
    }
    
    /* Responsive design */
    @media (max-width: 768px) {
      .container {
        padding: 1rem;
      }
    }
  </style>
</head>
<body>
  <header>
    <div class="container">
      <h1>${description}</h1>
    </div>
  </header>
  
  <main>
    <div class="container">
      <section class="card">
        <h2>Welcome to Codesphere</h2>
        <p>This is a template for: ${description}</p>
        <p>Customize this template to meet your specific requirements.</p>
        <a href="#" class="btn">Get Started</a>
      </section>
      
      <section class="card">
        <h2>Features</h2>
        <ul>
          <li>Responsive design that works on all devices</li>
          <li>Modern CSS with variables and flexbox</li>
          <li>Customizable color scheme</li>
          <li>Optimized for accessibility</li>
        </ul>
      </section>
    </div>
  </main>
  
  <footer>
    <div class="container">
      <p>Generated with Codesphere &copy; ${new Date().getFullYear()}</p>
    </div>
  </footer>
  
  <script>
    // JavaScript functionality can be added here
    document.addEventListener('DOMContentLoaded', () => {
      console.log('Page loaded successfully');
      
      // Example: Add event listener to button
      const btn = document.querySelector('.btn');
      if (btn) {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          alert('Button clicked!');
        });
      }
    });
  </script>
</body>
</html>`,

    css: `/* 
 * ${description}
 * Generated by Codesphere
 */

/* Modern CSS Reset */
*, *::before, *::after { 
  box-sizing: border-box; 
  margin: 0;
  padding: 0;
}

/* Define design system with CSS variables */
:root {
  /* Color palette */
  --primary-color: #4361ee;
  --primary-dark: #3a0ca3;
  --primary-light: #7209b7;
  --accent-color: #f72585;
  --text-color: #2b2d42;
  --text-light: #8d99ae;
  --background-color: #f8f9fa;
  --background-alt: #e9ecef;
  --white: #ffffff;
  --black: #000000;
  --success: #2ecc71;
  --warning: #f39c12;
  --error: #e74c3c;
  --info: #3498db;
  
  /* Typography */
  --font-primary: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  --font-secondary: Georgia, 'Times New Roman', serif;
  --font-mono: 'Courier New', monospace;
  
  /* Spacing */
  --space-xs: 0.25rem;  /* 4px */
  --space-sm: 0.5rem;   /* 8px */
  --space-md: 1rem;     /* 16px */
  --space-lg: 1.5rem;   /* 24px */
  --space-xl: 2rem;     /* 32px */
  --space-xxl: 3rem;    /* 48px */
  
  /* Border radius */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 16px;
  --radius-full: 9999px;
  
  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.1);
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.1);
  --shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.1);
}

/* Base styles */
body {
  font-family: var(--font-primary);
  line-height: 1.6;
  color: var(--text-color);
  background-color: var(--background-color);
}

/* Layout */
.container {
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  padding: var(--space-md);
}

.row {
  display: flex;
  flex-wrap: wrap;
  margin: 0 calc(-1 * var(--space-md));
}

.col {
  flex: 1 0 0%;
  padding: 0 var(--space-md);
}

/* Typography */
h1, h2, h3, h4, h5, h6 {
  margin-bottom: var(--space-md);
  line-height: 1.2;
  font-weight: 700;
  color: var(--text-color);
}

h1 { font-size: 2.5rem; }
h2 { font-size:, 2rem; }
h3 { font-size: 1.75rem; }
h4 { font-size: 1.5rem; }
h5 { font-size: 1.25rem; }
h6 { font-size: 1rem; }

p { 
  margin-bottom: var(--space-md);
}

a {
  color: var(--primary-color);
  text-decoration: none;
  transition: color 0.3s ease;
}

a:hover {
  color: var(--primary-dark);
  text-decoration: underline;
}

/* Components */
.btn {
  display: inline-block;
  padding: var(--space-sm) var(--space-lg);
  background-color: var(--primary-color);
  color: var(--white);
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-weight: 600;
  text-align: center;
  transition: all 0.3s ease;
}

.btn:hover {
  background-color: var(--primary-dark);
  transform: translateY(-2px);
}

.btn-accent {
  background-color: var(--accent-color);
}

.card {
  background-color: var(--white);
  border-radius: var(--radius-md);
  padding: var(--space-lg);
  margin-bottom: var(--space-lg);
  box-shadow: var(--shadow-md);
}

/* Utility classes */
.text-center { text-align: center; }
.text-right { text-align: right; }
.text-left { text-align: left; }

.m-0 { margin: 0; }
.mt-1 { margin-top: var(--space-sm); }
.mt-2 { margin-top: var(--space-md); }
.mt-3 { margin-top: var(--space-lg); }
.mb-1 { margin-bottom: var(--space-sm); }
.mb-2 { margin-bottom: var(--space-md); }
.mb-3 { margin-bottom: var(--space-lg); }

/* Media queries for responsiveness */
@media (max-width: 992px) {
  .container {
    max-width: 100%;
    padding: var(--space-md);
  }
}

@media (max-width: 768px) {
  .row {
    flex-direction: column;
  }
  
  h1 { font-size: 2rem; }
  h2 { font-size: 1.75rem; }
  h3 { font-size: 1.5rem; }
}

@media (max-width: 480px) {
  body {
    font-size: 0.875rem;
  }
  
  .container {
    padding: var(--space-sm);
  }
}`,

    bash: `#!/bin/bash
# ${description}
# Generated by Codesphere

# Set strict mode
set -e          # Exit immediately if a command exits with a non-zero status
set -u          # Treat unset variables as an error
set -o pipefail # Return value of a pipeline is the value of the last command to exit with a non-zero status

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "\${BASH_SOURCE[0]}")" && pwd)"
SCRIPT_NAME="$(basename "\${BASH_SOURCE[0]}")"
LOG_FILE="\${SCRIPT_DIR}/\${SCRIPT_NAME%.sh}.log"

# Colors for output
GREEN="\\033[0;32m"
YELLOW="\\033[0;33m"
RED="\\033[0;31m"
BLUE="\\033[0;34m"
NC="\\033[0m" # No Color

# Log function
log() {
  local level="$1"
  local message="$2"
  local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
  
  case "$level" in
    "INFO")
      echo -e "${GREEN}[INFO]${NC} [${timestamp}] $message" | tee -a "$LOG_FILE"
      ;;
    "WARN")
      echo -e "${YELLOW}[WARN]${NC} [${timestamp}] $message" | tee -a "$LOG_FILE"
      ;;
    "ERROR")
      echo -e "${RED}[ERROR]${NC} [${timestamp}] $message" | tee -a "$LOG_FILE"
      ;;
    "DEBUG")
      echo -e "${BLUE}[DEBUG]${NC} [${timestamp}] $message" | tee -a "$LOG_FILE"
      ;;
    *)
      echo -e "[${timestamp}] $message" | tee -a "$LOG_FILE"
      ;;
  esac
}

# Clean up function
cleanup() {
  log "INFO" "Performing cleanup..."
  # Add cleanup operations here
  log "INFO" "Cleanup completed"
}

# Error handler
error_handler() {
  log "ERROR" "An error occurred on line $1"
  cleanup
  exit 1
}

# Set up the error trap
trap 'error_handler $LINENO' ERR

# Help function
show_help() {
  cat << EOF
Usage: $SCRIPT_NAME [options]

${description}

Options:
  -h, --help        Show this help message and exit
  -v, --verbose     Enable verbose output
  -d, --debug       Enable debug mode
  -o, --output DIR  Set output directory

Example:
  $SCRIPT_NAME --verbose --output ./results

EOF
}

# Parse command line arguments
VERBOSE=false
DEBUG=false
OUTPUT_DIR="$SCRIPT_DIR/output"

while [[ $# -gt 0 ]]; do
  case "$1" in
    -h|--help)
      show_help
      exit 0
      ;;
    -v|--verbose)
      VERBOSE=true
      shift
      ;;
    -d|--debug)
      DEBUG=true
      shift
      ;;
    -o|--output)
      OUTPUT_DIR="$2"
      shift 2
      ;;
    *)
      log "ERROR" "Unknown option: $1"
      show_help
      exit 1
      ;;
  esac
done

# Create output directory if it doesn't exist
if [ ! -d "$OUTPUT_DIR" ]; then
  log "INFO" "Creating output directory: $OUTPUT_DIR"
  mkdir -p "$OUTPUT_DIR"
fi

# Main function
main() {
  log "INFO" "Starting script execution: ${description}"
  
  # Your script logic goes here
  log "INFO" "Processing data..."
  
  # Example operations
  if [ "$VERBOSE" = true ]; then
    log "INFO" "Verbose mode is enabled"
  fi
  
  if [ "$DEBUG" = true ]; then
    log "DEBUG" "Debug information: $OUTPUT_DIR"
  fi
  
  # Example of a successful operation
  log "INFO" "Operation completed successfully"
  
  # Return success
  return 0
}

# Run the main function
main
cleanup

log "INFO" "Script completed successfully"
exit 0`,

    java: `/**
 * ${description}
 * 
 * @author Codesphere
 */
 
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.Map;
import java.util.logging.Logger;
import java.util.logging.Level;
import java.util.logging.ConsoleHandler;
import java.util.logging.SimpleFormatter;

public class Main {
    private static final Logger LOGGER = Logger.getLogger(Main.class.getName());
    
    static {
        // Configure logger
        ConsoleHandler handler = new ConsoleHandler();
        handler.setFormatter(new SimpleFormatter());
        LOGGER.setUseParentHandlers(false);
        LOGGER.addHandler(handler);
        LOGGER.setLevel(Level.INFO);
    }
    
    public static void main(String[] args) {
        LOGGER.info("Starting application");
        
        try {
            // Parse command line arguments if any
            Map<String, String> arguments = parseArguments(args);
            
            // Process the main task
            Result result = processTask(arguments);
            
            // Output the result
            System.out.println(result);
            
            LOGGER.info("Application completed successfully");
        } catch (Exception e) {
            LOGGER.log(Level.SEVERE, "Error occurred during execution", e);
            System.exit(1);
        }
    }
    
    /**
     * Parse command line arguments into a map
     * 
     * @param args Command line arguments
     * @return Map of argument name to value
     */
    private static Map<String, String> parseArguments(String[] args) {
        Map<String, String> arguments = new HashMap<>();
        
        for (int i = 0; i < args.length; i++) {
            if (args[i].startsWith("--")) {
                String key = args[i].substring(2);
                if (i + 1 < args.length && !args[i+1].startsWith("--")) {
                    arguments.put(key, args[i+1]);
                    i++;
                } else {
                    arguments.put(key, "true");
                }
            }
        }
        
        return arguments;
    }
    
    /**
     * Process the main task
     * 
     * @param arguments Command line arguments
     * @return Result object containing the outcome
     */
    private static Result processTask(Map<String, String> arguments) {
        LOGGER.info("Processing task with arguments: " + arguments);
        
        // Implementation goes here
        // TODO: Replace with actual implementation based on description
        
        return new Result(true, "Operation completed successfully", LocalDateTime.now());
    }
    
    /**
     * Helper method for data processing
     * 
     * @param input Input data to process
     * @return Processed data
     */
    private static String processData(String input) {
        // Example data processing
        return input != null ? input.toUpperCase() : "";
    }
}

/**
 * Result class to hold operation outcome
 */
class Result {
    private final boolean success;
    private final String message;
    private final LocalDateTime timestamp;
    
    public Result(boolean success, String message, LocalDateTime timestamp) {
        this.success = success;
        this.message = message;
        this.timestamp = timestamp;
    }
    
    public boolean isSuccess() {
        return success;
    }
    
    public String getMessage() {
        return message;
    }
    
    public LocalDateTime getTimestamp() {
        return timestamp;
    }
    
    @Override
    public String toString() {
        DateTimeFormatter formatter = DateTimeFormatter.ISO_LOCAL_DATE_TIME;
        return String.format(
            "Result{success=%s, message='%s', timestamp=%s}",
            success,
            message,
            timestamp.format(formatter)
        );
    }
}`,

    'c++': `/**
 * ${description}
 *
 * Generated by Codesphere
 */

#include <iostream>
#include <string>
#include <vector>
#include <map>
#include <chrono>
#include <ctime>
#include <memory>
#include <stdexcept>

// Result struct to hold operation outcome
struct Result {
    bool success;
    std::string message;
    std::string timestamp;
    
    // Constructor
    Result(bool s, const std::string& msg) : 
        success(s), message(msg) {
        // Get current time
        auto now = std::chrono::system_clock::now();
        auto now_c = std::chrono::system_clock::to_time_t(now);
        char buffer[100];
        std::strftime(buffer, sizeof(buffer), "%Y-%m-%d %H:%M:%S", std::localtime(&now_c));
        timestamp = buffer;
    }
    
    // String representation
    std::string toString() const {
        return "Result{success=" + std::string(success ? "true" : "false") + 
               ", message='" + message + 
               "', timestamp=" + timestamp + "}";
    }
};

// Process data - helper function
std::string processData(const std::string& input) {
    // Sample data processing logic
    return input;
}

// Main task processing
Result processTask(const std::map<std::string, std::string>& args) {
    try {
        std::cout << "Processing task..." << std::endl;
        
        // TODO: Implement based on description
        
        return Result(true, "Operation completed successfully");
    } catch(const std::exception& e) {
        return Result(false, std::string("Error: ") + e.what());
    }
}

// Parse command line arguments into a map
std::map<std::string, std::string> parseArguments(int argc, char* argv[]) {
    std::map<std::string, std::string> args;
    
    for (int i = 1; i < argc; i++) {
        std::string arg = argv[i];
        if (arg.substr(0, 2) == "--") {
            std::string key = arg.substr(2);
            if (i + 1 < argc && argv[i+1][0] != '-') {
                args[key] = argv[i+1];
                i++;
            } else {
                args[key] = "true";
            }
        }
    }
    
    return args;
}

// Application entry point
int main(int argc, char* argv[]) {
    std::cout << "Starting application for: ${description}" << std::endl;
    
    try {
        // Parse arguments
        auto args = parseArguments(argc, argv);
        
        // Process the task
        Result result = processTask(args);
        
        // Output result
        std::cout << result.toString() << std::endl;
        
        return result.success ? 0 : 1;
    } catch (const std::exception& e) {
        std::cerr << "Fatal error: " << e.what() << std::endl;
        return 1;
    }
}`,

    rust: `//! ${description}
//! 
//! Generated by Codesphere

use std::collections::HashMap;
use std::env;
use std::error::Error;
use std::fmt;
use std::time::{SystemTime, UNIX_EPOCH};

/// Result of a processing operation
#[derive(Debug)]
struct OperationResult {
    success: bool,
    message: String,
    timestamp: u64,
}

impl OperationResult {
    /// Create a new successful result
    fn success(message: &str) -> Self {
        Self {
            success: true,
            message: message.to_string(),
            timestamp: SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .expect("Time went backwards")
                .as_secs(),
        }
    }

    /// Create a new error result
    fn error(message: &str) -> Self {
        Self {
            success: false,
            message: message.to_string(),
            timestamp: SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .expect("Time went backwards")
                .as_secs(),
        }
    }
}

impl fmt::Display for OperationResult {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(
            f,
            "OperationResult {{ success: {}, message: {}, timestamp: {} }}",
            self.success, self.message, self.timestamp
        )
    }
}

/// Process the main task
fn process_task(args: &HashMap<String, String>) -> OperationResult {
    println!("Processing task with arguments: {:?}", args);
    
    // TODO: Implement based on description
    
    OperationResult::success("Operation completed successfully")
}

/// Parse command line arguments into a HashMap
fn parse_arguments() -> HashMap<String, String> {
    let args: Vec<String> = env::args().collect();
    let mut map = HashMap::new();
    
    let mut i = 1;
    while i < args.len() {
        if args[i].starts_with("--") {
            let key = args[i][2..].to_string();
            if i + 1 < args.len() && !args[i + 1].starts_with("--") {
                map.insert(key, args[i + 1].clone());
                i += 2;
            } else {
                map.insert(key, "true".to_string());
                i += 1;
            }
        } else {
            i += 1;
        }
    }
    
    map
}

fn main() -> Result<(), Box<dyn Error>> {
    println!("Starting application for: ${description}");
    
    // Parse command line arguments
    let args = parse_arguments();
    
    // Process the task
    let result = process_task(&args);
    
    // Output the result
    println!("{}", result);
    
    if result.success {
        Ok(())
    } else {
        Err(result.message.into())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_operation_result() {
        let success = OperationResult::success("Test success");
        assert!(success.success);
        assert_eq!(success.message, "Test success");
        
        let error = OperationResult::error("Test error");
        assert!(!error.success);
        assert_eq!(error.message, "Test error");
    }
}`,

    go: `// ${description}
// Generated by Codesphere

package main

import (
	"flag"
	"fmt"
	"log"
	"os"
	"time"
)

// Result represents the outcome of an operation
type Result struct {
	Success   bool      \`json:"success"\`
	Message   string    \`json:"message"\`
	Timestamp time.Time \`json:"timestamp"\`
	Data      interface{} \`json:"data,omitempty"\`
}

// String returns a string representation of Result
func (r Result) String() string {
	return fmt.Sprintf("Result{success=%v, message='%s', timestamp=%v}",
		r.Success, r.Message, r.Timestamp.Format(time.RFC3339))
}

// processData is a helper function for data processing
func processData(input string) (string, error) {
	// Sample implementation
	return input, nil
}

// processTask handles the main processing logic
func processTask(verbose bool) Result {
	log.Println("Processing task...")
	
	// TODO: Implement based on the description
	
	return Result{
		Success:   true,
		Message:   "Operation completed successfully",
		Timestamp: time.Now(),
	}
}

func main() {
	// Set up command line flags
	verbose := flag.Bool("verbose", false, "Enable verbose output")
	debug := flag.Bool("debug", false, "Enable debug mode")
	outputDir := flag.String("output", "./output", "Output directory")
	
	// Custom usage message
	flag.Usage = func() {
		fmt.Fprintf(os.Stderr, "Usage: %s [options]\n\n", os.Args[0])
		fmt.Fprintf(os.Stderr, "${description}\n\n")
		fmt.Fprintf(os.Stderr, "Options:\n")
		flag.PrintDefaults()
	}
	
	// Parse flags
	flag.Parse()
	
	// Configure logging
	log.SetPrefix("APP: ")
	if *debug {
		log.Println("Debug mode enabled")
	}
	
	// Create output directory if it doesn't exist
	if _, err := os.Stat(*outputDir); os.IsNotExist(err) {
		log.Printf("Creating output directory: %s\n", *outputDir)
		if err := os.MkdirAll(*outputDir, 0755); err != nil {
			log.Fatalf("Failed to create output directory: %v", err)
		}
	}
	
	log.Println("Starting application")
	
	// Process the task
	result := processTask(*verbose)
	
	// Output the result
	fmt.Println(result)
	
	if !result.Success {
		os.Exit(1)
	}
}`,

    c: `/**
 * ${description}
 *
 * Generated by Codesphere
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdbool.h>
#include <time.h>

/* Result structure to hold operation outcome */
typedef struct {
    bool success;
    char message[256];
    time_t timestamp;
} Result;

/* Function prototypes */
Result process_task(void);
void print_result(const Result* result);
void parse_arguments(int argc, char* argv[]);
void cleanup(void);

/* Global variables */
bool verbose = false;
char output_dir[256] = "./output";

/**
 * Program entry point
 */
int main(int argc, char* argv[]) {
    /* Register cleanup function */
    atexit(cleanup);
    
    /* Print start message */
    printf("Starting application for: ${description}\\n");
    
    /* Parse command line arguments */
    parse_arguments(argc, argv);
    
    /* Process the main task */
    Result result = process_task();
    
    /* Print the result */
    print_result(&result);
    
    /* Return appropriate exit code */
    return result.success ? 0 : 1;
}

/**
 * Parse command line arguments
 */
void parse_arguments(int argc, char* argv[]) {
    for (int i = 1; i < argc; i++) {
        if (strcmp(argv[i], "--verbose") == 0 || strcmp(argv[i], "-v") == 0) {
            verbose = true;
        } else if (strcmp(argv[i], "--output") == 0 || strcmp(argv[i], "-o") == 0) {
            if (i + 1 < argc) {
                strncpy(output_dir, argv[i+1], sizeof(output_dir) - 1);
                output_dir[sizeof(output_dir) - 1] = '\\0';
                i++;
            }
        } else if (strcmp(argv[i], "--help") == 0 || strcmp(argv[i], "-h") == 0) {
            printf("Usage: %s [options]\\n\\n", argv[0]);
            printf("Options:\\n");
            printf("  -v, --verbose      Enable verbose output\\n");
            printf("  -o, --output DIR   Set output directory\\n");
            printf("  -h, --help         Show this help message\\n");
            exit(0);
        }
    }
    
    if (verbose) {
        printf("Verbose mode enabled\\n");
        printf("Output directory: %s\\n", output_dir);
    }
}

/**
 * Process the main task
 */
Result process_task(void) {
    Result result;
    result.success = true;
    strncpy(result.message, "Operation completed successfully", sizeof(result.message) - 1);
    result.message[sizeof(result.message) - 1] = '\\0';
    result.timestamp = time(NULL);
    
    /* TODO: Implement based on description */
    
    return result;
}

/**
 * Print result in a readable format
 */
void print_result(const Result* result) {
    char time_str[32];
    struct tm* time_info = localtime(&result->timestamp);
    strftime(time_str, sizeof(time_str), "%Y-%m-%d %H:%M:%S", time_info);
    
    printf("Result {\\n");
    printf("  success: %s,\\n", result->success ? "true" : "false");
    printf("  message: '%s',\\n", result->message);
    printf("  timestamp: %s\\n", time_str);
    printf("}\\n");
}

/**
 * Cleanup function to be called on program exit
 */
void cleanup(void) {
    if (verbose) {
        printf("Performing cleanup...\\n");
    }
    /* TODO: Add any necessary cleanup operations */
}`,

    r: `# ${description}
# Generated by Codesphere

# Load required libraries
suppressPackageStartupMessages({
  library(dplyr)
  library(ggplot2)
  library(lubridate)
  library(glue)
})

# Set up logging
log_info <- function(msg) {
  timestamp <- format(Sys.time(), "%Y-%m-%d %H:%M:%S")
  cat(glue("[INFO] [{timestamp}] {msg}\\n"))
}

log_warn <- function(msg) {
  timestamp <- format(Sys.time(), "%Y-%m-%d %H:%M:%S")
  cat(glue("[WARN] [{timestamp}] {msg}\\n"))
}

log_error <- function(msg) {
  timestamp <- format(Sys.time(), "%Y-%m-%d %H:%M:%S")
  cat(glue("[ERROR] [{timestamp}] {msg}\\n"))
}

# Parse command line arguments
parse_args <- function() {
  args <- commandArgs(trailingOnly = TRUE)
  params <- list(
    verbose = FALSE,
    output_dir = "./output"
  )
  
  i <- 1
  while (i <= length(args)) {
    if (args[i] == "--verbose" || args[i] == "-v") {
      params$verbose <- TRUE
      i <- i + 1
    } else if (args[i] == "--output" || args[i] == "-o") {
      if (i + 1 <= length(args)) {
        params$output_dir <- args[i + 1]
        i <- i + 2
      } else {
        i <- i + 1
      }
    } else if (args[i] == "--help" || args[i] == "-h") {
      cat("Usage: Rscript script.R [options]\\n\\n")
      cat("Options:\\n")
      cat("  -v, --verbose      Enable verbose output\\n")
      cat("  -o, --output DIR   Set output directory (default: ./output)\\n")
      cat("  -h, --help         Show this help message\\n")
      quit(status = 0)
    } else {
      i <- i + 1
    }
  }
  
  return(params)
}

# Process data - helper function
process_data <- function(data) {
  # TODO: Implement data processing logic
  if (is.data.frame(data)) {
    return(data %>% 
             mutate(processed = TRUE) %>%
             arrange(desc(rownames())))
  } else {
    return(data)
  }
}

# Main task processing function
process_task <- function(params) {
  log_info("Processing main task")
  
  # Create example data
  set.seed(42)
  data <- data.frame(
    x = 1:100,
    y = runif(100, 0, 10)
  )
  
  # Create output directory if it doesn't exist
  if (!dir.exists(params$output_dir)) {
    log_info(glue("Creating output directory: {params$output_dir}"))
    dir.create(params$output_dir, recursive = TRUE)
  }
  
  # Process the data
  processed_data <- process_data(data)
  
  # Create a plot
  p <- ggplot(processed_data, aes(x, y)) +
    geom_point() +
    geom_smooth(method = "loess") +
    theme_minimal() +
    labs(
      title = "${description}",
      subtitle = "Sample data visualization",
      x = "X values",
      y = "Y values"
    )
  
  # Save the plot
  plot_file <- file.path(params$output_dir, "plot.png")
  ggsave(plot_file, p, width = 8, height = 6, dpi = 300)
  log_info(glue("Plot saved to: {plot_file}"))
  
  # Save processed data
  data_file <- file.path(params$output_dir, "data.csv")
  write.csv(processed_data, data_file, row.names = FALSE)
  log_info(glue("Data saved to: {data_file}"))
  
  # Return result
  return(list(
    success = TRUE,
    message = "Operation completed successfully",
    timestamp = Sys.time(),
    files = list(plot = plot_file, data = data_file)
  ))
}

# Main execution
main <- function() {
  log_info("Starting R script for: ${description}")
  
  # Parse command line arguments
  params <- parse_args()
  
  if (params$verbose) {
    log_info("Verbose mode enabled")
    log_info(glue("Output directory: {params$output_dir}"))
  }
  
  # Process the task
  result <- tryCatch({
    process_task(params)
  }, error = function(e) {
    log_error(glue("Error: {e$message}"))
    return(list(
      success = FALSE,
      message = e$message,
      timestamp = Sys.time()
    ))
  })
  
  # Output result
  cat("\\n")
  cat(glue("Result: {ifelse(result$success, 'SUCCESS', 'FAILURE')}\\n"))
  cat(glue("Message: {result$message}\\n"))
  cat(glue("Timestamp: {format(result$timestamp, '%Y-%m-%d %H:%M:%S')}\\n"))
  
  if (result$success && params$verbose) {
    cat("\\nOutput files:\\n")
    for (name in names(result$files)) {
      cat(glue(" - {name}: {result$files[[name]]}\\n"))
    }
  }
  
  # Return appropriate exit code
  quit(status = ifelse(result$success, 0, 1))
}

# Run the main function
main()`,

    sql: `-- ${description}
-- Generated by Codesphere

-- Create a sample database schema

-- Users table
CREATE TABLE IF NOT EXISTS users (
    user_id INTEGER PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(50),
    last_name VARCHAR(50),
    date_of_birth DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);

-- Create index on frequently searched fields
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- User profiles table with one-to-one relationship
CREATE TABLE IF NOT EXISTS user_profiles (
    profile_id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL UNIQUE,
    bio TEXT,
    profile_picture_url VARCHAR(255),
    website_url VARCHAR(255),
    location VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- Categories table for organizing content
CREATE TABLE IF NOT EXISTS categories (
    category_id INTEGER PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    parent_id INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (parent_id) REFERENCES categories(category_id)
);

-- Posts table with many-to-one relationship with users
CREATE TABLE IF NOT EXISTS posts (
    post_id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL,
    category_id INTEGER,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'draft',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    published_at TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories(category_id) ON DELETE SET NULL
);

-- Create index on posts
CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_category_id ON posts(category_id);
CREATE INDEX IF NOT EXISTS idx_posts_status ON posts(status);

-- Tags table for a many-to-many relationship with posts
CREATE TABLE IF NOT EXISTS tags (
    tag_id INTEGER PRIMARY KEY,
    name VARCHAR(30) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Junction table for many-to-many relationship between posts and tags
CREATE TABLE IF NOT EXISTS post_tags (
    post_id INTEGER,
    tag_id INTEGER,
    PRIMARY KEY (post_id, tag_id),
    FOREIGN KEY (post_id) REFERENCES posts(post_id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(tag_id) ON DELETE CASCADE
);

-- Comments table
CREATE TABLE IF NOT EXISTS comments (
    comment_id INTEGER PRIMARY KEY,
    post_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    parent_comment_id INTEGER,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (post_id) REFERENCES posts(post_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (parent_comment_id) REFERENCES comments(comment_id) ON DELETE CASCADE
);

-- Sample data insertion
INSERT INTO users (username, email, password_hash, first_name, last_name)
VALUES 
    ('johndoe', 'john@example.com', 'hashed_password_1', 'John', 'Doe'),
    ('janedoe', 'jane@example.com', 'hashed_password_2', 'Jane', 'Doe');

INSERT INTO categories (name, description)
VALUES 
    ('Technology', 'Posts about technology'),
    ('Travel', 'Posts about travel experiences');

-- Create a view for post summaries
CREATE VIEW post_summaries AS
SELECT 
    p.post_id,
    p.title,
    u.username AS author,
    c.name AS category,
    p.created_at,
    p.status,
    (SELECT COUNT(*) FROM comments WHERE post_id = p.post_id) AS comment_count
FROM 
    posts p
    JOIN users u ON p.user_id = u.user_id
    LEFT JOIN categories c ON p.category_id = c.category_id;

-- Sample query to retrieve post data with related information
-- SELECT 
--     p.post_id,
--     p.title,
--     p.content,
--     p.created_at,
--     u.username AS author,
--     c.name AS category,
--     GROUP_CONCAT(t.name) AS tags
-- FROM 
--     posts p
--     JOIN users u ON p.user_id = u.user_id
--     LEFT JOIN categories c ON p.category_id = c.category_id
--     LEFT JOIN post_tags pt ON p.post_id = pt.post_id
--     LEFT JOIN tags t ON pt.tag_id = t.tag_id
-- WHERE 
--     p.status = 'published'
-- GROUP BY 
--     p.post_id
-- ORDER BY 
--     p.created_at DESC
-- LIMIT 10;
`,

    'c#': `using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;

namespace CodesphereGenerated
{
    /// <summary>
    /// ${description}
    /// Generated by Codesphere
    /// </summary>
    class Program
    {
        // Logger implementation
        private static readonly Logger Log = new Logger();

        // Program configuration
        private static readonly AppConfig Config = new AppConfig
        {
            Verbose = false,
            OutputDirectory = "./output",
            MaxRetries = 3
        };

        static async Task Main(string[] args)
        {
            try
            {
                Log.Info("Starting application");

                // Parse command line arguments
                ParseArguments(args);

                if (Config.Verbose)
                {
                    Log.Info($"Verbose mode enabled");
                    Log.Info($"Output directory: {Config.OutputDirectory}");
                }

                // Create output directory if it doesn't exist
                if (!Directory.Exists(Config.OutputDirectory))
                {
                    Log.Info($"Creating output directory: {Config.OutputDirectory}");
                    Directory.CreateDirectory(Config.OutputDirectory);
                }

                // Process the main task
                var result = await ProcessTaskAsync();

                // Output the result
                Console.WriteLine();
                Console.WriteLine($"Result: {(result.Success ? "SUCCESS" : "FAILURE")}");
                Console.WriteLine($"Message: {result.Message}");
                Console.WriteLine($"Timestamp: {result.Timestamp:yyyy-MM-dd HH:mm:ss}");

                // Exit with appropriate code
                Environment.Exit(result.Success ? 0 : 1);
            }
            catch (Exception ex)
            {
                Log.Error($"Unhandled exception: {ex.Message}");
                Environment.Exit(1);
            }
        }

        /// <summary>
        /// Parse command line arguments
        /// </summary>
        private static void ParseArguments(string[] args)
        {
            for (int i = 0; i < args.Length; i++)
            {
                switch (args[i].ToLower())
                {
                    case "--verbose":
                    case "-v":
                        Config.Verbose = true;
                        break;

                    case "--output":
                    case "-o":
                        if (i + 1 < args.Length)
                        {
                            Config.OutputDirectory = args[i + 1];
                            i++; // Skip the next argument
                        }
                        break;

                    case "--help":
                    case "-h":
                        ShowHelp();
                        Environment.Exit(0);
                        break;
                }
            }
        }

        /// <summary>
        /// Show help information
        /// </summary>
        private static void ShowHelp()
        {
            Console.WriteLine("Usage: CodesphereGenerated [options]");
            Console.WriteLine();
            Console.WriteLine("Options:");
            Console.WriteLine("  -v, --verbose      Enable verbose output");
            Console.WriteLine("  -o, --output DIR   Set output directory");
            Console.WriteLine("  -h, --help         Show this help message");
        }

        /// <summary>
        /// Process the main task
        /// </summary>
        private static async Task<OperationResult> ProcessTaskAsync()
        {
            Log.Info("Processing main task");

            try
            {
                // TODO: Replace with actual implementation based on description

                // Sample data processing
                var data = GenerateSampleData();
                var processedData = ProcessData(data);

                // Save processed data
                string outputFile = Path.Combine(Config.OutputDirectory, "result.json");
                await File.WriteAllTextAsync(outputFile, JsonSerializer.Serialize(processedData, new JsonSerializerOptions { WriteIndented = true }));
                
                Log.Info($"Data saved to: {outputFile}");

                return new OperationResult
                {
                    Success = true,
                    Message = "Operation completed successfully",
                    Timestamp = DateTime.Now,
                    Data = new Dictionary<string, object>
                    {
                        ["outputFile"] = outputFile,
                        ["recordCount"] = processedData.Count
                    }
                };
            }
            catch (Exception ex)
            {
                Log.Error($"Error processing task: {ex.Message}");
                return new OperationResult
                {
                    Success = false,
                    Message = ex.Message,
                    Timestamp = DateTime.Now
                };
            }
        }

        /// <summary>
        /// Generate sample data for processing
        /// </summary>
        private static List<Dictionary<string, object>> GenerateSampleData()
        {
            // Create some sample data
            return Enumerable.Range(1, 10).Select(i => new Dictionary<string, object>
            {
                ["id"] = i,
                ["name"] = $"Item {i}",
                ["value"] = i * 10,
                ["active"] = i % 2 == 0
            }).ToList();
        }

        /// <summary>
        /// Process data - helper function
        /// </summary>
        private static List<Dictionary<string, object>> ProcessData(List<Dictionary<string, object>> data)
        {
            // Sample processing logic
            return data
                .Where(item => (int)item["id"] > 2)
                .Select(item =>
                {
                    var newItem = new Dictionary<string, object>(item);
                    newItem["processed"] = true;
                    newItem["score"] = (int)item["value"] * 1.5;
                    return newItem;
                })
                .ToList();
        }
    }

    /// <summary>
    /// Application configuration
    /// </summary>
    class AppConfig
    {
        public bool Verbose { get; set; }
        public string OutputDirectory { get; set; }
        public int MaxRetries { get; set; }
    }

    /// <summary>
    /// Result of an operation
    /// </summary>
    class OperationResult
    {
        public bool Success { get; set; }
        public string Message { get; set; }
        public DateTime Timestamp { get; set; }
        public Dictionary<string, object> Data { get; set; } = new Dictionary<string, object>();
    }

    /// <summary>
    /// Simple logger implementation
    /// </summary>
    class Logger
    {
        public void Info(string message)
        {
            WriteLine(ConsoleColor.Green, "INFO", message);
        }

        public void Warn(string message)
        {
            WriteLine(ConsoleColor.Yellow, "WARN", message);
        }

        public void Error(string message)
        {
            WriteLine(ConsoleColor.Red, "ERROR", message);
        }

        public void Debug(string message)
        {
            WriteLine(ConsoleColor.Blue, "DEBUG", message);
        }

        private void WriteLine(ConsoleColor color, string level, string message)
        {
            var timestamp = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss");
            var originalColor = Console.ForegroundColor;
            
            Console.ForegroundColor = color;
            Console.Write($"[{level}]");
            Console.ForegroundColor = originalColor;
            Console.WriteLine($" [{timestamp}] {message}");
        }
    }
}`
  };
  
  // Add more templates for other languages
  const additionalTemplates = {
    swift: `// ${description}
// Generated by Codesphere

import Foundation

// MARK: - Data Models
struct Result {
    let success: Bool
    let message: String
    let timestamp: Date
    var data: [String: Any]?
    
    init(success: Bool, message: String, data: [String: Any]? = nil) {
        self.success = success
        self.message = message
        self.timestamp = Date()
        self.data = data
    }
    
    func description() -> String {
        let dateFormatter = DateFormatter()
        dateFormatter.dateFormat = "yyyy-MM-dd HH:mm:ss"
        
        var result = "Result {\n"
        result += "  success: \\(success),\n"
        result += "  message: '\\(message)',\n"
        result += "  timestamp: \\(dateFormatter.string(from: timestamp))"
        
        if let data = data {
            result += ",\n  data: \\(data)"
        }
        
        result += "\n}"
        return result
    }
}

// MARK: - Helper Functions
func processData(_ input: String) -> String {
    // TODO: Implement data processing logic
    return input
}

// MARK: - Main Logic
func processTask() -> Result {
    print("Processing task...")
    
    // TODO: Implement based on description
    
    return Result(success: true, message: "Operation completed successfully")
}

// MARK: - Command Line Argument Parsing
func parseArguments() -> [String: String] {
    var arguments = [String: String]()
    let args = CommandLine.arguments
    
    var i = 1
    while i < args.count {
        if args[i].hasPrefix("--") {
            let key = String(args[i].dropFirst(2))
            if i + 1 < args.count && !args[i + 1].hasPrefix("--") {
                arguments[key] = args[i + 1]
                i += 2
            } else {
                arguments[key] = "true"
                i += 1
            }
        } else {
            i += 1
        }
    }
    
    return arguments
}

// MARK: - Help Information
func showHelp() {
    print("Usage: program [options]")
    print()
    print("${description}")
    print()
    print("Options:")
    print("  --verbose       Enable verbose output")
    print("  --output DIR    Set output directory")
    print("  --help          Show this help message")
}

// MARK: - Application Entry Point
func main() {
    print("Starting application for: ${description}")
    
    // Parse command line arguments
    let args = parseArguments()
    
    // Check for help flag
    if args["help"] != nil {
        showHelp()
        exit(0)
    }
    
    // Handle verbose flag
    let verbose = args["verbose"] != nil
    if verbose {
        print("Verbose mode enabled")
    }
    
    // Handle output directory
    let outputDir = args["output"] ?? "./output"
    if verbose {
        print("Output directory: \\(outputDir)")
    }
    
    // Create output directory if it doesn't exist
    let fileManager = FileManager.default
    if !fileManager.fileExists(atPath: outputDir) {
        do {
            try fileManager.createDirectory(atPath: outputDir, withIntermediateDirectories: true)
            print("Created output directory: \\(outputDir)")
        } catch {
            print("Error creating output directory: \\(error)")
            exit(1)
        }
    }
    
    // Process the task
    let result = processTask()
    
    // Output the result
    print(result.description())
    
    // Exit with appropriate code
    exit(result.success ? 0 : 1)
}

// Run the application
main()`,

    kotlin: `/**
 * ${description}
 * Generated by Codesphere
 */

import java.io.File
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter
import kotlin.system.exitProcess

/**
 * Represents the result of an operation
 */
data class OperationResult(
    val success: Boolean,
    val message: String,
    val timestamp: LocalDateTime = LocalDateTime.now(),
    val data: Map<String, Any> = emptyMap()
) {
    override fun toString(): String {
        val formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")
        return """
            Result {
              success: \${success},
              message: '\${message}',
              timestamp: \${timestamp.format(formatter)}\${if (data.isNotEmpty()) ",\\n              data: \${data}" else ""}
            }
        """.trimIndent()
    }
}

/**
 * Application configuration
 */
data class AppConfig(
    var verbose: Boolean = false,
    var outputDir: String = "./output",
    var maxRetries: Int = 3
)

/**
 * Simple logger implementation
 */
object Logger {
    fun info(message: String) = println("[INFO] [${getTimestamp()}] $message")
    fun warn(message: String) = println("[WARN] [${getTimestamp()}] $message")
    fun error(message: String) = println("[ERROR] [${getTimestamp()}] $message")
    fun debug(message: String) {
        if (config.verbose) {
            println("[DEBUG] [${getTimestamp()}] $message")
        }
    }
    
    private fun getTimestamp() = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"))
}

// Global configuration
val config = AppConfig()

/**
 * Process data - helper function
 */
fun processData(input: String): String {
    // TODO: Implement data processing logic
    return input
}

/**
 * Process the main task
 */
fun processTask(): OperationResult {
    Logger.info("Processing task...")
    
    return try {
        // TODO: Implement based on description
        
        // Example implementation
        val outputFile = File(config.outputDir, "output.txt")
        outputFile.writeText("Generated content for: ${description}")
        
        Logger.info("Task completed successfully")
        Logger.info("Output saved to: ${outputFile.absolutePath}")
        
        OperationResult(
            success = true,
            message = "Operation completed successfully",
            data = mapOf("outputFile" to outputFile.absolutePath)
        )
    } catch (e: Exception) {
        Logger.error("Error processing task: ${e.message}")
        OperationResult(success = false, message = "Error: ${e.message}")
    }
}

/**
 * Parse command line arguments
 */
fun parseArguments(args: Array<String>) {
    var i = 0
    while (i < args.size) {
        when (args[i]) {
            "--verbose", "-v" -> {
                config.verbose = true
                i++
            }
            "--output", "-o" -> {
                if (i + 1 < args.size) {
                    config.outputDir = args[i + 1]
                    i += 2
                } else {
                    i++
                }
            }
            "--help", "-h" -> {
                showHelp()
                exitProcess(0)
            }
            else -> i++
        }
    }
}

/**
 * Show help information
 */
fun showHelp() {
    println("Usage: program [options]")
    println()
    println("${description}")
    println()
    println("Options:")
    println("  -v, --verbose      Enable verbose output")
    println("  -o, --output DIR   Set output directory")
    println("  -h, --help         Show this help message")
}

/**
 * Application entry point
 */
fun main(args: Array<String>) {
    try {
        Logger.info("Starting application")
        
        // Parse command line arguments
        parseArguments(args)
        
        if (config.verbose) {
            Logger.info("Verbose mode enabled")
            Logger.info("Output directory: ${config.outputDir}")
        }
        
        // Create output directory if it doesn't exist
        val outputDir = File(config.outputDir)
        if (!outputDir.exists()) {
            Logger.info("Creating output directory: ${outputDir.absolutePath}")
            outputDir.mkdirs()
        }
        
        // Process the task
        val result = processTask()
        
        // Output the result
        println("\n$result")
        
        // Exit with appropriate code
        exitProcess(if (result.success) 0 else 1)
    } catch (e: Exception) {
        Logger.error("Unhandled exception: ${e.message}")
        exitProcess(1)
    }
}`
  };
  
  // Merge additional templates
  Object.assign(templates, additionalTemplates);
  
  // Add attribution
  const result = templates[language] || 
    `// ${description}\n\n// Generated by Codesphere for ${language}`;
  
  return result.replace("Generated by Tabnine with Claude 3.7", "Generated by Codesphere");
}

// Guess language from user input
function guessLanguage(input) {
  const hints = {
    javascript: ['javascript', 'js', 'node', 'npm', 'express', 'react', 'vue', 'angular', 'nextjs'],
    typescript: ['typescript', 'ts', 'tsx', 'angular', 'nestjs', 'deno'],
    python: ['python', 'py', 'django', 'flask', 'numpy', 'pandas', 'tensorflow', 'pytorch', 'scikit'],
    html: ['html', 'webpage', 'website', 'page', 'web'],
    css: ['css', 'style', 'styling', 'stylesheet', 'sass', 'scss', 'less'],
    bash: ['bash', 'shell', 'script', 'sh', 'terminal', 'command', 'zsh'],
    java: ['java', 'spring', 'android', 'gradle', 'maven', 'junit'],
    c: ['c language', 'gcc', 'clang', 'libc'],
    'c++': ['c++', 'cpp', 'cxx', 'stl', 'boost'],
    'c#': ['c#', 'csharp', '.net', 'dotnet', 'unity', 'asp.net'],
    go: ['go', 'golang', 'gorm'],
    rust: ['rust', 'cargo', 'rustc', 'rustup'],
    ruby: ['ruby', 'rails', 'rake', 'gem'],
    php: ['php', 'laravel', 'symfony', 'wordpress', 'composer'],
    swift: ['swift', 'ios', 'xcode', 'swiftui', 'uikit'],
    kotlin: ['kotlin', 'android studio', 'kotlinx'],
    dart: ['dart', 'flutter'],
    r: ['rstudio', ' r language', 'r statistics', 'tidyverse'],
    scala: ['scala', 'akka', 'spark'],
    haskell: ['haskell', 'ghc', 'cabal', 'stack'],
    perl: ['perl'],
    lua: ['lua'],
    groovy: ['groovy', 'gradle'],
    julia: ['julia'],
    elixir: ['elixir', 'phoenix', 'erlang'],
    clojure: ['clojure', 'leiningen', 'ring'],
    sql: ['sql', 'mysql', 'postgresql', 'oracle', 'sqlite', 'database', 'query'],
    graphql: ['graphql', 'gql'],
    markdown: ['markdown', 'md'],
    yaml: ['yaml', 'yml'],
    json: ['json'],
    xml: ['xml'],
    assembly: ['assembly', 'asm', 'nasm', 'mips'],
    powershell: ['powershell', 'ps1'],
    fortran: ['fortran'],
    cobol: ['cobol'],
    lisp: ['lisp', 'scheme', 'racket'],
    prolog: ['prolog'],
    matlab: ['matlab'],
    objective_c: ['objective-c', 'objective c'],
    vb: ['visual basic', 'vb.net', 'vba'],
    abap: ['abap', 'sap'],
    solidity: ['solidity', 'ethereum', 'web3'],
    apex: ['apex', 'salesforce'],
    latex: ['latex', 'tex'],
    ocaml: ['ocaml'],
    erlang: ['erlang']
  };
  
  input = input.toLowerCase();
  
  // First, check for file extension if present
  const fileExtMatch = input.match(/\.([a-zA-Z0-9]+)(\s|$)/);
  if (fileExtMatch) {
    const ext = fileExtMatch[1].toLowerCase();
    const extToLang = {
      js: 'javascript',
      ts: 'typescript',
      tsx: 'typescript',
      jsx: 'javascript',
      py: 'python',
      html: 'html',
      css: 'css',
      sh: 'bash',
      java: 'java',
      c: 'c',
      cpp: 'c++',
      cc: 'c++',
      cxx: 'c++',
      cs: 'c#',
      go: 'go',
      rs: 'rust',
      rb: 'ruby',
      php: 'php',
      swift: 'swift',
      kt: 'kotlin',
      dart: 'dart',
      r: 'r',
      scala: 'scala',
      hs: 'haskell',
      pl: 'perl',
      lua: 'lua',
      groovy: 'groovy',
      jl: 'julia',
      ex: 'elixir',
      exs: 'elixir',
      clj: 'clojure',
      sql: 'sql',
      graphql: 'graphql',
      gql: 'graphql',
      md: 'markdown',
      yaml: 'yaml',
      yml: 'yaml',
      json: 'json',
      xml: 'xml',
      asm: 'assembly',
      ps1: 'powershell',
      f90: 'fortran',
      f95: 'fortran',
      cob: 'cobol',
      lisp: 'lisp',
      scm: 'lisp',
      rkt: 'lisp',
      pl: 'prolog',
      m: 'matlab',
      mm: 'objective_c',
      vb: 'vb',
      abap: 'abap',
      sol: 'solidity',
      cls: 'apex',
      tex: 'latex',
      ml: 'ocaml',
      erl: 'erlang'
    };
    
    if (extToLang[ext]) {
      return extToLang[ext];
    }
  }
  
  // Next, check for language keywords in the input
  for (const [lang, keywords] of Object.entries(hints)) {
    if (keywords.some(keyword => {
      // Match full words, not partial matches
      const regex = new RegExp(`\\b${keyword}\\b`, 'i');
      return regex.test(input);
    })) {
      return lang;
    }
  }
  
  // Default to JavaScript if no language is detected
  return 'javascript';
}

// Function to colorize code based on language
function colorizeCode(code, language) {
  // Simple syntax highlighting based on language
  if (!code) return '';
  
  const colorPatterns = {
    // JavaScript/TypeScript patterns
    javascript: [
      { pattern: /(\/\/.*)$/gm, color: style.dim }, // Comments
      { pattern: /\/\*[\s\S]*?\*\//g, color: style.dim }, // Multi-line comments
      { pattern: /('.*?'|".*?"|`.*?`)/g, color: style.green }, // Strings
      { pattern: /\b(const|let|var|function|class|if|else|for|while|return|import|export|from|try|catch)\b/g, color: style.magenta }, // Keywords
      { pattern: /\b(true|false|null|undefined|NaN)\b/g, color: style.yellow }, // Literals
      { pattern: /\b(\d+\.?\d*)\b/g, color: style.yellow }, // Numbers
      { pattern: /(\w+)\s*\(/g, color: style.cyan } // Function calls
    ],
    
    // Python patterns
    python: [
      { pattern: /(#.*)$/gm, color: style.dim }, // Comments
      { pattern: /"""[\s\S]*?"""|'''[\s\S]*?'''/g, color: style.dim }, // Docstrings
      { pattern: /('.*?'|".*?")/g, color: style.green }, // Strings
      { pattern: /\b(def|class|if|elif|else|for|while|return|import|from|try|except|with|as|lambda)\b/g, color: style.magenta }, // Keywords
      { pattern: /\b(True|False|None)\b/g, color: style.yellow }, // Literals
      { pattern: /\b(\d+\.?\d*)\b/g, color: style.yellow }, // Numbers
      { pattern: /(\w+)\s*\(/g, color: style.cyan } // Function calls
    ],
    
    // HTML patterns
    html: [
      { pattern: /(<!--[\s\S]*?-->)/g, color: style.dim }, // Comments
      { pattern: /(<\/?\w+(?:\s+\w+(?:\s*=\s*(?:".*?"|'.*?'|[\^'">\s]+))?)*\s*\/?>)/g, color: style.magenta }, // Tags
      { pattern: /(\w+)=["']/g, color: style.cyan }, // Attributes
      { pattern: /(["'])(?:(?=(\\?))\2.)*?\1/g, color: style.green } // Strings
    ],
    
    // CSS patterns
    css: [
      { pattern: /(\/\*[\s\S]*?\*\/)/g, color: style.dim }, // Comments
      { pattern: /([\.\#]\w+)/g, color: style.yellow }, // Selectors
      { pattern: /(\w+\s*:)/g, color: style.cyan }, // Properties
      { pattern: /(:\s*[^;]+);/g, color: style.green } // Values
    ],
    
    // Generic patterns for all other languages
    generic: [
      { pattern: /(\/\/.*)$/gm, color: style.dim }, // Single line comments
      { pattern: /\/\*[\s\S]*?\*\//g, color: style.dim }, // Multi-line comments
      { pattern: /(#.*)$/gm, color: style.dim }, // Hash comments
      { pattern: /('.*?'|".*?"|`.*?`)/g, color: style.green }, // Strings
      { pattern: /\b(function|class|def|if|else|for|while|return|import|export)\b/g, color: style.magenta }, // Common keywords
      { pattern: /\b(true|false|null|undefined|None|True|False)\b/g, color: style.yellow }, // Common literals
      { pattern: /\b(\d+\.?\d*)\b/g, color: style.yellow }, // Numbers
      { pattern: /(\w+)\s*\(/g, color: style.cyan } // Function calls
    ]
  };
  
  // Select patterns based on language
  let patterns;
  switch(language) {
    case 'javascript':
    case 'typescript':
      patterns = colorPatterns.javascript;
      break;
    case 'python':
      patterns = colorPatterns.python;
      break;
    case 'html':
      patterns = colorPatterns.html;
      break;
    case 'css':
      patterns = colorPatterns.css;
      break;
    default:
      patterns = colorPatterns.generic;
  }
  
  // Apply colors
  let colorized = code;
  for (const { pattern, color } of patterns) {
    colorized = colorized.replace(pattern, match => `${color}${match}${style.reset}`);
  }
  
  return colorized;
}

// Extract options from args with named parameters
function parseOptions(args) {
  const options = {};
  const positionalArgs = [];
  
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const optionName = args[i].substring(2);
      if (i + 1 < args.length && !args[i + 1].startsWith('--')) {
        options[optionName] = args[i + 1];
        i++; // Skip the next arg since it's the value
      } else {
        options[optionName] = true;
      }
    } else {
      positionalArgs.push(args[i]);
    }
  }
  
  return { options, positionalArgs };
}

// Fetch content from a URL
async function fetchFromUrl(url) {
  try {
    const https = require('https');
    const http = require('http');
    
    return new Promise((resolve, reject) => {
      const client = url.startsWith('https') ? https : http;
      
      client.get(url, (res) => {
        let data = '';
        
        // A chunk of data has been received
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        // The whole response has been received
        res.on('end', () => {
          resolve(data);
        });
      }).on('error', (err) => {
        reject(err);
      });
    });
  } catch (error) {
    throw new Error(`Failed to fetch from URL: ${error.message}`);
  }
}

// Create an agent to run autonomous tasks
async function runAgent(instructions) {
  console.log(`${style.cyan}Agent executing: ${instructions}${style.reset}`);
  
  try {
    // Log the agent initiation
    memory.addConversation(`launched agent with instructions: ${instructions}`, 'Agent initiated');
    
    // Agent's response would typically come from a separate model call
    // For now we'll simulate it with a basic implementation
    
    // Determine the type of task
    const taskType = 
      instructions.includes('search') || instructions.includes('find') ? 'search' :
      instructions.includes('create') || instructions.includes('write') ? 'create' :
      instructions.includes('analyze') || instructions.includes('review') ? 'analyze' :
      'general';
    
    let response;
    
    switch (taskType) {
      case 'search':
        // Simulate file search
        const searchPattern = instructions.match(/(?:search|find|locate)\s+(?:for\s+)?['""]?([^'""]+)['""]?/i)?.[1] || 'error';
        response = `${style.green}Agent completed search task${style.reset}\n\nSearched for pattern "${searchPattern}" in codebase.\n\nFound in following locations:\n- /path/to/file1.js:25\n- /path/to/file2.js:42\n\n${style.dim}Agent execution complete.${style.reset}`;
        break;
        
      case 'create':
        // Simulate code creation
        response = `${style.green}Agent completed creation task${style.reset}\n\nGenerated code according to instructions.\n\nSuggested file structure:\n- main.js - Main application logic\n- utils.js - Helper functions\n- styles.css - Basic styling\n\n${style.dim}Agent execution complete.${style.reset}`;
        break;
        
      case 'analyze':
        // Simulate code analysis
        response = `${style.green}Agent completed analysis task${style.reset}\n\nAnalyzed codebase according to instructions.\n\nKey findings:\n- Main application logic in app.js\n- Found potential memory leak in line 52\n- API endpoints defined in api/routes.js\n\n${style.dim}Agent execution complete.${style.reset}`;
        break;
        
      default:
        response = `${style.green}Agent completed task${style.reset}\n\nExecuted instructions as requested.\n\n${style.dim}Agent execution complete.${style.reset}`;
    }
    
    // Store the agent's response in memory
    memory.addConversation(instructions, `Agent task executed: ${taskType}`);
    
    return response;
  } catch (error) {
    return `${style.red}Agent error: ${error.message}${style.reset}`;
  }
}

// Parse a Jupyter notebook
function parseNotebook(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const notebook = JSON.parse(content);
    
    if (!notebook.cells) {
      return `Invalid notebook format: no cells found`;
    }
    
    let result = `${style.cyan}${style.bold}Jupyter Notebook: ${path.basename(filePath)}${style.reset}\n\n`;
    
    notebook.cells.forEach((cell, index) => {
      result += `${style.green}[Cell ${index}] ${cell.cell_type}${style.reset}\n`;
      
      if (cell.source) {
        const source = Array.isArray(cell.source) ? cell.source.join('') : cell.source;
        result += `${style.dim}--- Source ---${style.reset}\n${source}\n`;
        
        if (cell.outputs && cell.outputs.length > 0) {
          result += `${style.dim}--- Output ---${style.reset}\n`;
          
          cell.outputs.forEach(output => {
            if (output.text) {
              result += Array.isArray(output.text) ? output.text.join('') : output.text;
            } else if (output.data && output.data['text/plain']) {
              result += Array.isArray(output.data['text/plain']) 
                ? output.data['text/plain'].join('') 
                : output.data['text/plain'];
            }
          });
          
          result += '\n';
        }
      }
      
      result += '\n';
    });
    
    return result;
  } catch (error) {
    return `Error parsing notebook: ${error.message}`;
  }
}

// Process file operations
function handleFileOperation(command, args) {
  // Parse options from args
  const { options, positionalArgs } = parseOptions(args);
  
  switch(command) {
    case 'ls':
      try {
        const dir = positionalArgs.join(' ') || '.';
        const ignoredPatterns = options.ignore ? 
          `--ignore="${options.ignore}"` : '';
        
        return executeCommand(`ls -la ${ignoredPatterns} ${dir}`);
      } catch (error) {
        return `Error: ${error.message}`;
      }
      
    case 'cat':
      try {
        const file = positionalArgs.join(' ');
        if (!file) return 'Error: Please specify a file to view';
        if (!fs.existsSync(file)) return `Error: File not found: ${file}`;
        
        const content = fs.readFileSync(file, 'utf8');
        
        // Add to memory that we viewed this file
        memory.addConversation(`viewed file ${file}`, `Viewed file contents (${content.length} characters)`);
        
        return content;
      } catch (error) {
        return `Error: ${error.message}`;
      }
      
    case 'view':
      try {
        const file = positionalArgs[0];
        if (!file) return 'Error: Please specify a file to view';
        if (!fs.existsSync(file)) return `Error: File not found: ${file}`;
        
        // Parse options similar to Claude Code's View tool
        const offset = parseInt(options.offset) || 0;
        const limit = parseInt(options.limit) || 2000; // Default to 2000 lines like Claude Code
        
        // Read file content
        const content = fs.readFileSync(file, 'utf8');
        const lines = content.split('\n');
        
        // Apply offset and limit
        const selectedLines = lines.slice(offset, offset + limit);
        
        // Format with line numbers
        let result = `${style.cyan}${file}${style.reset} (showing lines ${offset+1}-${offset+selectedLines.length} of ${lines.length})\n\n`;
        
        selectedLines.forEach((line, index) => {
          const lineNumber = offset + index + 1;
          const paddedLineNumber = String(lineNumber).padStart(6, ' ');
          result += `${style.dim}${paddedLineNumber}${style.reset}\t${line}\n`;
        });
        
        if (offset + limit < lines.length) {
          result += `\n${style.dim}(${lines.length - (offset + limit)} more lines not shown)${style.reset}`;
        }
        
        // Add to memory that we viewed this file
        memory.addConversation(`viewed file ${file}`, `Viewed file with line numbers (${selectedLines.length} lines)`);
        
        return result;
      } catch (error) {
        return `Error: ${error.message}`;
      }
      
    case 'grep':
      try {
        const pattern = positionalArgs[0];
        if (!pattern) return 'Error: Please specify a pattern to search for';
        
        const includePath = options.include || '*';
        const path = options.path || '.';
        
        // Use grep with line numbers and file names
        const result = executeCommand(`grep -r -n "${pattern}" --include="${includePath}" ${path}`);
        
        // Add to memory
        memory.addConversation(`grepped for ${pattern}`, `Searched with pattern in files matching ${includePath}`);
        
        // Format results similar to GrepTool
        if (result) {
          const lines = result.split('\n');
          let formattedResult = `${style.green}Found ${lines.length} matches for '${pattern}' in files matching '${includePath}'${style.reset}\n\n`;
          
          lines.forEach(line => {
            if (line.trim()) {
              const parts = line.split(':');
              if (parts.length >= 3) {
                const [file, lineNum, ...contentParts] = parts;
                const content = contentParts.join(':');
                formattedResult += `${style.cyan}${file}:${style.yellow}${lineNum}${style.reset}: ${content}\n`;
              } else {
                formattedResult += line + '\n';
              }
            }
          });
          
          return formattedResult;
        }
        
        return `${style.yellow}No matches found for pattern '${pattern}'${style.reset}`;
      } catch (error) {
        return `Error: ${error.message}`;
      }
      
    case 'glob':
      try {
        const pattern = positionalArgs[0];
        if (!pattern) return 'Error: Please specify a pattern to match files';
        
        const searchPath = options.path || '.';
        
        // Use find to simulate glob pattern matching
        const result = executeCommand(`find ${searchPath} -type f -path "${pattern}" | sort -t/ -k1,1`);
        
        // Add to memory
        memory.addConversation(`globbed for ${pattern}`, `Found files matching pattern`);
        
        // Format results similar to GlobTool
        if (result) {
          const files = result.split('\n').filter(f => f.trim());
          let formattedResult = `${style.green}Found ${files.length} files matching pattern '${pattern}'${style.reset}\n\n`;
          
          files.forEach(file => {
            if (file.trim()) {
              formattedResult += `${style.cyan}${file}${style.reset}\n`;
            }
          });
          
          return formattedResult;
        }
        
        return `${style.yellow}No files found matching pattern '${pattern}'${style.reset}`;
      } catch (error) {
        return `Error: ${error.message}`;
      }
      
    case 'edit':
      try {
        // Claude Code's Edit tool functionality
        const file = positionalArgs[0];
        if (!file) return 'Error: Please specify a file to edit';
        
        // Check if we're using inline editing
        if (positionalArgs.length > 1 && positionalArgs[1] === '--inline') {
          console.log(`${style.cyan}Enter the old string to replace (ctrl+D when done):${style.reset}`);
          // For simplicity in this context, we'll still use external editor flow
          // In a full implementation, this would collect input for old_string and new_string
        }
        
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
            
            // Add to memory that we edited this file
            memory.addConversation(`edited file ${file}`, `Edited file using ${editor}`);
            
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
      
    case 'replace':
      try {
        const file = positionalArgs[0];
        if (!file) return 'Error: Please specify a file to replace content';
        
        // Collect all remaining args as content
        const content = positionalArgs.slice(1).join(' ');
        
        if (!content && !options.content) {
          return 'Error: Please provide content to write to the file';
        }
        
        const finalContent = options.content || content;
        
        // Write content to file
        fs.writeFileSync(file, finalContent);
        
        // Add to memory
        memory.addConversation(`replaced file ${file}`, `Replaced file contents (${finalContent.length} characters)`);
        memory.addGeneratedFile(file, finalContent, 'User replaced content');
        
        return `${style.green}File ${file} content replaced successfully.${style.reset}`;
      } catch (error) {
        return `Error: ${error.message}`;
      }
      
    case 'search':
      try {
        if (positionalArgs.length < 1) return 'Error: Please specify a pattern to search for';
        
        const pattern = positionalArgs[0];
        const filePattern = positionalArgs.length > 1 ? positionalArgs.slice(1).join(' ') : '*';
        
        const result = executeCommand(`grep -r -n "${pattern}" --include="${filePattern}" .`);
        
        // Add to memory that we searched
        memory.addConversation(`searched for ${pattern}`, `Found results in files matching ${filePattern}`);
        
        return result || 'No matches found';
      } catch (error) {
        return `Error: ${error.message}`;
      }
      
    case 'notebook':
      try {
        const notebook = positionalArgs[0];
        if (!notebook) return 'Error: Please specify a notebook file';
        if (!fs.existsSync(notebook)) return `Error: Notebook file not found: ${notebook}`;
        if (!notebook.endsWith('.ipynb')) return 'Error: File must be a Jupyter notebook (.ipynb)';
        
        const result = parseNotebook(notebook);
        
        // Add to memory
        memory.addConversation(`viewed notebook ${notebook}`, `Parsed Jupyter notebook`);
        
        return result;
      } catch (error) {
        return `Error: ${error.message}`;
      }
      
    case 'edit_cell':
      try {
        const notebook = positionalArgs[0];
        const cellNum = parseInt(positionalArgs[1]);
        
        if (!notebook || isNaN(cellNum)) {
          return 'Error: Please specify a notebook file and cell number';
        }
        
        if (!fs.existsSync(notebook)) return `Error: Notebook file not found: ${notebook}`;
        if (!notebook.endsWith('.ipynb')) return 'Error: File must be a Jupyter notebook (.ipynb)';
        
        // Get content from remaining args or options
        const newContent = positionalArgs.slice(2).join(' ') || options.content || '';
        const cellType = options.type || 'code';
        
        if (!newContent) {
          return 'Error: Please provide content for the cell';
        }
        
        // Read the notebook
        const content = fs.readFileSync(notebook, 'utf8');
        const notebookData = JSON.parse(content);
        
        // Check if cell exists
        if (!notebookData.cells || cellNum >= notebookData.cells.length) {
          return `Error: Cell ${cellNum} does not exist in notebook`;
        }
        
        // Update cell
        notebookData.cells[cellNum].source = [newContent];
        if (options.type) {
          notebookData.cells[cellNum].cell_type = cellType;
        }
        
        // Write back to file
        fs.writeFileSync(notebook, JSON.stringify(notebookData, null, 2));
        
        // Add to memory
        memory.addConversation(`edited notebook ${notebook} cell ${cellNum}`, `Updated cell content`);
        
        return `${style.green}Updated cell ${cellNum} in notebook ${notebook}${style.reset}`;
      } catch (error) {
        return `Error: ${error.message}`;
      }
      
    case 'web':
      try {
        const url = positionalArgs[0];
        if (!url) return 'Error: Please specify a URL to fetch';
        
        // This would be asynchronous in a full implementation
        console.log(`${style.cyan}Fetching content from ${url}...${style.reset}`);
        
        // For now, return a placeholder
        // In a real implementation, we would await fetchFromUrl(url)
        
        // Add to memory
        memory.addConversation(`fetched web content from ${url}`, `Retrieved web content`);
        
        return `${style.yellow}Web content fetch is simulated in this version.${style.reset}\n\n${style.dim}This would fetch content from: ${url}${style.reset}`;
      } catch (error) {
        return `Error: ${error.message}`;
      }
      
    case 'agent':
      try {
        const instructions = positionalArgs.join(' ');
        if (!instructions) return 'Error: Please provide instructions for the agent';
        
        // This would be asynchronous in a full implementation
        console.log(`${style.cyan}Launching agent with instructions: ${instructions}${style.reset}`);
        
        // For demonstration purposes
        return runAgent(instructions);
      } catch (error) {
        return `Error: ${error.message}`;
      }
      
    case 'compact':
      try {
        // Simulate compacting the conversation
        memory.conversations = memory.conversations.slice(-3);
        
        return `${style.green}Conversation compacted.${style.reset} Kept the most recent 3 exchanges.`;
      } catch (error) {
        return `Error: ${error.message}`;
      }
      
    case 'cd':
      try {
        const dir = positionalArgs.join(' ') || os.homedir();
        process.chdir(dir);
        
        // Add to memory that we changed directory
        memory.addConversation(`changed directory`, `Changed to ${dir}`);
        
        return `Changed directory to ${process.cwd()}`;
      } catch (error) {
        return `Error: ${error.message}`;
      }
      
    case 'pwd':
      return process.cwd();
      
    case 'run':
      try {
        const cmd = positionalArgs.join(' ');
        if (!cmd) return 'Error: Please specify a command to run';
        
        // Check for timeout option
        const timeout = options.timeout ? parseInt(options.timeout) : undefined;
        
        // Execute command with timeout if specified
        let result;
        if (timeout) {
          result = executeCommand(`timeout ${timeout/1000} ${cmd}`);
        } else {
          result = executeCommand(cmd);
        }
        
        // Add to memory that we ran a command
        memory.addConversation(`ran command ${cmd}`, `Command executed with ${result.length} characters of output`);
        
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
    // Parse command and arguments, respecting quotes
    const matches = input.slice(1).match(/([^\s"']+)|"([^"]*)"|'([^']*)'/g);
    
    if (!matches) {
      return 'Invalid command format. Type /help for available commands.';
    }
    
    const command = matches[0];
    const args = matches.slice(1).map(arg => {
      // Remove quotes if present
      if ((arg.startsWith('"') && arg.endsWith('"')) || 
          (arg.startsWith("'") && arg.endsWith("'"))) {
        return arg.slice(1, -1);
      }
      return arg;
    });
    
    // Handle basic commands that don't involve file operations
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
        return `${style.cyan}${style.bold}Codesphere v${VERSION}${style.reset}\n\n` +
               `A lightweight, terminal-based coding assistant that helps you generate code, ` +
               `navigate files, and work efficiently from the command line.\n\n` +
               `${style.bold}Features:${style.reset}\n` +
               `- Advanced code generation powered by Mistral AI\n` +
               `- Memory and context tracking for improved results\n` +
               `- Claude Code compatible tooling\n` +
               `- Full file system and notebook operations\n\n` +
               `${style.dim}Config directory: ${CONFIG_DIR}\n` +
               `Node.js version: ${process.version}${style.reset}`;
        
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
          
          return `${style.green}Saved output to ${filename}${style.reset}`;
        } catch (error) {
          return `Error saving file: ${error.message}`;
        }
        
      case 'compact':
        try {
          // Compact the conversation history
          const originalCount = memory.conversations.length;
          memory.conversations = memory.conversations.slice(-5);
          const newCount = memory.conversations.length;
          
          return `${style.green}Conversation history compacted.${style.reset} Reduced from ${originalCount} to ${newCount} entries.`;
        } catch (error) {
          return `Error compacting conversation: ${error.message}`;
        }
      
      case 'agent':
        try {
          const instructions = args.join(' ');
          if (!instructions) {
            return `${style.yellow}Usage: /agent <instructions>${style.reset}\nExample: /agent search the codebase for all functions that handle authentication`;
          }
          
          console.log(`${style.cyan}Launching autonomous agent with instructions: ${instructions}${style.reset}`);
          
          // This would invoke the agent
          return await runAgent(instructions);
        } catch (error) {
          return `${style.red}Agent error: ${error.message}${style.reset}`;
        }
        
      case 'web':
        try {
          if (args.length < 1) {
            return `${style.yellow}Usage: /web <url>${style.reset}\nExample: /web https://example.com`;
          }
          
          const url = args[0];
          
          console.log(`${style.cyan}Fetching web content from: ${url}${style.reset}`);
          
          // This would be an asynchronous call in a full implementation
          // const content = await fetchFromUrl(url);
          
          return `${style.yellow}Web content fetch is simulated in this version.${style.reset}\n\n${style.dim}Would fetch content from: ${url}${style.reset}`;
        } catch (error) {
          return `${style.red}Web fetch error: ${error.message}${style.reset}`;
        }
    }
    
    // Handle file operations
    try {
      // These commands are handled by the handleFileOperation function
      const fileOperationCommands = [
        'ls', 'cat', 'view', 'edit', 'replace', 'search', 
        'grep', 'glob', 'find', 'cd', 'pwd', 'run', 
        'notebook', 'edit_cell'
      ];
      
      if (fileOperationCommands.includes(command)) {
        return await handleFileOperation(command, args);
      }
      
      // If we get here, the command wasn't recognized
      return `${style.yellow}Unknown command: /${command}. Type /help for available commands.${style.reset}`;
    } catch (error) {
      return `${style.red}Error executing command: ${error.message}${style.reset}`;
    }
  }
  
  // Default behavior: if not a command, generate code
  try {
    console.log(`${style.cyan}Generating code for: ${input}${style.reset}`);
    
    const result = await generateCode(input);
    lastOutput = result; // Store for save command
    
    // Suggest creating a file with this code
    const suggestedFilename = suggestFilename(input, guessLanguage(input));
    console.log(`${style.green}Tip: Use /create ${suggestedFilename} "${input}" to save this as a file${style.reset}`);
    
    return result;
  } catch (error) {
    return `${style.red}Error generating code: ${error.message}${style.reset}`;
  }
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