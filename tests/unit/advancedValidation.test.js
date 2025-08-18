import assert from 'node:assert';
import { describe, test } from 'node:test';
import { validateConfig } from '../../src/utils/configValidation.js';

describe('Advanced Configuration Validation', () => {
  test('should validate function parameter count', () => {
    const result = validateConfig({
      name: 'Test App',
      version: '1.0.0',
      tools: [
        ['badTool', (arg1, arg2, arg3) => 'too many params'] // Should error
      ]
    });

    assert.strictEqual(result.isValid, false);
    assert.ok(result.errors.some(e => e.message.includes('should accept 0 or 1 parameter')));
  });

  test('should allow single parameter functions', () => {
    const result = validateConfig({
      name: 'Test App',
      version: '1.0.0',
      tools: [
        ['goodTool', (args) => 'single param ok'],
        ['noParamTool', () => 'no params ok']
      ]
    });

    assert.strictEqual(result.isValid, true);
  });

  test('should detect callback usage in handlers', () => {
    const result = validateConfig({
      name: 'Test App',
      version: '1.0.0',
      tools: [
        ['callbackTool', (args, callback) => {
          callback(null, 'result');
        }]
      ]
    });

    assert.strictEqual(result.isValid, false); // Too many params
    assert.ok(result.warnings.some(w => w.message.includes('appears to use callbacks')));
  });

  test('should warn about async/sync mixing', () => {
    const result = validateConfig({
      name: 'Test App',
      version: '1.0.0',
      tools: [
        ['asyncTool', async (args) => 'async result'],
        ['syncTool', (args) => 'sync result']
      ]
    });

    assert.strictEqual(result.isValid, true);
    assert.ok(result.warnings.some(w => w.message.includes('Mixing async and sync tools')));
  });

  test('should suggest converting sync tools when mostly async', () => {
    const result = validateConfig({
      name: 'Test App',
      version: '1.0.0',
      tools: [
        ['async1', async (args) => 'async 1'],
        ['async2', async (args) => 'async 2'],
        ['async3', async (args) => 'async 3'],
        ['sync1', (args) => 'sync 1'] // Only one sync tool
      ]
    });

    assert.strictEqual(result.isValid, true);
    assert.ok(result.warnings.some(w => w.message.includes('Most tools are async')));
  });

  test('should provide better guidance for empty tools array', () => {
    const result = validateConfig({
      name: 'Test App',
      version: '1.0.0',
      tools: []
    });

    assert.strictEqual(result.isValid, false);
    assert.ok(result.errors.some(e => e.suggestion.includes('mcp-connect init')));
  });

  test('should handle arrow functions correctly', () => {
    const result = validateConfig({
      name: 'Test App',
      version: '1.0.0',
      tools: [
        ['arrowTool', (args) => 'arrow function'],
        ['asyncArrow', async (args) => 'async arrow']
      ]
    });

    assert.strictEqual(result.isValid, true);
  });

  test('should detect Promise usage in non-async functions', () => {
    const result = validateConfig({
      name: 'Test App',
      version: '1.0.0',
      tools: [
        ['promiseTool', (args) => Promise.resolve('promise result')]
      ]
    });

    assert.strictEqual(result.isValid, true);
    // Should not warn about making it async since it returns a Promise
  });

  test('should handle function expressions', () => {
    const result = validateConfig({
      name: 'Test App',
      version: '1.0.0',
      tools: [
        ['funcExpr', function (args) { return 'function expression'; }],
        ['asyncFuncExpr', async function (args) { return 'async function expression'; }]
      ]
    });

    assert.strictEqual(result.isValid, true);
  });
});