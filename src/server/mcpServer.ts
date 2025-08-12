import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import type { MCPConfig } from "../types/mcp.js";
import { logger } from '../utils/logger.js';
import { sanitizeErrorMessage, validateToolArguments } from '../utils/validation.js';

// Default timeout for tool execution (30 seconds)
const DEFAULT_TOOL_TIMEOUT = 30000;

export class MCPConnectServer {
  private server: Server;
  private config: MCPConfig;
  private isShuttingDown = false;

  constructor(config: MCPConfig) {
    this.config = config;
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

  private setupGracefulShutdown() {
    const shutdown = async (signal: string) => {
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
      logger.error("Unccaught exeption", error);
      shutdown("uncaughtException");
    });
    process.on("unhandledRejection", (reason) => {
      logger.error("Unhandled rejection", reason);
      shutdown("unhandledRejection");
    });
  }

  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number, operation: string): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`${operation} timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    return Promise.race([promise, timeoutPromise]);
  }

  private setupHandlers() {
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
        let content: string;
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

  async start() {
    try {
      if (this.config.transport === "stdio") {
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
      } else {
        throw new Error("Only STDIO transport is currently supported");
      }
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
}
