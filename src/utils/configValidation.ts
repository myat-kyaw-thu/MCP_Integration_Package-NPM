/**
 * Comprehensive configuration validation for MCP-Connect
 */


export interface ValidationError {
  field: string;
  message: string;
  value?: any;
  suggestion?: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

/**
 * JSON Schema-like validation for MCP configuration
 */
export class ConfigValidator {
  private errors: ValidationError[] = [];
  private warnings: ValidationError[] = [];

  validate(config: any): ValidationResult {
    this.errors = [];
    this.warnings = [];

    // Basic structure validation
    this.validateBasicStructure(config);

    if (this.errors.length === 0) {
      // Detailed field validation
      this.validateName(config.name);
      this.validateVersion(config.version);
      this.validateDescription(config.description);
      this.validateTransport(config.transport);
      this.validateNetworkConfig(config.port, config.host);
      this.validateTools(config.tools);
    }

    return {
      isValid: this.errors.length === 0,
      errors: this.errors,
      warnings: this.warnings,
    };
  }

  private addError(field: string, message: string, value?: any, suggestion?: string) {
    this.errors.push({ field, message, value, suggestion });
  }

  private addWarning(field: string, message: string, value?: any, suggestion?: string) {
    this.warnings.push({ field, message, value, suggestion });
  }

  private validateBasicStructure(config: any) {
    if (!config || typeof config !== "object") {
      this.addError("config", "Configuration must be an object", config, "Use defineMCP({ ... })");
      return;
    }

    if (Array.isArray(config)) {
      this.addError("config", "Configuration cannot be an array", config, "Use defineMCP({ ... }) instead of [...]");
      return;
    }

    // Check for required fields
    const requiredFields = ["name", "version", "tools"];
    for (const field of requiredFields) {
      if (!(field in config)) {
        this.addError(field, `Required field "${field}" is missing`, undefined, `Add ${field}: "..."`);
      }
    }
  }

  private validateName(name: any) {
    if (name === undefined) return; // Already handled in basic structure

    if (typeof name !== "string") {
      this.addError("name", "Name must be a string", name, 'Use name: "My App"');
      return;
    }

    if (name.trim() === "") {
      this.addError("name", "Name cannot be empty", name, 'Use name: "My App"');
      return;
    }

    if (name.length > 100) {
      this.addWarning("name", "Name is very long (>100 chars)", name, "Consider a shorter name");
    }

    if (!/^[a-zA-Z0-9\s\-_\.]+$/.test(name)) {
      this.addWarning("name", "Name contains special characters", name, "Use only letters, numbers, spaces, hyphens, underscores, and dots");
    }
  }

  private validateVersion(version: any) {
    if (version === undefined) return; // Already handled in basic structure

    if (typeof version !== "string") {
      this.addError("version", "Version must be a string", version, 'Use version: "1.0.0"');
      return;
    }

    if (version.trim() === "") {
      this.addError("version", "Version cannot be empty", version, 'Use version: "1.0.0"');
      return;
    }

    // Check for semantic versioning
    const semverRegex = /^\d+\.\d+\.\d+(-[a-zA-Z0-9\-\.]+)?(\+[a-zA-Z0-9\-\.]+)?$/;
    if (!semverRegex.test(version)) {
      this.addWarning("version", "Version doesn't follow semantic versioning", version, 'Use format: "1.0.0"');
    }
  }

  private validateDescription(description: any) {
    if (description === undefined) return; // Optional field

    if (typeof description !== "string") {
      this.addError("description", "Description must be a string", description, 'Use description: "My app description"');
      return;
    }

    if (description.length > 500) {
      this.addWarning("description", "Description is very long (>500 chars)", description, "Consider a shorter description");
    }
  }

  private validateTransport(transport: any) {
    if (transport === undefined) return; // Optional field, defaults to "stdio"

    if (typeof transport !== "string") {
      this.addError("transport", "Transport must be a string", transport, 'Use transport: "stdio"');
      return;
    }

    const validTransports = ["stdio", "http"];
    if (!validTransports.includes(transport)) {
      this.addError("transport", `Invalid transport "${transport}"`, transport, 'Use "stdio" or "http"');
    }

    if (transport === "http") {
      this.addWarning("transport", "HTTP transport is not yet implemented", transport, 'Use "stdio" for now');
    }
  }

  private validateNetworkConfig(port: any, host: any) {
    if (port !== undefined) {
      if (typeof port !== "number") {
        this.addError("port", "Port must be a number", port, "Use port: 3001");
      } else if (port < 1 || port > 65535) {
        this.addError("port", "Port must be between 1 and 65535", port, "Use port: 3001");
      } else if (port < 1024) {
        this.addWarning("port", "Port is in privileged range (<1024)", port, "Consider using port >= 1024");
      }
    }

    if (host !== undefined) {
      if (typeof host !== "string") {
        this.addError("host", "Host must be a string", host, 'Use host: "localhost"');
      } else if (host.trim() === "") {
        this.addError("host", "Host cannot be empty", host, 'Use host: "localhost"');
      }
    }
  }

  private validateTools(tools: any) {
    if (tools === undefined) return; // Already handled in basic structure

    if (!Array.isArray(tools)) {
      this.addError("tools", "Tools must be an array", tools, "Use tools: [...]");
      return;
    }

    if (tools.length === 0) {
      this.addError("tools", "At least one tool must be defined", tools, 'Add tools: [["myTool", handler]]');
      return;
    }

    if (tools.length > 50) {
      this.addWarning("tools", "Large number of tools (>50)", tools, "Consider grouping related functionality");
    }

    // Validate each tool
    const toolNames = new Set<string>();
    tools.forEach((tool, index) => {
      this.validateTool(tool, index, toolNames);
    });
  }

