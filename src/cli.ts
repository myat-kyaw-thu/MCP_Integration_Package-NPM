#!/usr/bin/env node

import { existsSync } from "fs";
import { resolve } from "path";
import { defineMCP } from "./defineMCP.js";
import { MCPConnectServer } from "./server/mcpServer.js";
import { logger } from './utils/logger.js';

/**
 * CLI entry point for mcp-connect
 * Now uses proper MCP SDK with STDIO transport
 */
async function main() {
  try {
    logger.info("Starting MCP-Connect CLI...");

    // Look for config file in current directory
    const configPaths = ["mcp.config.ts", "mcp.config.js", "mcp.config.mjs"];

    let configPath: string | null = null;
    for (const path of configPaths) {
      const fullPath = resolve(process.cwd(), path);
      if (existsSync(fullPath)) {
        configPath = fullPath;
        break;
      }
    }

    if (!configPath) {
      logger.error("No MCP config file found. Create mcp.config.ts in your project root.");
      logger.info("Example config:", `
      import { defineMCP } from "mcp-connect"

      export default defineMCP({
        name: "My App",
        version: "1.0.0",
        tools: [
          ["hello", async ({ name }) => \`Hello \${name}!\`]
        ]
      })
      `);
      process.exit(1);
    }

    logger.info(`Loading config from: ${configPath}`);

    // Dynamic import the config with better error handling
    let configModule;
    try {
      configModule = await import(`file://${configPath}`);
    } catch (error) {
      logger.error("Failed to load config file", error);
      if (error instanceof Error) {
        if (error.message.includes("SyntaxError")) {
          logger.error("Syntax error in config file. Check your TypeScript/JavaScript syntax.");
        } else if (error.message.includes("EACCES")) {
          logger.error("Permission denied. Check file permissions.");
        } else if (error.message.includes("MODULE_NOT_FOUND")) {
          logger.error("Missing dependencies. Run 'bun install' or 'npm install'.");
        }
      }
      process.exit(1);
    }

    const config = configModule.default;

    if (!config) {
      logger.error("Config file must export a default configuration");
      logger.info("Make sure your config file has: export default defineMCP({...})");
      process.exit(1);
    }

    // Validate config using defineMCP (in case user didn't use it)
    let validatedConfig;
    try {
      validatedConfig = typeof config === "function" ? config : defineMCP(config);
    } catch (error) {
      logger.error("Configuration validation failed", error);

      process.exit(1);
    }

    // Create and start MCP server with STDIO transport
    const server = new MCPConnectServer(validatedConfig);
    await server.start();

    // Graceful shutdown is now handled in MCPConnectServer
  } catch (error) {
    console.error("Failed to start MCP server:");
    logger.error("Failed to start MCP server", error);
    process.exit(1);
  }
}

// Run CLI if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
