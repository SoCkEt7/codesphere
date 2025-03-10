#!/usr/bin/env node
// ESM Module
// Codesphere CLI - Advanced code analysis and management tool

import fs from "fs";
import path from "path";
import axios from "axios";
import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import inquirer from "inquirer";
import { parse } from "@babel/parser";
import traverse from "@babel/traverse";
import generate from "@babel/generator";
import * as t from "@babel/types";
import glob from "glob";
import dotenv from "dotenv";
import os from "os";

// Load environment variables
dotenv.config();

/**
 * Constants and Configuration
 */
const VERSION = '1.0.0';
const CONFIG_DIR = path.join(os.homedir(), '.codesphere');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
const CACHE_DIR = path.join(CONFIG_DIR, 'cache');
const LOG_DIR = path.join(CONFIG_DIR, 'logs');

// Terminal colors for different purposes
const colors = {
  success: chalk.green,
  error: chalk.red,
  warning: chalk.yellow,
  info: chalk.blue,
  highlight: chalk.cyan,
  code: chalk.gray,
  diff: {
    added: chalk.green,
    removed: chalk.red,
    addedBg: chalk.bgGreen.black,
    removedBg: chalk.bgRed.black
  }
};

// Ensure config directories exist
function ensureDirectories() {
  [CONFIG_DIR, CACHE_DIR, LOG_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
}

/**
 * Configuration Management
 */
function loadConfig() {
  ensureDirectories();
  
  if (!fs.existsSync(CONFIG_FILE)) {
    return { 
      apiKey: null,
      theme: 'dark',
      verbose: false,
      lastUpdate: null,
      projects: []
    };
  }
  
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
  } catch (error) {
    console.error(colors.error(`Error loading config: ${error.message}`));
    return {};
  }
}

function saveConfig(config) {
  ensureDirectories();
  
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
    return true;
  } catch (error) {
    console.error(colors.error(`Error saving config: ${error.message}`));
    return false;
  }
}

/**
 * Error handling
 */
class CodesphereError extends Error {
  constructor(message, code = 'UNKNOWN_ERROR', details = null) {
    super(message);
    this.name = 'CodesphereError';
    this.code = code;
    this.details = details;
    Error.captureStackTrace(this, CodesphereError);
  }

  static fromError(error) {
    const codesphereError = new CodesphereError(
      error.message,
      error.code || 'UNKNOWN_ERROR',
      error.details || null
    );
    codesphereError.stack = error.stack;
    return codesphereError;
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      details: this.details,
      stack: this.stack
    };
  }
}

function handleError(error, verbose = false) {
  if (error instanceof CodesphereError) {
    console.error(colors.error(`Error [${error.code}]: ${error.message}`));
    if (error.details) {
      console.error(colors.error('Details:'), error.details);
    }
  } else {
    console.error(colors.error(`Error: ${error.message}`));
  }

  if (verbose) {
    console.error(colors.error('Stack trace:'));
    console.error(colors.error(error.stack));
  }
}

/**
 * Enhanced File Parsing
 * Recursively parses a directory with improved filtering and handling
 */
function parseFolder(folderPath, options = {}) {
  const {
    extensions = ['.js', '.jsx', '.ts', '.tsx'],
    ignore = ['node_modules', '.git', 'dist', 'build'],
    maxDepth = Infinity,
    followSymlinks = false,
    includeContent = true
  } = options;
  
  const files = [];
  const visited = new Set();
  const config = loadConfig();
  const ignorePatterns = config.ignorePatterns || [];
  
  function isIgnored(filePath) {
    // Check if the path contains any ignored directory
    if (ignore.some(ignoredDir => filePath.includes(ignoredDir))) {
      return true;
    }
    
    // Check against custom ignore patterns
    if (ignorePatterns.some(pattern => new RegExp(pattern).test(filePath))) {
      return true;
    }
    
    return false;
  }

  function walkDir(currentPath, depth = 0) {
    if (depth > maxDepth) return;

    let items;
    try {
      items = fs.readdirSync(currentPath);
    } catch (error) {
      console.warn(colors.warning(`Could not read directory ${currentPath}: ${error.message}`));
      return;
    }

    items.forEach(item => {
      const fullPath = path.join(currentPath, item);
      
      // Skip ignored paths
      if (isIgnored(fullPath)) return;
      
      let stat;
      try {
        stat = followSymlinks ? fs.statSync(fullPath) : fs.lstatSync(fullPath);
      } catch (error) {
        console.warn(colors.warning(`Could not stat ${fullPath}: ${error.message}`));
        return;
      }

      // Handle symlinks
      if (!followSymlinks && stat.isSymbolicLink()) {
        return;
      }

      // Check for loops with realpath
      const realPath = fs.realpathSync(fullPath);
      if (visited.has(realPath)) {
        return;
      }
      
      visited.add(realPath);
      
      if (stat.isFile() && extensions.some(ext => fullPath.endsWith(ext))) {
        let fileData = {
          path: fullPath,
          relativePath: path.relative(folderPath, fullPath),
          ext: path.extname(fullPath),
          size: stat.size,
          modified: stat.mtime,
        };

        if (includeContent) {
          try {
            fileData.content = fs.readFileSync(fullPath, 'utf-8');
          } catch (error) {
            console.warn(colors.warning(`Could not read file ${fullPath}: ${error.message}`));
            fileData.content = null;
            fileData.error = error.message;
          }
        }
        
        files.push(fileData);
      } else if (stat.isDirectory()) {
        walkDir(fullPath, depth + 1);
      }
    });
  }

  walkDir(folderPath);
  return files;
}

