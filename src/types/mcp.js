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

export function isValidToolDefinition(toolDef) {
  if (Array.isArray(toolDef)) {
    return (
      toolDef.length === 2 && typeof toolDef[0] === 'string' && typeof toolDef[1] === 'function'
    );
  } else if (toolDef && typeof toolDef === 'object') {
    return (
      typeof toolDef.name === 'string' &&
      typeof toolDef.handler === 'function' &&
      (toolDef.description === undefined || typeof toolDef.description === 'string') &&
      (toolDef.schema === undefined ||
        (typeof toolDef.schema === 'object' && toolDef.schema !== null))
    );
  }
  return false;
}
