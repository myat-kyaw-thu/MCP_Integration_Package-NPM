import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { logger } from '../utils/logger.js';
import { sanitizeErrorMessage, validateToolArguments } from '../utils/validation.js';

const DEFAULT_TOOL_TIMEOUT = 30000;

export class MCPConnectServer {
  constructor(config) {
    this.config = config;
    this.isShuttingDown = false;
    this.requestCounts = new Map();
    this.maxRequestsPerMinute = 100;

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
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: this.config.tools.map((tool) => ({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema,
        })),
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
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

      try {
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
        throw new Error(`Tool "${name}" failed: ${sanitizedMessage}`);
      }
    });
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

      throw error;
    }
  }

  async stop() {
    this.isShuttingDown = true;
    logger.info('MCP server stopped');
  }
}