  private validateTool(tool: any, index: number, toolNames: Set<string>) {
    const fieldPrefix = `tools[${index}]`;

    if (Array.isArray(tool)) {
      // Tuple format: [name, handler]
      if (tool.length !== 2) {
        this.addError(fieldPrefix, "Tuple format must have exactly 2 elements [name, handler]", tool, '["toolName", handlerFunction]');
        return;
      }

      const [name, handler] = tool;
      this.validateToolName(name, `${fieldPrefix}.name`, toolNames);
      this.validateToolHandler(handler, `${fieldPrefix}.handler`);
    } else if (typeof tool === "object" && tool !== null) {
      // Object format: { name, handler, description?, schema? }
      this.validateToolName(tool.name, `${fieldPrefix}.name`, toolNames);
      this.validateToolHandler(tool.handler, `${fieldPrefix}.handler`);
      this.validateToolDescription(tool.description, `${fieldPrefix}.description`);
      this.validateToolSchema(tool.schema, `${fieldPrefix}.schema`);

      // Check for unknown properties
      const knownProps = ["name", "handler", "description", "schema"];
      const unknownProps = Object.keys(tool).filter(prop => !knownProps.includes(prop));
      if (unknownProps.length > 0) {
        this.addWarning(fieldPrefix, `Unknown properties: ${unknownProps.join(", ")}`, unknownProps, "Remove unknown properties");
      }
    } else {
      this.addError(fieldPrefix, "Tool must be [name, handler] or {name, handler, ...}", tool, '["toolName", handler] or {name: "toolName", handler}');
    }
  }

  private validateToolName(name: any, fieldPath: string, toolNames: Set<string>) {
    if (typeof name !== "string") {
      this.addError(fieldPath, "Tool name must be a string", name, '"myToolName"');
      return;
    }

    if (name.trim() === "") {
      this.addError(fieldPath, "Tool name cannot be empty", name, '"myToolName"');
      return;
    }

    const trimmedName = name.trim();
    if (toolNames.has(trimmedName)) {
      this.addError(fieldPath, `Duplicate tool name "${trimmedName}"`, name, "Each tool must have a unique name");
      return;
    }
    toolNames.add(trimmedName);

    // Validate name format
    if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(trimmedName)) {
      this.addWarning(fieldPath, "Tool name should start with letter and contain only letters, numbers, underscores", name, '"myToolName" or "my_tool_name"');
    }

    if (trimmedName.length > 50) {
      this.addWarning(fieldPath, "Tool name is very long (>50 chars)", name, "Consider a shorter name");
    }
  }

  private validateToolHandler(handler: any, fieldPath: string) {
    if (typeof handler !== "function") {
      this.addError(fieldPath, "Tool handler must be a function", typeof handler, "async (args) => { ... }");
      return;
    }

    // Check if it's an async function or returns a promise
    const isAsync = handler.constructor.name === "AsyncFunction";
    const handlerString = handler.toString();

    if (!isAsync && !handlerString.includes("Promise") && !handlerString.includes("await")) {
      this.addWarning(fieldPath, "Consider making tool handler async", undefined, "async (args) => { ... }");
    }
  }

  private validateToolDescription(description: any, fieldPath: string) {
    if (description === undefined) return; // Optional

    if (typeof description !== "string") {
      this.addError(fieldPath, "Tool description must be a string", description, '"Description of what this tool does"');
      return;
    }

    if (description.length > 200) {
      this.addWarning(fieldPath, "Tool description is very long (>200 chars)", description, "Consider a shorter description");
    }
  }

  private validateToolSchema(schema: any, fieldPath: string) {
    if (schema === undefined) return; // Optional

    if (typeof schema !== "object" || schema === null || Array.isArray(schema)) {
      this.addError(fieldPath, "Tool schema must be an object", schema, "{ type: 'object', properties: {...} }");
      return;
    }

    // Basic JSON Schema validation
    if (schema.type && typeof schema.type !== "string") {
      this.addError(`${fieldPath}.type`, "Schema type must be a string", schema.type, '"object"');
    }

    if (schema.properties && (typeof schema.properties !== "object" || Array.isArray(schema.properties))) {
      this.addError(`${fieldPath}.properties`, "Schema properties must be an object", schema.properties, "{ prop1: { type: 'string' } }");
    }

    if (schema.required && !Array.isArray(schema.required)) {
      this.addError(`${fieldPath}.required`, "Schema required must be an array", schema.required, '["prop1", "prop2"]');
    }
  }
}

/**
 * Validate MCP configuration with detailed error reporting
 */
export function validateConfig(config: any): ValidationResult {
  const validator = new ConfigValidator();
  return validator.validate(config);
}

/**
 * Format validation errors for user-friendly display
 */
export function formatValidationErrors(result: ValidationResult): string {
  const lines: string[] = [];

  if (result.errors.length > 0) {
    lines.push("❌ Configuration Errors:");
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
    if (lines.length > 0) lines.push("");
    lines.push("⚠️  Configuration Warnings:");
    result.warnings.forEach((warning, index) => {
      lines.push(`  ${index + 1}. ${warning.field}: ${warning.message}`);
      if (warning.suggestion) {
        lines.push(`     Suggestion: ${warning.suggestion}`);
      }
    });
  }

  return lines.join("\n");
}