/**
 * Advanced Code Analysis
 * Analyzes JavaScript files to extract functions, classes, and dependencies
 */
function analyzeContext(files) {
  const analysis = {
    functions: {},
    classes: {},
    imports: {},
    exports: {},
    dependencies: new Set()
  };

  files.forEach(file => {
    if (!file.content) return;
    
    try {
      // First, extract functions using simple regex for speed
      const functionMatches = file.content.match(/function\s+([a-zA-Z0-9_$]+)\s*\(/g) || [];
      const functionNames = functionMatches.map(match => match.replace(/function\s+/, '').replace(/\s*\($/, ''));
      analysis.functions[file.path] = functionNames;

      // For more detailed analysis, use AST parsing
      const ast = parse(file.content, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript']
      });

      // Classes
      const classNames = [];
      
      // Imports & Exports
      const imports = [];
      const exports = [];
      
      traverse(ast, {
        ClassDeclaration(path) {
          if (path.node.id && path.node.id.name) {
            classNames.push(path.node.id.name);
          }
        },
        ImportDeclaration(path) {
          const importSource = path.node.source.value;
          analysis.dependencies.add(importSource);
          
          const importedNames = path.node.specifiers.map(specifier => {
            if (specifier.type === 'ImportDefaultSpecifier') {
              return { type: 'default', name: specifier.local.name };
            } else if (specifier.type === 'ImportSpecifier') {
              return { 
                type: 'named', 
                name: specifier.imported.name,
                local: specifier.local.name 
              };
            } else {
              return { type: 'namespace', name: specifier.local.name };
            }
          });
          
          imports.push({ source: importSource, names: importedNames });
        },
        ExportNamedDeclaration(path) {
          if (path.node.declaration) {
            if (path.node.declaration.type === 'VariableDeclaration') {
              const names = path.node.declaration.declarations.map(d => d.id.name);
              exports.push({ type: 'named', names });
            } else if (path.node.declaration.type === 'FunctionDeclaration' && path.node.declaration.id) {
              exports.push({ type: 'named', names: [path.node.declaration.id.name] });
            }
          }
        },
        ExportDefaultDeclaration() {
          exports.push({ type: 'default' });
        }
      });
      
      analysis.classes[file.path] = classNames;
      analysis.imports[file.path] = imports;
      analysis.exports[file.path] = exports;
      
    } catch (error) {
      console.warn(colors.warning(`Error analyzing ${file.path}: ${error.message}`));
    }
  });

  return analysis;
}

/**
 * Interface Generation
 * Generates interface files based on extracted code structure
 */
function generateInterfaces(analysis, outputPath = 'generatedInterfaces.js') {
  let interfaceContent = '// Generated Interfaces\n\n';

  // Group by file
  Object.entries(analysis.functions).forEach(([filePath, functions]) => {
    const fileName = path.basename(filePath, path.extname(filePath));
    
    interfaceContent += `// Interface for ${fileName}\n`;
    interfaceContent += `const ${fileName}API = {\n`;

    // Add functions
    functions.forEach(fn => {
      interfaceContent += `  ${fn}: () => {\n    // TODO: Implement ${fn}\n  },\n`;
    });
    
    // Add classes if available
    const classes = analysis.classes[filePath] || [];
    classes.forEach(cls => {
      interfaceContent += `  ${cls}: class {\n    // TODO: Implement ${cls} methods\n  },\n`;
    });

    interfaceContent += '};\n\n';
    
    // Add exports if needed
    const exports = analysis.exports[filePath] || [];
    if (exports.length > 0) {
      interfaceContent += `// Exports for ${fileName}\n`;
      interfaceContent += `module.exports = ${fileName}API;\n\n`;
    }
  });

  // Write to file
  fs.writeFileSync(outputPath, interfaceContent, 'utf-8');
  console.log(colors.success("Interfaces generated at " + outputPath));
}

/**
 * API Integration
 * Connects to external APIs for code analysis and generation
 */
async function integrateWithAPI(prompt, options = {}) {
  const config = loadConfig();
  const apiKey = process.env.CODESPHERE_API_KEY || config.apiKey;
  
  if (!apiKey) {
    throw new CodesphereError(
      'API key not found. Please set CODESPHERE_API_KEY environment variable or configure it with "config set apiKey <key>"',
      'AUTH_ERROR'
    );
  }
  
  const spinner = ora('Processing request...').start();
  
  try {
    const response = await axios.post('https://api.codesphere.com/v1/generate', {
      prompt,
      ...options
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      }
    });
    
    spinner.succeed('Request processed successfully');
    return response.data;
  } catch (error) {
    spinner.fail('Failed to process request');
    
    if (error.response) {
      throw new CodesphereError(
        `API Error: ${error.response.data.message || 'Unknown API error'}`,
        'API_ERROR',
        error.response.data
      );
    } else if (error.request) {
      throw new CodesphereError(
        'Network Error: No response received from API',
        'NETWORK_ERROR'
      );
    } else {
      throw CodesphereError.fromError(error);
    }
  }
}

