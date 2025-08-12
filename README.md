# mcp-connect

> Dead simple MCP (Model Context Protocol) server for exposing your app functions to AI agents

[![npm version](https://badge.fury.io/js/mcp-connect.svg)](https://www.npmjs.com/package/mcp-connect)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 🚀 Quick Start

```bash
# Install
npm install mcp-connect
# or
bun add mcp-connect
```

Create `mcp.config.ts`:

```typescript
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

Start the server:

```bash
bunx mcp-connect
```

Connect your AI agent (like Claude Desktop) via STDIO transport!

## 🎯 Features

- **Zero Config** - Works out of the box with minimal setup
- **MCP Compliant** - Uses official MCP SDK with JSON-RPC 2.0 and STDIO transport
- **Type Safe** - Full TypeScript support with comprehensive validation
- **Production Ready** - Enterprise-grade error handling and logging
- **Performance Monitoring** - Built-in execution timing and debugging
- **Universal** - Works with npm, pnpm, yarn, bun, and deno
- **Claude Desktop Ready** - Works seamlessly with Claude Desktop and other MCP clients
- **Simple API** - Clean, declarative tool definitions with flexible formats

## 📖 Documentation

### Tool Definition Formats

```typescript
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

```typescript
defineMCP({
  name: "My MCP Server",      // Required: Server name
  version: "1.0.0",           // Required: Server version
  description: "My server",   // Optional: Description
  transport: "stdio",         // Transport type (stdio for Claude Desktop)
  tools: [
    // Your tool definitions
  ]
})
```

## 🔧 CLI Usage

```bash
# Start server (looks for mcp.config.ts)
bunx mcp-connect

# With debug logging and performance tracking
MCP_DEBUG=1 bunx mcp-connect

# Performance tracking only
MCP_PERF=1 bunx mcp-connect

# Custom log level
MCP_LOG_LEVEL=warn bunx mcp-connect
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

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "my-app": {
      "command": "bunx",
      "args": ["mcp-connect"],
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

```typescript
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
bun install

# Run example with debug logging
cd examples/todo-app
MCP_DEBUG=1 bun run ../../src/cli.ts

# Build package
bun run build

# Run tests
bun run test
```

## 🏗️ Architecture

- **TypeScript-first** with strict type checking
- **ESM + CJS** dual package support
- **Bun-optimized** build system
- **Official MCP SDK** integration
- **Structured logging** with performance metrics
- **Comprehensive validation** with user-friendly errors

## 📄 License

MIT © [myat-kyaw-thu](https://github.com/myat-kyaw-thu)
