import { defineMCP } from '@myatkyawthu/mcp-connect';

// Enhanced todo storage with better structure
let todos = [];
let nextId = 1;

// Utility functions for validation and sanitization
const validateTitle = (title) => {
  if (typeof title !== 'string') {
    throw new Error('Title must be a string');
  }
  const sanitized = title.trim();
  if (!sanitized) {
    throw new Error('Title cannot be empty');
  }
  if (sanitized.length > 200) {
    throw new Error('Title cannot exceed 200 characters');
  }
  return sanitized;
};

const validateId = (id) => {
  const numId = typeof id === 'string' ? parseInt(id, 10) : id;
  if (!Number.isInteger(numId) || numId <= 0) {
    throw new Error('ID must be a positive integer');
  }
  return numId;
};

const createSuccessResponse = (data, message) => ({
  success: true,
  message,
  data,
  timestamp: new Date().toISOString()
});

const createErrorResponse = (error) => ({
  success: false,
  error,
  timestamp: new Date().toISOString()
});

export default defineMCP({
  name: "Enhanced Todo Manager",
  version: "2.0.0",
  description: "Complete todo management with error handling and validation",
  tools: [
    // Add a new todo with comprehensive validation
    ["addTodo", async ({ title }) => {
      try {
        const validTitle = validateTitle(title);
        const newTodo = {
          id: nextId++,
          title: validTitle,
          completed: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        todos.push(newTodo);
        return createSuccessResponse(newTodo, `Todo "${validTitle}" added successfully`);
      } catch (error) {
        return createErrorResponse(error instanceof Error ? error.message : 'Failed to add todo');
      }
    }],

    // Get all todos with optional filtering
    ["getTodos", async ({ status = 'all' } = {}) => {
      try {
        let filteredTodos = todos;

        if (status === 'completed') {
          filteredTodos = todos.filter(todo => todo.completed);
        } else if (status === 'pending') {
          filteredTodos = todos.filter(todo => !todo.completed);
        } else if (status !== 'all') {
          throw new Error('Status must be "all", "completed", or "pending"');
        }

        return createSuccessResponse({
          todos: filteredTodos,
          total: filteredTodos.length,
          completed: filteredTodos.filter(t => t.completed).length,
          pending: filteredTodos.filter(t => !t.completed).length
        }, `Retrieved ${filteredTodos.length} todos`);
      } catch (error) {
        return createErrorResponse(error instanceof Error ? error.message : 'Failed to get todos');
      }
    }],

    // Get a specific todo by ID
    ["getTodoById", async ({ id }) => {
      try {
        const validId = validateId(id);
        const todo = todos.find(t => t.id === validId);

        if (!todo) {
          throw new Error(`Todo with ID ${validId} not found`);
        }

        return createSuccessResponse(todo, `Retrieved todo "${todo.title}"`);
      } catch (error) {
        return createErrorResponse(error instanceof Error ? error.message : 'Failed to get todo');
      }
    }],

    // Update todo title
    ["updateTodo", async ({ id, title }) => {
      try {
        const validId = validateId(id);
        const validTitle = validateTitle(title);

        const todoIndex = todos.findIndex(t => t.id === validId);
        if (todoIndex === -1) {
          throw new Error(`Todo with ID ${validId} not found`);
        }

        const oldTitle = todos[todoIndex].title;
        todos[todoIndex].title = validTitle;
        todos[todoIndex].updatedAt = new Date().toISOString();

        return createSuccessResponse(
          todos[todoIndex],
          `Todo updated from "${oldTitle}" to "${validTitle}"`
        );
      } catch (error) {
        return createErrorResponse(error instanceof Error ? error.message : 'Failed to update todo');
      }
    }],

    // Toggle todo completion status
    ["toggleTodo", async ({ id }) => {
      try {
        const validId = validateId(id);
        const todoIndex = todos.findIndex(t => t.id === validId);

        if (todoIndex === -1) {
          throw new Error(`Todo with ID ${validId} not found`);
        }

        todos[todoIndex].completed = !todos[todoIndex].completed;
        todos[todoIndex].updatedAt = new Date().toISOString();

        const status = todos[todoIndex].completed ? 'completed' : 'pending';
        return createSuccessResponse(
          todos[todoIndex],
          `Todo "${todos[todoIndex].title}" marked as ${status}`
        );
      } catch (error) {
        return createErrorResponse(error instanceof Error ? error.message : 'Failed to toggle todo');
      }
    }],

    // Delete a specific todo
    ["deleteTodo", async ({ id }) => {
      try {
        const validId = validateId(id);
        const todoIndex = todos.findIndex(t => t.id === validId);

        if (todoIndex === -1) {
          throw new Error(`Todo with ID ${validId} not found`);
        }

        const deletedTodo = todos.splice(todoIndex, 1)[0];
        return createSuccessResponse(
          { deletedTodo, remainingCount: todos.length },
          `Todo "${deletedTodo.title}" deleted successfully`
        );
      } catch (error) {
        return createErrorResponse(error instanceof Error ? error.message : 'Failed to delete todo');
      }
    }],

    // Clear all completed todos
    ["clearCompleted", async () => {
      try {
        const completedCount = todos.filter(t => t.completed).length;

        if (completedCount === 0) {
          return createSuccessResponse(
            { clearedCount: 0, remainingCount: todos.length },
            'No completed todos to clear'
          );
        }

        todos = todos.filter(t => !t.completed);
        return createSuccessResponse(
          { clearedCount: completedCount, remainingCount: todos.length },
          `Cleared ${completedCount} completed todos`
        );
      } catch (error) {
        return createErrorResponse('Failed to clear completed todos');
      }
    }],

    // Clear all todos with confirmation
    ["clearAllTodos", async ({ confirm = false } = {}) => {
      try {
        if (!confirm) {
          return createErrorResponse('Please set confirm=true to clear all todos. This action cannot be undone.');
        }

        const totalCount = todos.length;
        todos = [];
        nextId = 1;

        return createSuccessResponse(
          { clearedCount: totalCount },
          `All ${totalCount} todos cleared successfully`
        );
      } catch (error) {
        return createErrorResponse('Failed to clear all todos');
      }
    }],

    // Get todo statistics
    ["getTodoStats", async () => {
      try {
        const total = todos.length;
        const completed = todos.filter(t => t.completed).length;
        const pending = total - completed;
        const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

        const oldestTodo = todos.length > 0 ?
          todos.reduce((oldest, current) =>
            new Date(current.createdAt) < new Date(oldest.createdAt) ? current : oldest
          ) : null;

        const newestTodo = todos.length > 0 ?
          todos.reduce((newest, current) =>
            new Date(current.createdAt) > new Date(newest.createdAt) ? current : newest
          ) : null;

        return createSuccessResponse({
          total,
          completed,
          pending,
          completionRate: `${completionRate}%`,
          oldestTodo: oldestTodo ? {
            id: oldestTodo.id,
            title: oldestTodo.title,
            createdAt: oldestTodo.createdAt
          } : null,
          newestTodo: newestTodo ? {
            id: newestTodo.id,
            title: newestTodo.title,
            createdAt: newestTodo.createdAt
          } : null
        }, 'Todo statistics retrieved successfully');
      } catch (error) {
        return createErrorResponse('Failed to get todo statistics');
      }
    }]
  ]
});