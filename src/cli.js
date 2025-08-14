#!/usr/bin/env node

import { existsSync } from "fs";
import { resolve } from "path";
import { defineMCP } from "./defineMCP.js";
import { MCPConnectServer } from "./server/mcpServer.js";

/**
 * CLI entry point for mcp-connect
 * Uses MCP SDK with STDIO transport or Express.js for HTTP transport
 */
async function main() {
  try {
    console.error("Starting MCP-Connect CLI...");

    // Check if config file path is provided as argument
    const configArg = process.argv[2];
    /** @type {string|null} */
    let configPath = null;

    if (configArg) {
      // Config file path provided as argument
      const fullPath = resolve(configArg);
      if (existsSync(fullPath)) {
        configPath = fullPath;
      } else {
        console.error(`Config file not found: ${configArg}`);
        process.exit(1);
      }
    } else {
      // Look for config file in current directory (prioritize .js and .mjs)
      const configPaths = ["mcp.config.js", "mcp.config.mjs", "mcp.config.ts"];

      for (const path of configPaths) {
        const fullPath = resolve(process.cwd(), path);
        if (existsSync(fullPath)) {
          configPath = fullPath;
          break;
        }
      }
    }

    if (!configPath) {
      console.error("No MCP config file found. Create mcp.config.js in your project root.");
      console.error("Example config:");
      console.error(`
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

    console.error(`Loading config from: ${configPath}`);

    let configModule;
    try {
      // Handle TypeScript config files
      if (configPath.endsWith(".ts")) {
        console.error("TypeScript config detected. For Node.js compatibility:");
        console.error("1. Rename mcp.config.ts to mcp.config.js and convert to JavaScript");
        console.error("2. Or install tsx: npm install tsx");
        console.error("3. Then run with: npx tsx src/cli.js");
        console.error("");
        console.error("JavaScript example:");
        console.error(`
// mcp.config.js
import { defineMCP } from "mcp-connect";

export default defineMCP({
  name: "My App",
  version: "1.0.0",
  tools: [
    ["hello", async ({ name }) => \`Hello \${name}!\`]
  ]
});
        `);
        process.exit(1);
      }

      // Import config file using Node.js ES modules
      const fileUrl = configPath.startsWith('/')
        ? `file://${configPath}`
        : `file:///${configPath.replace(/\\/g, '/')}`;

      configModule = await import(fileUrl);
    } catch (error) {
      console.error("Failed to load config file:");
      if (error instanceof Error) {
        console.error("Error:", error.message);

        if (error.message.includes("Cannot resolve") || error.message.includes("MODULE_NOT_FOUND")) {
          console.error("Make sure 'mcp-connect' is installed: npm install mcp-connect");
        } else if (error.message.includes("SyntaxError")) {
          console.error("Config file has syntax errors. Check your JavaScript syntax.");
        } else if (error.message.includes("ERR_MODULE_NOT_FOUND")) {
          console.error("Module import error. Check your import paths in the config file.");
        }
      }
      process.exit(1);
    }

    const config = configModule.default;

    if (!config) {
      console.error("Config file must export a default configuration");
      console.error("Make sure your config has: export default defineMCP({...})");
      process.exit(1);
    }

    // Validate config using defineMCP (in case user didn't use it)
    let validatedConfig;
    try {
      validatedConfig = typeof config === "function" ? config : defineMCP(config);
    } catch (error) {
      console.error("Configuration validation failed:", error);
      process.exit(1);
    }

    // Create and start MCP server
    const server = new MCPConnectServer(validatedConfig);
    await server.start();

    // Handle graceful shutdown
    process.on("SIGINT", async () => {
      console.error("Shutting down...");
      try {
        await server.stop();
      } catch (error) {
        console.error("Error during shutdown:", error);
      }
      process.exit(0);
    });

    process.on("SIGTERM", async () => {
      console.error("Shutting down...");
      try {
        await server.stop();
      } catch (error) {
        console.error("Error during shutdown:", error);
      }
      process.exit(0);
    });
  } catch (error) {
    console.error("Failed to start MCP server:", error);
    process.exit(1);
  }
}

// Run CLI if this file is executed directly
// Multiple checks to ensure main() runs when CLI is executed
const isMainModule = process.argv[1] && (
  import.meta.url === `file://${process.argv[1]}` ||
  import.meta.url.endsWith(process.argv[1]) ||
  process.argv[1].endsWith('cli.js') ||
  process.argv[1].includes('mcp-connect')
);

if (isMainModule) {
  main().catch((error) => {
    console.error("CLI startup failed:", error);
    process.exit(1);
  });
}