# Codesphere

Codesphere is a lightweight, terminal-based coding assistant that helps you generate code, navigate files, and work efficiently from the command line. It provides an interactive interface similar to Claude Code but runs entirely locally.

![Codesphere Terminal Interface](https://i.imgur.com/nNy6TNt.png)

## Features

- **Interactive terminal interface** with command history
- **Code generation** for multiple languages (JavaScript, Python, HTML, CSS, Bash, Java)
- **File operations** (ls, cat, edit, search)
- **Command execution** directly from the interface
- **Language detection** from your description
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

### Available Commands

- `/help` - Show available commands
- `/exit` - Exit the CLI
- `/clear` - Clear the terminal screen
- `/ls [directory]` - List files in directory
- `/cat <filename>` - Display file contents
- `/edit <filename>` - Edit or create a file
- `/search <pattern> [file-pattern]` - Search file contents
- `/run <command>` - Execute a shell command
- `/cd <directory>` - Change directory
- `/pwd` - Show current working directory

### Code Generation

To generate code, simply type a description of what you want to create:

```
create a simple express server with two routes
```

Codesphere will automatically detect the language and generate appropriate code.

## Requirements

- Node.js (v12 or higher)
- A terminal that supports ANSI colors

## Uninstalling

To uninstall Codesphere:

```bash
~/.codesphere/uninstall.sh
```

## License

MIT

---

Made with ❤️ by Claude