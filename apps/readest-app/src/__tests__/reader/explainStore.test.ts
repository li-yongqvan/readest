import { beforeEach, describe, expect, test } from 'vitest';
import { MAX_CONTEXT_LEVEL, useExplainStore } from '@/store/explainStore';
import type { TextSelection } from '@/utils/sel';

const selection = { key: 'bk', text: 'deep module', page: 1 } as TextSelection;
const result = { term: 'deep module', def: '深模块', explain: '……' };

const reset = () =>
  useExplainStore.setState({
    selection: null,
    status: 'idle',
    result: null,
    error: null,
    contextLevel: 0,
    requestId: 0,
  });

describe('explainStore', () => {
  beforeEach(reset);

  test('setSelection keeps the selection and resets explain state', () => {
    useExplainStore.getState().setSelection(selection);
    useExplainStore.getState().escalateContext();
    useExplainStore.getState().setSelection({ ...selection, text: 'another' });
    const s = useExplainStore.getState();
    expect(s.selection?.text).toBe('another');
    expect(s.status).toBe('idle');
    expect(s.result).toBeNull();
    expect(s.error).toBeNull();
    expect(s.contextLevel).toBe(0);
  });

  test('same-text republish preserves a delivered explanation', () => {
    useExplainStore.getState().setSelection(selection);
    const id = useExplainStore.getState().startRequest();
    useExplainStore.getState().resolveRequest(id, result);
    useExplainStore.getState().setSelection({ ...selection, annotated: true });
    const s = useExplainStore.getState();
    expect(s.status).toBe('success');
    expect(s.result).toEqual(result);
    expect(s.contextLevel).toBe(0);
  });

  test('republish with a different key resets even when text matches', () => {
    useExplainStore.getState().setSelection(selection);
    const id = useExplainStore.getState().startRequest();
    useExplainStore.getState().resolveRequest(id, result);
    useExplainStore.getState().setSelection({ ...selection, key: 'other-book' });
    expect(useExplainStore.getState().status).toBe('idle');
    expect(useExplainStore.getState().result).toBeNull();
  });

  test('startRequest increments requestId and sets loading', () => {
    const id1 = useExplainStore.getState().startRequest();
    const id2 = useExplainStore.getState().startRequest();
    expect(id2).toBe(id1 + 1);
    expect(useExplainStore.getState().status).toBe('loading');
  });

  test('resolveRequest stores the result', () => {
    const id = useExplainStore.getState().startRequest();
    useExplainStore.getState().resolveRequest(id, result);
    expect(useExplainStore.getState().status).toBe('success');
    expect(useExplainStore.getState().result).toEqual(result);
  });

  test('stale resolveRequest is discarded (loadKey)', () => {
    const id = useExplainStore.getState().startRequest();
    useExplainStore.getState().startRequest(); // a newer request supersedes
    useExplainStore.getState().resolveRequest(id, result);
    expect(useExplainStore.getState().status).toBe('loading');
    expect(useExplainStore.getState().result).toBeNull();
  });

  test('failRequest stores the error; stale failRequest is discarded', () => {
    const id = useExplainStore.getState().startRequest();
    useExplainStore.getState().failRequest(id, { kind: 'network', message: 'x' });
    expect(useExplainStore.getState().status).toBe('error');
    expect(useExplainStore.getState().error?.kind).toBe('network');

    const id2 = useExplainStore.getState().startRequest();
    useExplainStore.getState().failRequest(id2 - 1, { kind: 'auth', message: 'y' });
    expect(useExplainStore.getState().status).toBe('loading');
  });

  test('escalateContext caps at MAX_CONTEXT_LEVEL', () => {
    useExplainStore.getState().escalateContext();
    useExplainStore.getState().escalateContext();
    useExplainStore.getState().escalateContext();
    expect(useExplainStore.getState().contextLevel).toBe(MAX_CONTEXT_LEVEL);
    expect(MAX_CONTEXT_LEVEL).toBe(2);
  });
});
