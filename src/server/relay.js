import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { logger } from '../utils/logger.js';

export class MCPRelayServer {
  constructor() {
    this.tunnels = new Map(); // tunnelId -> local client SSE response
    this.pendingRequests = new Map(); // requestId -> remote client HTTP response
    this.remoteSessions = new Map(); // sessionId -> remote client SSE response
  }

  async start(port) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    this.httpServer = createServer(async (req, res) => {
      if (req.method === 'OPTIONS') {
        res.writeHead(204, corsHeaders);
        res.end();
        return;
      }

      for (const [k, v] of Object.entries(corsHeaders)) {
        res.setHeader(k, v);
      }

      const url = new URL(req.url, `http://localhost:${port}`);
      const pathParts = url.pathname.split('/').filter(Boolean);

      // POST /api/register -> Register local client, return tunnelId
      if (req.method === 'POST' && url.pathname === '/api/register') {
        const tunnelId = randomUUID().substring(0, 8);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ tunnelId }));
        logger.info(`Registered new tunnel [tunnel:${tunnelId}]`);
        return;
      }

      // GET /api/tunnel/:tunnelId/stream -> Local client opens tunnel stream
      if (req.method === 'GET' && pathParts[0] === 'api' && pathParts[1] === 'tunnel' && pathParts[3] === 'stream') {
        const tunnelId = pathParts[2];
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        });
        this.tunnels.set(tunnelId, res);
        logger.info(`Local client established tunnel stream [tunnel:${tunnelId}]`);

        req.on('close', () => {
          this.tunnels.delete(tunnelId);
          logger.info(`Local client closed tunnel stream [tunnel:${tunnelId}]`);
        });
        return;
      }

      // POST /api/tunnel/:tunnelId/response -> Local client returns execution response
      if (req.method === 'POST' && pathParts[0] === 'api' && pathParts[1] === 'tunnel' && pathParts[3] === 'response') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
          try {
            const { requestId, response } = JSON.parse(body);
            const pendingRes = this.pendingRequests.get(requestId);
            if (pendingRes) {
              pendingRes.writeHead(200, { 'Content-Type': 'application/json' });
              pendingRes.end(JSON.stringify(response));
              this.pendingRequests.delete(requestId);
            } else {
              res.writeHead(404).end('Request not found or expired');
            }
          } catch (err) {
            res.writeHead(400).end('Invalid JSON');
          }
        });
        return;
      }

      // GET /t/:tunnelId/sse -> Remote client establishes SSE stream
      if (req.method === 'GET' && pathParts[0] === 't' && pathParts[2] === 'sse') {
        const tunnelId = pathParts[1];
        const sessionId = randomUUID();

        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        });
        this.remoteSessions.set(sessionId, res);

        // Send endpoint event directing remote client where to POST JSON-RPC messages
        res.write(`event: endpoint\ndata: /t/${tunnelId}/message?sessionId=${sessionId}\n\n`);
        logger.info(`Remote client connected to SSE [tunnel:${tunnelId}] [session:${sessionId}]`);

        req.on('close', () => {
          this.remoteSessions.delete(sessionId);
          logger.info(`Remote client closed SSE [session:${sessionId}]`);
        });
        return;
      }

      // POST /t/:tunnelId/message -> Remote client sends JSON-RPC message
      if (req.method === 'POST' && pathParts[0] === 't' && pathParts[2] === 'message') {
        const tunnelId = pathParts[1];
        const sessionId = url.searchParams.get('sessionId');
        const localTunnel = this.tunnels.get(tunnelId);

        if (!localTunnel) {
          res.writeHead(503).end('Local MCP server is offline');
          return;
        }

        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
          try {
            const payload = JSON.parse(body);
            const requestId = randomUUID();
            this.pendingRequests.set(requestId, res);

            // Forward the JSON-RPC call over the local client's tunnel SSE stream
            localTunnel.write(`event: rpc\ndata: ${JSON.stringify({ requestId, sessionId, payload })}\n\n`);
          } catch (err) {
            res.writeHead(400).end('Invalid JSON-RPC request');
          }
        });
        return;
      }

      res.writeHead(404).end('Not found');
    });

    await new Promise((resolve, reject) => {
      this.httpServer.listen(port, () => resolve());
      this.httpServer.on('error', reject);
    });

    logger.info(`Relay Gateway listening on port ${port}`);
    console.error(`\n  Relay Gateway running at http://localhost:${port}`);
    console.error(`  Tunnel endpoints map: http://localhost:${port}/t/:tunnelId/sse\n`);
  }

  async stop() {
    if (this.httpServer) {
      if (typeof this.httpServer.closeAllConnections === 'function') {
        this.httpServer.closeAllConnections();
      }
      await new Promise(resolve => this.httpServer.close(resolve));
    }
    for (const res of this.tunnels.values()) {
      try { res.end(); } catch { /* empty */ }
    }
    for (const res of this.remoteSessions.values()) {
      try { res.end(); } catch { /* empty */ }
    }
    this.tunnels.clear();
    this.remoteSessions.clear();
  }
}
