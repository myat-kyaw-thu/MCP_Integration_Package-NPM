# mcp-connect

> Dead simple MCP (Model Context Protocol) server for exposing your app functions to AI agents

[![npm version](https://badge.fury.io/js/mcp-connect.svg)](https://www.npmjs.com/package/mcp-connect)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 🚀 Quick Start

### Step 1: Install Globally

```ash
npm install -g @myatkyawthu/mcp-connect
```
### Step 2: Create mcp.config.js

Create `mcp.config.js` in your project directory:

```avascript
import { defineMCP } from '@myatkyawthu/mcp-connect';

export default defineMCP({
  name: "My App",
  version: "1.0.0",
  tools: [
    ["hello", async ({ name }) => `Hello ${name}!`],
    ["getTodos", async () => [{ id: 1, title: "Buy milk", completed: false }]],
  ]
});
```
### Step 3: Test Locally

Run from your project directory to test the server:

```ash
mcp-connect
```
You should see:
[MCP-INFO] MCP server "My App" started
```
### Step 4: Configure Claude Desktop

Add to your Claude Desktop config file:

**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`  
**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`

```son
{
  "mcpServers": {
    "my-app": {
      "command": "mcp-connect",
      "args": ["C:/full/path/to/your/mcp.config.js"]
    }
  }
}
```
**Important**: Use the full absolute path to your config file.

### Step 5: Restart Claude Desktop

Restart Claude Desktop completely and test with: **"What tools do you have available?"**

## 🎯 Features

- **Zero Config** - Works out of the box with minimal setup
- **MCP Compliant** - Uses official MCP SDK with JSON-RPC 2.0
- **STDIO Transport** - Direct communication with Claude Desktop
- **Pure JavaScript** - No compilation needed, runs on Node.js 18+
- **Production Ready** - Enterprise-grade error handling and logging
- **Global Installation** - Run from anywhere, no project dependencies

## 📖 Configuration

### Tool Definition Formats

```avascript
// Simple tuple format
["toolName", async (args) => result]

// Object format with validation
{
  name: "toolName",
  description: "What this tool does",
  handler: async (args) => result,
  schema: { /* JSON schema for input validation */ }
}
```
### Configuration Options

```avascript
defineMCP({
  name: "My MCP Server",      // Required: Server name
  version: "1.0.0",           // Required: Server version
  description: "My server",   // Optional: Description
  tools: [
    // Your tool definitions
  ]
})
```
## 📁 Example: Todo App

```avascript
import { defineMCP } from '@myatkyawthu/mcp-connect';

const todos = [{ id: 1, title: "Buy milk", completed: false }];

export default defineMCP({
  name: "Todo App",
  version: "1.0.0",
  description: "Simple todo list management",
  tools: [
    // Get all todos
    ["getTodos", async () => todos],
    
    // Add new todo with validation
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
    },
    
    // Toggle todo completion
    ["toggleTodo", async ({ id }) => {
      const todo = todos.find(t => t.id === id);
      if (todo) {
        todo.completed = !todo.completed;
        return todo;
      }
      throw new Error("Todo not found");
    }]
  ]
});
```
## 🔧 CLI Usage

```ash
# Start server (looks for mcp.config.js in current directory)
mcp-connect

# Start server with specific config file
mcp-connect /path/to/your/mcp.config.js

# Using npx (alternative)
npx @myatkyawthu/mcp-connect
```
## 🔍 Debugging

All logs go to stderr, keeping stdout clean for MCP communication:

```Starting MCP-Connect CLI...
Loading config from: /path/to/mcp.config.js
[MCP-INFO] 2025-08-14T15:16:19.803Z MCP server "Todo App" started
[MCP-WARN] 2025-08-14T15:16:19.802Z Configuration warnings (if any)
```
## 🛠 Development

```ash
# Clone and install
git clone https://github.com/myat-kyaw-thu/MCP_Indigration_Package-NPM.git
cd MCP_Indigration_Package-NPM
npm install

# Test locally
npm link
mcp-connect

# Run linting
npm run lint
npm run format
```
## 📄 License

MIT © [myat-kyaw-thu](https://github.com/myat-kyaw-thu)
