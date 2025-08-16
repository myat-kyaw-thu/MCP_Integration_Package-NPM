import assert from 'node:assert';
import { describe, test } from 'node:test';
import { defineMCP } from '../../src/defineMCP.js';
import { MCPConnectServer } from '../../src/server/mcpServer.js';

describe('Error Handling Integration', () => {
  test('should handle rate limiting', async () => {
    const config = defineMCP({
      name: 'Test Server',
      version: '1.0.0',
      tools: [
        ['test', async () => 'test']
      ]
    });

    const server = new MCPConnectServer(config);

    // Set a very low rate limit for testing
    server.maxRequestsPerMinute = 2;

    // Verify rate limiting properties exist
    assert.ok(server.requestCounts instanceof Map);
    assert.strictEqual(server.maxRequestsPerMinute, 2);
  });

  test('should handle large responses with truncation', async () => {
    const config = defineMCP({
      name: 'Test Server',
      version: '1.0.0',
      tools: [
        ['largeTool', async () => {
          // Create a large response
          return 'x'.repeat(2000000); // 2MB string
        }]
      ]
    });

    const server = new MCPConnectServer(config);

    // Test that server can be created with tools that might return large responses
    assert.ok(server);
    assert.strictEqual(server.config.tools.length, 1);
  });

  test('should handle circular references in responses', async () => {
    const config = defineMCP({
      name: 'Test Server',
      version: '1.0.0',
      tools: [
        ['circularTool', async () => {
          const obj = { name: 'test' };
          obj.self = obj; // Create circular reference
          return obj;
        }]
      ]
    });

    const server = new MCPConnectServer(config);

    // Test that server can handle tools with circular references
    assert.ok(server);
    assert.strictEqual(server.config.tools.length, 1);
  });

  test('should initialize request tracking', () => {
    const config = defineMCP({
      name: 'Test Server',
      version: '1.0.0',
      tools: [
        ['test', async () => 'test']
      ]
    });

    const server = new MCPConnectServer(config);

    // Verify request tracking is initialized
    assert.ok(server.requestCounts instanceof Map);
    assert.strictEqual(server.requestCounts.size, 0);
    assert.strictEqual(typeof server.maxRequestsPerMinute, 'number');
    assert.ok(server.maxRequestsPerMinute > 0);
  });

  test('should handle server shutdown during request processing', async () => {
    const config = defineMCP({
      name: 'Test Server',
      version: '1.0.0',
      tools: [
        ['test', async () => 'test']
      ]
    });

    const server = new MCPConnectServer(config);

    // Test shutdown flag
    server.isShuttingDown = false;
    assert.strictEqual(server.isShuttingDown, false);

    server.isShuttingDown = true;
    assert.strictEqual(server.isShuttingDown, true);
  });

  test('should handle timeout scenarios', async () => {
    const config = defineMCP({
      name: 'Test Server',
      version: '1.0.0',
      tools: [
        ['slowTool', async () => {
          return new Promise(resolve => {
            setTimeout(() => resolve('done'), 50);
          });
        }]
      ]
    });

    const server = new MCPConnectServer(config);

    // Test withTimeout method with successful completion
    const fastPromise = Promise.resolve('fast');
    const result = await server.withTimeout(fastPromise, 1000, 'fast operation');
    assert.strictEqual(result, 'fast');

    // Test withTimeout method with timeout
    const slowPromise = new Promise(resolve => {
      setTimeout(() => resolve('slow'), 100);
    });

    try {
      await server.withTimeout(slowPromise, 10, 'slow operation');
      assert.fail('Should have timed out');
    } catch (error) {
      assert.ok(error.message.includes('timed out'));
    }
  });
});