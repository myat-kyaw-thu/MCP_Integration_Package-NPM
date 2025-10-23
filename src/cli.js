#!/usr/bin/env node

import { existsSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { defineMCP } from './defineMCP.js';
import { MCPConnectServer } from './server/mcpServer.js';

async function handleInitCommand() {
  const configPath = resolve(process.cwd(), 'mcp.config.js');

  if (existsSync(configPath)) {
    console.error('❌ mcp.config.js already exists in current directory');
    console.error('Remove it first or run mcp-connect in a different directory');
    process.exit(1);
  }

  const sampleConfig = `import { defineMCP } from "@myatkyawthu/mcp-connect";

export default defineMCP({
  name: "My MCP App",
  version: "1.0.0",
  description: "My awesome MCP server",
  tools: [
    // Simple tuple format: [name, handler]
    ["hello", async ({ name = "World" }) => \`Hello \${name}!\`],
    
    // Object format with schema validation
    {
      name: "echo",
      description: "Echo back the input",
      schema: {
        type: "object",
        properties: {
          message: { type: "string", description: "Message to echo" }
        },
        required: ["message"]
      },
      handler: async ({ message }) => \`Echo: \${message}\`
    }
  ]
});
`;

  try {
    writeFileSync(configPath, sampleConfig, 'utf8');
    console.error('✅ Created mcp.config.js');
    console.error('');
    console.error('Next steps:');
    console.error('1. Edit mcp.config.js to add your tools');
    console.error('2. Run: mcp-connect');
    console.error('3. Connect your AI agent via STDIO transport');
    console.error('');
    console.error('Example Claude Desktop config:');
    console.error(`{
  "mcpServers": {
    "my-app": {
      "command": "mcp-connect",
      "args": ["${configPath}"]
    }
  }
}`);
  } catch (error) {
    console.error('❌ Failed to create config file:', error.message);
    process.exit(1);
  }
}

async function main() {
  try {
    if (process.argv[2] === 'init') {
      await handleInitCommand();
      return;
    }

    console.error('Starting MCP-Connect CLI...');

    const configArg = process.argv[2];
    let configPath = null;

    if (configArg) {
      const fullPath = resolve(configArg);
      if (existsSync(fullPath)) {
        configPath = fullPath;
      } else {
        console.error(`Config file not found: ${configArg}`);
        process.exit(1);
      }
    } else {
      const configPaths = ['mcp.config.js', 'mcp.config.mjs', 'mcp.config.ts'];

      for (const path of configPaths) {
        const fullPath = resolve(process.cwd(), path);
        if (existsSync(fullPath)) {
          configPath = fullPath;
          break;
        }
      }
    }

    if (!configPath) {
      console.error('No MCP config file found. Create mcp.config.js in your project root.');
      console.error('');
      console.error('Would you like to create a sample config? Run:');
      console.error('  mcp-connect init');
      console.error('');
      console.error('Or create mcp.config.js manually:');
      console.error(`
import { defineMCP } from "@myatkyawthu/mcp-connect";

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

    console.error(`Loading config from: ${configPath}`);

    let configModule;
    try {
      if (configPath.endsWith('.ts')) {
        console.error('TypeScript config detected. For Node.js compatibility:');
        console.error('1. Rename mcp.config.ts to mcp.config.js and convert to JavaScript');
        console.error('2. Or install tsx: npm install tsx');
        console.error('3. Then run with: npx tsx src/cli.js');
        console.error('');
        console.error('JavaScript example:');
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

      const fileUrl = configPath.startsWith('/')
        ? `file://${configPath}`
        : `file:///${configPath.replace(/\\/g, '/')}`;

      configModule = await import(fileUrl);
    } catch (error) {
      console.error('Failed to load config file:');
      if (error instanceof Error) {
        console.error('Error:', error.message);

        if (
          error.message.includes('Cannot resolve') ||
          error.message.includes('MODULE_NOT_FOUND')
        ) {
          console.error("Make sure 'mcp-connect' is installed: npm install mcp-connect");
        } else if (error.message.includes('SyntaxError')) {
          console.error('Config file has syntax errors. Check your JavaScript syntax.');
        } else if (error.message.includes('ERR_MODULE_NOT_FOUND')) {
          console.error('Module import error. Check your import paths in the config file.');
        }
      }
      process.exit(1);
    }

    const config = configModule.default;

    if (!config) {
      console.error('Config file must export a default configuration');
      console.error('Make sure your config has: export default defineMCP({...})');
      process.exit(1);
    }

    let validatedConfig;
    try {
      validatedConfig = typeof config === 'function' ? config : defineMCP(config);
    } catch (error) {
      console.error('Configuration validation failed:', error);
      process.exit(1);
    }

    const server = new MCPConnectServer(validatedConfig);
    await server.start();

    process.on('SIGINT', async () => {
      console.error('Shutting down...');
      try {
        await server.stop();
      } catch (error) {
        console.error('Error during shutdown:', error);
      }
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.error('Shutting down...');
      try {
        await server.stop();
      } catch (error) {
        console.error('Error during shutdown:', error);
      }
      process.exit(0);
    });
  } catch (error) {
    console.error('Failed to start MCP server:', error);
    process.exit(1);
  }
}

const isMainModule =
  process.argv[1] &&
  (import.meta.url === `file://${process.argv[1]}` ||
    import.meta.url.endsWith(process.argv[1]) ||
    process.argv[1].endsWith('cli.js') ||
    process.argv[1].includes('mcp-connect'));

if (isMainModule) {
  main().catch((error) => {
    console.error('CLI startup failed:', error);
    process.exit(1);
  });
}
