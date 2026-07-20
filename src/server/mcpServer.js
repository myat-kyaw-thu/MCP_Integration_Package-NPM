import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import { createServer } from 'node:http';
import { decrypt, encrypt } from '../utils/crypto.js';
import { logger } from '../utils/logger.js';
import { sanitizeErrorMessage, validateToolArguments } from '../utils/validation.js';
import { getDashboardHTML } from './dashboard.js';

const DEFAULT_TOOL_TIMEOUT = 30000;

export class MCPConnectServer {
  constructor(config) {
    this.config = config;
    this.isShuttingDown = false;
    this.requestCounts = new Map();
    this.maxRequestsPerMinute = 100;
    this.logs = [];
    this.logClients = new Set();
    this.tunnelController = null;

    this.server = new Server(
      {
        name: config.name,
        version: config.version,
        description: config.description,
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();
    this.setupGracefulShutdown();
  }

  setupGracefulShutdown() {
    const shutdown = async (signal) => {
      if (this.isShuttingDown) return;
      this.isShuttingDown = true;

      logger.serverShutdown(signal);
      try {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        process.exit(0);
      } catch (error) {
        logger.error('Error during shutdown', error);
        process.exit(1);
      }
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception', error);
      shutdown('uncaughtException');
    });
    process.on('unhandledRejection', (reason) => {
      logger.error('Unhandled rejection', reason);
      shutdown('unhandledRejection');
    });
  }

  async withTimeout(promise, timeoutMs, operation) {
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`${operation} timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    return Promise.race([promise, timeoutPromise]);
  }

  setupHandlers() {
    this._registerHandlers(this.server);
  }

  _addLogEntry(entry) {
    this.logs.push(entry);
    if (this.logs.length > 100) {
      this.logs.shift();
    }
    const eventData = `data: ${JSON.stringify(entry)}\n\n`;
    for (const client of this.logClients) {
      client.write(eventData);
    }
  }

  _handleCallTool(request) {
    const requestId = Math.random().toString(36).substring(2, 8);

    if (this.isShuttingDown) {
      throw new Error('Server is shutting down');
    }

    const currentMinute = Math.floor(Date.now() / 60000);
    const requestKey = `${currentMinute}`;
    const currentCount = this.requestCounts.get(requestKey) || 0;

    if (currentCount >= this.maxRequestsPerMinute) {
      const error = new Error(
        `Rate limit exceeded: ${this.maxRequestsPerMinute} requests per minute`
      );
      logger.traceError('tools/call', error, requestId);
      throw error;
    }

    this.requestCounts.set(requestKey, currentCount + 1);

    for (const [key] of this.requestCounts) {
      if (parseInt(key) < currentMinute - 1) {
        this.requestCounts.delete(key);
      }
    }

    const { name, arguments: args } = request.params;

    logger.traceRequest('tools/call', { name, args }, requestId);

    if (!name || typeof name !== 'string') {
      const error = new Error('Tool name is required and must be a string');
      logger.traceError('tools/call', error, requestId);
      throw error;
    }

    const tool = this.config.tools.find((t) => t.name === name);
    if (!tool) {
      const error = new Error(
        `Tool "${name}" not found. Available tools: ${this.config.tools.map((t) => t.name).join(', ')}`
      );
      logger.traceError('tools/call', error, requestId);
      throw error;
    }

    const startTime = Date.now();
    logger.toolExecutionStart(name, args, requestId);

    return (async () => {
      try {
        if (tool.confirm) {
          const allowed = await this._promptConfirmation(`Allow tool "${name}" execution?`);
          if (!allowed) {
            throw new Error('Action rejected by user');
          }
        }
        const validatedArgs = validateToolArguments(args);

        const toolPromise = Promise.resolve(tool.handler(validatedArgs));
        const result = await logger.timeAsync(
          `Tool "${name}" execution`,
          this.withTimeout(toolPromise, DEFAULT_TOOL_TIMEOUT, `Tool "${name}" execution`),
          name
        );

        let content;
        const MAX_RESPONSE_SIZE = 1024 * 1024;

        if (typeof result === 'string') {
          content = result;
        } else if (result === null || result === undefined) {
          content = 'null';
        } else {
          try {
            const jsonString = JSON.stringify(result, (key, value) => {
              if (typeof value === 'object' && value !== null) {
                if (this.seenObjects && this.seenObjects.has(value)) {
                  return '[Circular Reference]';
                }
                if (!this.seenObjects) this.seenObjects = new WeakSet();
                this.seenObjects.add(value);
              }
              return value;
            }, 2);

            this.seenObjects = null;

            content = jsonString;
          } catch (jsonError) {
            logger.warn(`JSON serialization failed for tool "${name}"`, jsonError);
            content = String(result);
          }
        }

        if (content.length > MAX_RESPONSE_SIZE) {
          const truncated = content.substring(0, MAX_RESPONSE_SIZE - 100);
          content = truncated + '\n\n[Response truncated - exceeded 1MB limit]';
          logger.warn(`Tool "${name}" response truncated`, {
            originalSize: content.length,
            truncatedSize: MAX_RESPONSE_SIZE,
          });
        }

        const duration = Date.now() - startTime;
        logger.toolExecutionEnd(name, duration, requestId);
        logger.traceResponse('tools/call', { content }, requestId);

        this._addLogEntry({
          timestamp: new Date().toISOString(),
          tool: name,
          args,
          response: content,
          duration,
          error: null,
        });

        return {
          content: [
            {
              type: 'text',
              text: content,
            },
          ],
        };
      } catch (error) {
        const duration = Date.now() - startTime;
        logger.toolExecutionError(name, error, duration, requestId);
        logger.traceError('tools/call', error, requestId);

        const sanitizedMessage = sanitizeErrorMessage(error);
        this._addLogEntry({
          timestamp: new Date().toISOString(),
          tool: name,
          args,
          response: null,
          duration,
          error: sanitizedMessage,
        });
        throw new Error(`Tool "${name}" failed: ${sanitizedMessage}`);
      }
    })();
  }


  async start() {
    try {
      const transport = new StdioServerTransport();

      transport.onclose = () => {
        if (!this.isShuttingDown) {
          logger.warn('STDIO transport closed unexpectedly - AI client may have disconnected');
          logger.info('This is normal when Claude Desktop or other MCP clients disconnect');
        }
      };

      transport.onerror = (error) => {
        logger.error('STDIO transport error', error);

        if (error && typeof error === 'object') {
          const errorStr = error.toString();

          if (errorStr.includes('EPIPE') || errorStr.includes('broken pipe')) {
            logger.error('Broken pipe - AI client disconnected abruptly');
            logger.info('Restart the MCP server and reconnect your AI client');
          } else if (errorStr.includes('ECONNRESET')) {
            logger.error('Connection reset - AI client closed connection');
            logger.info('This is normal during AI client restart');
          } else if (errorStr.includes('parse') || errorStr.includes('JSON')) {
            logger.error('JSON parsing error - malformed message received');
            logger.info('Check AI client MCP implementation');
          }
        }
      };

      process.stdin.on('error', (error) => {
        if (!this.isShuttingDown) {
          logger.error('STDIN error', error);
          logger.info('STDIN pipe broken - AI client may have disconnected');
        }
      });

      process.stdout.on('error', (error) => {
        if (!this.isShuttingDown) {
          logger.error('STDOUT error', error);
          logger.info('STDOUT pipe broken - cannot send responses to AI client');
        }
      });

      await this.server.connect(transport);
      logger.serverStarted(this.config.name, 'STDIO', this.config.tools.length);
    } catch (error) {
      this._handleStartError(error);
      throw error;
    }
  }

  async startSSE(port) {
    const sessions = new Map();

    // -- CORS origin allowlist ---------------------------------------------------
    const allowedOrigins = this.config.server?.cors?.origins;   // string[] | undefined
    const hasCorsAllowlist = Array.isArray(allowedOrigins) && allowedOrigins.length > 0;

    // -- Auth token enforcement --------------------------------------------------
    const serverToken =
      process.env.MCP_TUNNEL_TOKEN ||
      this.config.server?.tunnel?.token ||
      null;

    const _checkAuth = (req, res) => {
      if (!serverToken) return true;  // no token configured → open
      const authHeader = req.headers['authorization'] || '';
      const provided = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
      if (provided !== serverToken) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unauthorized: invalid or missing token' }));
        return false;
      }
      return true;
    };

    this.httpServer = createServer(async (req, res) => {
      const origin = req.headers['origin'] || '';

      // -- Dynamic CORS header based on allowlist --------------------------------
      let allowOriginValue = '*';
      if (hasCorsAllowlist) {
        allowOriginValue = allowedOrigins.includes(origin) ? origin : 'null';
      }

      const corsHeaders = {
        'Access-Control-Allow-Origin': allowOriginValue,
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Vary': 'Origin',
      };

      if (req.method === 'OPTIONS') {
        res.writeHead(204, corsHeaders);
        res.end();
        return;
      }

      for (const [k, v] of Object.entries(corsHeaders)) {
        res.setHeader(k, v);
      }

      // Reject requests from disallowed origins (non-simple requests only)
      if (hasCorsAllowlist && origin && allowOriginValue === 'null') {
        res.writeHead(403).end('Origin not allowed');
        return;
      }

      const url = new URL(req.url, `http://localhost:${port}`);

      if (req.method === 'GET' && url.pathname === '/sse') {
        if (!_checkAuth(req, res)) return;
        const transport = new SSEServerTransport('/message', res);
        sessions.set(transport.sessionId, transport);

        transport.onclose = () => {
          sessions.delete(transport.sessionId);
          logger.info(`SSE client disconnected [session:${transport.sessionId}]`);
        };

        transport.onerror = (error) => {
          logger.error('SSE transport error', error);
        };

        const sessionServer = new Server(
          { name: this.config.name, version: this.config.version },
          {
            capabilities: {
              tools: {},
              resources: {},
              prompts: {}
            }
          }
        );
        this._registerHandlers(sessionServer);
        await sessionServer.connect(transport);

        logger.info(`SSE client connected [session:${transport.sessionId}]`);
        return;
      }

      if (req.method === 'POST' && url.pathname === '/message') {
        if (!_checkAuth(req, res)) return;
        const sessionId = url.searchParams.get('sessionId');
        const transport = sessions.get(sessionId);

        if (!transport) {
          res.writeHead(400).end('Unknown or expired session');
          return;
        }

        await transport.handlePostMessage(req, res);
        return;
      }

      // GET /api/events -> Server-Sent Events stream for inspector log updates
      if (req.method === 'GET' && url.pathname === '/api/events') {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        });
        this.logClients.add(res);

        // Instantly catch up with existing buffered logs
        for (const log of this.logs) {
          res.write(`data: ${JSON.stringify(log)}\n\n`);
        }

        req.on('close', () => {
          this.logClients.delete(res);
        });
        return;
      }

