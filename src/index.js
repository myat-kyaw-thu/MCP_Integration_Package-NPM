/**
 * MCP-Connect main entry point
 */

// Main API exports
export { defineMCP } from './defineMCP.js';
export { MCPConnectServer } from './server/mcpServer.js';

// Type validation utilities (for runtime type checking)
export { isValidMCPConfig, isValidMCPTool, isValidToolDefinition } from './types/mcp.js';

/**
 * @typedef {import('./types/mcp.js').MCPConfig} MCPConfig
 * @typedef {import('./types/mcp.js').MCPTool} MCPTool
 * @typedef {import('./types/mcp.js').ToolDefinition} ToolDefinition
 * @typedef {import('./types/mcp.js').MCPServerOptions} MCPServerOptions
 * @typedef {import('./types/mcp.js').ToolFunction} ToolFunction
 */
