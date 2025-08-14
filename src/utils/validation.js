/**
 * Validation utilities for MCP-Connect
 */

/**
 * @typedef {Object} JsonRpcRequest
 * @property {string} jsonrpc - JSON-RPC version
 * @property {string} method - Method name
 * @property {any} [params] - Method parameters
 * @property {string|number|null} [id] - Request ID
 */

/**
 * Basic JSON-RPC request validation
 * The MCP SDK handles most validation, but this provides additional safety
 * @param {any} request - Request to validate
 * @returns {JsonRpcRequest} Validated request
 * @throws {Error} If request is invalid
 */
export function validateJsonRpcRequest(request) {
  if (!request || typeof request !== "object") {
    throw new Error("Request must be a JSON object");
  }

  if (request.jsonrpc !== "2.0") {
    throw new Error("Invalid JSON-RPC version. Must be '2.0'");
  }

  if (!request.method || typeof request.method !== "string") {
    throw new Error("Request must include a 'method' string");
  }

  // ID is optional for notifications, but if present must be string, number, or null
  if (request.id !== undefined &&
    typeof request.id !== "string" &&
    typeof request.id !== "number" &&
    request.id !== null) {
    throw new Error("Request 'id' must be string, number, or null");
  }

  return /** @type {JsonRpcRequest} */ (request);
}

/**
 * Validate tool arguments
 * @param {any} args - Arguments to validate
 * @returns {Record<string, any>} Validated arguments object
 * @throws {Error} If arguments are invalid
 */
export function validateToolArguments(args) {
  if (args === null || args === undefined) {
    return {};
  }

  if (typeof args !== "object" || Array.isArray(args)) {
    throw new Error("Tool arguments must be an object");
  }

  return args;
}

/**
 * Sanitize error messages for client consumption
 * @param {unknown} error - Error to sanitize
 * @returns {string} Sanitized error message
 */
export function sanitizeErrorMessage(error) {
  if (error instanceof Error) {
    // Remove sensitive information from stack traces
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "An unknown error occurred";
}