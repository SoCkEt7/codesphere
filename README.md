# Codesphere

Codesphere is a powerful, terminal-based coding assistant that helps you generate code, navigate files, and work efficiently from the command line. It provides an interactive interface fully compatible with Claude Code features, enhanced with memory and context awareness.

![Codesphere Terminal Interface](https://i.imgur.com/nNy6TNt.png)

## Features

- **Interactive terminal interface** with command history
- **Context-aware code generation** for all programming languages
- **Conversation memory** that retains information between sessions
- **Autonomous agent capabilities** for complex tasks
- **Claude Code compatible tooling** - LS, View, GrepTool, GlobTool, Edit, etc.
- **Customizable model integration** with Mistral AI and local models
- **Jupyter notebook support** for data science workflows
- **Clean, user-friendly output** with proper styling

## Installation

### Quick Install

```bash
cd codesphere
./install.sh
```

This will install Codesphere globally on your system, making it available as the `codesphere` command.

### Manual Installation

If you prefer to install manually:

1. Copy `codesphere.js` to a location of your choice
2. Make it executable with `chmod +x codesphere.js`
3. Create a symlink or alias to run it easily

## Usage

Once installed, run Codesphere by typing:

```bash
codesphere
```

For enhanced AI capabilities with Mistral AI:

```bash
./run-with-mistral.sh
```

### Available Commands

#### Core Commands
- `/help` - Show available commands
- `/exit` - Exit the CLI
- `/clear` - Clear the terminal screen
- `/version` - Show version information
- `/about` - Display information about Codesphere
- `/models` - List available AI models
- `/install` - Install local models
- `/context` - Show current conversation context
- `/compact` - Compact and continue the conversation

#### File Operations (Claude Code Compatible)
- `/ls [directory]` - List files in directory
- `/cat <filename>` - Display file contents
- `/view <filename> [--offset <line>] [--limit <count>]` - View file with line numbers
- `/edit <filename>` - Edit or create a file
- `/replace <filename> <content>` - Replace file content
- `/search <pattern> [file-pattern]` - Search file contents
- `/grep <pattern> [--include <file-pattern>] [--path <directory>]` - Search files with regex
- `/glob <pattern> [--path <directory>]` - Find files matching pattern
- `/find <pattern>` - Find files by name
- `/cd <directory>` - Change directory
- `/pwd` - Show current working directory
- `/run <command> [--timeout <ms>]` - Execute a shell command

#### Code Generation
- `<description>` - Generate code from description (no command prefix needed)
- `/create <filename> <description>` - Create file with generated code
- `/save <filename>` - Save last output to file
- `/agent <instructions>` - Launch an autonomous agent for complex tasks

#### Jupyter Notebook Support
- `/notebook <filename>` - Read Jupyter notebook
- `/edit_cell <filename> <cell_number> <content> [--type code|markdown]` - Edit notebook cell

#### Web Integration
- `/web <url>` - Fetch content from a URL

### Code Generation

To generate code, simply type a description of what you want to create:

```
create a simple express server with two routes
```

Codesphere will automatically detect the language and generate appropriate code with context from your previous interactions.

Example with direct file creation:

```
/create server.js create a Node.js express server with authentication
```

## Features Comparison with Claude Code

| Feature | Codesphere | Claude Code |
|---------|-----------|------------|
| Code Generation | ✅ | ✅ |
| Memory & Context | ✅ | ✅ |
| File Operations | ✅ | ✅ |
| GrepTool | ✅ | ✅ |
| GlobTool | ✅ | ✅ |
| View | ✅ | ✅ |
| Edit | ✅ | ✅ |
| Replace | ✅ | ✅ |
| Jupyter Support | ✅ | ✅ |
| Agent | ✅ | ✅ |
| Web Fetch | ✅ | ✅ |
| Local Operation | ✅ | ❌ |
| Custom Models | ✅ | ❌ |
| Offline Use | ✅ | ❌ |

## Requirements

- Node.js (v12 or higher)
- A terminal that supports ANSI colors

## Configuring External Models

Codesphere can use Mistral AI's code generation models:

1. Set up your API key in `real-api-handler.js`
2. Run with `./run-with-mistral.sh`

## Uninstalling

To uninstall Codesphere:

```bash
~/.codesphere/uninstall.sh
```

## License

MIT

---

Made with ❤️ by Claude