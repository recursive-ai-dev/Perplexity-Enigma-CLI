import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('loadConfig', () => {
  it('returns defaults when no config file is present', async () => {
    const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'enigma-config-'));

    const { loadConfig, defaultConfig } = await import('../src/config.js');
    const config = loadConfig(baseDir);

    expect(config.api.base_url).toBe(defaultConfig.api.base_url);
    expect(config.models.default).toBe(defaultConfig.models.default);
    expect(config.output.stream).toBe(false);
  });

  it('applies environment variable overrides', async () => {
    const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'enigma-config-env-'));
    vi.stubEnv('PPLX_API_KEY', 'test-key');
    vi.stubEnv('PPLX_API_BASE_URL', 'https://test.api.ai');
    vi.stubEnv('PPLX_API_TIMEOUT', '30000');
    vi.stubEnv('PPLX_MODEL_DEFAULT', 'sonar');
    vi.stubEnv('PPLX_MODEL_SEARCH_HEAVY', 'sonar-pro-search');
    vi.stubEnv('PPLX_MODEL_REASONING', 'sonar-reasoning-large');
    vi.stubEnv('PPLX_MODEL_FAST', 'sonar-fast');
    vi.stubEnv('PPLX_MODEL_DEEP_RESEARCH', 'sonar-deep-search');
    vi.stubEnv('PPLX_OUTPUT_STREAM', 'true');
    vi.stubEnv('PPLX_API_TIMEOUT_INVALID', 'invalid');

    const { loadConfig, resolveApiKey } = await import('../src/config.js');
    const config = loadConfig(baseDir);

    expect(config.api.base_url).toBe('https://test.api.ai');
    expect(config.api.timeout).toBe(30000);
    expect(config.models.default).toBe('sonar');
    expect(config.models.search_heavy).toBe('sonar-pro-search');
    expect(config.models.reasoning).toBe('sonar-reasoning-large');
    expect(config.models.fast).toBe('sonar-fast');
    expect(config.models.deep_research).toBe('sonar-deep-search');
    expect(config.output.stream).toBe(true);
    expect(resolveApiKey(config)).toBe('test-key');
  });

  it('handles invalid timeout parsing from env', async () => {
    const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'enigma-config-env-'));
    vi.stubEnv('PPLX_API_TIMEOUT', 'invalid');

    const { loadConfig, defaultConfig } = await import('../src/config.js');
    const config = loadConfig(baseDir);

    expect(config.api.timeout).toBe(defaultConfig.api.timeout);
  });

  it('handles invalid numbers, booleans and strings from env gracefully', async () => {
    const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'enigma-config-invalid-env-'));
    vi.stubEnv('PPLX_AGENT_MAX_ITERATIONS', 'invalid');
    vi.stubEnv('PPLX_AGENT_TEMPERATURE', 'invalid');
    vi.stubEnv('PPLX_AGENT_MAX_TOKENS', 'invalid');
    vi.stubEnv('PPLX_AGENT_TOP_P', 'invalid');
    vi.stubEnv('PPLX_SEARCH_MODE', 'invalid');
    vi.stubEnv('PPLX_INCLUDE_CITATIONS', 'invalid');
    vi.stubEnv('PPLX_FOCUS_ON_RECENT', 'invalid');
    vi.stubEnv('PPLX_OUTPUT_FORMAT', 'invalid');
    vi.stubEnv('PPLX_OUTPUT_STREAM', 'invalid');
    vi.stubEnv('PPLX_VERBOSE', 'invalid');

    // Also add one random env to hit the default branch in switch block
    process.env['PPLX_UNKNOWN'] = 'true';

    const { loadConfig, defaultConfig } = await import('../src/config.js');
    const config = loadConfig(baseDir);

    expect(config.agent.max_iterations).toBe(defaultConfig.agent.max_iterations);
    expect(config.agent.temperature).toBe(defaultConfig.agent.temperature);
    expect(config.agent.max_tokens).toBe(defaultConfig.agent.max_tokens);
    expect(config.agent.top_p).toBe(defaultConfig.agent.top_p);
    expect(config.research.search_mode).toBe(defaultConfig.research.search_mode);
    // parseBoolean returns false for 'invalid', which overrides the true default,
    // so we expect false instead of defaultConfig
    expect(config.research.include_citations).toBe(false);
    expect(config.research.focus_on_recent).toBe(false);
    expect(config.output.format).toBe(defaultConfig.output.format);
    expect(config.output.stream).toBe(false);
    expect(config.output.verbose).toBe(false);

    delete process.env['PPLX_UNKNOWN'];
  });

  it('applies agent config from environment variables', async () => {
    const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'enigma-config-agent-'));
    vi.stubEnv('PPLX_AGENT_TEMPERATURE', '0.7');
    vi.stubEnv('PPLX_AGENT_MAX_TOKENS', '2048');
    vi.stubEnv('PPLX_AGENT_TOP_P', '0.95');
    vi.stubEnv('PPLX_AGENT_MAX_ITERATIONS', '5');

    const { loadConfig } = await import('../src/config.js');
    const config = loadConfig(baseDir);

    expect(config.agent.temperature).toBe(0.7);
    expect(config.agent.max_tokens).toBe(2048);
    expect(config.agent.top_p).toBe(0.95);
    expect(config.agent.max_iterations).toBe(5);
  });

  it('applies research config from environment variables', async () => {
    const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'enigma-config-research-'));
    vi.stubEnv('PPLX_SEARCH_MODE', 'high');
    vi.stubEnv('PPLX_INCLUDE_CITATIONS', 'false');
    vi.stubEnv('PPLX_FOCUS_ON_RECENT', 'false');

    const { loadConfig } = await import('../src/config.js');
    const config = loadConfig(baseDir);

    expect(config.research.search_mode).toBe('high');
    expect(config.research.include_citations).toBe(false);
    expect(config.research.focus_on_recent).toBe(false);
  });

  it('applies output config from environment variables', async () => {
    const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'enigma-config-output-'));
    vi.stubEnv('PPLX_OUTPUT_FORMAT', 'json');
    vi.stubEnv('PPLX_VERBOSE', 'true');

    const { loadConfig } = await import('../src/config.js');
    const config = loadConfig(baseDir);

    expect(config.output.format).toBe('json');
    expect(config.output.verbose).toBe(true);
  });

  it('merges values from .pplxrc when present', async () => {
    const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'enigma-config-file-'));

    const configPath = path.join(baseDir, '.pplxrc');
    fs.writeFileSync(
      configPath,
      `
api:
  base_url: "https://example.test"
output:
  format: "json"
`,
    );

    const { loadConfig } = await import('../src/config.js');
    const config = loadConfig(baseDir);

    expect(config.api.base_url).toBe('https://example.test');
    expect(config.output.format).toBe('json');
  });

  it('gracefully handles malformed YAML', async () => {
    const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'enigma-config-bad-'));
    const configPath = path.join(baseDir, '.pplxrc');
    fs.writeFileSync(configPath, 'api: key: bad'); // invalid YAML

    const { loadConfig, defaultConfig } = await import('../src/config.js');
    const config = loadConfig(baseDir);

    expect(config.api.base_url).toBe(defaultConfig.api.base_url);
    expect(config.models.default).toBe(defaultConfig.models.default);
  });
});

