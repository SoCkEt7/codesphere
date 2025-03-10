// codesphere.js

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { Command } = require('commander');

const program = new Command();

/**
 * 1. Folder Parsing
 * Recursively parses a directory to collect all JavaScript files.
 */
function parseFolder(folderPath) {
    const files = [];

    function walkDir(currentPath) {
        const items = fs.readdirSync(currentPath);

        items.forEach(item => {
            const fullPath = path.join(currentPath, item);
            const stat = fs.statSync(fullPath);

            if (stat.isFile() && item.endsWith('.js')) {
                const content = fs.readFileSync(fullPath, 'utf-8');
                files.push({
                    path: fullPath,
                    content: content
                });
            } else if (stat.isDirectory()) {
                walkDir(fullPath);
            }
        });
    }

    walkDir(folderPath);
    return files;
}

/**
 * 2. Context Analysis
 * Analyzes JavaScript files to extract function names.
 */
function analyzeContext(files) {
    const functionMap = {};

    files.forEach(file => {
        const functionNames = [];
        const regex = /function\s+([a-zA-Z0-9_]+)\s*\(/g;
        let match;

        while ((match = regex.exec(file.content)) !== null) {
            functionNames.push(match[1]);
        }

        functionMap[file.path] = functionNames;
    });

    return functionMap;
}

/**
 * 3. Interface Generation
 * Generates a simple interface file based on extracted functions.
 */
function generateInterfaces(functionMap, outputPath = 'generatedInterfaces.js') {
    let interfaceContent = '// Generated Interfaces\n\n';

    Object.keys(functionMap).forEach(filePath => {
        const fileName = path.basename(filePath, '.js');
        const functions = functionMap[filePath];

        interfaceContent += `// Interface for ${fileName}.js\n`;
        interfaceContent += `const ${fileName}API = {\n`;

        functions.forEach(fn => {
            interfaceContent += `  ${fn}: () => {\n    // TODO: Implement ${fn}\n  },\n`;
        });

        interfaceContent += '};\n\n';
    });

    fs.writeFileSync(outputPath, interfaceContent, 'utf-8');
    console.log(`Interfaces generated at ${outputPath}`);
}

/**
 * 4. Integration with Free Models
 * Example: Using OpenAI's GPT-3 (assuming free tier access)
 */
async function integrateWithFreeModel(prompt) {
    const apiKey = 'YOUR_OPENAI_API_KEY'; // Replace with your API key

    try {
        const response = await axios.post('https://api.openai.com/v1/engines/text-davinci-003/completions', {
            prompt: prompt,
            max_tokens: 150
        }, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            }
        });

        return response.data.choices[0].text.trim();
    } catch (error) {
        console.error('Error accessing the free model API:', error.response ? error.response.data : error.message);
        return null;
    }
}

/**
 * Command-Line Interface
 */
program
    .version('1.0.0')
    .description('CLI tool to parse folders, analyze context, generate interfaces, and integrate with free models.');

program
    .command('parse <folder>')
    .description('Parse the specified folder to collect JavaScript files.')
    .action((folder) => {
        const absolutePath = path.resolve(folder);
        if (!fs.existsSync(absolutePath)) {
            console.error('The specified folder does not exist.');
            process.exit(1);
        }

        const files = parseFolder(absolutePath);
        console.log(`Found ${files.length} JavaScript files.`);
    });

program
    .command('analyze <folder>')
    .description('Analyze the JavaScript files in the specified folder.')
    .action((folder) => {
        const absolutePath = path.resolve(folder);
        if (!fs.existsSync(absolutePath)) {
            console.error('The specified folder does not exist.');
            process.exit(1);
        }

        const files = parseFolder(absolutePath);
        const analysis = analyzeContext(files);
        console.log('Context Analysis:', analysis);
    });

program
    .command('generate <folder>')
    .description('Generate interface files based on the analyzed context.')
    .action((folder) => {
        const absolutePath = path.resolve(folder);
        if (!fs.existsSync(absolutePath)) {
            console.error('The specified folder does not exist.');
            process.exit(1);
        }

        const files = parseFolder(absolutePath);
        const analysis = analyzeContext(files);
        generateInterfaces(analysis);
    });

program
    .command('model <prompt>')
    .description('Integrate with a free model API using the provided prompt.')
    .action(async (prompt) => {
        const response = await integrateWithFreeModel(prompt);
        if (response) {
            console.log('Model Response:', response);
        }
    });

program.parse(process.argv);