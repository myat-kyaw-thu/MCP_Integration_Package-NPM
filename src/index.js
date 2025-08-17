/**
 * MCP-Connect - Dead simple MCP (Model Context Protocol) server for exposing your app functions to AI agents
 *
 * Main entry point - exports public API
 *
 * @example
 * ```javascript
 * import { defineMCP } from 'mcp-connect';
 *
 * export default defineMCP({
 *   name: 'My App',
 *   version: '1.0.0',
 *   tools: [
 *     ['hello', async ({ name }) => `Hello ${name}!`]
 *   ]
 * });
 * ```
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
