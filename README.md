# mcp-connect

> Dead simple MCP server framework. Define your tools as async functions — it handles the protocol, transport, security, and dashboard.

[![npm version](https://img.shields.io/npm/v/@myatkyawthu/mcp-connect.svg)](https://www.npmjs.com/package/@myatkyawthu/mcp-connect)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## What is this?

**Model Context Protocol (MCP)** is the standard way AI tools (Claude, Cursor, Cline, etc.) call your app's functions. Think of it like a plugin system — any MCP-compatible AI can discover and call your tools.

`mcp-connect` removes all the boilerplate. You write async functions. It handles the rest: JSON-RPC wiring, transport, schema advertisement, rate limiting, auth, error handling, and a live inspector dashboard.

```js
import { defineMCP } from "@myatkyawthu/mcp-connect";

export default defineMCP({
  name: "my-server",
  version: "1.0.0",
  tools: [
    ["hello", async ({ name = "World" }) => `Hello ${name}!`],
    {
      name: "echo",
      description: "Echo back the input",
      schema: {
        type: "object",
        properties: { message: { type: "string" } },
        required: ["message"]
      },
      handler: async ({ message }) => `Echo: ${message}`
    }
  ]
});
```

---

## Install

```bash
# Global CLI (recommended)
npm install -g @myatkyawthu/mcp-connect

# Or as a project dependency
npm install @myatkyawthu/mcp-connect
```

Requires **Node.js 18+**.

---

## Quick Start

```bash
# 1. Create a config file
mcp-connect init

# 2. Edit mcp.config.js and add your tools

# 3. Run it
mcp-connect                  # STDIO mode (for Claude Desktop)
mcp-connect --port 3000      # SSE/HTTP mode (for web clients, IDEs)
```

---

## Three Modes — Pick One

### Mode 1 — STDIO (Local, for Claude Desktop)

Your AI tool spawns the process. Communication happens via stdin/stdout pipes. No port, no HTTP.

```bash
mcp-connect mcp.config.js
```

**Claude Desktop config** (`~/Library/Application Support/Claude/claude_desktop_config.json`):
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

---

### Mode 2 — SSE / HTTP (Deployed on a Server)

Starts an HTTP server. AI clients connect to `/sse` and send requests to `/message`. **This is the mode for deploying on a VPS or cloud** so any client can reach it over the internet.

```bash
mcp-connect mcp.config.js --port 3000
```

Once deployed behind HTTPS, clients connect to:
```
https://yourserver.com/sse
```

**Client compatibility:**

| Client | SSE Support |
| :--- | :---: |
| Claude.ai (web) | ✅ |
| Cursor | ✅ |
| Cline (VS Code) | ✅ |
| Windsurf | ✅ |
| Continue.dev | ✅ |
| Zed | ✅ |
| Claude Desktop | ❌ (STDIO only) |

**Endpoints exposed:**

| Endpoint | Description |
| :--- | :--- |
| `GET /sse` | AI client connects here (long-lived SSE stream) |
| `POST /message` | AI client sends JSON-RPC requests |
| `GET /health` | JSON health check with tool list |
| `GET /` | Live inspector dashboard |

---

### Mode 3 — Tunnel (Behind NAT, No Open Port)

If your machine can't receive inbound connections (home laptop, office network), use the tunnel. Run a tiny relay on any $5/month VPS — your local machine connects outbound to it. Remote clients hit the VPS and get proxied to your machine.

**Step 1 — Start the relay on your VPS (one-time setup):**
```bash
mcp-connect relay --port 4000
```

**Step 2 — Start your server on your local machine:**
```bash
mcp-connect mcp.config.js --port 3111 --tunnel
```

Your terminal will print:
```
MCP Tunnel bridge active!
Remote SSE endpoint: http://your-vps.com/t/<tunnelId>/sse
```

Share that URL with any MCP client. Done.

> The relay auto-reconnects if the tunnel drops. All payloads can be AES-256-GCM encrypted end-to-end (see Security section below).

---

## Tool Definition Formats

### Short format (tuple)
For simple one-liner tools:
```js
["toolName", async (args) => result]
```

### Full format (object)
For tools that need schema validation, descriptions, or a security confirmation gate:
```js
{
  name: "delete_record",
  description: "Permanently delete a record by ID",
  schema: {
    type: "object",
    properties: {
      id: { type: "string", description: "Record ID to delete" }
    },
    required: ["id"]
  },
  confirm: true,   // asks "y/N?" in terminal before executing
  handler: async ({ id }) => {
    await db.delete(id);
    return `Deleted ${id}`;
  }
}
```

The AI receives the schema and knows exactly what arguments to pass. You don't have to document it separately.

---

## Security

All security features are optional — enable only what you need.

### Bearer Token Auth

Protect the `/sse` and `/message` endpoints. Any request without the correct token gets a `401`.

```bash
# Set via environment variable
MCP_TUNNEL_TOKEN=my-secret-token mcp-connect mcp.config.js --port 3000
```

Or in config:
```js
server: {
  tunnel: { token: "my-secret-token" }
}
```

Clients must send: `Authorization: Bearer my-secret-token`

---

### CORS Origin Allowlist

Restrict which origins can connect. Without this, all origins are allowed (`*`).

```js
server: {
  cors: {
    origins: ["https://claude.ai", "https://cursor.sh"]
  }
}
```

Requests from unlisted origins get `403 Origin not allowed`.

---

### End-to-End Encryption (Tunnel mode)

Encrypt all payloads over the tunnel so the relay server only sees ciphertext. Uses AES-256-GCM.

```js
server: {
  tunnel: {
    encryptionKey: "my-32-char-passphrase-or-64hex"
  }
}
```

The relay cannot read your tool calls or responses even if it's compromised.

---

### Confirm Gate for Dangerous Tools

Add `confirm: true` to any tool. Before it runs, the terminal prompts you:
```
⚠️  [MCP SECURITY] Allow tool "delete_record" execution? (y/N):
```

The tool only runs if you type `y`. Otherwise it's rejected with an error.

---

## Built-in Protections (Always On)

These run automatically without any config:

| Protection | Detail |
| :--- | :--- |
| **Rate limiting** | 100 requests/minute per server |
| **Tool timeout** | 30 seconds max per tool call |
| **Response size cap** | 1MB max, truncated if exceeded |
| **Error sanitization** | Stack traces stripped before returning to AI |
| **Circular reference guard** | Safe JSON serialization |

---

## Inspector Dashboard

Available at `http://localhost:<port>/` whenever running in SSE mode.

- **Logs tab** — live feed of every tool call with timestamp, duration, pass/fail status. Click any row to see full request args and response.
- **Test Tool tab** — pick a tool, fill in args as JSON, hit Execute. See the response immediately. No AI client needed for debugging.

The dashboard connects to `/api/events` over SSE — it updates in real-time without refreshing.

---

## Full Config Reference

```js
import { defineMCP } from "@myatkyawthu/mcp-connect";

export default defineMCP({
  name: "my-server",       // required
  version: "1.0.0",        // required
  description: "...",      // optional

  server: {
    port: 3000,            // optional — same as --port flag

    cors: {
      origins: [           // optional — allowlist of origins
        "https://claude.ai",
        "http://localhost:5173"
      ]
    },

    tunnel: {
      enabled: true,       // optional — same as --tunnel flag
      relayUrl: "http://your-vps.com:4000",  // relay address
      token: "secret",     // bearer token for auth
      encryptionKey: "..."  // AES-256-GCM key (passphrase or 64-char hex)
    }
  },

  tools: [
    // Short format
    ["hello", async ({ name = "World" }) => `Hello ${name}!`],

    // Full format
    {
      name: "echo",
      description: "Echo back the input",
      schema: {
        type: "object",
        properties: {
          message: { type: "string" }
        },
        required: ["message"]
      },
      handler: async ({ message }) => `Echo: ${message}`
    },

    // Dangerous tool with confirmation gate
    {
      name: "delete_all",
      description: "Wipe everything",
      confirm: true,
      handler: async () => {
        await nuke();
        return "Done.";
      }
    }
  ]
});
```

---

## CLI Reference

```bash
mcp-connect init                        # Scaffold mcp.config.js in current directory
mcp-connect [config.js]                 # Start in STDIO mode
mcp-connect [config.js] --port <port>   # Start in SSE/HTTP mode
mcp-connect [config.js] --tunnel        # Start with outbound tunnel
mcp-connect relay --port <port>         # Run a relay gateway (deploy on VPS)
```

Config file defaults to `mcp.config.js` in the current directory if not specified.

---

## Deployment Recipes

### Deploy on Railway / Render / Fly.io

1. Push your repo with `mcp.config.js`
2. Set start command: `mcp-connect mcp.config.js --port 3000`
3. Set env var: `MCP_TUNNEL_TOKEN=your-secret`
4. Add your domain/URL to your AI client as the MCP server URL: `https://yourapp.railway.app/sse`

### Self-hosted VPS (nginx + HTTPS)

```nginx
location / {
    proxy_pass http://localhost:3000;
    proxy_http_version 1.1;
    proxy_set_header Connection '';          # keep SSE alive
    proxy_buffering off;                     # required for SSE streaming
    proxy_cache off;
    proxy_set_header Host $host;
}
```

Then run: `mcp-connect mcp.config.js --port 3000`

### Laptop behind NAT (tunnel setup)

```bash
# On VPS
mcp-connect relay --port 4000

# On laptop
MCP_TUNNEL_TOKEN=secret mcp-connect mcp.config.js --port 3111 --tunnel
```

---

## License

MIT © [myat-kyaw-thu](https://github.com/myat-kyaw-thu)