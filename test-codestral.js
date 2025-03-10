// Test script to verify Codestral API integration
const { generateCodeViaAPI } = require('./real-api-handler');

async function runTest() {
  try {
    console.log('Testing Codestral API connection...');
    const code = await generateCodeViaAPI('create a function to calculate factorial', 'javascript');
    console.log('\nGenerated Code:\n' + code);
    console.log('\nTest completed successfully!');
  } catch (error) {
    console.error('Error during test:', error.message);
  }
}

runTest();