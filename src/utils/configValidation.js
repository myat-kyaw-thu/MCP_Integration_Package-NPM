/**
 * Comprehensive configuration validation for MCP-Connect
 */

/**
 * @typedef {Object} ValidationError
 * @property {string} field - The field that has an error
 * @property {string} message - Error message
 * @property {any} [value] - The invalid value
 * @property {string} [suggestion] - Suggestion for fixing the error
 */

/**
 * @typedef {Object} ValidationResult
 * @property {boolean} isValid - Whether the configuration is valid
 * @property {ValidationError[]} errors - Array of validation errors
 * @property {ValidationError[]} warnings - Array of validation warnings
 */

/**
 * JSON Schema-like validation for MCP configuration
 */
export class ConfigValidator {
  constructor() {
    /** @type {ValidationError[]} */
    this.errors = [];
    /** @type {ValidationError[]} */
    this.warnings = [];
  }

  /**
   * Validate MCP configuration
   * @param {any} config - Configuration to validate
   * @returns {ValidationResult} Validation result
   */
  validate(config) {
    this.errors = [];
    this.warnings = [];

    // Basic structure validation
    this.validateBasicStructure(config);

    if (this.errors.length === 0) {
      // Detailed field validation
      this.validateName(config.name);
      this.validateVersion(config.version);
      this.validateDescription(config.description);
      this.validateTools(config.tools);
    }

    return {
      isValid: this.errors.length === 0,
      errors: this.errors,
      warnings: this.warnings,
    };
  }

  /**
   * Add validation error
   * @param {string} field - Field name
   * @param {string} message - Error message
   * @param {any} [value] - Invalid value
   * @param {string} [suggestion] - Suggestion for fix
   */
  addError(field, message, value, suggestion) {
    this.errors.push({ field, message, value, suggestion });
  }

  /**
   * Add validation warning
   * @param {string} field - Field name
   * @param {string} message - Warning message
   * @param {any} [value] - Value that triggered warning
   * @param {string} [suggestion] - Suggestion for improvement
   */
  addWarning(field, message, value, suggestion) {
    this.warnings.push({ field, message, value, suggestion });
  }

  /**
   * Validate basic configuration structure
   * @param {any} config - Configuration to validate
   */
  validateBasicStructure(config) {
    if (!config || typeof config !== 'object') {
      this.addError('config', 'Configuration must be an object', config, 'Use defineMCP({ ... })');
      return;
    }

    if (Array.isArray(config)) {
      this.addError(
        'config',
        'Configuration cannot be an array',
        config,
        'Use defineMCP({ ... }) instead of [...]'
      );
      return;
    }

    // Check for required fields
    const requiredFields = ['name', 'version', 'tools'];
    for (const field of requiredFields) {
      if (!(field in config)) {
        this.addError(
          field,
          `Required field "${field}" is missing`,
          undefined,
          `Add ${field}: "..."`
        );
      }
    }
  }

  /**
   * Validate name field
   * @param {any} name - Name to validate
   */
  validateName(name) {
    if (name === undefined) return; // Already handled in basic structure

    if (typeof name !== 'string') {
      this.addError('name', 'Name must be a string', name, 'Use name: "My App"');
      return;
    }

    if (name.trim() === '') {
      this.addError('name', 'Name cannot be empty', name, 'Use name: "My App"');
      return;
    }

    if (name.length > 100) {
      this.addWarning('name', 'Name is very long (>100 chars)', name, 'Consider a shorter name');
    }

    if (!/^[a-zA-Z0-9\s\-_.]+$/.test(name)) {
      this.addWarning(
        'name',
        'Name contains special characters',
        name,
        'Use only letters, numbers, spaces, hyphens, underscores, and dots'
      );
    }
  }

