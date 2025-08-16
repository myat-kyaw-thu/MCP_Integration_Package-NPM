import assert from 'node:assert';
import { describe, test } from 'node:test';
import { formatValidationErrors, validateConfig } from '../../src/utils/configValidation.js';

describe('configValidation', () => {
  test('should validate correct config', () => {
    const result = validateConfig({
      name: 'Test App',
      version: '1.0.0',
      tools: [
        ['hello', async ({ name }) => `Hello ${name}!`]
      ]
    });

    assert.strictEqual(result.isValid, true);
    assert.strictEqual(result.errors.length, 0);
  });

  test('should catch missing required fields', () => {
    const result = validateConfig({
      name: 'Test App'
      // Missing version and tools
    });

    assert.strictEqual(result.isValid, false);
    assert.ok(result.errors.some(e => e.field === 'version'));
    assert.ok(result.errors.some(e => e.field === 'tools'));
  });

  test('should validate tool names', () => {
    const result = validateConfig({
      name: 'Test App',
      version: '1.0.0',
      tools: [
        ['', async () => 'test'] // Empty tool name
      ]
    });

    assert.strictEqual(result.isValid, false);
    assert.ok(result.errors.some(e => e.message.includes('Tool name cannot be empty')));
  });

  test('should catch duplicate tool names', () => {
    const result = validateConfig({
      name: 'Test App',
      version: '1.0.0',
      tools: [
        ['hello', async () => 'Hello 1'],
        ['hello', async () => 'Hello 2']
      ]
    });

    assert.strictEqual(result.isValid, false);
    assert.ok(result.errors.some(e => e.message.includes('Duplicate tool name')));
  });

  test('should validate tool handlers are functions', () => {
    const result = validateConfig({
      name: 'Test App',
      version: '1.0.0',
      tools: [
        ['hello', 'not a function']
      ]
    });

    assert.strictEqual(result.isValid, false);
    assert.ok(result.errors.some(e => e.message.includes('Tool handler must be a function')));
  });

  test('should format validation errors nicely', () => {
    const result = validateConfig({
      name: '',
      version: 'invalid-version',
      tools: []
    });

    const formatted = formatValidationErrors(result);
    assert.ok(formatted.includes('❌ Configuration Errors:'));
    assert.ok(formatted.includes('Name cannot be empty'));
    assert.ok(formatted.includes('At least one tool must be defined'));
  });

  test('should handle warnings separately from errors', () => {
    const result = validateConfig({
      name: 'Test App',
      version: '1.0.0',
      tools: [
        ['hello-123', async () => 'test'] // Warning: non-standard name format (contains hyphen)
      ]
    });

    assert.strictEqual(result.isValid, true);
    assert.ok(result.warnings.length > 0);
  });
});