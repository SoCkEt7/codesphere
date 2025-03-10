#!/usr/bin/env node
// CommonJS version - Codesphere CLI - Advanced code analysis and management tool

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { Command } = require('commander');
const chalk = require('chalk');
const ora = require('ora');
const inquirer = require('inquirer');
const { parse } = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const generate = require('@babel/generator').default;
const t = require('@babel/types');
const glob = require('glob');
const dotenv = require('dotenv');
const os = require('os');

// Load environment variables
if (dotenv) dotenv.config();

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

// Rest of your current code without any changes, just keep the function definitions as they are
// ...

// Create program instance
const program = new Command();
program.parse(process.argv);
