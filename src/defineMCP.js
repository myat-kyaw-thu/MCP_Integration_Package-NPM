import { formatValidationErrors, validateConfig } from './utils/configValidation.js';
import { logger } from './utils/logger.js';

export function defineMCP(config) {
  const validationResult = validateConfig(config);

  if (!validationResult.isValid) {
    const errorMessage = formatValidationErrors(validationResult);
    logger.error('Configuration validation failed', errorMessage);
    throw new Error(`Invalid MCP configuration:\n${errorMessage}`);
  }

  if (validationResult.warnings.length > 0) {
    const warningMessage = formatValidationErrors({
      isValid: true,
      errors: [],
      warnings: validationResult.warnings,
    });
    logger.warn('Configuration warnings', warningMessage);
  }

  const mcpTools = config.tools.map((tool) => {
    if (Array.isArray(tool)) {
      const [name, handler] = tool;
      return {
        name: name.trim(),
        description: `Tool: ${name}`,
        inputSchema: {
          type: 'object',
          properties: {},
          additionalProperties: true,
        },
        handler,
      };
    } else {
      const { name, handler, description, schema } = tool;
      return {
        name: name.trim(),
        description: description || `Tool: ${name}`,
        inputSchema: schema || {
          type: 'object',
          properties: {},
          additionalProperties: true,
        },
        handler,
      };
    }
  });

  return {
    name: config.name,
    version: config.version,
    description: config.description,
    tools: mcpTools,
  };
}
