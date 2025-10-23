class MCPLogger {
  constructor() {
    this.logLevel = 'info';
    this.debugMode = process.env.MCP_DEBUG === '1' || process.env.MCP_DEBUG === 'true';
    this.performanceTracking =
      process.env.MCP_PERF === '1' || process.env.MCP_PERF === 'true' || this.debugMode;

    if (this.debugMode) {
      this.logLevel = 'debug';
    } else if (process.env.MCP_LOG_LEVEL) {
      this.logLevel = process.env.MCP_LOG_LEVEL;
    } else {
      this.logLevel = 'info';
    }
  }

  shouldLog(level) {
    const levels = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3,
    };
    return levels[level] >= levels[this.logLevel];
  }

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

  log(level, message, data, meta) {
    if (!this.shouldLog(level)) return;

    const context = {
      timestamp: new Date().toISOString(),
      level,
      message,
      data,
      ...meta,
    };

    const logMessage = this.formatLog(context);

    const output = console.error;

    if (data && this.debugMode) {
      output(logMessage);
      output('Data:', typeof data === 'string' ? data : JSON.stringify(data, null, 2));
    } else {
      output(logMessage);
    }
  }

  debug(message, data, meta) {
    this.log('debug', message, data, meta);
  }

  info(message, data, meta) {
    this.log('info', message, data, meta);
  }

  warn(message, data, meta) {
    this.log('warn', message, data, meta);
  }

  error(message, error, meta) {
    this.log('error', message, error, meta);
  }

  startTimer(operation) {
    if (!this.performanceTracking) {
      return () => {};
    }

    const startTime = Date.now();
    return () => {
      const duration = Date.now() - startTime;
      this.debug(`${operation} completed`, undefined, { duration });
      return duration;
    };
  }

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

  traceRequest(method, params, requestId) {
    this.debug(`MCP Request: ${method}`, params, { requestId });
  }

  traceResponse(method, result, requestId) {
    this.debug(`MCP Response: ${method}`, result, { requestId });
  }

  traceError(method, error, requestId) {
    this.error(`MCP Error: ${method}`, error, { requestId });
  }

  serverStarted(serverName, transport, toolCount) {
    this.info(`MCP server "${serverName}" started`, {
      transport,
      toolCount,
      debugMode: this.debugMode,
      performanceTracking: this.performanceTracking,
    });
  }

  serverShutdown(reason) {
    this.info(`MCP server shutting down: ${reason}`);
  }

  toolExecutionStart(toolName, args, requestId) {
    this.debug(`Tool execution started: ${toolName}`, this.debugMode ? args : undefined, {
      toolName,
      requestId,
    });
  }

  toolExecutionEnd(toolName, duration, requestId) {
    this.info(`Tool execution completed: ${toolName}`, undefined, {
      toolName,
      duration,
      requestId,
    });
  }

  toolExecutionError(toolName, error, duration, requestId) {
    this.error(`Tool execution failed: ${toolName}`, error, { toolName, duration, requestId });
  }
}

export const logger = new MCPLogger();
