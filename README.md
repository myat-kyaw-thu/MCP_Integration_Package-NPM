# mcp-connect

> Dead simple Model Context Protocol (MCP) server for exposing your app functions to AI agents.

[![npm version](https://badge.fury.io/js/mcp-connect.svg)](https://www.npmjs.com/package/mcp-connect)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

mcp-connect shifts MCP server creation into high gear. Define your tools in JavaScript once and instantly run them under three modes: **Stdio** (local IDE child processes), **SSE / HTTP** (exposing local ports), or **Secure Cloud Tunneling** (connecting behind NATs/firewalls via a proxy gateway).

---

## 🚀 Setup & Initialization (5 Minutes)

### Step 1: Install mcp-connect
```bash
# Global CLI install
npm install -g @myatkyawthu/mcp-connect

# Or local project dependency
npm install @myatkyawthu/mcp-connect
```

### Step 2: Initialize Config File
Run the initializer command in your project directory:
```bash
mcp-connect init
```

This creates a default `mcp.config.js` containing example tools:
```javascript
import { defineMCP } from "@myatkyawthu/mcp-connect";

export default defineMCP({
  name: "My MCP App",
  version: "1.0.0",
  tools: [
    // Simple tuple format: [name, handler]
    ["hello", async ({ name = "World" }) => `Hello ${name}!`],

    // Advanced format with description and schema validation
    {
      name: "echo",
      description: "Echo back the input",
      schema: {
        type: "object",
        properties: {
          message: { type: "string", description: "Message to echo" }
        },
        required: ["message"]
      },
      handler: async ({ message }) => `Echo: ${message}`
    }
  ]
});
```

---

## 🌐 Three Running Modes

### 1. Stdio Mode (Default)
Ideal for standard local IDE integrations (like Cursor, Claude Desktop, or VS Code). Runs as a child process using stdin/stdout.

```bash
# Runs the server using mcp.config.js in current directory
mcp-connect

# Or supply an explicit config file path
mcp-connect /path/to/your/mcp.config.js
```

**Example Claude Desktop Configuration (`claude_desktop_config.json`)**:
```json
{
  "mcpServers": {
    "my-app": {
      "command": "mcp-connect",
      "args": ["/absolute/path/to/mcp.config.js"]
    }
  }
}
```

### 2. HTTP / SSE Mode (`--port`)
Exposes the MCP server over HTTP/SSE. AI clients connect to the `/sse` stream and POST payloads to the `/message` endpoint.

```bash
# Starts local SSE transport on port 8080
mcp-connect --port 8080
```

### 3. Secure Reverse Proxy Tunnel (`--tunnel`)
Connects your local MCP server to a public Relay Gateway via an outbound client connection. Exposes your local server transiently to cloud agents (like Claude.ai web) without needing to configure local ports, firewalls, or dynamic DNS.

```bash
# Outbound tunnel proxy pointing to a relay gateway
mcp-connect --tunnel
```

To run your own self-hosted Relay Gateway:
```bash
# Boot the routing relay service on port 4000
mcp-connect relay --port 4000
```

---

## 🖥️ Local Inspector Console

When running in **SSE** or **Tunnel** modes, opening `http://localhost:<port>/` in your browser launches a built-in dark-themed developer dashboard:

*   **Real-time Log Feed**: Trace method requests, call arguments, durations, and response bodies.
*   **Mock Tool Executor**: Test and debug your tools directly from the browser by sending mock execution payloads.

---

## 🔒 Security Framework & Config Settings

mcp-connect supports deep security validations inside `mcp.config.js`:

```javascript
export default defineMCP({
  name: "Secure DB Server",
  version: "1.0.0",
  server: {
    // 1. Config-driven transport and ports
    transport: "hybrid",     // "stdio" | "sse" | "hybrid"
    port: 8080,

    // 2. CORS origin filtering (allowlist)
    cors: {
      origins: ["https://claude.ai", "http://localhost:3000"]
    },

    // 3. Authorization Tokens & Symmetric Encryption
    tunnel: {
      enabled: true,
      token: "secret-token-key",                       // Enforces Bearer auth
      encryptionKey: "my-32-byte-secret-aes-key-here"  // E2E AES-256-GCM payload encryption
    }
  },
  tools: [
    {
      name: "delete_record",
      description: "Destructive database action",
      confirm: true, // <── 4. Prompts developer on CLI for y/N confirmation before running!
      handler: async ({ id }) => { ... }
    }
  ]
});
```

---

## 🔧 CLI Commands Reference

```bash
mcp-connect init                   # Generate default template config
mcp-connect                        # Launch default config in Stdio mode
mcp-connect --port <port>          # Launch SSE server and Inspector Console
mcp-connect --tunnel               # Expose server via bridge tunnel
mcp-connect relay --port <port>    # Run a Relay Gateway router
```

---

## 📄 License

MIT © [myat-kyaw-thu](https://github.com/myat-kyaw-thu)