// Test script for memory features

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
function enhancePromptWithContext(prompt) {
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

// Run tests
function runTests() {
  console.log("Testing memory system...");
  
  // Add some conversations
  memory.addConversation("create a calculator function", "Generated a JavaScript calculator function");
  memory.addConversation("make a to-do list app", "Created a Todo class with add, remove, and list methods");
  memory.addConversation("write a recursive factorial function", "Created a factorial function using recursion");
  
  // Add some generated files
  memory.addGeneratedFile("calculator.js", "function calculator(a, b, op) { /*... code ...*/ }", "create a calculator function");
  memory.addGeneratedFile("todo.js", "class Todo { /*... code ...*/ }", "make a to-do list app");
  
  // Test 1: Get context for related prompt
  console.log("\nTest 1: Context for a prompt related to calculator");
  const prompt1 = "I need a simple calculator with add and subtract";
  const enhanced1 = enhancePromptWithContext(prompt1);
  console.log("Enhanced prompt:", enhanced1);
  
  // Test 2: Get context for unrelated prompt
  console.log("\nTest 2: Context for unrelated prompt");
  const prompt2 = "create a weather app";
  const enhanced2 = enhancePromptWithContext(prompt2);
  console.log("Enhanced prompt:", enhanced2);
  
  // Test 3: Add many conversations to test trimming
  console.log("\nTest 3: Testing conversation trimming");
  for (let i = 0; i < 12; i++) {
    memory.addConversation(`prompt ${i}`, `response ${i}`);
  }
  console.log(`Conversation count after adding 12 more: ${memory.conversations.length}`);
  console.log(`First conversation prompt: "${memory.conversations[0].prompt}"`);
  
  console.log("\nAll tests completed!");
}

// Run the tests
runTests();