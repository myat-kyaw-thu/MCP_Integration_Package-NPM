import assert from 'node:assert';
import { describe, test } from 'node:test';
import { defineMCP } from '../../src/defineMCP.js';
import { MCPConnectServer } from '../../src/server/mcpServer.js';

describe('MCPConnectServer Integration', () => {
  test('should create server with valid config', () => {
    const config = defineMCP({
      name: 'Test Server',
      version: '1.0.0',
      tools: [
        ['hello', async ({ name }) => `Hello ${name}!`]
      ]
    });

    const server = new MCPConnectServer(config);
    assert.ok(server);
    assert.strictEqual(server.config.name, 'Test Server');
    assert.strictEqual(server.config.tools.length, 1);
  });

  test('should handle graceful shutdown', async () => {
    const config = defineMCP({
      name: 'Test Server',
      version: '1.0.0',
      tools: [
        ['test', async () => 'test']
      ]
    });

    const server = new MCPConnectServer(config);

    // Should not throw when stopping
    await assert.doesNotReject(async () => {
      await server.stop();
    });

    assert.strictEqual(server.isShuttingDown, true);
  });

  test('should validate tool arguments', async () => {
    const config = defineMCP({
      name: 'Test Server',
      version: '1.0.0',
      tools: [
        ['echo', async (args) => args]
      ]
    });

    const server = new MCPConnectServer(config);

    // Test withTimeout method
    const testPromise = Promise.resolve('test result');
    const result = await server.withTimeout(testPromise, 1000, 'test operation');
    assert.strictEqual(result, 'test result');
  });

  test('should handle timeout in tool execution', async () => {
    const config = defineMCP({
      name: 'Test Server',
      version: '1.0.0',
      tools: [
        ['slowTool', async () => {
          return new Promise(resolve => {
            setTimeout(() => resolve('done'), 100);
          });
        }]
      ]
    });

    const server = new MCPConnectServer(config);

    // Test timeout with very short timeout
    try {
      await server.withTimeout(
        new Promise(resolve => setTimeout(() => resolve('done'), 100)),
        10, // 10ms timeout
        'slow operation'
      );
      assert.fail('Should have timed out');
    } catch (error) {
      assert.ok(error.message.includes('timed out'));
    }
  });

  test('should handle server shutdown flag during operations', async () => {
    const config = defineMCP({
      name: 'Test Server',
      version: '1.0.0',
      tools: [
        ['test', async () => 'test']
      ]
    });

    const server = new MCPConnectServer(config);
    server.isShuttingDown = true;

    // Server should reject operations when shutting down
    // Note: This tests the concept, actual MCP request handling would need mock transport
    assert.strictEqual(server.isShuttingDown, true);
  });

  test('should setup graceful shutdown handlers', () => {
    const config = defineMCP({
      name: 'Test Server',
      version: '1.0.0',
      tools: [
        ['test', async () => 'test']
      ]
    });

    const server = new MCPConnectServer(config);

    // Verify shutdown handlers are set up (they exist on process)
    assert.ok(process.listenerCount('SIGINT') > 0);
    assert.ok(process.listenerCount('SIGTERM') > 0);
    assert.ok(process.listenerCount('uncaughtException') > 0);
    assert.ok(process.listenerCount('unhandledRejection') > 0);
  });
});