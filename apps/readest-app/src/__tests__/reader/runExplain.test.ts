import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('@/services/ai/providers', () => ({ getAIProvider: vi.fn() }));
vi.mock('@/app/reader/components/explain/context', () => ({
  extractSelectionContext: vi.fn(() => 'ctx'),
}));
vi.mock('@/app/reader/components/explain/service', () => {
  // Mirror the real ExplainRequestError so the unconfigured path keeps its
  // kind through the mocked classifyExplainError.
  class ExplainRequestError extends Error {
    kind: string;
    constructor(kind: string, message: string) {
      super(message);
      this.kind = kind;
    }
  }
  return {
    ExplainRequestError,
    requestExplanation: vi.fn(),
    classifyExplainError: vi.fn((e: unknown) =>
      e instanceof ExplainRequestError
        ? { kind: e.kind, message: e.message }
        : { kind: 'unknown', message: (e as Error).message },
    ),
  };
});

import { getAIProvider } from '@/services/ai/providers';
import { requestExplanation } from '@/app/reader/components/explain/service';
import { runExplain } from '@/app/reader/components/explain/runExplain';
import { useBookDataStore } from '@/store/bookDataStore';
import { useExplainStore } from '@/store/explainStore';
import { useSettingsStore } from '@/store/settingsStore';
import type { TextSelection } from '@/utils/sel';

const selection = { key: 'bk', text: 'deep module', page: 1 } as TextSelection;
const result = { term: 'deep module', def: 'd', explain: 'e' };

const configured = {
  aiSettings: {
    provider: 'openrouter',
    openrouterApiKey: 'sk-test',
    openrouterBaseUrl: 'https://api.deepseek.com',
    openrouterModel: 'deepseek-chat',
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  useExplainStore.setState({
    selection: null,
    status: 'idle',
    result: null,
    error: null,
    contextLevel: 0,
    requestId: 0,
  });
  useSettingsStore.setState({ settings: configured } as never);
  useBookDataStore.setState({
    booksData: { bk: { isFixedLayout: false } },
    getBookData: (key: string) =>
      (useBookDataStore.getState().booksData as Record<string, unknown>)[
        key.split('-')[0]!
      ] as never,
  } as never);
  vi.mocked(getAIProvider).mockReturnValue({ getModel: () => ({}) } as never);
  vi.mocked(requestExplanation).mockResolvedValue(result);
});

describe('runExplain', () => {
  test('happy path: loading → success with the result stored', async () => {
    useExplainStore.getState().setSelection(selection);
    await runExplain();
    const s = useExplainStore.getState();
    expect(s.status).toBe('success');
    expect(s.result).toEqual(result);
    expect(requestExplanation).toHaveBeenCalledWith(
      expect.objectContaining({ text: 'deep module', context: 'ctx' }),
    );
  });

  test('unconfigured provider short-circuits to an unconfigured error', async () => {
    useSettingsStore.setState({
      settings: { aiSettings: { provider: 'ollama' } },
    } as never);
    useExplainStore.getState().setSelection(selection);
    await runExplain();
    expect(useExplainStore.getState().status).toBe('error');
    expect(useExplainStore.getState().error?.kind).toBe('unconfigured');
    expect(requestExplanation).not.toHaveBeenCalled();
  });

  test('a rejected request lands in the error state via classifyExplainError', async () => {
    vi.mocked(requestExplanation).mockRejectedValue(new Error('boom'));
    useExplainStore.getState().setSelection(selection);
    await runExplain();
    expect(useExplainStore.getState().status).toBe('error');
    expect(useExplainStore.getState().error?.kind).toBe('unknown');
  });

  test('does nothing without a selection', async () => {
    await runExplain();
    expect(useExplainStore.getState().status).toBe('idle');
    expect(requestExplanation).not.toHaveBeenCalled();
  });

  test('cross-page selections are never sent (M2 notice path)', async () => {
    useExplainStore.getState().setSelection({
      ...selection,
      segments: [{ range: {} as Range, index: 1, text: 'a' }],
    });
    await runExplain();
    expect(useExplainStore.getState().status).toBe('idle');
    expect(requestExplanation).not.toHaveBeenCalled();
  });
});
