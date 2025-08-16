import assert from 'node:assert';
import { describe, test } from 'node:test';
import { logger } from '../../src/utils/logger.js';

describe('logger', () => {
  test('should format log messages correctly', () => {
    const context = {
      timestamp: '2025-01-01T00:00:00.000Z',
      level: 'info',
      message: 'Test message',
      toolName: 'testTool',
      requestId: 'req123',
      duration: 100
    };

    const formatted = logger.formatLog(context);
    assert.ok(formatted.includes('[MCP-INFO]'));
    assert.ok(formatted.includes('Test message'));
    assert.ok(formatted.includes('[tool:testTool]'));
    assert.ok(formatted.includes('[req:req123]'));
    assert.ok(formatted.includes('(100ms)'));
  });

  test('should respect log levels', () => {
    const originalLevel = logger.logLevel;

    // Set to warn level
    logger.logLevel = 'warn';

    assert.strictEqual(logger.shouldLog('debug'), false);
    assert.strictEqual(logger.shouldLog('info'), false);
    assert.strictEqual(logger.shouldLog('warn'), true);
    assert.strictEqual(logger.shouldLog('error'), true);

    // Restore original level
    logger.logLevel = originalLevel;
  });

  test('should handle debug mode', () => {
    const originalDebug = logger.debugMode;
    const originalLevel = logger.logLevel;
    const originalPerf = logger.performanceTracking;

    // Enable debug mode and performance tracking
    logger.debugMode = true;
    logger.performanceTracking = true;
    logger.logLevel = 'debug';
    assert.strictEqual(logger.shouldLog('debug'), true);

    logger.debugMode = false;
    logger.logLevel = 'info';
    assert.strictEqual(logger.shouldLog('debug'), false);

    // Restore original state
    logger.debugMode = originalDebug;
    logger.logLevel = originalLevel;
    logger.performanceTracking = originalPerf;
  });

  test('should create timer function', () => {
    const originalPerf = logger.performanceTracking;

    // Enable performance tracking for this test
    logger.performanceTracking = true;

    const timer = logger.startTimer('test operation');
    assert.strictEqual(typeof timer, 'function');

    // Timer should return duration when called
    const duration = timer();
    assert.strictEqual(typeof duration, 'number');
    assert.ok(duration >= 0);

    // Restore original state
    logger.performanceTracking = originalPerf;
  });

  test('should time async operations', async () => {
    const testPromise = new Promise(resolve => {
      setTimeout(() => resolve('test result'), 10);
    });

    const result = await logger.timeAsync('test async', testPromise, 'testTool');
    assert.strictEqual(result, 'test result');
  });

  test('should handle async operation errors', async () => {
    const testPromise = Promise.reject(new Error('Test error'));

    try {
      await logger.timeAsync('test async error', testPromise, 'testTool');
      assert.fail('Should have thrown error');
    } catch (error) {
      assert.strictEqual(error.message, 'Test error');
    }
  });
});