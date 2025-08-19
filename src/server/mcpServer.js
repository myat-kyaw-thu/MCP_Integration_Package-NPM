import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { logger } from '../utils/logger.js';
import { sanitizeErrorMessage, validateToolArguments } from '../utils/validation.js';

// Default timeout for tool execution (30 seconds)
const DEFAULT_TOOL_TIMEOUT = 30000;

/**
 * MCP Connect Server class
 */
export class MCPConnectServer {
  /**
   * Create MCP Connect Server
   * @param {import('../types/mcp.js').MCPConfig} config - MCP configuration
   */
  constructor(config) {
    /** @type {import('../types/mcp.js').MCPConfig} */
    this.config = config;
    /** @type {boolean} */
    this.isShuttingDown = false;
    /** @type {Map<string, number>} */
    this.requestCounts = new Map();
    /** @type {number} */
    this.maxRequestsPerMinute = 100; // Simple rate limiting

    // Create MCP SDK server for STDIO transport
    /** @type {Server} */
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

  /**
   * Set up graceful shutdown handlers
   */
  setupGracefulShutdown() {
    /**
     * Shutdown handler
     * @param {string} signal - Shutdown signal
     */
    const shutdown = async (signal) => {
      if (this.isShuttingDown) return;
      this.isShuttingDown = true;

      logger.serverShutdown(signal);
      try {
        // Give ongoing operations a chance to complete
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

  /**
   * Execute promise with timeout
   * @template T
   * @param {Promise<T>} promise - Promise to execute
   * @param {number} timeoutMs - Timeout in milliseconds
   * @param {string} operation - Operation name for error messages
   * @returns {Promise<T>} Promise that resolves or rejects with timeout
   */
  async withTimeout(promise, timeoutMs, operation) {
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`${operation} timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    return Promise.race([promise, timeoutPromise]);
  }

  /**
   * Set up MCP request handlers
   */
  setupHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: this.config.tools.map((tool) => ({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema,
        })),
      };
    });

    // Execute tool calls with proper error handling and timeout
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const requestId = Math.random().toString(36).substring(2, 8);

      if (this.isShuttingDown) {
        throw new Error('Server is shutting down');
      }

      // Simple rate limiting protection
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

      // Clean up old request counts (keep only current and previous minute)
      for (const [key] of this.requestCounts) {
        if (parseInt(key) < currentMinute - 1) {
          this.requestCounts.delete(key);
        }
      }

      const { name, arguments: args } = request.params;

      // Log incoming request
      logger.traceRequest('tools/call', { name, args }, requestId);

      // Validate request
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
        // Validate and sanitize arguments
        const validatedArgs = validateToolArguments(args);

        // Execute tool with timeout and performance tracking
        const toolPromise = Promise.resolve(tool.handler(validatedArgs));
        const result = await logger.timeAsync(
          `Tool "${name}" execution`,
          this.withTimeout(toolPromise, DEFAULT_TOOL_TIMEOUT, `Tool "${name}" execution`),
          name
        );

        // Handle different result types with size limits
        let content;
        const MAX_RESPONSE_SIZE = 1024 * 1024; // 1MB limit

        if (typeof result === 'string') {
          content = result;
        } else if (result === null || result === undefined) {
          content = 'null';
        } else {
          try {
            // Handle circular references and large objects
            const jsonString = JSON.stringify(
              result,
              (key, value) => {
                // Handle circular references
                if (typeof value === 'object' && value !== null) {
                  if (this.seenObjects && this.seenObjects.has(value)) {
                    return '[Circular Reference]';
                  }
                  if (!this.seenObjects) this.seenObjects = new WeakSet();
                  this.seenObjects.add(value);
                }
                return value;
              },
              2
            );

            // Reset circular reference tracker
            this.seenObjects = null;

            content = jsonString;
          } catch (jsonError) {
            logger.warn(`JSON serialization failed for tool "${name}"`, jsonError);
            content = String(result);
          }
        }

        // Check response size and truncate if necessary
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

        // Return MCP-compliant error with sanitized message
        const sanitizedMessage = sanitizeErrorMessage(error);
        throw new Error(`Tool "${name}" failed: ${sanitizedMessage}`);
      }
    });
  }

  /**
   * Start the MCP server with STDIO transport
   * @returns {Promise<void>} Promise that resolves when server starts
   * @throws {Error} If server fails to start
   */
  async start() {
    try {
      const transport = new StdioServerTransport();

      // Enhanced error handling for transport
      transport.onclose = () => {
        if (!this.isShuttingDown) {
          logger.warn('STDIO transport closed unexpectedly - AI client may have disconnected');
          logger.info('This is normal when Claude Desktop or other MCP clients disconnect');
        }
      };

      transport.onerror = (error) => {
        logger.error('STDIO transport error', error);

        // Provide helpful guidance for common transport errors
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

      // Handle process stdio errors
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

      // Enhanced error guidance
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

  /**
   * Stop the MCP server
   * @returns {Promise<void>} Promise that resolves when server stops
   */
  async stop() {
    this.isShuttingDown = true;
    // STDIO transport doesn't need explicit stopping
    logger.info('MCP server stopped');
  }
}
