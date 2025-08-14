# Todo App MCP Example

This example demonstrates how to use mcp-connect to create a simple todo list that AI agents can interact with.

## Features

- `getTodos` - List all todos
- `addTodo` - Add a new todo item
- `toggleTodo` - Toggle completion status

## Running

```bash
# Install dependencies
npm install

# Start the MCP server
npm start

# Or run in development mode
npm run dev
```

## Claude Desktop Integration

Add this to your Claude Desktop config:

```json
{
  "mcpServers": {
    "todo-app": {
      "command": "npx",
      "args": ["mcp-connect"],
      "cwd": "/path/to/mcp-connect/examples/todo-app"
    }
  }
}
```