/**
 * Diff generation and visualization
 */
function generateDiff(original, modified) {
  const diffLines = [];
  const originalLines = original.split('\n');
  const modifiedLines = modified.split('\n');
  
  // Simple line-by-line diff
  let i = 0, j = 0;
  
  while (i < originalLines.length || j < modifiedLines.length) {
    if (i < originalLines.length && j < modifiedLines.length && originalLines[i] === modifiedLines[j]) {
      // Lines match
      diffLines.push({ type: 'context', content: originalLines[i] });
      i++;
      j++;
    } else {
      // Lines don't match
      const origRemaining = originalLines.slice(i);
      const modRemaining = modifiedLines.slice(j);
      
      // Check if lines were added
      if (i < originalLines.length && !modRemaining.includes(originalLines[i])) {
        diffLines.push({ type: 'removed', content: originalLines[i] });
        i++;
      } 
      // Check if lines were removed
      else if (j < modifiedLines.length && !origRemaining.includes(modifiedLines[j])) {
        diffLines.push({ type: 'added', content: modifiedLines[j] });
        j++;
      }
      // Otherwise, it's a modification
      else {
        diffLines.push({ type: 'removed', content: originalLines[i] });
        diffLines.push({ type: 'added', content: modifiedLines[j] });
        i++;
        j++;
      }
    }
  }
  
  return diffLines;
}

function printDiff(diff) {
  diff.forEach(line => {
    if (line.type === 'context') {
      console.log(`  ${line.content}`);
    } else if (line.type === 'added') {
      console.log(colors.diff.added(`+ ${line.content}`));
    } else if (line.type === 'removed') {
      console.log(colors.diff.removed(`- ${line.content}`));
    }
  });
}

/**
 * Project Management
 */
function initProject(projectPath, options = {}) {
  const config = loadConfig();
  const projectName = path.basename(projectPath);
  
  // Create project structure
  if (!fs.existsSync(projectPath)) {
    fs.mkdirSync(projectPath, { recursive: true });
  }
  
  // Create a default configuration file
  const projectConfig = {
    name: projectName,
    created: new Date().toISOString(),
    type: options.type || 'javascript',
    settings: {
      include: options.include || ['**/*.js', '**/*.jsx', '**/*.ts', '**/*.tsx'],
      exclude: options.exclude || ['node_modules/**', 'dist/**', '.git/**']
    }
  };
  
  fs.writeFileSync(
    path.join(projectPath, '.codesphererc.json'),
    JSON.stringify(projectConfig, null, 2)
  );
  
  // Add to global projects list
  if (!config.projects) {
    config.projects = [];
  }
  
  config.projects.push({
    name: projectName,
    path: projectPath,
    created: projectConfig.created
  });
  
  saveConfig(config);
  
  return projectConfig;
}

/**
 * Command Line Interface
 */
const program = new Command();

program
  .version(VERSION)
  .description('CLI tool to parse folders, analyze context, generate interfaces, and integrate with APIs');