  /**
   * Validate version field
   * @param {any} version - Version to validate
   */
  validateVersion(version) {
    if (version === undefined) return; // Already handled in basic structure

    if (typeof version !== 'string') {
      this.addError('version', 'Version must be a string', version, 'Use version: "1.0.0"');
      return;
    }

    if (version.trim() === '') {
      this.addError('version', 'Version cannot be empty', version, 'Use version: "1.0.0"');
      return;
    }

    // Check for semantic versioning
    const semverRegex = /^\d+\.\d+\.\d+(-[a-zA-Z0-9\-._]+)?(\+[a-zA-Z0-9\-._]+)?$/;
    if (!semverRegex.test(version)) {
      this.addWarning(
        'version',
        "Version doesn't follow semantic versioning",
        version,
        'Use format: "1.0.0"'
      );
    }
  }

  /**
   * Validate description field
   * @param {any} description - Description to validate
   */
  validateDescription(description) {
    if (description === undefined) return; // Optional field

    if (typeof description !== 'string') {
      this.addError(
        'description',
        'Description must be a string',
        description,
        'Use description: "My app description"'
      );
      return;
    }

    if (description.length > 500) {
      this.addWarning(
        'description',
        'Description is very long (>500 chars)',
        description,
        'Consider a shorter description'
      );
    }
  }

  /**
   * Validate tools array
   * @param {any} tools - Tools to validate
   */
  validateTools(tools) {
    if (tools === undefined) return; // Already handled in basic structure

    if (!Array.isArray(tools)) {
      this.addError('tools', 'Tools must be an array', tools, 'Use tools: [...]');
      return;
    }

    if (tools.length === 0) {
      this.addError(
        'tools',
        'At least one tool must be defined',
        tools,
        'Add tools: [["myTool", handler]] or run "mcp-connect init" for examples'
      );
      return;
    }

    if (tools.length > 50) {
      this.addWarning(
        'tools',
        'Large number of tools (>50)',
        tools,
        'Consider grouping related functionality'
      );
    }

    // Validate each tool and check for consistency
    const toolNames = new Set();
    const asyncPatterns = [];

    tools.forEach((tool, index) => {
      this.validateTool(tool, index, toolNames);

      // Track async patterns for consistency checking
      let handler;
      if (Array.isArray(tool) && tool.length === 2) {
        handler = tool[1];
      } else if (tool && typeof tool === 'object' && tool.handler) {
        handler = tool.handler;
      }

      if (typeof handler === 'function') {
        const isAsync = handler.constructor.name === 'AsyncFunction';
        const handlerString = handler.toString();
        const hasPromise = handlerString.includes('Promise') || handlerString.includes('await');
        asyncPatterns.push({ index, isAsync: isAsync || hasPromise });
      }
    });

    // Check for async/sync mixing
    this.validateAsyncConsistency(asyncPatterns);
  }

  /**
   * Validate individual tool
   * @param {any} tool - Tool to validate
   * @param {number} index - Tool index
   * @param {Set<string>} toolNames - Set of existing tool names
   */
  validateTool(tool, index, toolNames) {
    const fieldPrefix = `tools[${index}]`;

    if (Array.isArray(tool)) {
      // Tuple format: [name, handler]
      if (tool.length !== 2) {
        this.addError(
          fieldPrefix,
          'Tuple format must have exactly 2 elements [name, handler]',
          tool,
          '["toolName", handlerFunction]'
        );
        return;
      }

      const [name, handler] = tool;
      this.validateToolName(name, `${fieldPrefix}.name`, toolNames);
      this.validateToolHandler(handler, `${fieldPrefix}.handler`);
    } else if (typeof tool === 'object' && tool !== null) {
      // Object format: { name, handler, description?, schema? }
      this.validateToolName(tool.name, `${fieldPrefix}.name`, toolNames);
      this.validateToolHandler(tool.handler, `${fieldPrefix}.handler`);
      this.validateToolDescription(tool.description, `${fieldPrefix}.description`);
      this.validateToolSchema(tool.schema, `${fieldPrefix}.schema`);

      // Check for unknown properties
      const knownProps = ['name', 'handler', 'description', 'schema'];
      const unknownProps = Object.keys(tool).filter((prop) => !knownProps.includes(prop));
      if (unknownProps.length > 0) {
        this.addWarning(
          fieldPrefix,
          `Unknown properties: ${unknownProps.join(', ')}`,
          unknownProps,
          'Remove unknown properties'
        );
      }
    } else {
      this.addError(
        fieldPrefix,
        'Tool must be [name, handler] or {name, handler, ...}',
        tool,
        '["toolName", handler] or {name: "toolName", handler}'
      );
    }
  }

