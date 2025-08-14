# mcp-connect

> Dead simple MCP (Model Context Protocol) server for exposing your app functions to AI agents

[![npm version](https://badge.fury.io/js/mcp-connect.svg)](https://www.npmjs.com/package/mcp-connect)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 🚀 Quick Start

### Option 1: Global Installation (Recommended)

```bash
# Install globally with npm
npm install -g mcp-connect
```

Create `mcp.config.js` in your project:

```javascript
import { defineMCP } from "mcp-connect"

export default defineMCP({
  name: "My App",
  version: "1.0.0",
  tools: [
    ["hello", async ({ name }) => `Hello ${name}!`],
    ["getTodos", async () => [{ id: 1, title: "Buy milk" }]],
  ]
})
```

Start the server from your project directory:

```bash
mcp-connect
```

### Option 2: Local Installation

```bash
# Install locally with npm
npm install mcp-connect
```

Start with npx:

```bash
npx mcp-connect
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
# Start server (looks for mcp.config.ts in current directory)
mcp-connect

# With debug logging and performance tracking
MCP_DEBUG=1 mcp-connect

# Performance tracking only
MCP_PERF=1 mcp-connect

# Custom log level
MCP_LOG_LEVEL=warn mcp-connect
```

### Local Installation

```bash
# Using npx
npx mcp-connect

# With environment variables
MCP_DEBUG=1 npx mcp-connect
```

## 🔍 Logging & Debugging

MCP-Connect includes comprehensive logging and debugging features:

### Environment Variables

- `MCP_DEBUG=1` - Enable debug logging with full MCP message tracing
- `MCP_PERF=1` - Enable performance tracking for tool execution times
- `MCP_LOG_LEVEL=level` - Set minimum log level (debug, info, warn, error)

### Log Output Examples

```
[MCP-INFO] 2024-01-15T10:30:45.123Z MCP server "Todo App" started (stdio, 3 tools)
[MCP-DEBUG] 2024-01-15T10:30:46.456Z Tool execution started: addTodo [req:abc123]
[MCP-INFO] 2024-01-15T10:30:46.478Z Tool execution completed: addTodo (22ms) [req:abc123]
```

## ✅ Configuration Validation

MCP-Connect provides comprehensive configuration validation with helpful error messages:

```
❌ Configuration Errors:
  1. tools[0].name: Tool name must be a non-empty string
     Current value: ""
     Suggestion: "myToolName"

⚠️  Configuration Warnings:
  1. version: Version doesn't follow semantic versioning
     Suggestion: Use format: "1.0.0"
```

## 🛡️ Error Handling

- **Tool Execution Timeouts** - 30-second default timeout prevents hanging
- **Graceful Shutdown** - Proper cleanup on SIGINT/SIGTERM
- **Sanitized Errors** - Safe error messages without sensitive information
- **MCP-Compliant Errors** - Proper JSON-RPC error format

## 🤝 AI Agent Integration

### Claude Desktop

#### Global Installation (Recommended)

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "my-app": {
      "command": "mcp-connect",
      "cwd": "/path/to/your/project"
    }
  }
}
```

#### Local Installation

```json
{
  "mcpServers": {
    "my-app": {
      "command": "npx",
      "args": ["mcp-connect"],
      "cwd": "/path/to/your/project"
    }
  }
}
```

#### Alternative: Package Script

Add to your project's `package.json`:

```json
{
  "scripts": {
    "mcp": "mcp-connect"
  }
}
```

Then in Claude Desktop config:

```json
{
  "mcpServers": {
    "my-app": {
      "command": "npm",
      "args": ["run", "mcp"],
      "cwd": "/path/to/your/project"
    }
  }
}
```

### Other MCP Clients

Any MCP-compliant client can connect using the STDIO transport. The server implements the full MCP specification with:

- `tools/list` - List available tools
- `tools/call` - Execute tool functions
- Proper JSON-RPC 2.0 messaging
- Standard MCP lifecycle management

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
cd mcp-connect
npm install

# Run example with debug logging
cd examples/todo-app
MCP_DEBUG=1 node ../../src/cli.js

# Test global installation locally
npm link
cd /path/to/test/project
mcp-connect

# Run tests
npm test

# Lint and format code
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