// Parse command
program
  .command('parse <folder>')
  .description('Parse the specified folder to collect files')
  .option('-e, --extensions <exts>', 'File extensions to include (comma separated)', '.js,.jsx,.ts,.tsx')
  .option('-i, --ignore <dirs>', 'Directories to ignore (comma separated)', 'node_modules,.git,dist,build')
  .option('-d, --max-depth <depth>', 'Maximum directory depth to traverse', Infinity)
  .option('-s, --follow-symlinks', 'Follow symbolic links', false)
  .option('-c, --no-content', 'Don\'t include file content', false)
  .action((folder, options) => {
    try {
      const absolutePath = path.resolve(folder);
      if (!fs.existsSync(absolutePath)) {
        console.error(colors.error('The specified folder does not exist.'));
        process.exit(1);
      }

      const parseOptions = {
        extensions: options.extensions.split(','),
        ignore: options.ignore.split(','),
        maxDepth: options.maxDepth === 'Infinity' ? Infinity : parseInt(options.maxDepth, 10),
        followSymlinks: options.followSymlinks,
        includeContent: options.content
      };

      const files = parseFolder(absolutePath, parseOptions);
      console.log(colors.success(`Found ${files.length} files matching the criteria.`));
      
      if (options.verbose) {
        files.forEach(file => {
          console.log(colors.info(`- ${file.relativePath} (${file.size} bytes)`));
        });
      }
    } catch (error) {
      handleError(error, loadConfig().verbose);
    }
  });

// Analyze command
program
  .command('analyze <folder>')
  .description('Analyze the code files in the specified folder')
  .option('-e, --extensions <exts>', 'File extensions to include (comma separated)', '.js,.jsx,.ts,.tsx')
  .option('-i, --ignore <dirs>', 'Directories to ignore (comma separated)', 'node_modules,.git,dist,build')
  .option('-o, --output <file>', 'Output file for analysis results')
  .option('-v, --verbose', 'Show verbose output')
  .action((folder, options) => {
    try {
      const absolutePath = path.resolve(folder);
      if (!fs.existsSync(absolutePath)) {
        console.error(colors.error('The specified folder does not exist.'));
        process.exit(1);
      }

      const parseOptions = {
        extensions: options.extensions.split(','),
        ignore: options.ignore.split(','),
      };

      const spinner = ora('Analyzing files...').start();
      const files = parseFolder(absolutePath, parseOptions);
      const analysis = analyzeContext(files);

      spinner.succeed(`Analysis complete. Found ${Object.values(analysis.functions).flat().length} functions and ${Object.values(analysis.classes).flat().length} classes.`);
      
      if (options.verbose) {
        console.log(colors.info('\nDependencies:'));
        [...analysis.dependencies].forEach(dep => {
          console.log(colors.info(`- ${dep}`));
        });
        
        console.log(colors.info('\nFunctions by file:'));
        Object.entries(analysis.functions).forEach(([file, functions]) => {
          if (functions.length > 0) {
            console.log(colors.info(`\n${path.relative(absolutePath, file)}:`));
            functions.forEach(fn => console.log(`  - ${fn}`));
          }
        });
      }
      
      if (options.output) {
        fs.writeFileSync(
          options.output, 
          JSON.stringify(analysis, null, 2),
          'utf-8'
        );
        console.log(colors.success(`Analysis saved to ${options.output}`));
      }
      
    } catch (error) {
      handleError(error, loadConfig().verbose);
    }
  });

// Generate interface command
program
  .command('generate <folder>')
  .description('Generate interface files based on the analyzed context')
  .option('-o, --output <file>', 'Output file name', 'generatedInterfaces.js')
  .action((folder, options) => {
    try {
      const absolutePath = path.resolve(folder);
      if (!fs.existsSync(absolutePath)) {
        console.error(colors.error('The specified folder does not exist.'));
        process.exit(1);
      }

      const spinner = ora('Analyzing files...').start();
      const files = parseFolder(absolutePath);
      const analysis = analyzeContext(files);
      spinner.succeed('Analysis complete');

      spinner.start('Generating interfaces...');
      generateInterfaces(analysis, options.output);
      spinner.succeed(`Interfaces generated at ${options.output}`);
    } catch (error) {
      handleError(error, loadConfig().verbose);
    }
  });

