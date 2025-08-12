// MCP-compliant types using official SDK
export interface MCPTool {
  name: string;
  description: string;
  inputSchema: Record<string, any>;
  handler: (args: Record<string, any>) => Promise<any> | any;
}

export interface MCPConfig {
  name: string;
  version: string;
  description?: string;
  tools: MCPTool[];
  transport?: "stdio" | "http";
  port?: number;
  host?: string;
}

export interface MCPServerOptions {
  config: MCPConfig;
  transport: "stdio" | "http";
  port?: number;
  host?: string;
}

// Legacy types for backward compatibility
export type ToolFunction = (...args: any[]) => Promise<any> | any;

export type ToolDefinition =
  | [string, ToolFunction]
  | {
    name: string;
    handler: ToolFunction;
    description?: string;
    schema?: Record<string, any>;
  };
