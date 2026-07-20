import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { encrypt, decrypt } from '../../src/utils/crypto.js';
import { MCPConnectServer } from '../../src/server/mcpServer.js';

// ─── Crypto helpers ──────────────────────────────────────────────────────────

describe('E2E crypto helpers', () => {
  const KEY = 'my-super-secret-32-byte-passphrase!!';

  it('encrypt + decrypt round-trip with string key', () => {
    const original = JSON.stringify({ method: 'tools/call', params: { name: 'echo' } });
    const blob = encrypt(original, KEY);
    assert.ok(typeof blob === 'string', 'should return base64 string');
    assert.notEqual(blob, original, 'cipher must differ from plaintext');
    const plain = decrypt(blob, KEY);
    assert.equal(plain, original, 'round-trip must be lossless');
  });

  it('encrypt + decrypt with 64-char hex key', () => {
    const hexKey = 'a'.repeat(64); // valid 64-char hex
    const msg = 'hello encrypted world';
    assert.equal(decrypt(encrypt(msg, hexKey), hexKey), msg);
  });

  it('tampered ciphertext throws during decrypt', () => {
    const blob = encrypt('safe payload', KEY);
    const tampered = blob.slice(0, -4) + 'XXXX'; // corrupt last bytes
    assert.throws(() => decrypt(tampered, KEY), /Unsupported state|bad decrypt|authentication/i);
  });
});

// ─── CORS origin allowlist ────────────────────────────────────────────────────

describe('CORS origin filtering', () => {
  const makeServer = (origins) => new MCPConnectServer({
    name: 'cors-test', version: '1.0.0',
    server: { cors: { origins } },
    tools: [],
  });

  it('allows wildcard (*) by default when no allowlist set', async () => {
    const srv = makeServer(undefined);
    await srv.startSSE(0);
    const { port } = srv.httpServer.address();

    const res = await fetch(`http://localhost:${port}/health`, {
      headers: { Origin: 'https://evil.com' },
    });
    assert.equal(res.headers.get('access-control-allow-origin'), '*');
    await srv.stop();
  });

  it('reflects allowed origin when in allowlist', async () => {
    const srv = makeServer(['https://claude.ai']);
    await srv.startSSE(0);
    const { port } = srv.httpServer.address();

    const res = await fetch(`http://localhost:${port}/health`, {
      headers: { Origin: 'https://claude.ai' },
    });
    assert.equal(res.headers.get('access-control-allow-origin'), 'https://claude.ai');
    await srv.stop();
  });

  it('rejects requests from disallowed origin with 403', async () => {
    const srv = makeServer(['https://claude.ai']);
    await srv.startSSE(0);
    const { port } = srv.httpServer.address();

    const res = await fetch(`http://localhost:${port}/health`, {
      headers: { Origin: 'https://evil.com' },
    });
    assert.equal(res.status, 403);
    await srv.stop();
  });
});

// ─── Auth token enforcement ───────────────────────────────────────────────────

describe('Auth token enforcement', () => {
  const makeServer = (token) => new MCPConnectServer({
    name: 'auth-test', version: '1.0.0',
    server: { tunnel: { token } },
    tools: [{ name: 'ping', description: 'ping', inputSchema: { type: 'object', properties: {} }, handler: async () => 'pong' }],
  });

  it('allows requests with no token configured', async () => {
    const srv = makeServer(undefined);
    await srv.startSSE(0);
    const { port } = srv.httpServer.address();

    const res = await fetch(`http://localhost:${port}/health`);
    assert.equal(res.status, 200);
    await srv.stop();
  });

  it('rejects /sse without Bearer token when token is configured', async () => {
    const srv = makeServer('secret-abc');
    await srv.startSSE(0);
    const { port } = srv.httpServer.address();

    const res = await fetch(`http://localhost:${port}/health`);
    // health endpoint does NOT require auth
    assert.equal(res.status, 200);

    // SSE endpoint requires auth
    const sseRes = await fetch(`http://localhost:${port}/sse`);
    assert.equal(sseRes.status, 401);
    await srv.stop();
  });

  it('allows /sse with correct Bearer token', async () => {
    const srv = makeServer('secret-abc');
    await srv.startSSE(0);
    const { port } = srv.httpServer.address();

    const controller = new AbortController();
    setTimeout(() => controller.abort(), 500);

    try {
      const res = await fetch(`http://localhost:${port}/sse`, {
        headers: { Authorization: 'Bearer secret-abc' },
        signal: controller.signal,
      });
      assert.equal(res.status, 200);
      assert.equal(res.headers.get('content-type'), 'text/event-stream');
    } catch (err) {
      // AbortError is fine — we just needed to verify status 200
      if (err.name !== 'AbortError') throw err;
    }
    await srv.stop();
  });

  it('rejects /sse with wrong token', async () => {
    const srv = makeServer('secret-abc');
    await srv.startSSE(0);
    const { port } = srv.httpServer.address();

    const sseRes = await fetch(`http://localhost:${port}/sse`, {
      headers: { Authorization: 'Bearer wrong-token' },
    });
    assert.equal(sseRes.status, 401);
    await srv.stop();
  });
});