  /**
   * Validate tool name
   * @param {any} name - Tool name to validate
   * @param {string} fieldPath - Field path for error reporting
   * @param {Set<string>} toolNames - Set of existing tool names
   */
  validateToolName(name, fieldPath, toolNames) {
    if (typeof name !== 'string') {
      this.addError(fieldPath, 'Tool name must be a string', name, '"myToolName"');
      return;
    }

    if (name.trim() === '') {
      this.addError(fieldPath, 'Tool name cannot be empty', name, '"myToolName"');
      return;
    }

    const trimmedName = name.trim();
    if (toolNames.has(trimmedName)) {
      this.addError(
        fieldPath,
        `Duplicate tool name "${trimmedName}"`,
        name,
        'Each tool must have a unique name'
      );
      return;
    }
    toolNames.add(trimmedName);

    // Validate name format
    if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(trimmedName)) {
      this.addWarning(
        fieldPath,
        'Tool name should start with letter and contain only letters, numbers, underscores',
        name,
        '"myToolName" or "my_tool_name"'
      );
    }

    if (trimmedName.length > 50) {
      this.addWarning(
        fieldPath,
        'Tool name is very long (>50 chars)',
        name,
        'Consider a shorter name'
      );
    }
  }

  /**
   * Validate tool handler function
   * @param {any} handler - Handler to validate
   * @param {string} fieldPath - Field path for error reporting
   */
  validateToolHandler(handler, fieldPath) {
    if (typeof handler !== 'function') {
      this.addError(
        fieldPath,
        'Tool handler must be a function',
        typeof handler,
        'async (args) => { ... }'
      );
      return;
    }

    // Validate function signature
    const handlerString = handler.toString();

    // Check parameter count (should accept 0 or 1 parameter)
    const paramMatch = handlerString.match(/^(?:async\s+)?(?:function\s*)?(?:\w+\s*)?\(([^)]*)\)/);
    if (paramMatch) {
      const params = paramMatch[1].trim();
      if (params) {
        const paramCount = params.split(',').filter(p => p.trim()).length;
        if (paramCount > 1) {
          this.addError(
            fieldPath,
            `Tool handler should accept 0 or 1 parameter, got ${paramCount}`,
            paramCount,
            'Use: async (args) => { ... } or async () => { ... }'
          );
        }
      }
    }

    // Check if it's an async function or returns a promise
    const isAsync = handler.constructor.name === 'AsyncFunction';

    if (!isAsync && !handlerString.includes('Promise') && !handlerString.includes('await')) {
      this.addWarning(
        fieldPath,
        'Consider making tool handler async for better performance',
        undefined,
        'async (args) => { ... }'
      );
    }

    // Check for common mistakes
    if (handlerString.includes('callback') || handlerString.includes('cb')) {
      this.addWarning(
        fieldPath,
        'Tool handler appears to use callbacks - use async/await instead',
        undefined,
        'Replace callbacks with: async (args) => { return await someAsyncOperation(); }'
      );
    }
  }

  /**
   * Validate tool description
   * @param {any} description - Description to validate
   * @param {string} fieldPath - Field path for error reporting
   */
  validateToolDescription(description, fieldPath) {
    if (description === undefined) return; // Optional

    if (typeof description !== 'string') {
      this.addError(
        fieldPath,
        'Tool description must be a string',
        description,
        '"Description of what this tool does"'
      );
      return;
    }

    if (description.length > 200) {
      this.addWarning(
        fieldPath,
        'Tool description is very long (>200 chars)',
        description,
        'Consider a shorter description'
      );
    }
  }

  /**
   * Validate async/sync consistency across tools
   * @param {Array<{index: number, isAsync: boolean}>} asyncPatterns - Async patterns for each tool
   */
  validateAsyncConsistency(asyncPatterns) {
    if (asyncPatterns.length < 2) return; // No consistency issues with single tool

    const asyncCount = asyncPatterns.filter(p => p.isAsync).length;
    const syncCount = asyncPatterns.length - asyncCount;

    // If mixing async and sync, warn about it
    if (asyncCount > 0 && syncCount > 0) {
      const syncIndexes = asyncPatterns.filter(p => !p.isAsync).map(p => p.index);
      this.addWarning(
        'tools',
        `Mixing async and sync tools may cause inconsistent behavior. Tools at indexes [${syncIndexes.join(', ')}] are synchronous`,
        { asyncCount, syncCount },
        'Consider making all tools async for consistency: async (args) => { ... }'
      );
    }

    // If mostly async but some sync, suggest converting
    if (asyncCount > syncCount && syncCount > 0) {
      this.addWarning(
        'tools',
        'Most tools are async - consider converting remaining sync tools to async',
        undefined,
        'Use: async (args) => { return syncResult; } for sync operations'
      );
    }
  }

  /**
   * Validate tool schema
   * @param {any} schema - Schema to validate
   * @param {string} fieldPath - Field path for error reporting
   */
  validateToolSchema(schema, fieldPath) {
    if (schema === undefined) return; // Optional

    if (typeof schema !== 'object' || schema === null || Array.isArray(schema)) {
      this.addError(
        fieldPath,
        'Tool schema must be an object',
        schema,
        "{ type: 'object', properties: {...} }"
      );
      return;
    }

    // Basic JSON Schema validation
    if (schema.type && typeof schema.type !== 'string') {
      this.addError(`${fieldPath}.type`, 'Schema type must be a string', schema.type, '"object"');
    }

    if (
      schema.properties &&
      (typeof schema.properties !== 'object' || Array.isArray(schema.properties))
    ) {
      this.addError(
        `${fieldPath}.properties`,
        'Schema properties must be an object',
        schema.properties,
        "{ prop1: { type: 'string' } }"
      );
    }

    if (schema.required && !Array.isArray(schema.required)) {
      this.addError(
        `${fieldPath}.required`,
        'Schema required must be an array',
        schema.required,
        '["prop1", "prop2"]'
      );
    }
  }
}

