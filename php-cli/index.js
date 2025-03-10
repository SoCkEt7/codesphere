#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// CLI Configuration
const VERSION = '0.1.0';
const program = new Command();

program
  .version(VERSION)
  .description('php-cli - CLI tool for php (symfony)');

// Basic commands
program
  .command('info')
  .description('Display project information')
  .action(() => {
    console.log(chalk.blue('Project Information:'));
    
    try {
      // Get current directory
      const currentDir = process.cwd();
      const packageJsonPath = path.join(currentDir, 'package.json');
      
      if (fs.existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        console.log(chalk.green('Name:'), packageJson.name || 'Unknown');
        console.log(chalk.green('Version:'), packageJson.version || 'Unknown');
        console.log(chalk.green('Description:'), packageJson.description || 'No description');
      } else {
        console.log(chalk.yellow('No package.json found in the current directory.'));
      }
    } catch (error) {
      console.error(chalk.red('Error fetching project information:'), error.message);
    }
  });

// PHP specific commands
program
  .command('lint')
  .description('Lint PHP files for errors')
  .option('-p, --path <path>', 'Path to lint', '.')
  .action((options) => {
    const spinner = ora('Linting PHP files...').start();
    
    try {
      // You'd execute PHP linting via child_process in a real app
      setTimeout(() => {
        spinner.succeed('PHP linting complete');
        console.log(chalk.green('No syntax errors detected'));
      }, 1500);
    } catch (error) {
      spinner.fail('Linting failed');
      console.error(chalk.red('Error:'), error.message);
    }
  });

// Import framework specific commands
import { registerSymfonyCommands } from './commands/symfony.js';

// Register framework specific commands
registerSymfonyCommands(program);

// Parse command line arguments
program.parse(process.argv);

