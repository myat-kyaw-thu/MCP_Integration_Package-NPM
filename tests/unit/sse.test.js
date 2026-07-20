import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { MCPConnectServer } from '../../src/server/mcpServer.js';

describe('MCPConnectServer SSE transport', () => {
  const config = {
    name: 'test-server',
    version: '1.0.0',
    tools: [
      {
        name: 'ping',
        description: 'Returns pong',
        inputSchema: { type: 'object', properties: {} },
        handler: async () => 'pong',
      },
    ],
  };

  let server;

  after(async () => {
    if (server) await server.stop();
  });

  it('starts SSE server and responds to /health', async () => {
    server = new MCPConnectServer(config);
    await server.startSSE(0); // port 0 = OS picks a free port

    const addr = server.httpServer.address();
    const res = await fetch(`http://localhost:${addr.port}/health`);
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.name, 'test-server');
    assert.equal(body.status, 'ok');
    assert.deepEqual(body.tools, ['ping']);
  });

  it('returns 404 for unknown paths', async () => {
    const addr = server.httpServer.address();
    const res = await fetch(`http://localhost:${addr.port}/nope`);
    assert.equal(res.status, 404);
  });
});
