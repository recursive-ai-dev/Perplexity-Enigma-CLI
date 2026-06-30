import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import EventEmitter from 'events';

vi.mock('axios', () => {
  const post = vi.fn().mockResolvedValue({
    data: { choices: [{ message: { content: 'hello world' } }] },
  });
  const isAxiosError = (err: any) => Boolean(err?.isAxiosError);
  return {
    default: { post, isAxiosError },
    isAxiosError,
  };
});

describe('askPerplexityStreaming', () => {
  let stdoutSpy: any;

  beforeEach(() => {
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
  });

  it('throws when the API key is missing', async () => {
    const { askPerplexityStreaming } = await import('../src/perplexity.js');
    const { defaultConfig } = await import('../src/config.js');
    const config = { ...defaultConfig };

    await expect(askPerplexityStreaming('hello', config)).rejects.toThrow(/API key/i);
  });

  it('handles stream data events and processes complete lines', async () => {
    const axios = await import('axios');
    const stream = new EventEmitter();

    vi.mocked((axios as any).default.post).mockResolvedValueOnce({
      data: stream,
    });

    const { askPerplexityStreaming } = await import('../src/perplexity.js');
    const { defaultConfig } = await import('../src/config.js');

    const config = {
      ...defaultConfig,
      api: { ...defaultConfig.api, key: 'pplx-test' },
    };

    const promise = askPerplexityStreaming('test question', config);

    // Wait a tick for the promise to setup listeners
    await new Promise(resolve => setTimeout(resolve, 0));

    // Send partial chunk
    stream.emit('data', Buffer.from('data: {"choices":[{"delta":{"content":"Hel"}}'));
    // Complete chunk
    stream.emit('data', Buffer.from(']}\n'));
    // Send another complete chunk
    stream.emit('data', Buffer.from('data: {"choices":[{"delta":{"content":"lo"}}]}\n'));
    // Send [DONE]
    stream.emit('data', Buffer.from('data: [DONE]\n'));

    await promise;

    expect(stdoutSpy).toHaveBeenCalledWith('Hel');
    expect(stdoutSpy).toHaveBeenCalledWith('lo');
    expect((axios as any).default.post).toHaveBeenCalledWith(
      'https://api.perplexity.ai/chat/completions',
      expect.objectContaining({
        model: 'sonar-pro',
        stream: true,
      }),
      expect.objectContaining({
        responseType: 'stream',
      })
    );
  });

  it('processes remaining buffer on end event', async () => {
    const axios = await import('axios');
    const stream = new EventEmitter();

    vi.mocked((axios as any).default.post).mockResolvedValueOnce({
      data: stream,
    });

    const { askPerplexityStreaming } = await import('../src/perplexity.js');
    const { defaultConfig } = await import('../src/config.js');

    const config = {
      ...defaultConfig,
      api: { ...defaultConfig.api, key: 'pplx-test' },
    };

    const promise = askPerplexityStreaming('test question', config);

    // Wait a tick for the promise to setup listeners
    await new Promise(resolve => setTimeout(resolve, 0));

    // Send a chunk without a newline to test remaining buffer
    stream.emit('data', Buffer.from('data: {"choices":[{"delta":{"content":"world"}}]}'));
    stream.emit('end');

    await promise;

    expect(stdoutSpy).toHaveBeenCalledWith('world');
  });

  it('rejects the promise on stream error', async () => {
    const axios = await import('axios');
    const stream = new EventEmitter();

    vi.mocked((axios as any).default.post).mockResolvedValueOnce({
      data: stream,
    });

    const { askPerplexityStreaming } = await import('../src/perplexity.js');
    const { defaultConfig } = await import('../src/config.js');

    const config = {
      ...defaultConfig,
      api: { ...defaultConfig.api, key: 'pplx-test' },
    };

    const promise = askPerplexityStreaming('test question', config);

    // Wait a tick for the promise to setup listeners
    await new Promise(resolve => setTimeout(resolve, 0));

    stream.emit('error', new Error('Network failure'));

    await expect(promise).rejects.toThrow('Stream interrupted: Network failure');
  });
});

