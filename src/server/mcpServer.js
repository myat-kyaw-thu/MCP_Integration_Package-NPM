import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { logger } from '../utils/logger.js';
import { sanitizeErrorMessage, validateToolArguments } from '../utils/validation.js';

// Default timeout for tool execution (30 seconds)
const DEFAULT_TOOL_TIMEOUT = 30000;

/**
 * MCP Connect Server class
 * Handles MCP protocol communication and tool execution
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
      },
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
        await new Promise(resolve => setTimeout(resolve, 1000));
        process.exit(0);
      } catch (error) {
        logger.error("Error during shutdown", error);
        process.exit(1);
      }
    };

    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("uncaughtException", (error) => {
      logger.error("Uncaught exception", error);
      shutdown("uncaughtException");
    });
    process.on("unhandledRejection", (reason) => {
      logger.error("Unhandled rejection", reason);
      shutdown("unhandledRejection");
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
        throw new Error("Server is shutting down");
      }

      const { name, arguments: args } = request.params;

      // Log incoming request
      logger.traceRequest("tools/call", { name, args }, requestId);

      // Validate request
      if (!name || typeof name !== "string") {
        const error = new Error("Tool name is required and must be a string");
        logger.traceError("tools/call", error, requestId);
        throw error;
      }

      const tool = this.config.tools.find((t) => t.name === name);
      if (!tool) {
        const error = new Error(`Tool "${name}" not found. Available tools: ${this.config.tools.map(t => t.name).join(", ")}`);
        logger.traceError("tools/call", error, requestId);
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

        // Handle different result types
        let content;
        if (typeof result === "string") {
          content = result;
        } else if (result === null || result === undefined) {
          content = "null";
        } else {
          try {
            content = JSON.stringify(result, null, 2);
          } catch (jsonError) {
            content = String(result);
          }
        }

        const duration = Date.now() - startTime;
        logger.toolExecutionEnd(name, duration, requestId);
        logger.traceResponse("tools/call", { content }, requestId);

        return {
          content: [
            {
              type: "text",
              text: content,
            },
          ],
        };
      } catch (error) {
        const duration = Date.now() - startTime;
        logger.toolExecutionError(name, error, duration, requestId);
        logger.traceError("tools/call", error, requestId);

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

      // Add error handling for transport
      transport.onclose = () => {
        if (!this.isShuttingDown) {
          logger.warn("STDIO transport closed unexpectedly");
        }
      };

      transport.onerror = (error) => {
        logger.error("STDIO transport error", error);
      };

      await this.server.connect(transport);
      logger.serverStarted(this.config.name, "STDIO", this.config.tools.length);
    } catch (error) {
      logger.error("Failed to start MCP server", error);

      if (error instanceof Error && error.message.includes("EACCES")) {
        logger.error("Permission denied. Check file/directory permissions.");
      } else if (error instanceof Error && error.message.includes("ENOENT")) {
        logger.error("File or directory not found. Check your configuration.");
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
    logger.info("MCP server stopped");
  }
}