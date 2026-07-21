/**
 * mcp.test-all.js
 * A single config that exercises every feature of @myatkyawthu/mcp-connect.
 * Run it in different modes to test each feature (see LOCAL_TEST_GUIDE.md).
 */
import { defineMCP } from '../src/index.js';

export default defineMCP({
  name: 'mcp-connect-feature-test',
  version: '1.0.0',
  description: 'Full feature test server',

  // ── Section 3: Server config block ───────────────────────────────────────
  server: {
    // Uncomment to test config-driven port (instead of --port flag):
    // port: 3111,

    // Uncomment to test CORS allowlist (only claude.ai and localhost allowed):
    // cors: {
    //   origins: ['https://claude.ai', 'http://localhost:5173'],
    // },

    tunnel: {
      // Uncomment to enable tunneling via config instead of --tunnel flag:
      // enabled: true,
      // relayUrl: 'http://localhost:4000',

      // Uncomment to enable auth token (also set MCP_TUNNEL_TOKEN env var):
      // token: 'my-super-secret-token',

      // Uncomment to enable E2E encryption:
      // encryptionKey: 'my-32-byte-or-longer-passphrase!!',
    },
  },

  tools: [
    // ── Feature 1: Simple tuple tool ─────────────────────────────────────
    ['hello', async ({ name = 'World' }) => `Hello, ${name}!`],

    // ── Feature 2: Object tool with schema ───────────────────────────────
    {
      name: 'echo',
      description: 'Echoes the message back',
      schema: {
        type: 'object',
        properties: {
          message: { type: 'string', description: 'Message to echo' },
        },
        required: ['message'],
      },
      handler: async ({ message }) => `Echo: ${message}`,
    },

    // ── Feature 3: Async tool (simulates real work) ───────────────────────
    {
      name: 'wait',
      description: 'Waits N milliseconds then returns',
      schema: {
        type: 'object',
        properties: {
          ms: { type: 'number', description: 'Milliseconds to wait' },
        },
      },
      handler: async ({ ms = 500 }) => {
        await new Promise(r => setTimeout(r, ms));
        return `Done after ${ms}ms`;
      },
    },

    // ── Feature 4: Tool that returns structured JSON ───────────────────────
    {
      name: 'get_info',
      description: 'Returns server info as JSON',
      schema: { type: 'object', properties: {} },
      handler: async () => ({
        server: 'mcp-connect-feature-test',
        node: process.version,
        platform: process.platform,
        uptime: process.uptime().toFixed(1) + 's',
      }),
    },

    // ── Feature 5: CONFIRM tool (requires interactive approval) ───────────
    {
      name: 'delete_data',
      description: 'Simulates a destructive operation — requires console approval',
      confirm: true,   // <── triggers _promptConfirmation()
      schema: {
        type: 'object',
        properties: {
          target: { type: 'string', description: 'What to delete' },
        },
        required: ['target'],
      },
      handler: async ({ target }) => `Deleted: ${target}`,
    },
  ],
});