/**
 * Validate MCP configuration with detailed error reporting
 * @param {any} config - Configuration to validate
 * @returns {ValidationResult} Validation result
 */
export function validateConfig(config) {
  const validator = new ConfigValidator();
  return validator.validate(config);
}

/**
 * Format validation errors for user-friendly display
 * @param {ValidationResult} result - Validation result to format
 * @returns {string} Formatted error message
 */
export function formatValidationErrors(result) {
  const lines = [];

  if (result.errors.length > 0) {
    lines.push('❌ Configuration Errors:');
    result.errors.forEach((error, index) => {
      lines.push(`  ${index + 1}. ${error.field}: ${error.message}`);
      if (error.value !== undefined) {
        lines.push(`     Current value: ${JSON.stringify(error.value)}`);
      }
      if (error.suggestion) {
        lines.push(`     Suggestion: ${error.suggestion}`);
      }
    });
  }

  if (result.warnings.length > 0) {
    if (lines.length > 0) lines.push('');
    lines.push('⚠️  Configuration Warnings:');
    result.warnings.forEach((warning, index) => {
      lines.push(`  ${index + 1}. ${warning.field}: ${warning.message}`);
      if (warning.suggestion) {
        lines.push(`     Suggestion: ${warning.suggestion}`);
      }
    });
  }

  return lines.join('\n');
}
