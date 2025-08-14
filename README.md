# mcp-connect

> Dead simple MCP (Model Context Protocol) server for exposing your app functions to AI agents

[![npm version](https://badge.fury.io/js/mcp-connect.svg)](https://www.npmjs.com/package/mcp-connect)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 🚀 Quick Start

### Installation

```bash
# Install globally with npm
npm install -g @myatkyawthu/mcp-connect
```

Create `mcp.config.js` in your project:

```javascript
import { defineMCP } from '@myatkyawthu/mcp-connect';

export default defineMCP({
  name: "My App",
  version: "1.0.0",
  tools: [
    ["hello", async ({ name }) => `Hello ${name}!`],
    ["getTodos", async () => [{ id: 1, title: "Buy milk" }]],
  ]
});
```

Start the server from your project directory:

```bash
mcp-connect
```

Connect your AI agent via STDIO transport (Claude Desktop)!

## 🎯 Features

- **Zero Config** - Works out of the box with minimal setup
- **MCP Compliant** - Uses official MCP SDK with JSON-RPC 2.0
- **STDIO Transport** - Direct communication with Claude Desktop and other MCP clients
- **Pure JavaScript** - No compilation needed, runs directly on Node.js 18+
- **Production Ready** - Enterprise-grade error handling and logging
- **Performance Monitoring** - Built-in execution timing and debugging
- **Universal** - Works with npm, pnpm, and yarn
- **Claude Desktop Ready** - Works seamlessly with Claude Desktop and other MCP clients
- **Simple API** - Clean, declarative tool definitions with flexible formats

## 📖 Documentation

### Tool Definition Formats

```javascript
// Tuple format (simple)
["toolName", async (args) => result]

// Object format (with metadata)
{
  name: "toolName",
  description: "What this tool does",
  handler: async (args) => result,
  schema: { /* JSON schema for input validation */ }
}
```

### Configuration Options

```javascript
defineMCP({
  name: "My MCP Server",      // Required: Server name
  version: "1.0.0",           // Required: Server version
  description: "My server",   // Optional: Description
  tools: [
    // Your tool definitions
  ]
})
```

## 🔧 CLI Usage

### Global Installation

```bash
# Install globally
npm install -g @myatkyawthu/mcp-connect

# Start server (looks for mcp.config.js in current directory)
mcp-connect

# Start server with specific config file
mcp-connect /path/to/your/mcp.config.js
```

### Local Installation

```bash
# Using npx with the published package
npx @myatkyawthu/mcp-connect
```

## 🔍 Logging & Debugging

MCP-Connect includes structured logging for debugging:

### Log Output Examples

```
Starting MCP-Connect CLI...
Loading config from: /path/to/mcp.config.js
[MCP-WARN] 2025-08-14T15:16:19.802Z Configuration warnings
[MCP-INFO] 2025-08-14T15:16:19.803Z MCP server "Todo App" started
```

All logging goes to stderr (as required by MCP protocol), leaving stdout clean for JSON communication.

## ✅ Features

- **Configuration Validation** - Comprehensive validation with helpful error messages
- **Tool Execution Timeouts** - 30-second default timeout prevents hanging  
- **Graceful Shutdown** - Proper cleanup on SIGINT/SIGTERM
- **Sanitized Errors** - Safe error messages without sensitive information
- **MCP Protocol Compliance** - Full JSON-RPC 2.0 over STDIO implementation

## 🤝 Claude Desktop Integration

### Step 1: Install the Package

```bash
npm install -g @myatkyawthu/mcp-connect
```

### Step 2: Create Your Config File

Create `mcp.config.js` in your project directory:

```javascript
import { defineMCP } from '@myatkyawthu/mcp-connect';

export default defineMCP({
  name: "My App",
  version: "1.0.0",
  tools: [
    ["hello", async ({ name }) => `Hello ${name}!`]
  ]
});
```

### Step 3: Configure Claude Desktop

Add to your Claude Desktop config:

**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "my-app": {
      "command": "mcp-connect",
      "args": ["C:/full/path/to/your/mcp.config.js"]
    }
  }
}
```

**Important**: Use the full absolute path to your config file in the `args` array.

### Step 4: Restart Claude Desktop

Completely restart Claude Desktop and test with: **"What tools do you have available?"**

### Other MCP Clients

Any MCP-compliant client can connect using the STDIO transport. The server implements:

- `tools/list` - List available tools
- `tools/call` - Execute tool functions  
- JSON-RPC 2.0 messaging over STDIO
- Proper error handling and logging

## 📁 Examples

### Todo App Example

```javascript
import { defineMCP } from "mcp-connect";

const todos = [{ id: 1, title: "Buy milk", completed: false }];

export default defineMCP({
  name: "Todo App",
  version: "1.0.0",
  description: "Simple todo list management via MCP",
  tools: [
    // Simple tuple format
    ["getTodos", async () => todos],
    
    // Object format with schema validation
    {
      name: "addTodo",
      description: "Add a new todo item",
      schema: {
        type: "object",
        properties: {
          title: { type: "string", description: "Todo title" }
        },
        required: ["title"]
      },
      handler: async ({ title }) => {
        const newTodo = { id: Date.now(), title, completed: false };
        todos.push(newTodo);
        return newTodo;
      }
    }
  ]
});
```

Check out the [examples](./examples) directory for complete working examples.

## 🛠 Development

```bash
# Clone and install
git clone https://github.com/myat-kyaw-thu/MCP_Indigration_Package-NPM.git
cd MCP_Indigration_Package-NPM
npm install

# Test locally with the todo example
cd examples/todo-app
node ../../src/cli.js

# Test global installation locally
npm link
mcp-connect

# Run linting and formatting
npm run lint
npm run format
```

## 🏗️ Architecture

- **Pure JavaScript** with JSDoc type annotations
- **ESM modules** with Node.js 18+ support
- **Express.js** HTTP server integration
- **Official MCP SDK** integration
- **Structured logging** with performance metrics
- **Comprehensive validation** with user-friendly errors
- **Pure MCP implementation** focused on STDIO transport

## 📄 License

MIT © [myat-kyaw-thu](https://github.com/myat-kyaw-thu)
