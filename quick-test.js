// Quick test script
const { generateCodeViaAPI } = require('./real-api-handler');

async function testMistralCode() {
  try {
    console.log('Testing Codestral API...');
    const code = await generateCodeViaAPI('create a simple calculator function that supports addition, subtraction, multiplication and division', 'javascript');
    console.log('\nGenerated Code:\n' + code);
    console.log('\nTest completed successfully!');
  } catch (error) {
    console.error('Error during test:', error.message);
  }
}

testMistralCode();