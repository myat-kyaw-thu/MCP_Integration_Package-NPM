import { defineMCP } from '@myatkyawthu/mcp-connect';
export default defineMCP({
  name: "My MCP App",
  version: "1.0.0",
  description: "My awesome MCP server",
  tools: [
    // Simple tuple format: [name, handler]
    ["hello", async ({ name = "World" }) => `Hello ${name}!`],

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
      handler: async ({ message }) => `Echo: ${message}`
    }
  ]
});
