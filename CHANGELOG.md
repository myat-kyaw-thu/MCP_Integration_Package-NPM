# Changelog

All notable changes to `@myatkyawthu/mcp-connect` are documented here.

---

## [0.3.2] — 2026-07-22

### Bug Fixes

- **Config validation: destructured args no longer falsely error**
  Tools with handlers like `async ({ id, content }) => ...` were incorrectly reported as having multiple parameters. The validator now detects destructured arguments (`{...}` or `[...]`) and counts them as a single parameter. ([`configValidation.js`](src/utils/configValidation.js))

- **Config validation: `confirm` no longer warns as unknown property**
  Tools with `confirm: true` were emitting a spurious _"Unknown properties: confirm"_ warning. `confirm` is now a recognised property in the validator. ([`configValidation.js`](src/utils/configValidation.js))

### New Features

- **Runtime schema validation against tool input schemas**
  Tool arguments are now validated against the tool's declared JSON Schema before the handler is called. Required fields that are missing and properties with the wrong type both return a clear error to the AI client instead of silently crashing.
  - No new dependencies — uses the existing `required` and `properties.*.type` fields you already define.
  - Example error: `Missing required argument: "message"` or `Argument "limit" must be of type number, got string`
  ([`validation.js`](src/utils/validation.js), [`mcpServer.js`](src/server/mcpServer.js))

---

## [0.3.1] — 2026-07-21

### Patch

- Re-publish to fix `bin` field packaging issue in 0.3.0 that caused the `mcp-connect` CLI command not to register on some npm versions.

---

## [0.3.0] — 2026-07-21

### Breaking Changes

- **Removed Resources and Prompts support** — the framework is now strictly tool-centric. If you were using `resources` or `prompts` in your config, remove them. This makes the API surface smaller and the codebase ~40% leaner (YAGNI).

### New Features

- **SSE / HTTP transport** (`--port` flag) — expose your MCP server over HTTP to any web client, IDE, or AI tool that supports SSE transport (Cursor, Cline, Windsurf, Claude.ai web, etc.)
- **Tunnel / relay transport** (`--tunnel` flag) — NAT-bypassing outbound tunnel so your laptop can serve remote AI clients without an open port. Includes a self-hostable `MCPRelayServer`.
- **Inspector Dashboard** — live browser UI at `GET /` showing real-time tool call logs and a mock tool executor for debugging without an AI client.
- **Bearer token auth** — protect all endpoints via `MCP_TUNNEL_TOKEN` env var or `server.tunnel.token` config.
- **CORS origin allowlist** — lock down which origins can connect via `server.cors.origins`.
- **Confirm gate** — mark any tool `confirm: true` to require a `y/N` prompt in the terminal before execution. Uses `/dev/tty` directly so it doesn't interfere with the STDIO JSON-RPC pipe.
- **AES-256-GCM end-to-end encryption** — tunnel payloads can be encrypted before leaving your machine via `server.tunnel.encryptionKey`.

### Built-in Protections (always on)

- Rate limiting: 100 requests/minute
- Tool timeout: 30 seconds
- Response size cap: 1MB
- Error sanitization: stack traces stripped before returning to AI clients
- Circular reference guard on JSON serialisation

### Upgraded

- `@modelcontextprotocol/sdk` upgraded from `^0.5.x` to `^1.29.0`

---

## [0.2.0] — Earlier

- Added basic SSE transport and dashboard prototype.

## [0.1.0] — Initial release

- STDIO-only MCP wrapper with `defineMCP()` config API.