describe('validateApiKeyFormat', () => {
  it('rejects empty or missing keys', async () => {
    const { validateApiKeyFormat } = await import('../src/config.js');
    
    expect(validateApiKeyFormat('')).toEqual({ valid: false, message: 'API key is required' });
    expect(validateApiKeyFormat(null as any)).toEqual({ valid: false, message: 'API key is required' });
    expect(validateApiKeyFormat(undefined as any)).toEqual({ valid: false, message: 'API key is required' });
  });

  it('rejects keys not starting with pplx-', async () => {
    const { validateApiKeyFormat } = await import('../src/config.js');
    
    expect(validateApiKeyFormat('sk-1234567890123456789012345678901234567890')).toEqual({ 
      valid: false, 
      message: 'API key must start with "pplx-"' 
    });
  });

  it('rejects keys that are too short', async () => {
    const { validateApiKeyFormat } = await import('../src/config.js');
    
    expect(validateApiKeyFormat('pplx-short')).toEqual({ 
      valid: false, 
      message: 'API key is too short' 
    });
  });

  it('rejects keys that are too long', async () => {
    const { validateApiKeyFormat } = await import('../src/config.js');
    const longKey = 'pplx-' + 'a'.repeat(200);
    
    expect(validateApiKeyFormat(longKey)).toEqual({ 
      valid: false, 
      message: 'API key is too long' 
    });
  });

  it('rejects keys with invalid characters', async () => {
    const { validateApiKeyFormat } = await import('../src/config.js');
    
    expect(validateApiKeyFormat('pplx-abc!@#$%^&*()1234567890123456789012')).toEqual({ 
      valid: false, 
      message: 'API key contains invalid characters' 
    });
  });

  it('accepts valid API keys', async () => {
    const { validateApiKeyFormat } = await import('../src/config.js');
    
    // Valid key with 32+ alphanumeric characters after prefix
    const validKey = 'pplx-abcdef1234567890abcdef1234567890';
    expect(validateApiKeyFormat(validKey)).toEqual({ valid: true });

    // Valid key with hyphens and underscores
    const validKeyWithChars = 'pplx-abc-def_123-456-789-0ab-cdef-1234';
    expect(validateApiKeyFormat(validKeyWithChars)).toEqual({ valid: true });
  });
});

