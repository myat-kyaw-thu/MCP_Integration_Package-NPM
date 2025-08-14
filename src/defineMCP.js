import { formatValidationErrors, validateConfig } from "./utils/configValidation.js";
import { logger } from "./utils/logger.js";

/**
 * Define MCP configuration with tools and server settings
 * This is the main user-facing API that converts simple tool definitions
 * into MCP-compliant format with comprehensive validation
 * 
 * @param {Object} config - Configuration object
 * @param {string} config.name - Server name
 * @param {string} config.version - Server version
 * @param {string} [config.description] - Server description
 * @param {import('./types/mcp.js').ToolDefinition[]} config.tools - Tool definitions
 * @returns {import('./types/mcp.js').MCPConfig} MCP configuration object
 * @throws {Error} If configuration is invalid
 */
export function defineMCP(config) {
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
  /** @type {import('./types/mcp.js').MCPTool[]} */
  const mcpTools = config.tools.map((tool) => {
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
  };
}