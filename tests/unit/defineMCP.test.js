import assert from 'node:assert';
import { describe, test } from 'node:test';
import { defineMCP } from '../../src/defineMCP.js';

describe('defineMCP', () => {
  test('should create valid MCP config with minimal input', () => {
    const config = defineMCP({
      name: 'Test App',
      version: '1.0.0',
      tools: [
        ['hello', async ({ name }) => `Hello ${name}!`]
      ]
    });

    assert.strictEqual(config.name, 'Test App');
    assert.strictEqual(config.version, '1.0.0');
    assert.strictEqual(config.tools.length, 1);
    assert.strictEqual(config.tools[0].name, 'hello');
    assert.strictEqual(config.tools[0].description, 'Tool: hello');
  });

  test('should handle object format tools', () => {
    const config = defineMCP({
      name: 'Test App',
      version: '1.0.0',
      tools: [
        {
          name: 'greet',
          description: 'Greet a user',
          handler: async ({ name }) => `Hello ${name}!`,
          schema: {
            type: 'object',
            properties: {
              name: { type: 'string' }
            }
          }
        }
      ]
    });

    assert.strictEqual(config.tools[0].name, 'greet');
    assert.strictEqual(config.tools[0].description, 'Greet a user');
    assert.deepStrictEqual(config.tools[0].inputSchema, {
      type: 'object',
      properties: {
        name: { type: 'string' }
      }
    });
  });

  test('should throw error for invalid config', () => {
    assert.throws(() => {
      defineMCP({
        name: 'Test App'
        // Missing version and tools
      });
    }, /Invalid MCP configuration/);
  });

  test('should throw error for duplicate tool names', () => {
    assert.throws(() => {
      defineMCP({
        name: 'Test App',
        version: '1.0.0',
        tools: [
          ['hello', async () => 'Hello 1'],
          ['hello', async () => 'Hello 2']
        ]
      });
    }, /Duplicate tool name/);
  });

  test('should handle empty description gracefully', () => {
    const config = defineMCP({
      name: 'Test App',
      version: '1.0.0',
      description: '',
      tools: [
        ['test', async () => 'test']
      ]
    });

    assert.strictEqual(config.description, '');
  });
});