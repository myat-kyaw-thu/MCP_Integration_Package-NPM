# mcp-connect

> Dead simple MCP (Model Context Protocol) server for exposing your app functions to AI agents

[![npm version](https://badge.fury.io/js/mcp-connect.svg)](https://www.npmjs.com/package/mcp-connect)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 🚀 Claude Desktop Setup (5 Minutes)

### Step 1: Install mcp-connect

```bash
npm install -g @myatkyawthu/mcp-connect
```

### Step 2: Create Your MCP Server

```bash
# Navigate to your project directory
cd your-project

# Generate sample config
mcp-connect init
```

This creates `mcp.config.js` with example tools:

```javascript
import { defineMCP } from "@myatkyawthu/mcp-connect";

export default defineMCP({
  name: "My MCP App",
  version: "1.0.0",
  tools: [
    ["hello", async ({ name = "World" }) => `Hello ${name}!`],
    ["echo", async ({ message }) => `Echo: ${message}`]
  ]
});
```

### Step 3: Configure Claude Desktop

Open Claude Desktop config file:
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`

Add your MCP server:

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

**Important**: Use the full absolute path to your `mcp.config.js` file.

### Step 4: Start & Test

1. **Restart Claude Desktop** completely
2. **Test connection**: Ask Claude *"What tools do you have available?"*
3. **Use your tools**: Try *"Hello there!"* or *"Echo this message"*

✅ **Done!** Your functions are now available to Claude Desktop.

---

## 📖 Tool Definition Guide

### Simple Format (Recommended)

```javascript
// Just name and function
["toolName", async (args) => "result"]
```

### Advanced Format (With Validation)

```javascript
{
  name: "toolName",
  description: "What this tool does",
  schema: {
    type: "object",
    properties: {
      param: { type: "string", description: "Parameter description" }
    },
    required: ["param"]
  },
  handler: async ({ param }) => `Result: ${param}`
}
```

## 🛠 Development Commands

```bash
# Start with auto-reload during development
npm run dev

# Run tests
npm test

# Format code
npm run format

# Lint code
npm run lint
```

## 🔧 Troubleshooting

### Config File Not Found
```bash
# Create sample config
mcp-connect init
```

### Claude Desktop Not Connecting
1. Check config file path is absolute
2. Restart Claude Desktop completely
3. Check Claude Desktop logs for errors

### Tool Not Working
1. Verify tool syntax in `mcp.config.js`
2. Check server logs for errors
3. Test with simple tools first

## 📋 Examples

### File Operations
```javascript
["readFile", async ({ path }) => {
  const fs = await import('fs/promises');
  return await fs.readFile(path, 'utf8');
}]
```

### API Calls
```javascript
["getWeather", async ({ city }) => {
  const response = await fetch(`https://api.weather.com/${city}`);
  return await response.json();
}]
```

### Database Queries
```javascript
["getUser", async ({ id }) => {
  // Your database logic here
  return { id, name: "John Doe", email: "john@example.com" };
}]
```

## 🌐 Other MCP Clients

Claude Desktop setup is covered above. Tutorials for other MCP clients coming soon:
- VS Code extensions
- Custom applications
- Other AI platforms

## 📄 License

MIT © [myat-kyaw-thu](https://github.com/myat-kyaw-thu)