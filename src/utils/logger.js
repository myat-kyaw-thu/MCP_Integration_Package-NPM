/**
 * Enhanced structured logger for MCP-Connect
 */

/**
 * @typedef {'debug'|'info'|'warn'|'error'} LogLevel
 */

/**
 * @typedef {Object} LogContext
 * @property {string} timestamp - ISO timestamp
 * @property {LogLevel} level - Log level
 * @property {string} message - Log message
 * @property {any} [data] - Additional data
 * @property {number} [duration] - Duration in milliseconds
 * @property {string} [toolName] - Tool name
 * @property {string} [requestId] - Request ID
 */

/**
 * @typedef {Object} LogMeta
 * @property {number} [duration] - Duration in milliseconds
 * @property {string} [toolName] - Tool name
 * @property {string} [requestId] - Request ID
 */

class MCPLogger {
  constructor() {
    /** @type {LogLevel} */
    this.logLevel = 'info';
    /** @type {boolean} */
    this.debugMode = process.env.MCP_DEBUG === "1" || process.env.MCP_DEBUG === "true";
    /** @type {boolean} */
    this.performanceTracking = process.env.MCP_PERF === "1" || process.env.MCP_PERF === "true" || this.debugMode;

    // Set log level based on environment
    if (this.debugMode) {
      this.logLevel = "debug";
    } else if (process.env.MCP_LOG_LEVEL) {
      this.logLevel = /** @type {LogLevel} */ (process.env.MCP_LOG_LEVEL);
    } else {
      this.logLevel = "info";
    }
  }

  /**
   * Check if we should log at this level
   * @param {LogLevel} level - Log level to check
   * @returns {boolean} Whether to log
   */
  shouldLog(level) {
    /** @type {Record<LogLevel, number>} */
    const levels = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3,
    };
    return levels[level] >= levels[this.logLevel];
  }

  /**
   * Format log message
   * @param {LogContext} context - Log context
   * @returns {string} Formatted log message
   */
  formatLog(context) {
    const { timestamp, level, message, duration, toolName, requestId } = context;

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

  /**
   * Internal log method
   * @param {LogLevel} level - Log level
   * @param {string} message - Log message
   * @param {any} [data] - Additional data
   * @param {LogMeta} [meta] - Metadata
   */
  log(level, message, data, meta) {
    if (!this.shouldLog(level)) return;

    /** @type {LogContext} */
    const context = {
      timestamp: new Date().toISOString(),
      level,
      message,
      data,
      ...meta,
    };

    const logMessage = this.formatLog(context);

    // Output to stderr (MCP requirement - stdout is reserved for JSON protocol)
    const output = console.error;

    if (data && this.debugMode) {
      output(logMessage);
      output("Data:", typeof data === "string" ? data : JSON.stringify(data, null, 2));
    } else {
      output(logMessage);
    }
  }

  /**
   * Log debug message
   * @param {string} message - Debug message
   * @param {any} [data] - Additional data
   * @param {LogMeta} [meta] - Metadata
   */
  debug(message, data, meta) {
    this.log("debug", message, data, meta);
  }

  /**
   * Log info message
   * @param {string} message - Info message
   * @param {any} [data] - Additional data
   * @param {LogMeta} [meta] - Metadata
   */
  info(message, data, meta) {
    this.log("info", message, data, meta);
  }

  /**
   * Log warning message
   * @param {string} message - Warning message
   * @param {any} [data] - Additional data
   * @param {LogMeta} [meta] - Metadata
   */
  warn(message, data, meta) {
    this.log("warn", message, data, meta);
  }

  /**
   * Log error message
   * @param {string} message - Error message
   * @param {any} [error] - Error object or data
   * @param {LogMeta} [meta] - Metadata
   */
  error(message, error, meta) {
    this.log("error", message, error, meta);
  }

  /**
   * Start performance timer
   * @param {string} operation - Operation name
   * @returns {Function} Function to call when operation completes
   */
  startTimer(operation) {
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

  /**
   * Time an async operation
   * @template T
   * @param {string} operation - Operation name
   * @param {Promise<T>} promise - Promise to time
   * @param {string} [toolName] - Tool name
   * @returns {Promise<T>} The original promise
   */
  timeAsync(operation, promise, toolName) {
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

  /**
   * Trace MCP request
   * @param {string} method - MCP method
   * @param {any} [params] - Request parameters
   * @param {string} [requestId] - Request ID
   */
  traceRequest(method, params, requestId) {
    this.debug(`MCP Request: ${method}`, params, { requestId });
  }

  /**
   * Trace MCP response
   * @param {string} method - MCP method
   * @param {any} [result] - Response result
   * @param {string} [requestId] - Request ID
   */
  traceResponse(method, result, requestId) {
    this.debug(`MCP Response: ${method}`, result, { requestId });
  }

  /**
   * Trace MCP error
   * @param {string} method - MCP method
   * @param {any} error - Error object
   * @param {string} [requestId] - Request ID
   */
  traceError(method, error, requestId) {
    this.error(`MCP Error: ${method}`, error, { requestId });
  }

  /**
   * Log server startup
   * @param {string} serverName - Server name
   * @param {string} transport - Transport type
   * @param {number} toolCount - Number of tools
   */
  serverStarted(serverName, transport, toolCount) {
    this.info(`MCP server "${serverName}" started`, {
      transport,
      toolCount,
      debugMode: this.debugMode,
      performanceTracking: this.performanceTracking,
    });
  }

  /**
   * Log server shutdown
   * @param {string} reason - Shutdown reason
   */
  serverShutdown(reason) {
    this.info(`MCP server shutting down: ${reason}`);
  }

  /**
   * Log tool execution start
   * @param {string} toolName - Tool name
   * @param {any} args - Tool arguments
   * @param {string} [requestId] - Request ID
   */
  toolExecutionStart(toolName, args, requestId) {
    this.debug(`Tool execution started: ${toolName}`, this.debugMode ? args : undefined, { toolName, requestId });
  }

  /**
   * Log tool execution completion
   * @param {string} toolName - Tool name
   * @param {number} duration - Execution duration
   * @param {string} [requestId] - Request ID
   */
  toolExecutionEnd(toolName, duration, requestId) {
    this.info(`Tool execution completed: ${toolName}`, undefined, { toolName, duration, requestId });
  }

  /**
   * Log tool execution error
   * @param {string} toolName - Tool name
   * @param {any} error - Error object
   * @param {number} duration - Execution duration
   * @param {string} [requestId] - Request ID
   */
  toolExecutionError(toolName, error, duration, requestId) {
    this.error(`Tool execution failed: ${toolName}`, error, { toolName, duration, requestId });
  }
}

// Export singleton instance
export const logger = new MCPLogger();