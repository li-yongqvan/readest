import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('ai', () => ({ generateObject: vi.fn() }));

import { generateObject } from 'ai';
import {
  classifyExplainError,
  ExplainRequestError,
  explainResultSchema,
  requestExplanation,
} from '@/app/reader/components/explain/service';
import type { LanguageModel } from 'ai';

const mockGenerate = vi.mocked(generateObject);
const model = { modelId: 'deepseek-chat' } as unknown as LanguageModel;
const payload = { term: 'deep module', def: '深模块', explain: '……', zh: '深模块' };

// Braces matter: an expression-bodied hook would return the mock function, and
// vitest treats a beforeEach return value as a cleanup callback — calling the
// mock again after the test and failing it with the rejection.
beforeEach(() => {
  mockGenerate.mockReset();
});

describe('explainResultSchema', () => {
  test('accepts the JSON contract and allows zh to be omitted', () => {
    expect(explainResultSchema.parse(payload)).toEqual(payload);
    expect(explainResultSchema.parse({ term: 't', def: 'd', explain: 'e' })).toEqual({
      term: 't',
      def: 'd',
      explain: 'e',
    });
  });

  test('rejects a payload missing required fields', () => {
    expect(() => explainResultSchema.parse({ term: 't' })).toThrow();
  });
});

describe('requestExplanation', () => {
  test('returns the generated object and passes schema + prompts through', async () => {
    mockGenerate.mockResolvedValueOnce({ object: payload } as never);
    const result = await requestExplanation({ model, text: 'deep module', context: 'ctx' });
    expect(result).toEqual(payload);
    const args = mockGenerate.mock.calls[0]![0] as Record<string, unknown>;
    expect(args['schema']).toBe(explainResultSchema);
    expect(args['model']).toBe(model);
    expect(args['maxRetries']).toBe(0); // retries are owned by withRetryAndTimeout
    expect(String(args['system'])).toContain('word or short term');
    expect(String(args['prompt'])).toContain('ctx');
    expect(String(args['prompt'])).toContain('deep module');
  });

  test('retries once after a failure, then succeeds', async () => {
    mockGenerate
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce({ object: payload } as never);
    const result = await requestExplanation({ model, text: 'deep module', context: 'ctx' });
    expect(result).toEqual(payload);
    expect(mockGenerate).toHaveBeenCalledTimes(2);
  }, 15000); // real backoff: baseDelayMs 1000

  test('gives up after the single retry', async () => {
    mockGenerate.mockRejectedValue(new Error('boom'));
    await expect(requestExplanation({ model, text: 'x', context: 'c' })).rejects.toThrow('boom');
    expect(mockGenerate).toHaveBeenCalledTimes(2);
  }, 15000);
});

describe('classifyExplainError', () => {
  test('passes ExplainRequestError through with its kind', () => {
    expect(classifyExplainError(new ExplainRequestError('unconfigured', 'no key'))).toEqual({
      kind: 'unconfigured',
      message: 'no key',
    });
  });

  test('HTTP 401/403 is an auth error', () => {
    expect(classifyExplainError({ statusCode: 401, message: 'Unauthorized' }).kind).toBe('auth');
    expect(classifyExplainError({ statusCode: 403, message: 'Forbidden' }).kind).toBe('auth');
  });

  test('abort and timeout messages are timeout errors', () => {
    expect(classifyExplainError({ name: 'AbortError', message: 'aborted' }).kind).toBe('timeout');
    expect(classifyExplainError(new Error('Timeout after 60000ms')).kind).toBe('timeout');
  });

  test('fetch failures are network errors', () => {
    expect(classifyExplainError(new TypeError('fetch failed')).kind).toBe('network');
    expect(classifyExplainError(new Error('NetworkError when attempting to fetch')).kind).toBe(
      'network',
    );
  });

  test('JSON/schema failures are parse errors', () => {
    expect(
      classifyExplainError({ name: 'AI_NoObjectGeneratedError', message: 'No object generated' })
        .kind,
    ).toBe('parse');
  });

  test('anything else is unknown', () => {
    expect(classifyExplainError(new Error('boom')).kind).toBe('unknown');
  });
});
