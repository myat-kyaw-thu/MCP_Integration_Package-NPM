/**
 * Enhanced structured logger for MCP-Connect
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

interface LogContext {
  timestamp: string;
  level: LogLevel;
  message: string;
  data?: any;
  duration?: number;
  toolName?: string;
  requestId?: string;
}

class MCPLogger {
  private logLevel: LogLevel;
  private debugMode: boolean;
  private performanceTracking: boolean;

  constructor() {
    this.debugMode = process.env.MCP_DEBUG === "1" || process.env.MCP_DEBUG === "true";
    this.performanceTracking = process.env.MCP_PERF === "1" || process.env.MCP_PERF === "true" || this.debugMode;

    // Set log level based on environment
    if (this.debugMode) {
      this.logLevel = "debug";
    } else if (process.env.MCP_LOG_LEVEL) {
      this.logLevel = process.env.MCP_LOG_LEVEL as LogLevel;
    } else {
      this.logLevel = "info";
    }
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: Record<LogLevel, number> = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3,
    };
    return levels[level] >= levels[this.logLevel];
  }

  private formatLog(context: LogContext): string {
    const { timestamp, level, message, data, duration, toolName, requestId } = context;

    let logMessage = `[MCP-${level.toUpperCase()}] ${timestamp} ${message}`;

    if (toolName) {
      logMessage += ` [tool:${toolName}]`;
    }

    if (requestId) {
      logMessage += ` [req:${requestId}]`;
    }

    if (duration !== undefined) {
      logMessage += ` (${duration}ms)`;
    }

    return logMessage;
  }

  private log(level: LogLevel, message: string, data?: any, meta?: { duration?: number; toolName?: string; requestId?: string; }) {
    if (!this.shouldLog(level)) return;

    const context: LogContext = {
      timestamp: new Date().toISOString(),
      level,
      message,
      data,
      ...meta,
    };

    const logMessage = this.formatLog(context);

    // Output to appropriate stream
    const output = level === "error" ? console.error : level === "warn" ? console.warn : console.log;

    if (data && this.debugMode) {
      output(logMessage);
      output("Data:", typeof data === "string" ? data : JSON.stringify(data, null, 2));
    } else {
      output(logMessage);
    }
  }

  debug(message: string, data?: any, meta?: { duration?: number; toolName?: string; requestId?: string; }) {
    this.log("debug", message, data, meta);
  }

  info(message: string, data?: any, meta?: { duration?: number; toolName?: string; requestId?: string; }) {
    this.log("info", message, data, meta);
  }

  warn(message: string, data?: any, meta?: { duration?: number; toolName?: string; requestId?: string; }) {
    this.log("warn", message, data, meta);
  }

  error(message: string, error?: any, meta?: { duration?: number; toolName?: string; requestId?: string; }) {
    this.log("error", message, error, meta);
  }

  // Performance tracking methods
  startTimer(operation: string): () => void {
    if (!this.performanceTracking) {
      return () => { }; // No-op if performance tracking disabled
    }

    const startTime = Date.now();
    return () => {
      const duration = Date.now() - startTime;
      this.debug(`${operation} completed`, undefined, { duration });
      return duration;
    };
  }

  timeAsync<T>(operation: string, promise: Promise<T>, toolName?: string): Promise<T> {
    if (!this.performanceTracking) {
      return promise;
    }

    const startTime = Date.now();
    return promise
      .then((result) => {
        const duration = Date.now() - startTime;
        this.info(`${operation} completed successfully`, undefined, { duration, toolName });
        return result;
      })
      .catch((error) => {
        const duration = Date.now() - startTime;
        this.error(`${operation} failed`, error, { duration, toolName });
        throw error;
      });
  }

  // MCP message tracing
  traceRequest(method: string, params?: any, requestId?: string) {
    this.debug(`MCP Request: ${method}`, params, { requestId });
  }

  traceResponse(method: string, result?: any, requestId?: string) {
    this.debug(`MCP Response: ${method}`, result, { requestId });
  }

  traceError(method: string, error: any, requestId?: string) {
    this.error(`MCP Error: ${method}`, error, { requestId });
  }

  // Server lifecycle logging
  serverStarted(serverName: string, transport: string, toolCount: number) {
    this.info(`MCP server "${serverName}" started`, {
      transport,
      toolCount,
      debugMode: this.debugMode,
      performanceTracking: this.performanceTracking,
    });
  }

  serverShutdown(reason: string) {
    this.info(`MCP server shutting down: ${reason}`);
  }

  toolExecutionStart(toolName: string, args: any, requestId?: string) {
    this.debug(`Tool execution started: ${toolName}`, this.debugMode ? args : undefined, { toolName, requestId });
  }

  toolExecutionEnd(toolName: string, duration: number, requestId?: string) {
    this.info(`Tool execution completed: ${toolName}`, undefined, { toolName, duration, requestId });
  }

  toolExecutionError(toolName: string, error: any, duration: number, requestId?: string) {
    this.error(`Tool execution failed: ${toolName}`, error, { toolName, duration, requestId });
  }
}

// Export singleton instance
export const logger = new MCPLogger();
