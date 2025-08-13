#!/usr/bin/env node

import { existsSync } from "fs";
import { resolve } from "path";
import { defineMCP } from "./defineMCP.js";
import { MCPConnectServer } from "./server/mcpServer.js";

/**
 * CLI entry point for mcp-connect
 * Now uses proper MCP SDK with STDIO transport
 */
async function main() {
  try {
    console.error("Starting MCP-Connect CLI...");

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
      console.error("No MCP config file found. Create mcp.config.ts in your project root.");
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
      // Use Bun's native TypeScript support or Node.js with proper error handling
      const isBunRuntime = typeof Bun !== "undefined" ||
        process.argv[0]?.includes('bun') ||
        process.env.BUN_RUNTIME ||
        process.env.npm_execpath?.includes('bun') ||
        process.argv.some(arg => arg.includes('bunx'));

      if (isBunRuntime) {
        // Running with Bun - native TypeScript support
        const fileUrl = configPath.startsWith('/') ? `file://${configPath}` : `file:///${configPath.replace(/\\/g, '/')}`;
        configModule = await import(fileUrl);
      } else {
        // Running with Node.js - need to handle TypeScript differently
        if (configPath.endsWith(".ts")) {
          console.error("TypeScript config detected. For Node.js compatibility:");
          console.error("1. Rename mcp.config.ts to mcp.config.js");
          console.error("2. Or run with: bunx mcp-connect");
          console.error("3. Or install tsx: npx tsx node_modules/mcp-connect/dist/cli.js");
          process.exit(1);
        }
        configModule = await import(`file://${configPath}`);
      }
    } catch (error) {
      console.error("Failed to load config file:");
      if (error instanceof Error) {
        console.error("Error:", error.message);

        if (error.message.includes("Cannot resolve")) {
          console.error("Make sure 'mcp-connect' is installed: npm install mcp-connect");
        } else if (configPath.endsWith(".ts") && typeof Bun === "undefined") {
          console.error("TypeScript files require Bun or compilation.");
          console.error("Quick fixes:");
          console.error("1. Run with Bun: bunx mcp-connect");
          console.error("2. Rename to .js: mv mcp.config.ts mcp.config.js");
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

    // Create and start MCP server with STDIO transport
    const server = new MCPConnectServer(validatedConfig);
    await server.start();

    // Handle graceful shutdown
    process.on("SIGINT", async () => {
      console.error("Shutting down...");
      process.exit(0);
    });

    process.on("SIGTERM", async () => {
      console.error("Shutting down...");
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