describe('deepMerge', () => {
  it('merges nested objects', async () => {
    const { deepMerge } = await import('../src/config.js');
    
    const base = { a: { b: 1, c: 2 }, d: 3 };
    const override = { a: { b: 10 } };
    
    const result = deepMerge(base, override);
    
    expect(result).toEqual({ a: { b: 10, c: 2 }, d: 3 });
  });

  it('handles arrays by replacing them', async () => {
    const { deepMerge } = await import('../src/config.js');
    
    const base = { items: [1, 2, 3] };
    const override = { items: [4, 5] };
    
    const result = deepMerge(base, override);
    
    expect(result).toEqual({ items: [4, 5] });
  });

  it('skips undefined values', async () => {
    const { deepMerge } = await import('../src/config.js');
    
    const base = { a: 1, b: 2 };
    const override = { a: undefined, b: 3 };
    
    const result = deepMerge(base, override);
    
    expect(result).toEqual({ a: 1, b: 3 });
  });

  it('returns base when override is null', async () => {
    const { deepMerge } = await import('../src/config.js');
    
    const base = { a: 1 };
    const result = deepMerge(base, null as any);
    
    expect(result).toEqual({ a: 1 });
  });

  it('returns base when override is non-object', async () => {
    const { deepMerge } = await import('../src/config.js');
    
    const base = { a: 1 };
    const result = deepMerge(base, 'string' as any);
    
    expect(result).toEqual({ a: 1 });
  });

  it('handles deeply nested objects', async () => {
    const { deepMerge } = await import('../src/config.js');
    
    const base = { a: { b: { c: { d: 1 } } } };
    const override = { a: { b: { c: { d: 2, e: 3 } } } };
    
    const result = deepMerge(base, override);
    
    expect(result).toEqual({ a: { b: { c: { d: 2, e: 3 } } } });
  });
});

describe('parseBoolean', () => {
  it('parses true values', async () => {
    const { parseBoolean } = await import('../src/config.js');
    
    expect(parseBoolean('true')).toBe(true);
    expect(parseBoolean('1')).toBe(true);
  });

  it('parses false values', async () => {
    const { parseBoolean } = await import('../src/config.js');
    
    expect(parseBoolean('false')).toBe(false);
    expect(parseBoolean('0')).toBe(false);
    expect(parseBoolean('anything')).toBe(false);
  });

  it('returns undefined for undefined input', async () => {
    const { parseBoolean } = await import('../src/config.js');
    
    expect(parseBoolean(undefined)).toBe(undefined);
  });
});

