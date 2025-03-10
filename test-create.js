// Test script for file creation with context

const fs = require('fs');
const path = require('path');
const { generateCodeViaAPI } = require('./real-api-handler');

// Memory implementation for testing
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

// Function to enhance prompt with context
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
  
  console.log(`Added context from ${context.conversations.length} conversations and ${context.files.length} files`);
  
  return enhancedPrompt;
}

// Test create file function
async function testCreateFile() {
  try {
    console.log("Testing file creation with context...");
    
    // Set up with some initial conversations and file
    memory.addConversation("create a calculator function", "Generated a JavaScript calculator function");
    memory.addGeneratedFile("calculator.js", "function calculator(a, b, op) { switch(op) { case '+': return a + b; /* etc */ } }", "create a calculator function");
    
    // First test: create a related file
    console.log("\nTest 1: Creating a related file");
    const prompt1 = "create a better calculator with scientific functions";
    const enhancedPrompt1 = enhancePromptWithContext(prompt1, "javascript");
    console.log("Enhanced prompt:", enhancedPrompt1);
    
    // Generate code with API
    console.log("\nGenerating code using API...");
    const code1 = await generateCodeViaAPI(enhancedPrompt1, "javascript");
    console.log("Generated code preview:", code1.substring(0, 200) + "...");
    
    // Write to file
    const filename1 = "scientific-calculator.js";
    fs.writeFileSync(filename1, code1);
    console.log(`Wrote ${code1.length} characters to ${filename1}`);
    
    // Add to memory
    memory.addGeneratedFile(filename1, code1, prompt1);
    memory.addConversation(prompt1, "Created scientific calculator with trig functions");
    
    // Second test: create an unrelated file
    console.log("\nTest 2: Creating an unrelated file");
    const prompt2 = "create a weather app that fetches data from an API";
    const enhancedPrompt2 = enhancePromptWithContext(prompt2, "javascript");
    console.log("Enhanced prompt:", enhancedPrompt2);
    
    // Generate code with API
    console.log("\nGenerating code using API...");
    const code2 = await generateCodeViaAPI(enhancedPrompt2, "javascript");
    console.log("Generated code preview:", code2.substring(0, 200) + "...");
    
    // Write to file
    const filename2 = "weather-app.js";
    fs.writeFileSync(filename2, code2);
    console.log(`Wrote ${code2.length} characters to ${filename2}`);
    
    // Add to memory
    memory.addGeneratedFile(filename2, code2, prompt2);
    memory.addConversation(prompt2, "Created weather app with API integration");
    
    // Third test: create another calculator that should use both contexts
    console.log("\nTest 3: Creating another file with multiple contexts");
    const prompt3 = "create a calculator that also shows weather";
    const enhancedPrompt3 = enhancePromptWithContext(prompt3, "javascript");
    console.log("Enhanced prompt:", enhancedPrompt3);
    
    // Generate code with API
    console.log("\nGenerating code using API...");
    const code3 = await generateCodeViaAPI(enhancedPrompt3, "javascript");
    console.log("Generated code preview:", code3.substring(0, 200) + "...");
    
    // Write to file
    const filename3 = "calculator-weather.js";
    fs.writeFileSync(filename3, code3);
    console.log(`Wrote ${code3.length} characters to ${filename3}`);
    
    console.log("\nAll tests completed!");
    
  } catch (error) {
    console.error("Error during test:", error);
  }
}

// Run the test
testCreateFile();