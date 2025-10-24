import { existsSync } from 'fs';
import { resolve } from 'path';
import { defineMCP } from '../defineMCP.js';
import { logger } from './logger.js';

export async function loadConfig(configPath = null) {
  let resolvedConfigPath = null;

  if (configPath) {
    logger.debug('loadConfig - Custom config path provided - RUN');
    const fullPath = resolve(configPath);
    if (existsSync(fullPath)) {
      resolvedConfigPath = fullPath;
    } else {
      throw new Error(
        `Config file not found: ${configPath}\nMake sure the file exists and the path is correct.`
      );
    }
  } else {
    logger.debug('loadConfig - Searching for config in current directory - RUN');
    const configPaths = ['mcp.config.js', 'mcp.config.mjs'];

    for (const path of configPaths) {
      const fullPath = resolve(process.cwd(), path);
      if (existsSync(fullPath)) {
        resolvedConfigPath = fullPath;
        logger.debug(`loadConfig - Found config at ${path} - RUN`);
        break;
      }
    }
  }

  if (!resolvedConfigPath) {
    throw new Error(
      `No mcp.config.js found in current directory\nSuggestion: Run 'mcp-connect init' to create a config file`
    );
  }

  logger.debug(`loadConfig - Loading config from ${resolvedConfigPath} - RUN`);

  let configModule;
  try {
    if (resolvedConfigPath.endsWith('.ts')) {
      throw new Error(
        `TypeScript config detected at ${resolvedConfigPath}\nPlease rename to .js or .mjs and use JavaScript syntax.`
      );
    }

    const fileUrl = resolvedConfigPath.startsWith('/')
      ? `file://${resolvedConfigPath}`
      : `file:///${resolvedConfigPath.replace(/\\/g, '/')}`;

    configModule = await import(fileUrl);
  } catch (error) {
    if (error.message.includes('TypeScript config detected')) {
      throw error;
    }

    let errorMessage = `Failed to load config file: ${error.message}`;

    if (
      error.message.includes('Cannot resolve') ||
      error.message.includes('MODULE_NOT_FOUND')
    ) {
      errorMessage += `\nMake sure 'mcp-connect' is installed: npm install mcp-connect`;
    } else if (error.message.includes('SyntaxError')) {
      errorMessage += `\nConfig file has syntax errors. Check your JavaScript syntax.`;
    } else if (error.message.includes('ERR_MODULE_NOT_FOUND')) {
      errorMessage += `\nModule import error. Check your import paths in the config file.`;
    }

    throw new Error(errorMessage);
  }

  const config = configModule.default;

  if (!config) {
    throw new Error(
      `Config file must export a default configuration\nMake sure your config has: export default defineMCP({...})`
    );
  }

  logger.debug('loadConfig - Validating config - RUN');

  let validatedConfig;
  try {
    validatedConfig = typeof config === 'function' ? config : defineMCP(config);
  } catch (error) {
    throw new Error(`Configuration validation failed: ${error.message}`);
  }

  return {
    config: validatedConfig,
    configPath: resolvedConfigPath
  };
}