// API integration command
program
  .command('ai <prompt>')
  .description('Integrate with AI API using the provided prompt')
  .option('-m, --model <model>', 'AI model to use', 'default')
  .option('-t, --temperature <temp>', 'Temperature for generation', '0.7')
  .option('-c, --context <file>', 'File with additional context')
  .action(async (prompt, options) => {
    try {
      let contextText = '';
      if (options.context && fs.existsSync(options.context)) {
        contextText = fs.readFileSync(options.context, 'utf-8');
      }
      
      const apiOptions = {
        model: options.model,
        temperature: parseFloat(options.temperature),
        context: contextText || undefined
      };

      const response = await integrateWithAPI(prompt, apiOptions);
      
      console.log('\n' + colors.highlight('AI Response:'));
      console.log(response.completion);
      
      if (response.suggestions && response.suggestions.length > 0) {
        console.log('\n' + colors.highlight('Suggestions:'));
        response.suggestions.forEach((suggestion, i) => {
          console.log(`${i + 1}. ${suggestion}`);
        });
      }
    } catch (error) {
      handleError(error, loadConfig().verbose);
    }
  });

// Init project command
program
  .command('init [directory]')
  .description('Initialize a new Codesphere project')
  .option('-t, --type <type>', 'Project type', 'javascript')
  .option('--include <patterns>', 'Glob patterns to include (comma separated)')
  .option('--exclude <patterns>', 'Glob patterns to exclude (comma separated)')
  .action((directory = '.', options) => {
    try {
      const projectPath = path.resolve(directory);
      
      // Check if directory exists and is empty if not current directory
      if (directory !== '.' && fs.existsSync(projectPath)) {
        const files = fs.readdirSync(projectPath);
        if (files.length > 0) {
          console.warn(colors.warning('Directory is not empty. Files may be overwritten.'));
        }
      }
      
      // Parse options
      const initOptions = {
        type: options.type,
        include: options.include ? options.include.split(',') : undefined,
        exclude: options.exclude ? options.exclude.split(',') : undefined
      };
      
      // Initialize project
      const projectConfig = initProject(projectPath, initOptions);
      
      console.log(colors.success(`Project '${projectConfig.name}' initialized successfully.`));
      console.log(colors.info('Project configuration:'));
      console.log(JSON.stringify(projectConfig, null, 2));
    } catch (error) {
      handleError(error, loadConfig().verbose);
    }
  });

// Config command
program
  .command('config')
  .description('Manage configuration')
  .option('get <key>', 'Get configuration value')
  .option('set <key> <value>', 'Set configuration value')
  .option('list', 'List all configuration values')
  .option('reset', 'Reset configuration to defaults')
  .action((cmd) => {
    try {
      const config = loadConfig();
      
      if (cmd.get) {
        const value = config[cmd.get];
        if (value !== undefined) {
          console.log(value);
        } else {
          console.log(colors.warning(`Configuration key '${cmd.get}' not found.`));
        }
      } else if (cmd.set && cmd.args[0]) {
        const key = cmd.set;
        const value = cmd.args[0];
        
        // Parse value if it looks like a boolean or number
        let parsedValue = value;
        if (value.toLowerCase() === 'true') parsedValue = true;
        else if (value.toLowerCase() === 'false') parsedValue = false;
        else if (!isNaN(value)) parsedValue = Number(value);
        
        config[key] = parsedValue;
        saveConfig(config);
        console.log(colors.success(`Configuration key '${key}' set to '${parsedValue}'.`));
      } else if (cmd.list) {
        console.log(colors.info('Current configuration:'));
        console.log(JSON.stringify(config, null, 2));
      } else if (cmd.reset) {
        const defaultConfig = {
          apiKey: null,
          theme: 'dark',
          verbose: false,
          lastUpdate: null,
          projects: []
        };
        saveConfig(defaultConfig);
        console.log(colors.success('Configuration reset to defaults.'));
      } else {
        console.log(colors.error('Invalid config command. Use --help for usage information.'));
      }
    } catch (error) {
      handleError(error, loadConfig().verbose);
    }
  });

// Diff command
program
  .command('diff <fileA> <fileB>')
  .description('Show differences between two files')
  .action((fileA, fileB) => {
    try {
      if (!fs.existsSync(fileA)) {
        console.error(colors.error(`File not found: ${fileA}`));
        process.exit(1);
      }
      
      if (!fs.existsSync(fileB)) {
        console.error(colors.error(`File not found: ${fileB}`));
        process.exit(1);
      }
      
      const contentA = fs.readFileSync(fileA, 'utf-8');
      const contentB = fs.readFileSync(fileB, 'utf-8');
      
      console.log(colors.info(`Comparing ${path.basename(fileA)} and ${path.basename(fileB)}:\n`));
      
      const diff = generateDiff(contentA, contentB);
      printDiff(diff);
    } catch (error) {
      handleError(error, loadConfig().verbose);
    }
  });

// ADD THIS LINE TO CLOSE THE PROGRAM DEFINITION
program.parse(process.argv);