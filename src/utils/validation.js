export function validateJsonRpcRequest(request) {
  if (!request || typeof request !== 'object') {
    throw new Error('Request must be a JSON object');
  }

  if (request.jsonrpc !== '2.0') {
    throw new Error('Invalid JSON-RPC version. Must be \'2.0\'');
  }

  if (!request.method || typeof request.method !== 'string') {
    throw new Error('Request must include a \'method\' string');
  }

  // ID is optional for notifications, but if present must be string, number, or null
  if (
    request.id !== undefined &&
    typeof request.id !== 'string' &&
    typeof request.id !== 'number' &&
    request.id !== null
  ) {
    throw new Error('Request \'id\' must be string, number, or null');
  }

  return request;
}

export function validateToolArguments(args) {
  if (args === null || args === undefined) {
    return {};
  }

  if (typeof args !== 'object' || Array.isArray(args)) {
    throw new Error('Tool arguments must be an object');
  }

  return args;
}

/**
 * Validate args against a JSON Schema definition (subset: required + type).
 * No external deps — covers the common cases without pulling in ajv.
 * @param {object} args
 * @param {object} schema  - the tool's inputSchema
 */
export function validateArgsAgainstSchema(args, schema) {
  if (!schema || typeof schema !== 'object') return;

  // Check required fields
  if (Array.isArray(schema.required)) {
    for (const field of schema.required) {
      if (args[field] === undefined || args[field] === null) {
        throw new Error(`Missing required argument: "${field}"`);
      }
    }
  }

  // Check declared property types
  if (schema.properties && typeof schema.properties === 'object') {
    for (const [key, def] of Object.entries(schema.properties)) {
      if (args[key] === undefined) continue; // optional — already handled above
      if (!def || typeof def.type !== 'string') continue;

      const actual = Array.isArray(args[key]) ? 'array' : typeof args[key];
      if (actual !== def.type) {
        throw new Error(
          `Argument "${key}" must be of type ${def.type}, got ${actual}`
        );
      }
    }
  }
}

export function sanitizeErrorMessage(error) {
  if (error instanceof Error) {
    // Remove sensitive information from stack traces
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  return 'An unknown error occurred';
}
