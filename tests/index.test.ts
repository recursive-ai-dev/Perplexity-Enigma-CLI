import { describe, expect, it, vi } from 'vitest';
import { startInteractiveSession, normalizeAskOptions, ensureApiKeyInteractive, handleQuestion, program } from '../src/index.js';
import fs from 'fs';
import os from 'os';
import path from 'path';

vi.mock('../src/perplexity.js', async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    askPerplexity: vi.fn().mockResolvedValue('Mocked non-streamed response'),
    askPerplexityStreaming: vi.fn().mockResolvedValue(undefined),
  };
});

describe('normalizeAskOptions', () => {
  it('returns empty options when nothing provided', () => {
    const result = normalizeAskOptions({});
    expect(result).toEqual({ model: undefined, searchMode: undefined, stream: undefined });
  });

  it('passes through valid model', () => {
    const result = normalizeAskOptions({ model: 'sonar-pro' });
    expect(result.model).toBe('sonar-pro');
  });

  it('normalizes valid search modes', () => {
    expect(normalizeAskOptions({ searchMode: 'low' }).searchMode).toBe('low');
    expect(normalizeAskOptions({ searchMode: 'medium' }).searchMode).toBe('medium');
    expect(normalizeAskOptions({ searchMode: 'high' }).searchMode).toBe('high');
  });

  it('returns undefined for invalid search mode', () => {
    const result = normalizeAskOptions({ searchMode: 'invalid' });
    expect(result.searchMode).toBe(undefined);
  });

  it('passes through stream option', () => {
    expect(normalizeAskOptions({ stream: true }).stream).toBe(true);
    expect(normalizeAskOptions({ stream: false }).stream).toBe(false);
  });
});

describe('handleQuestion', () => {
  let perplexityModule: any;

  beforeEach(async () => {
    perplexityModule = await import('../src/perplexity.js');
    vi.clearAllMocks();
    process.env.PPLX_API_KEY = 'pplx-mock-key';
  });

  afterEach(() => {
    delete process.env.PPLX_API_KEY;
  });

  it('calls askPerplexityStreaming when stream option is true', async () => {
    await handleQuestion('test stream', { stream: true });
    expect(perplexityModule.askPerplexityStreaming).toHaveBeenCalledWith(
      'test stream',
      expect.any(Object),
      { model: undefined, searchMode: undefined }
    );
    expect(perplexityModule.askPerplexity).not.toHaveBeenCalled();
  });

  it('calls askPerplexity when stream option is false', async () => {
    await handleQuestion('test stream', { stream: false });
    expect(perplexityModule.askPerplexity).toHaveBeenCalledWith(
      'test stream',
      expect.any(Object),
      { model: undefined, searchMode: undefined }
    );
    expect(perplexityModule.askPerplexityStreaming).not.toHaveBeenCalled();
  });

describe('handleQuestion', () => {
  let perplexityModule: any;
  let loadConfigSpy: any;

  beforeEach(async () => {
    perplexityModule = await import('../src/perplexity.js');
    const configModule = await import('../src/config.js');
    loadConfigSpy = vi.spyOn(configModule, 'loadConfig').mockReturnValue({
      ...configModule.defaultConfig,
      output: { ...configModule.defaultConfig.output, stream: false },
    });
    vi.clearAllMocks();
    process.env.PPLX_API_KEY = 'pplx-mock-key';
  });

  afterEach(() => {
    loadConfigSpy.mockRestore();
    delete process.env.PPLX_API_KEY;
  });

  it('calls askPerplexity by default based on config', async () => {
    await handleQuestion('test default', {});
    expect(perplexityModule.askPerplexity).toHaveBeenCalledWith(
      'test default',
      expect.any(Object),
      { model: undefined, searchMode: undefined }
    );
    expect(perplexityModule.askPerplexityStreaming).not.toHaveBeenCalled();
  });
});

  it('sets exitCode to 1 on error and logs formatted error', async () => {
    const error = new Error('Test API Error');
    perplexityModule.askPerplexity.mockRejectedValueOnce(error);

    // Store original exitCode and log error
    const originalExitCode = process.exitCode;
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await handleQuestion('test error', { stream: false });

    expect(process.exitCode).toBe(1);
    expect(consoleErrorSpy).toHaveBeenCalled();

    // Restore
    process.exitCode = originalExitCode;
    consoleErrorSpy.mockRestore();
  });
});

