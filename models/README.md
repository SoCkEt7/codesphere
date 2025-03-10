# Free AI Code Models

Codesphere uses free, open source AI models for code generation. This approach ensures:

1. No API keys or subscriptions required
2. Complete privacy (your code prompts don't leave your machine)
3. Customizable code generation

## Available Models

Codesphere intelligently selects the best model based on your prompt and programming language:

| Model | Size | Best for | Notes |
|-------|------|----------|-------|
| CodeLlama-34b-Instruct | Large | Complex code, strongly typed languages | Most powerful model for sophisticated code |
| StarCoder-15b | Medium | General code generation | Good balance of speed and capabilities |
| Mistral-7b-Instruct | Small | Simple tasks, short prompts | Fastest response time |

## How Model Selection Works

The application automatically selects the appropriate model based on:

- **Programming language** - Strongly typed languages use different models than dynamic languages
- **Prompt complexity** - Longer, more detailed prompts use larger models
- **Task specificity** - Some models are better at certain types of code generation

## Adding Custom Models

You can add your own models by editing the configuration in:
`~/.codesphere/model-config.json`

```json
{
  "models": [
    {
      "name": "My-Custom-Model",
      "endpoint": "http://localhost:8080/generate",
      "description": "My local LLM server",
      "size": "custom"
    }
  ]
}
```

## Running Local Models

For advanced users, you can run your own local LLM server and connect Codesphere to it:

1. Run a compatible LLM server locally (like llama.cpp, text-generation-webui, etc.)
2. Configure the endpoint in your model configuration
3. Restart Codesphere

This allows you to use your own custom-trained code models or any other LLM you prefer!