describe('askPerplexity', () => {
  it('builds the correct request payload with agent config', async () => {
    const axios = await import('axios');
    const { askPerplexity } = await import('../src/perplexity.js');
    const { defaultConfig } = await import('../src/config.js');

    const config = {
      ...defaultConfig,
      api: { ...defaultConfig.api, key: 'pplx-test' },
    };

    const answer = await askPerplexity('test question', config, { model: 'sonar-reasoning' });

    expect(answer).toBe('hello world');
    expect((axios as any).default.post).toHaveBeenCalledWith(
      'https://api.perplexity.ai/chat/completions',
      {
        model: 'sonar-reasoning',
        messages: [{ role: 'user', content: 'test question' }],
        stream: false,
        search_mode: 'medium',
        // Agent configuration parameters (temperature, max_tokens, top_p) are now included in the API payload
        temperature: 0.3,
        max_tokens: 4096,
        top_p: 0.9,
      },
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer pplx-test',
          'Content-Type': 'application/json',
        }),
        timeout: 60000,
      }),
    );
  });

  it('throws when the API key is missing', async () => {
    const { askPerplexity } = await import('../src/perplexity.js');
    const { defaultConfig } = await import('../src/config.js');
    const config = { ...defaultConfig };

    await expect(askPerplexity('hello', config)).rejects.toThrow(/API key/i);
  });

  it('falls back to default model when invalid', async () => {
    const axios = await import('axios');
    const { askPerplexity } = await import('../src/perplexity.js');
    const { defaultConfig } = await import('../src/config.js');
    const config = {
      ...defaultConfig,
      api: { ...defaultConfig.api, key: 'pplx-test' },
    };

    const answer = await askPerplexity('test question', config, { model: 'invalid-model' });

    expect(answer).toBe('hello world');
    expect((axios as any).default.post).toHaveBeenCalledWith(
      'https://api.perplexity.ai/chat/completions',
      expect.objectContaining({ model: defaultConfig.models.default }),
      expect.any(Object),
    );
  });

  it('returns JSON when content is not a string', async () => {
    const axios = await import('axios');
    vi.mocked((axios as any).default.post).mockResolvedValueOnce({
      data: { choices: [{ message: { content: { nested: 'object' } } }] },
    });
    
    const { askPerplexity } = await import('../src/perplexity.js');
    const { defaultConfig } = await import('../src/config.js');
    const config = {
      ...defaultConfig,
      api: { ...defaultConfig.api, key: 'pplx-test' },
    };

    const answer = await askPerplexity('test question', config);

    expect(answer).toContain('choices');
  });
});

describe('buildApiPayload', () => {
  it('includes agent config parameters', async () => {
    const { buildApiPayload } = await import('../src/perplexity.js');
    const { defaultConfig } = await import('../src/config.js');

    const customConfig = {
      ...defaultConfig,
      agent: { ...defaultConfig.agent, temperature: 0.7, max_tokens: 2048, top_p: 0.95 },
    };

    const payload = buildApiPayload('test', customConfig, {}, false);

    expect(payload.temperature).toBe(0.7);
    expect(payload.max_tokens).toBe(2048);
    expect(payload.top_p).toBe(0.95);
  });

  it('uses search mode from options if provided', async () => {
    const { buildApiPayload } = await import('../src/perplexity.js');
    const { defaultConfig } = await import('../src/config.js');

    const payload = buildApiPayload('test', defaultConfig, { searchMode: 'high' }, false);

    expect(payload.search_mode).toBe('high');
  });
});