describe('CLI Actions (program)', () => {
  let consoleLogSpy: any;
  let saveConfigSpy: any;
  let loadConfigSpy: any;
  let configModule: any;

  beforeEach(async () => {
    configModule = await import('../src/config.js');
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    saveConfigSpy = vi.spyOn(configModule, 'saveConfig').mockImplementation(() => {});
    loadConfigSpy = vi.spyOn(configModule, 'loadConfig').mockReturnValue(configModule.defaultConfig);
    vi.clearAllMocks();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    saveConfigSpy.mockRestore();
    loadConfigSpy.mockRestore();
  });

  it('runs config command to display config', async () => {
    await program.parseAsync(['node', 'test', 'config']);
    expect(loadConfigSpy).toHaveBeenCalled();
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Resolved configuration:'));
    expect(saveConfigSpy).not.toHaveBeenCalled();
  });

  it('runs config command with --save', async () => {
    await program.parseAsync(['node', 'test', 'config', '--save']);
    expect(loadConfigSpy).toHaveBeenCalled();
    expect(saveConfigSpy).toHaveBeenCalled();
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Configuration written'));
  });


  it('runs root command with empty question exits early', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'test';
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { program } = await import('../src/index.js');
    await program.parseAsync(['node', 'test', '   ']);

    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('No question provided'));

    process.env.NODE_ENV = originalEnv;
    consoleErrorSpy.mockRestore();
  });
});

describe('ensureApiKeyInteractive', () => {
  // Mock readline-sync
  vi.mock('readline-sync', () => ({
    default: {
      question: vi.fn(),
    },
  }));

  it('throws error when key is empty', async () => {
    const readlineSync = await import('readline-sync');
    vi.mocked(readlineSync.default.question).mockReturnValue('');

    const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'enigma-key-'));
    const configPath = path.join(baseDir, '.pplxrc');

    expect(() => ensureApiKeyInteractive(configPath)).toThrow(/API key is required/);
  });

  it('throws error for invalid key format', async () => {
    const readlineSync = await import('readline-sync');
    vi.mocked(readlineSync.default.question).mockReturnValue('invalid-key');

    const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'enigma-key-'));
    const configPath = path.join(baseDir, '.pplxrc');

    expect(() => ensureApiKeyInteractive(configPath)).toThrow(/Invalid API key/);
  });

  it('throws error for key that is too short', async () => {
    const readlineSync = await import('readline-sync');
    vi.mocked(readlineSync.default.question).mockReturnValue('pplx-short');

    const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'enigma-key-'));
    const configPath = path.join(baseDir, '.pplxrc');

    expect(() => ensureApiKeyInteractive(configPath)).toThrow(/too short/);
  });
});

describe('startInteractiveSession', () => {
  it('keeps prompting until an exit command is entered', async () => {
    const prompts = ['First question', 'Second question', 'exit'];
    const promptFn = vi.fn().mockImplementation(() => {
      if (prompts.length === 0) {
        throw new Error('Unexpected prompt call');
      }
      return prompts.shift()!;
    });
    const ask = vi.fn().mockResolvedValue(undefined);

    await startInteractiveSession({}, promptFn, ask);

    expect(promptFn).toHaveBeenCalledTimes(3);
    expect(ask).toHaveBeenCalledTimes(2);
    expect(ask).toHaveBeenNthCalledWith(1, 'First question', {});
    expect(ask).toHaveBeenNthCalledWith(2, 'Second question', {});
  });

  it('ignores blank input and keeps the session alive', async () => {
    const prompts = ['   ', 'quit'];
    const promptFn = vi.fn().mockImplementation(() => {
      if (prompts.length === 0) {
        throw new Error('Unexpected prompt call');
      }
      return prompts.shift()!;
    });
    const ask = vi.fn().mockResolvedValue(undefined);

    await startInteractiveSession({}, promptFn, ask);

    expect(promptFn).toHaveBeenCalledTimes(2);
    expect(ask).not.toHaveBeenCalled();
  });

  it('shows help and exits on :exit', async () => {
    const prompts = [':help', ':exit'];
    const promptFn = vi.fn().mockImplementation(() => prompts.shift()!);
    const ask = vi.fn().mockResolvedValue(undefined);

    await startInteractiveSession({}, promptFn, ask);

    expect(promptFn).toHaveBeenCalledTimes(2);
    expect(ask).not.toHaveBeenCalled();
  });

  it('handles Ctrl+C gracefully', async () => {
    const promptFn = vi.fn().mockImplementation(() => {
      throw new Error('SIGINT');
    });
    const ask = vi.fn().mockResolvedValue(undefined);

    await startInteractiveSession({}, promptFn, ask);

    expect(promptFn).toHaveBeenCalledTimes(1);
    expect(ask).not.toHaveBeenCalled();
  });

  it('handles error in ask function gracefully', async () => {
    const prompts = ['question', 'exit'];
    const promptFn = vi.fn().mockImplementation(() => prompts.shift()!);
    const ask = vi.fn().mockRejectedValue(new Error('API error'));

    await startInteractiveSession({}, promptFn, ask);

    expect(promptFn).toHaveBeenCalledTimes(2);
    expect(ask).toHaveBeenCalledTimes(1);
  });

  it('passes options to ask function', async () => {
    const prompts = ['question', 'exit'];
    const promptFn = vi.fn().mockImplementation(() => prompts.shift()!);
    const ask = vi.fn().mockResolvedValue(undefined);

    await startInteractiveSession({ model: 'sonar-pro', stream: true }, promptFn, ask);

    expect(ask).toHaveBeenCalledWith('question', { model: 'sonar-pro', stream: true });
  });
});