describe('parseNumber', () => {
  it('parses valid numbers', async () => {
    const { parseNumber } = await import('../src/config.js');
    
    expect(parseNumber('42')).toBe(42);
    expect(parseNumber('3.14')).toBe(3.14);
    expect(parseNumber('-10')).toBe(-10);
  });

  it('returns undefined for invalid numbers', async () => {
    const { parseNumber } = await import('../src/config.js');
    
    expect(parseNumber('not a number')).toBe(undefined);
    expect(parseNumber('NaN')).toBe(undefined);
    expect(parseNumber('Infinity')).toBe(undefined);
  });

  it('returns undefined for undefined input', async () => {
    const { parseNumber } = await import('../src/config.js');
    
    expect(parseNumber(undefined)).toBe(undefined);
  });
});

describe('parseSearchMode', () => {
  it('parses valid search modes', async () => {
    const { parseSearchMode } = await import('../src/config.js');
    
    expect(parseSearchMode('low')).toBe('low');
    expect(parseSearchMode('medium')).toBe('medium');
    expect(parseSearchMode('high')).toBe('high');
  });

  it('returns undefined for invalid modes', async () => {
    const { parseSearchMode } = await import('../src/config.js');
    
    expect(parseSearchMode('invalid')).toBe(undefined);
    expect(parseSearchMode('')).toBe(undefined);
    expect(parseSearchMode(undefined)).toBe(undefined);
  });
});

describe('parseOutputFormat', () => {
  it('parses valid output formats', async () => {
    const { parseOutputFormat } = await import('../src/config.js');
    
    expect(parseOutputFormat('markdown')).toBe('markdown');
    expect(parseOutputFormat('json')).toBe('json');
    expect(parseOutputFormat('plain')).toBe('plain');
  });

  it('returns undefined for invalid formats', async () => {
    const { parseOutputFormat } = await import('../src/config.js');
    
    expect(parseOutputFormat('html')).toBe(undefined);
    expect(parseOutputFormat('')).toBe(undefined);
    expect(parseOutputFormat(undefined)).toBe(undefined);
  });
});

describe('writeSecureFile', () => {
  it('writes file with mode 0600', async () => {
    const { writeSecureFile } = await import('../src/config.js');
    
    const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'enigma-secure-'));
    const filePath = path.join(baseDir, 'test-file');
    
    writeSecureFile(filePath, 'secret content');
    
    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toBe('secret content');
    
    // Check file permissions (only on Unix-like systems)
    if (process.platform !== 'win32') {
      const stats = fs.statSync(filePath);
      const mode = stats.mode & 0o777;
      expect(mode).toBe(0o600);
    }
  });
});

describe('saveConfig', () => {
  it('saves config with secure permissions', async () => {
    const { saveConfig, loadConfig, defaultConfig } = await import('../src/config.js');
    
    const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'enigma-save-'));
    const configPath = path.join(baseDir, '.pplxrc');
    
    saveConfig(defaultConfig, configPath);
    
    // Verify file was created
    expect(fs.existsSync(configPath)).toBe(true);
    
    // Verify it can be loaded back
    const loaded = loadConfig(baseDir);
    expect(loaded.api.base_url).toBe(defaultConfig.api.base_url);
    
    // Check file permissions (only on Unix-like systems)
    if (process.platform !== 'win32') {
      const stats = fs.statSync(configPath);
      const mode = stats.mode & 0o777;
      expect(mode).toBe(0o600);
    }
  });
});

describe('validateModelName', () => {
  it('returns default model when none provided', async () => {
    const { validateModelName, defaultConfig } = await import('../src/config.js');
    
    const result = validateModelName(undefined, defaultConfig);
    expect(result).toEqual({ model: 'sonar-pro', warned: false });
  });

  it('accepts valid models', async () => {
    const { validateModelName, defaultConfig } = await import('../src/config.js');
    
    expect(validateModelName('sonar', defaultConfig)).toEqual({ model: 'sonar', warned: false });
    expect(validateModelName('sonar-pro', defaultConfig)).toEqual({ model: 'sonar-pro', warned: false });
    expect(validateModelName('sonar-reasoning', defaultConfig)).toEqual({ model: 'sonar-reasoning', warned: false });
  });

  it('falls back to default for invalid models', async () => {
    const { validateModelName, defaultConfig } = await import('../src/config.js');
    
    const result = validateModelName('invalid-model', defaultConfig);
    expect(result).toEqual({ model: 'sonar-pro', warned: true });
  });
});
