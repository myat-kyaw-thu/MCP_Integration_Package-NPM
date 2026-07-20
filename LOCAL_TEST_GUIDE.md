# Local Testing Guide — `@myatkyawthu/mcp-connect`

All commands run from the **package root** (`MCP_Integration_Package-NPM/`).
The test server config is at [`examples/mcp.test-all.js`](file:///Users/myatkyawthu/Documents/MCP_Integration_Package-NPM/examples/mcp.test-all.js).

---

## Step 0 — One-time Setup

```bash
# Install dependencies
npm install

# Run all automated unit tests (27 tests, ~2s)
npm run test:unit
```

Expected output: `pass 27 | fail 0`

---

## Feature 1 — Stdio Mode (local IDE / Claude Desktop)

**What it tests:** standard stdio transport — the original mode used by Cursor, Claude Desktop, etc.

### Terminal 1
```bash
node src/cli.js examples/mcp.test-all.js
```

The process will block waiting for JSON-RPC on stdin. That's correct.

### Terminal 2 — send raw JSON-RPC
```bash
echo '{"jsonrpc":"2.0","method":"tools/list","id":1}' | node src/cli.js examples/mcp.test-all.js
```

**Expected:** JSON response listing 5 tools: `hello`, `echo`, `wait`, `get_info`, `delete_data`

```bash
echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"hello","arguments":{"name":"Myat"}},"id":2}' | node src/cli.js examples/mcp.test-all.js
```

**Expected:** `Hello, Myat!`

---

## Feature 2 — HTTP / SSE Mode (`--port`)

**What it tests:** remote HTTP transport — lets AI clients connect over the network.

### Terminal 1 — start server
```bash
node src/cli.js examples/mcp.test-all.js --port 3111
```

**Expected output:**
```
MCP server running at http://localhost:3111/sse
Dashboard Console:   http://localhost:3111/
Health check:        http://localhost:3111/health
```

### Terminal 2 — verify health
```bash
curl http://localhost:3111/health
```

**Expected:** `{"name":"mcp-connect-feature-test","version":"1.0.0","status":"ok","tools":["hello","echo","wait","get_info","delete_data"]}`

### Call a tool via HTTP
```bash
curl -s -N http://localhost:3111/sse &   # open SSE stream
SESSION=$(curl -s http://localhost:3111/health | node -e "process.stdin.resume()")

# Or use a proper MCP client like the MCP Inspector CLI:
npx @modelcontextprotocol/inspector http://localhost:3111/sse
```

---

## Feature 3 — Local Inspector Dashboard

**What it tests:** browser-based tool log viewer and mock executor.

1. Start the server: `node src/cli.js examples/mcp.test-all.js --port 3111`
2. Open in browser: **http://localhost:3111/**
3. You should see a dark dashboard with a sidebar listing all 5 tools.

### Test in dashboard:
- Click **"Test Tool"** tab
- Select `echo` from the dropdown
- Fill in: `{"message": "hello from browser"}`
- Click **Execute**
- ✅ Should show response: `Echo: hello from browser`
- Switch to **"Logs"** tab — should show the call with duration and status dot

---

## Feature 4 — Config-Driven Port (no CLI flag)

**What it tests:** `server.port` in `mcp.config.js` as alternative to `--port`.

1. Open [`examples/mcp.test-all.js`](file:///Users/myatkyawthu/Documents/MCP_Integration_Package-NPM/examples/mcp.test-all.js)
2. Uncomment the `port: 3111` line inside `server: { ... }`
3. Run **without** `--port`:
```bash
node src/cli.js examples/mcp.test-all.js
```
**Expected:** server still starts on port 3111.

---

## Feature 5 — Relay Gateway + Tunnel Bridge (`--tunnel`)

**What it tests:** exposing your local server to remote clients via the relay.

### Terminal 1 — start the Relay Gateway
```bash
node src/cli.js relay --port 4000
```

**Expected:**
```
Relay Gateway running at http://localhost:4000
Tunnel endpoints map: http://localhost:4000/t/:tunnelId/sse
```

### Terminal 2 — start local server with tunnel
```bash
node src/cli.js examples/mcp.test-all.js --port 3111 --tunnel
```

**Expected:**
```
MCP Tunnel bridge active!
Remote SSE endpoint: http://localhost:4000/t/<tunnelId>/sse
```
Copy the full `tunnelId` URL from the output.

### Terminal 3 — simulate a remote AI client
```bash
# Replace <tunnelId> with the actual ID from the output above
TUNNEL_ID=<tunnelId>

# Connect to relay SSE
curl -s -N "http://localhost:4000/t/$TUNNEL_ID/sse" &

# Check what session endpoint was returned
# Then call tools via relay:
curl -s http://localhost:4000/t/$TUNNEL_ID/sse | head -5
```

**Expected SSE event:** `event: endpoint` with a `/message?sessionId=...` URL.

---

## Feature 6 — Auth Token Enforcement

**What it tests:** `Authorization: Bearer` token on SSE and message endpoints.

1. Open [`examples/mcp.test-all.js`](file:///Users/myatkyawthu/Documents/MCP_Integration_Package-NPM/examples/mcp.test-all.js), uncomment:
   ```js
   token: 'my-super-secret-token',
   ```
2. Start: `node src/cli.js examples/mcp.test-all.js --port 3111`

### Without token → 401
```bash
curl -i http://localhost:3111/sse
```
**Expected:** `HTTP/1.1 401 Unauthorized`

### With correct token → 200
```bash
curl -i -H "Authorization: Bearer my-super-secret-token" http://localhost:3111/sse
```
**Expected:** `HTTP/1.1 200 OK` + `content-type: text/event-stream`

### Via env var (alternative)
```bash
MCP_TUNNEL_TOKEN=my-super-secret-token node src/cli.js examples/mcp.test-all.js --port 3111
```

---

## Feature 7 — CORS Origin Allowlist

**What it tests:** blocking requests from unlisted origins.

1. Uncomment in config:
   ```js
   cors: {
     origins: ['https://claude.ai', 'http://localhost:5173'],
   },
   ```
2. Start: `node src/cli.js examples/mcp.test-all.js --port 3111`

### Allowed origin → correct header
```bash
curl -i -H "Origin: https://claude.ai" http://localhost:3111/health
```
**Expected:** `access-control-allow-origin: https://claude.ai`

### Blocked origin → 403
```bash
curl -i -H "Origin: https://evil.com" http://localhost:3111/health
```
**Expected:** `HTTP/1.1 403` + `Origin not allowed`

### No origin header (e.g. direct curl) → passes through
```bash
curl -i http://localhost:3111/health
```
**Expected:** `HTTP/1.1 200 OK` (origin filtering only applies when `Origin` header is present)

---

## Feature 8 — E2E Payload Encryption (AES-256-GCM)

**What it tests:** encrypted tunnel payloads.

1. Uncomment in config:
   ```js
   encryptionKey: 'my-32-byte-or-longer-passphrase!!',
   ```
2. Start relay + tunnel as in Feature 5.
3. The tunnel client and relay will now encrypt/decrypt JSON-RPC payloads transparently.

### Verify with a quick node script:
```bash
node -e "
import { encrypt, decrypt } from './src/utils/crypto.js';
const key = 'my-32-byte-or-longer-passphrase!!';
const blob = encrypt('hello world', key);
console.log('Encrypted:', blob);
console.log('Decrypted:', decrypt(blob, key));
" --input-type=module
```

**Expected:**
```
Encrypted: <base64 blob>
Decrypted: hello world
```

---

## Feature 9 — Destructive Tool Confirmation Prompt

**What it tests:** interactive terminal prompt before executing `confirm: true` tools.

1. Start server in SSE mode: `node src/cli.js examples/mcp.test-all.js --port 3111`
2. In the browser dashboard, go to **Test Tool**, select `delete_data`
3. Fill in: `{"target": "users_table"}`
4. Click **Execute**

**Expected behavior:** the server terminal will print:
```
⚠️  [MCP SECURITY] Allow tool "delete_data" execution? (y/N):
```
- Type `y` → response: `Deleted: users_table`
- Type `n` or Enter → response error: `Action rejected by user`

---

## Feature 10 — Automated Test Suite

```bash
npm run test:unit
```

**Expected:** 37 tests, 0 failures across 8 suites:
- `configValidation` (7) — config parsing edge cases
- `defineMCP` (5) — config normalisation
- `logger` (6) — log formatting
- `configLoader` (3) — file loading
- `sse` (2) — HTTP server + SSE headers
- `dashboard` (3) — inspector UI + log stream + mock executor
- `tunnel` (3) — relay gateway + end-to-end tool call routing
- `security` (10) — crypto round-trip, CORS allowlist, auth token

---

## Quick Reference — All CLI Commands

```bash
# Stdio mode (default)
node src/cli.js examples/mcp.test-all.js

# SSE / HTTP mode
node src/cli.js examples/mcp.test-all.js --port 3111

# Relay Gateway
node src/cli.js relay --port 4000

# SSE + tunnel (points at relay on :4000)
node src/cli.js examples/mcp.test-all.js --port 3111 --tunnel

# SSE + tunnel + custom relay URL
MCP_RELAY_URL=http://your-relay.com node src/cli.js examples/mcp.test-all.js --port 3111 --tunnel

# SSE + auth token via env var
MCP_TUNNEL_TOKEN=secret123 node src/cli.js examples/mcp.test-all.js --port 3111
```
