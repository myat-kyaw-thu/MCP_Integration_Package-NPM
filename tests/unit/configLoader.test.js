import assert from 'node:assert';
import { describe, test } from 'node:test';
import { writeFileSync, unlinkSync, mkdirSync, rmSync } from 'fs';
import { resolve } from 'path';
import { loadConfig } from '../../src/utils/configLoader.js';

describe('configLoader', () => {
    const testDir = resolve(process.cwd(), 'tests/unit/fixtures/config-loader');
    const validConfigPath = resolve(testDir, 'valid.config.js');
    const invalidConfigPath = resolve(testDir, 'invalid.config.js');

    test('should load valid config successfully', async () => {
        mkdirSync(testDir, { recursive: true });

        const defineMCPPath = resolve(process.cwd(), 'src/defineMCP.js');
        const validConfig = `import { defineMCP } from '${defineMCPPath}';

export default defineMCP({
  name: 'Test App',
  version: '1.0.0',
  tools: [
    ['hello', async ({ name }) => \`Hello \${name}!\`]
  ]
});
`;

        writeFileSync(validConfigPath, validConfig, 'utf8');

        const result = await loadConfig(validConfigPath);

        assert.ok(result.config);
        assert.strictEqual(result.config.name, 'Test App');
        assert.strictEqual(result.config.version, '1.0.0');
        assert.strictEqual(result.configPath, validConfigPath);

        unlinkSync(validConfigPath);
        rmSync(testDir, { recursive: true, force: true });
    });

    test('should throw error for missing config file', async () => {
        await assert.rejects(
            async () => {
                await loadConfig('/nonexistent/path/config.js');
            },
            {
                message: /Config file not found/
            }
        );
    });

    test('should throw error for config without default export', async () => {
        mkdirSync(testDir, { recursive: true });

        const noDefaultConfig = `export const config = { name: 'Test' };`;

        writeFileSync(invalidConfigPath, noDefaultConfig, 'utf8');

        await assert.rejects(
            async () => {
                await loadConfig(invalidConfigPath);
            },
            {
                message: /Config file must export a default configuration/
            }
        );

        unlinkSync(invalidConfigPath);
        rmSync(testDir, { recursive: true, force: true });
    });
});