describe('parseSSELine', () => {
  it('extracts content from valid SSE data', async () => {
    const { parseSSELine } = await import('../src/perplexity.js');
    
    const line = 'data: {"choices":[{"delta":{"content":"Hello"}}]}';
    expect(parseSSELine(line)).toBe('Hello');
  });

  it('returns done for [DONE] message', async () => {
    const { parseSSELine } = await import('../src/perplexity.js');
    
    expect(parseSSELine('data: [DONE]')).toBe('done');
  });

  it('returns null for empty lines', async () => {
    const { parseSSELine } = await import('../src/perplexity.js');
    
    expect(parseSSELine('')).toBe(null);
    expect(parseSSELine('   ')).toBe(null);
  });

  it('returns null for SSE comments', async () => {
    const { parseSSELine } = await import('../src/perplexity.js');
    
    expect(parseSSELine(': keep-alive')).toBe(null);
  });

  it('handles malformed JSON gracefully', async () => {
    const { parseSSELine } = await import('../src/perplexity.js');
    
    expect(parseSSELine('data: {invalid json}')).toBe(null);
  });
});

describe('formatError', () => {
  it('returns actionable message for 401/403', async () => {
    const { formatError } = await import('../src/perplexity.js');
    const message = formatError({ isAxiosError: true, response: { status: 401 }, message: 'unauthorized' });
    expect(message).toMatch(/API key invalid/);
  });

  it('handles network errors with code', async () => {
    const { formatError } = await import('../src/perplexity.js');
    const message = formatError({ isAxiosError: true, code: 'ETIMEDOUT', message: 'timeout' });
    expect(message).toMatch(/Network error/);
  });

  it('returns actionable message for 429 rate limit', async () => {
    const { formatError } = await import('../src/perplexity.js');
    const message = formatError({ isAxiosError: true, response: { status: 429 }, message: 'too many requests' });
    expect(message).toMatch(/Rate limit exceeded/);
  });

  it('returns actionable message for server errors', async () => {
    const { formatError } = await import('../src/perplexity.js');
    const message = formatError({ isAxiosError: true, response: { status: 503 }, message: 'service unavailable' });
    expect(message).toMatch(/Server error/);
  });

  it('handles plain Error objects', async () => {
    const { formatError } = await import('../src/perplexity.js');
    const message = formatError(new Error('Something went wrong'));
    expect(message).toBe('Something went wrong');
  });

  it('handles string errors', async () => {
    const { formatError } = await import('../src/perplexity.js');
    const message = formatError('An error occurred');
    expect(message).toBe('An error occurred');
  });

  it('handles unknown error types', async () => {
    const { formatError } = await import('../src/perplexity.js');
    const message = formatError({ custom: 'error' });
    expect(message).toBe('{"custom":"error"}');
  });

  it('handles 404 errors', async () => {
    const { formatError } = await import('../src/perplexity.js');
    const message = formatError({ isAxiosError: true, response: { status: 404 }, message: 'not found' });
    expect(message).toMatch(/Endpoint not found/);
  });

  it('handles general API errors with status', async () => {
    const { formatError } = await import('../src/perplexity.js');
    const message = formatError({ isAxiosError: true, response: { status: 400, data: { error: 'Bad Request' } }, message: 'bad' });
    expect(message).toMatch(/API error \(400\)/);
  });

  it('handles API errors without status', async () => {
    const { formatError } = await import('../src/perplexity.js');
    const message = formatError({ isAxiosError: true, message: 'unknown error' });
    expect(message).toBe('API error: unknown error');
  });
});

describe('withSpinner', () => {
  it('succeeds and stops spinner on success', async () => {
    const { withSpinner } = await import('../src/perplexity.js');
    
    const result = await withSpinner('Test', async () => 'success');
    expect(result).toBe('success');
  });

  it('fails and stops spinner on error', async () => {
    const { withSpinner } = await import('../src/perplexity.js');
    
    await expect(withSpinner('Test', async () => {
      throw new Error('Test error');
    })).rejects.toThrow('Test error');
  });
});

describe('printAnswer', () => {
  it('prints formatted answer', async () => {
    const { printAnswer } = await import('../src/perplexity.js');
    const consoleSpy = vi.spyOn(console, 'log');
    
    printAnswer('Test answer');
    
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});

describe('availableModelsMessage', () => {
  it('returns list of available models', async () => {
    const { availableModelsMessage } = await import('../src/perplexity.js');
    
    const message = availableModelsMessage();
    expect(message).toContain('sonar');
    expect(message).toContain('sonar-pro');
    expect(message).toContain('--model');
  });
});
