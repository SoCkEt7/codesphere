#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { fileURLToPath } from 'url';

// Constants
const VERSION = '1.0.0';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MISTRAL_API_ENDPOINT = 'https://codestral.mistral.ai/v1/fim/completions';
const MISTRAL_API_KEY = 'I9GTSjsqxQ3N2E12VBke8jOqT9UlJHLE';

// Couleurs pour différents usages
const colors = {
  success: chalk.green,
  error: chalk.red,
  warning: chalk.yellow,
  info: chalk.blue,
  highlight: chalk.cyan,
  code: chalk.gray
};

/**
 * Générer du code en utilisant l'API Mistral AI
 */
async function generateWithAI(prompt, type = 'code') {
  const apiKey = MISTRAL_API_KEY;
  
  try {
    // Utilisation du fetch natif de Node.js au lieu du package node-fetch
    const response = await fetch(MISTRAL_API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'codestral-latest',
        prompt: `Génère ${type}. Fournis uniquement le code sans explications ou texte supplémentaire. Voici ce dont j'ai besoin: ${prompt}`,
        max_tokens_to_predict: 2048,
        temperature: 0.7
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Erreur API: ${JSON.stringify(error)}`);
    }
    
    const data = await response.json();
    return data.completion.trim();
  } catch (error) {
    console.error(colors.error('Erreur lors de la communication avec l\'API:'), error);
    throw error;
  }
}

/**
 * Générateur de code AI interactif
 */
async function interactiveCodeGeneration() {
  try {
    // Obtenir les détails de génération de code
    const { codeType, prompt, outputPath } = await inquirer.prompt([
      {
        type: 'list',
        name: 'codeType',
        message: 'Quel type de code voulez-vous générer?',
        choices: [
          { name: 'Fonction', value: 'Function' },
          { name: 'Classe', value: 'Class' },
          { name: 'Composant', value: 'Component' },
          { name: 'Endpoint API', value: 'API Endpoint' },
          { name: 'Utilitaire', value: 'Utility' },
          { name: 'Script complet', value: 'Complete Script' },
          { name: 'Autre', value: 'Other' }
        ]
      },
      {
        type: 'input',
        name: 'prompt',
        message: 'Décrivez ce que vous voulez générer:',
        validate: (input) => input.length > 10 ? true : 'Veuillez fournir une description détaillée (au moins 10 caractères)'
      },
      {
        type: 'input',
        name: 'outputPath',
        message: 'Où le code généré doit-il être enregistré?',
        default: (answers) => {
          const extension = answers.codeType === 'Component' ? 'jsx' : 'js';
          return `./generated_${answers.codeType.toLowerCase().replace(/\s+/g, '_')}.${extension}`;
        }
      }
    ]);
    
    // Générer le code
    const spinner = ora('Génération de code avec l\'IA...').start();
    
    try {
      const generatedCode = await generateWithAI(prompt, codeType);
      fs.writeFileSync(outputPath, generatedCode);
      
      spinner.succeed(`Code généré et enregistré dans ${outputPath}`);
      
      // Aperçu
      console.log(chalk.blue('\nAperçu:'));
      console.log(chalk.gray(generatedCode.slice(0, 500) + (generatedCode.length > 500 ? '...' : '')));
      
      return outputPath;
    } catch (error) {
      spinner.fail('Échec de la génération de code');
      console.error(chalk.red(error.message));
      throw error;
    }
  } catch (error) {
    console.error(chalk.red('Erreur dans la génération de code interactive:'), error.message);
    throw error;
  }
}

/**
 * Main CLI application
 */
const program = new Command();

program
  .version(VERSION)
  .description('Générateur de code IA interactif');

program
  .command('code')
  .description('Générer du code en utilisant l\'IA')
  .option('-p, --prompt <prompt>', 'Prompt pour la génération de code')
  .option('-t, --type <type>', 'Type de code à générer', 'function')
  .option('-o, --output <o>', 'Chemin du fichier de sortie')
  .action(async (options) => {
    try {
      if (options.prompt) {
        // Génération directe
        const spinner = ora('Génération de code avec l\'IA...').start();
        try {
          const result = await generateWithAI(options.prompt, options.type);
          
          const outputPath = options.output || `./generated_${options.type.toLowerCase()}.js`;
          fs.writeFileSync(outputPath, result);
          
          spinner.succeed(`Code généré et enregistré dans ${outputPath}`);
          
          // Aperçu
          console.log(colors.info('\nAperçu:'));
          console.log(colors.code(result.slice(0, 500) + (result.length > 500 ? '...' : '')));
        } catch (error) {
          spinner.fail('Échec de la génération de code');
          console.error(colors.error(error.message));
        }
      } else {
        // Génération interactive
        await interactiveCodeGeneration();
      }
    } catch (error) {
      console.error(colors.error(`Erreur: ${error.message}`));
    }
  });

program
  .command('examples')
  .description('Afficher des exemples de commandes')
  .action(() => {
    console.log(colors.highlight('Exemples de commandes:'));
    console.log(colors.info('\nGénération de code interactive:'));
    console.log(colors.code('  codegen'));
    console.log(colors.info('\nGénération de code directe:'));
    console.log(colors.code('  codegen code --prompt "Créer une fonction qui trie un tableau d\'objets par date" --type "function" --output "./trierFonction.js"'));
  });

// Si aucun argument n'est fourni, lancer directement la génération de code interactive
if (process.argv.length === 2) {
  console.log(colors.highlight('Bienvenue dans le Générateur de Code IA!'));
  console.log(colors.info('Démarrage du mode interactif...\n'));
  
  interactiveCodeGeneration().catch(error => {
    console.error(colors.error(`Erreur: ${error.message}`));
    process.exit(1);
  });
} else {
  // Parse command line arguments
  program.parse(process.argv);
}