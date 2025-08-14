/**
 * MCP-compliant types using official SDK
 * This file contains JSDoc type definitions for MCP-Connect
 */

/**
 * @typedef {Object} MCPTool
 * @property {string} name - Tool name
 * @property {string} description - Tool description
 * @property {Record<string, any>} inputSchema - JSON Schema for input validation
 * @property {function(Record<string, any>): Promise<any>|any} handler - Tool execution function
 */

/**
 * @typedef {Object} MCPConfig
 * @property {string} name - Server name
 * @property {string} version - Server version
 * @property {string} [description] - Server description
 * @property {MCPTool[]} tools - Array of MCP tools
 */

/**
 * @typedef {Object} MCPServerOptions
 * @property {MCPConfig} config - MCP configuration
 */

/**
 * Legacy types for backward compatibility
 */

/**
 * @typedef {function(...any[]): Promise<any>|any} ToolFunction
 */

/**
 * Tool definition - supports both tuple and object formats
 * @typedef {[string, ToolFunction]|{name: string, handler: ToolFunction, description?: string, schema?: Record<string, any>}} ToolDefinition
 * 
 * Tuple format: [name, handler]
 * @example ['hello', async (args) => `Hello ${args.name}!`]
 * 
 * Object format: {name, handler, description?, schema?}
 * @example {
 *   name: 'hello',
 *   handler: async (args) => `Hello ${args.name}!`,
 *   description: 'Greet a user',
 *   schema: { type: 'object', properties: { name: { type: 'string' } } }
 * }
 */

// Runtime validation functions for type checking

/**
 * Validate MCPTool object
 * @param {any} tool - Tool to validate
 * @returns {boolean} Whether the tool is valid
 */
export function isValidMCPTool(tool) {
  return (
    tool &&
    typeof tool === 'object' &&
    typeof tool.name === 'string' &&
    typeof tool.description === 'string' &&
    typeof tool.inputSchema === 'object' &&
    typeof tool.handler === 'function'
  );
}

/**
 * Validate MCPConfig object
 * @param {any} config - Config to validate
 * @returns {boolean} Whether the config is valid
 */
export function isValidMCPConfig(config) {
  return (
    config &&
    typeof config === 'object' &&
    typeof config.name === 'string' &&
    typeof config.version === 'string' &&
    Array.isArray(config.tools) &&
    config.tools.every(isValidMCPTool)
  );
}

/**
 * Validate ToolDefinition (tuple or object format)
 * @param {any} toolDef - Tool definition to validate
 * @returns {boolean} Whether the tool definition is valid
 */
export function isValidToolDefinition(toolDef) {
  if (Array.isArray(toolDef)) {
    // Tuple format: [name, handler]
    return (
      toolDef.length === 2 &&
      typeof toolDef[0] === 'string' &&
      typeof toolDef[1] === 'function'
    );
  } else if (toolDef && typeof toolDef === 'object') {
    // Object format: {name, handler, description?, schema?}
    return (
      typeof toolDef.name === 'string' &&
      typeof toolDef.handler === 'function' &&
      (toolDef.description === undefined || typeof toolDef.description === 'string') &&
      (toolDef.schema === undefined || (typeof toolDef.schema === 'object' && toolDef.schema !== null))
    );
  }
  return false;
}