      // POST /api/test -> Mock Tool executor for debug console testing
      if (req.method === 'POST' && url.pathname === '/api/test') {
        let rawBody = '';
        req.on('data', chunk => { rawBody += chunk; });
        req.on('end', async () => {
          try {
            const body = JSON.parse(rawBody);
            const { tool, args } = body;
            const result = await this._handleCallTool({
              params: {
                name: tool,
                arguments: args,
              },
            });
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
          } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
          }
        });
        return;
      }

      // Health check JSON endpoint
      if (req.method === 'GET' && url.pathname === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          name: this.config.name,
          version: this.config.version,
          status: 'ok',
          transport: 'sse',
          tools: this.config.tools.map(t => t.name),
          resources: (this.config.resources || []).map(r => ({ uri: r.uri, name: r.name })),
          prompts: (this.config.prompts || []).map(p => p.name),
        }));
        return;
      }

      // Dashboard interface
      if (req.method === 'GET' && url.pathname === '/') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(getDashboardHTML(this.config.name, this.config.tools));
        return;
      }

      res.writeHead(404).end('Not found');
    });

    try {
      await new Promise((resolve, reject) => {
        this.httpServer.listen(port, () => resolve());
        this.httpServer.on('error', reject);
      });
      logger.serverStarted(this.config.name, `SSE (http://localhost:${port}/sse)`, this.config.tools.length);
      console.error(`\n  MCP server running at http://localhost:${port}/sse`);
      console.error(`  Dashboard Console:   http://localhost:${port}/`);
      console.error(`  Health check:        http://localhost:${port}/health\n`);
    } catch (error) {
      this._handleStartError(error);
      throw error;
    }
  }

  _registerHandlers(server) {
    server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: this.config.tools.map((tool) => ({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema,
        })),
      };
    });

    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      return this._handleCallTool(request);
    });
  }

  _handleStartError(error) {
    logger.error('Failed to start MCP server', error);

    if (error instanceof Error) {
      const errorMsg = error.message;

      if (errorMsg.includes('EACCES')) {
        logger.error('❌ Permission denied');
        logger.info('💡 Try running with elevated permissions or check file/directory access');
      } else if (errorMsg.includes('ENOENT')) {
        logger.error('❌ File or directory not found');
        logger.info('💡 Check your configuration file path and working directory');
      } else if (errorMsg.includes('EADDRINUSE')) {
        logger.error('❌ Address already in use');
        logger.info('💡 Another MCP server may be running. Stop it first');
      } else if (errorMsg.includes('MODULE_NOT_FOUND')) {
        logger.error('❌ Module not found');
        logger.info('💡 Run: npm install @myatkyawthu/mcp-connect');
      } else if (errorMsg.includes('Cannot resolve')) {
        logger.error('❌ Import resolution failed');
        logger.info('💡 Check your import paths in mcp.config.js');
      }
    }
  }

  async startTunnel(relayUrl) {
    this.tunnelController = new AbortController();
    while (!this.isShuttingDown) {
      try {
        const regRes = await fetch(`${relayUrl}/api/register`, {
          method: 'POST',
          signal: this.tunnelController.signal,
        });
        if (!regRes.ok) throw new Error(`Registration failed: ${regRes.statusText}`);
        const { tunnelId } = await regRes.json();
        this.tunnelId = tunnelId;

        logger.info(`Established secure tunnel bridge [tunnel:${tunnelId}]`);
        console.error('\n  MCP Tunnel bridge active!');
        console.error(`  Remote SSE endpoint: ${relayUrl}/t/${tunnelId}/sse\n`);

        const tunnelToken = process.env.MCP_TUNNEL_TOKEN || this.config.server?.tunnel?.token || null;
        const tunnelHeaders = { 'Accept': 'text/event-stream' };
        if (tunnelToken) tunnelHeaders['Authorization'] = `Bearer ${tunnelToken}`;

        const res = await fetch(`${relayUrl}/api/tunnel/${tunnelId}/stream`, {
          headers: tunnelHeaders,
          signal: this.tunnelController.signal,
        });

        if (!res.ok) throw new Error(`Tunnel stream failed: ${res.statusText}`);

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (!this.isShuttingDown) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split('\n\n');
          buffer = parts.pop();

          for (const part of parts) {
            await this._parseAndHandleTunnelEvent(part, relayUrl, tunnelId);
          }
        }
      } catch (err) {
        if (this.isShuttingDown) break;
        logger.error('Tunnel bridge connection dropped. Reconnecting in 5s...', err);
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
  }

  async _parseAndHandleTunnelEvent(part, relayUrl, tunnelId) {
    const lines = part.split('\n');
    let eventType = '';
    let dataStr = '';

    for (const line of lines) {
      if (line.startsWith('event:')) {
        eventType = line.slice(6).trim();
      } else if (line.startsWith('data:')) {
        dataStr = line.slice(5).trim();
      }
    }

    if (eventType === 'rpc' && dataStr) {
      try {
        const encKey = this.config.server?.tunnel?.encryptionKey;
        const rawData = encKey ? decrypt(dataStr, encKey) : dataStr;
        const { requestId, payload } = JSON.parse(rawData);
        let responsePayload;

        if (payload.method === 'tools/list') {
          const tools = this.config.tools.map((tool) => ({
            name: tool.name,
            description: tool.description,
            inputSchema: tool.inputSchema,
          }));
          responsePayload = { jsonrpc: '2.0', result: { tools }, id: payload.id };
        } else if (payload.method === 'tools/call') {
          try {
            const result = await this._handleCallTool({ params: payload.params });
            responsePayload = { jsonrpc: '2.0', result, id: payload.id };
          } catch (err) {
            responsePayload = { jsonrpc: '2.0', error: { code: -32000, message: err.message }, id: payload.id };
          }
        } else {
          responsePayload = { jsonrpc: '2.0', error: { code: -32601, message: `Method not found: ${payload.method}` }, id: payload.id };
        }

        const responseBody = JSON.stringify({ requestId, response: responsePayload });
        const sendBody = encKey ? encrypt(responseBody, encKey) : responseBody;
        const sendContentType = encKey ? 'text/plain' : 'application/json';

        await fetch(`${relayUrl}/api/tunnel/${tunnelId}/response`, {
          method: 'POST',
          headers: { 'Content-Type': sendContentType },
          body: sendBody,
        });
      } catch (err) {
        logger.error('Error handling tunnel event', err);
      }
    }
  }

  async _promptConfirmation(message) {
    const fs = await import('node:fs');
    return new Promise((resolve) => {
      process.stderr.write(`\n⚠️  [MCP SECURITY] ${message} (y/N): `);
      let fd;
      try {
        const dev = process.platform === 'win32' ? '\\\\.\\CON' : '/dev/tty';
        fd = fs.openSync(dev, 'r');
        const buffer = Buffer.alloc(10);
        const bytesRead = fs.readSync(fd, buffer, 0, 10, null);
        const response = buffer.toString('utf8', 0, bytesRead).trim().toLowerCase();
        resolve(response === 'y' || response === 'yes');
      } catch (err) {
        logger.warn('Failed to prompt for confirmation, defaulting to reject', err);
        resolve(false);
      } finally {
        if (fd !== undefined) {
          try { fs.closeSync(fd); } catch { /* empty */ }
        }
      }
    });
  }

  async stop() {
    this.isShuttingDown = true;
    if (this.tunnelController) {
      this.tunnelController.abort();
    }
    if (this.httpServer) {
      this.httpServer.close();
      if (typeof this.httpServer.closeAllConnections === 'function') {
        this.httpServer.closeAllConnections();
      }
    }
    logger.info('MCP server stopped');
  }
}
