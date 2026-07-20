import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { MCPConnectServer } from '../../src/server/mcpServer.js';

describe('MCP Inspector Dashboard', () => {
  const config = {
    name: 'test-dashboard-server',
    version: '1.0.0',
    tools: [
      {
        name: 'echo',
        description: 'Echoes message',
        inputSchema: {
          type: 'object',
          properties: { msg: { type: 'string' } },
        },
        handler: async ({ msg }) => `Echo: ${msg}`,
      },
    ],
  };

  let server;

  after(async () => {
    if (server) await server.stop();
  });

  it('serves dashboard HTML at GET /', async () => {
    server = new MCPConnectServer(config);
    await server.startSSE(0);
    const addr = server.httpServer.address();

    const res = await fetch(`http://localhost:${addr.port}/`);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-type'), 'text/html');
    const text = await res.text();
    assert.match(text, /MCP Inspector/);
    assert.match(text, /test-dashboard-server/);
  });

  it('handles tool execution via POST /api/test', async () => {
    const addr = server.httpServer.address();

    const res = await fetch(`http://localhost:${addr.port}/api/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tool: 'echo', args: { msg: 'hello' } }),
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.deepEqual(body, {
      content: [{ type: 'text', text: 'Echo: hello' }],
    });
  });

  it('streams logs to GET /api/events', async () => {
    const addr = server.httpServer.address();

    // Call /api/test to generate one log entry in the buffer
    await fetch(`http://localhost:${addr.port}/api/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tool: 'echo', args: { msg: 'verify-logs' } }),
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1000);

    try {
      const res = await fetch(`http://localhost:${addr.port}/api/events`, {
        signal: controller.signal,
      });
      assert.equal(res.status, 200);
      assert.equal(res.headers.get('content-type'), 'text/event-stream');

      const reader = res.body.getReader();
      const { value } = await reader.read();
      const text = new TextDecoder().decode(value);
      assert.match(text, /data:/);
      assert.match(text, /verify-logs/);
      await reader.cancel();
    } finally {
      clearTimeout(timeout);
    }
  });
});
