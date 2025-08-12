import { config } from 'process';
import type { MCPConfig, MCPTool, ToolDefinition } from "./types/mcp.js";
import { formatValidationErrors, validateConfig } from "./utils/configValidation.js";
import { logger } from "./utils/logger.js";

/**
 * Define MCP configuration with tools and server settings
 * This is the main user-facing API that converts simple tool definitions
 * into MCP-compliant format with comprehensive validation
 */
export function defineMCP(config: {
  name: string;
  version: string;
  description?: string;
  tools: ToolDefinition[];
  transport?: "stdio" | "http";
  port?: number;
  host?: string;
}): MCPConfig {
  // Comprehensive configuration validation
  const validationResult = validateConfig(config);

  if (!validationResult.isValid) {
    const errorMessage = formatValidationErrors(validationResult);
    logger.error("Configuration validation failed", errorMessage);
    throw new Error(`Invalid MCP configuration:\n${errorMessage}`);
  }

  // Log warnings if any
  if (validationResult.warnings.length > 0) {
    const warningMessage = formatValidationErrors({ isValid: true, errors: [], warnings: validationResult.warnings });
    logger.warn("Configuration warnings", warningMessage);
  }

  // Convert validated tool definitions to MCP format
  const mcpTools: MCPTool[] = config.tools.map((tool) => {
    if (Array.isArray(tool)) {
      // Handle [name, function] format
      const [name, handler] = tool;
      return {
        name: name.trim(),
        description: `Tool: ${name}`,
        inputSchema: {
          type: "object",
          properties: {},
          additionalProperties: true,
        },
        handler,
      };
    } else {
      // Handle object format
      const { name, handler, description, schema } = tool;
      return {
        name: name.trim(),
        description: description || `Tool: ${name}`,
        inputSchema: schema || {
          type: "object",
          properties: {},
          additionalProperties: true,
        },
        handler,
      };
    }
  });

  // Return MCP-compliant config
  return {
    name: config.name,
    version: config.version,
    description: config.description,
    tools: mcpTools,
    transport: config.transport || "stdio",
    port: config.port || 3001,
    host: config.host || "localhost",
  };
}
