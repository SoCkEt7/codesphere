# Setting Up Mistral AI with Codesphere

To use Mistral AI's powerful code generation capabilities with Codesphere, follow these steps:

## 1. Get a Mistral AI API Key

1. Visit [Mistral AI's platform](https://console.mistral.ai/) and create an account
2. After signing in, navigate to the API section
3. Create a new API key with appropriate permissions
4. Copy your API key for the next step

## 2. Configure Codesphere with Your API Key

Open the `real-api-handler.js` file and update the API key:

```javascript
// Mistral AI API configuration
const MISTRAL_API_KEY = 'your-mistral-api-key-here';
```

Replace `your-mistral-api-key-here` with the API key you received.

## 3. Test the Integration

Run the application with:

```bash
./run-with-model.sh
```

Then try generating code with a prompt like:
```
create a simple express server with two routes
```

## Troubleshooting

If you encounter authorization issues:

1. Check that your API key is correctly entered
2. Ensure your Mistral AI account has sufficient credits
3. Verify that your API key has the appropriate permissions
4. Check the Mistral AI status page for any service outages

## Available Mistral Models

Depending on your subscription level, you may have access to different models:

- `mistral-tiny`: Fastest, most economical
- `mistral-small`: Good balance of speed and quality
- `mistral-medium`: Better quality, slower
- `mistral-large`: Best quality, slowest

You can change the model in `real-api-handler.js` by updating the `model` parameter in the request object:

```javascript
const mistralRequest = {
  model: "mistral-small-latest", // Change to your preferred model
  // other parameters...
};
```