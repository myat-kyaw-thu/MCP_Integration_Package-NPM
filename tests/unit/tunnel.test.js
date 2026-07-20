import assert from 'node:assert/strict';
import { after, describe, it } from 'node:test';
import { MCPConnectServer } from '../../src/server/mcpServer.js';
import { MCPRelayServer } from '../../src/server/relay.js';

describe('MCP Tunnel & Security Confirmation', () => {
  const config = {
    name: 'test-secure-server',
    version: '1.0.0',
    tools: [
      {
        name: 'write_action',
        description: 'Requires approval',
        confirm: true,
        inputSchema: { type: 'object', properties: {} },
        handler: async () => 'done',
      },
    ],
  };

  let server;
  let relay;

  after(async () => {
    if (server) await server.stop();
    if (relay) await relay.stop();
  });

  it('prompts and execution succeeds if approved', async () => {
    server = new MCPConnectServer(config);
    // Stub confirmation prompt to return true (approved)
    server._promptConfirmation = async () => true;

    const result = await server._handleCallTool({
      params: { name: 'write_action', arguments: {} }
    });
    assert.deepEqual(result, {
      content: [{ type: 'text', text: 'done' }]
    });
  });

  it('prompts and execution throws error if rejected', async () => {
    server = new MCPConnectServer(config);
    // Stub confirmation prompt to return false (rejected)
    server._promptConfirmation = async () => false;

    await assert.rejects(
      server._handleCallTool({
        params: { name: 'write_action', arguments: {} }
      }),
      /Action rejected by user/
    );
  });

  it('bridges remote client calls through public relay gateway', async () => {
    // 1. Start Relay Server on free port
    relay = new MCPRelayServer();
    await relay.start(0);
    const relayAddr = relay.httpServer.address();
    const relayUrl = `http://localhost:${relayAddr.port}`;

    // 2. Start local server
    server = new MCPConnectServer(config);
    server._promptConfirmation = async () => true; // auto-approve

    // Start local client tunnel connection pointing to the relay
    const tunnelPromise = server.startTunnel(relayUrl);

    // Give connection a tiny moment to initialize
    await new Promise(resolve => setTimeout(resolve, 200));

    const tunnelId = server.tunnelId;

    // 3. Remote client establishes SSE connection on Relay
    const sseRes = await fetch(`${relayUrl}/t/${tunnelId}/sse`);
    assert.equal(sseRes.status, 200);
    assert.equal(sseRes.headers.get('content-type'), 'text/event-stream');

    const reader = sseRes.body.getReader();
    const { value } = await reader.read();
    const sseEventText = new TextDecoder().decode(value);
    assert.match(sseEventText, /event: endpoint/);
    assert.match(sseEventText, new RegExp(`/t/${tunnelId}/message`));

    // Parse out sessionId
    const match = sseEventText.match(/sessionId=([a-f0-9-]+)/);
    const sessionId = match[1];

    // 4. Remote client POSTs JSON-RPC tool call to Relay
    const postRes = await fetch(`${relayUrl}/t/${tunnelId}/message?sessionId=${sessionId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: { name: 'write_action', arguments: {} },
        id: 1,
      }),
    });

    assert.equal(postRes.status, 200);
    const responseBody = await postRes.json();
    assert.deepEqual(responseBody, {
      jsonrpc: '2.0',
      result: {
        content: [{ type: 'text', text: 'done' }]
      },
      id: 1,
    });

    await reader.cancel();
  });
});
