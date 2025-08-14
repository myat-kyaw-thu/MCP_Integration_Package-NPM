import { defineMCP } from '../../src';
// Simple todo list storage
const todos: Array<{ id: number; title: string; completed: boolean; }> = [
  { id: 1, title: "Buy milk", completed: false },
  { id: 2, title: "Walk the dog", completed: true },
];

let nextId = 3;

export default defineMCP({
  name: "Todo App",
  version: "1.0.0",
  description: "Simple todo list management via MCP",
  tools: [
    // Simple tuple format
    ["getTodos", async () => todos],

    // Object format with description and schema
    {
      name: "addTodo",
      description: "Add a new todo item",
      schema: {
        type: "object",
        properties: {
          title: { type: "string", description: "Todo title" }
        },
        required: ["title"]
      },
      handler: async ({ title }: { title: string; }) => {
        const newTodo = { id: nextId++, title, completed: false };
        todos.push(newTodo);
        return newTodo;
      }
    },

    {
      name: "toggleTodo",
      description: "Toggle todo completion status",
      schema: {
        type: "object",
        properties: {
          id: { type: "number", description: "Todo ID" }
        },
        required: ["id"]
      },
      handler: async ({ id }: { id: number; }) => {
        const todo = todos.find(t => t.id === id);
        if (!todo) throw new Error(`Todo with id ${id} not found`);
        todo.completed = !todo.completed;
        return todo;
      }
    }
  ]
});