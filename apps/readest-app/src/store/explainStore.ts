import { create } from 'zustand';
import type { TextSelection } from '@/utils/sel';

// Structured AI explanation returned by DeepSeek (JSON contract, M3). Defined
// here so the store has no dependency on the service module; service.ts
// re-uses this type and validates runtime payloads against its zod twin.
export interface ExplainResult {
  term: string;
  def: string;
  explain: string;
  zh?: string;
}

export type ExplainStatus = 'idle' | 'loading' | 'success' | 'error';
export type ExplainContextLevel = 0 | 1 | 2;

export type ExplainErrorKind =
  | 'unconfigured'
  | 'auth'
  | 'network'
  | 'timeout'
  | 'parse'
  | 'unknown';

export interface ExplainErrorState {
  kind: ExplainErrorKind;
  message: string;
}

export const MAX_CONTEXT_LEVEL: ExplainContextLevel = 2;

interface ExplainState {
  // The latest published selection, kept after dismissal (M2/Q4).
  selection: TextSelection | null;
  status: ExplainStatus;
  result: ExplainResult | null;
  error: ExplainErrorState | null;
  // "Retry with more context" escalation: 0 = paragraph, 1 = ±1 paragraph,
  // 2 = whole section (truncated). Reset to 0 on a new selection.
  contextLevel: ExplainContextLevel;
  // loadKey: stale async responses are dropped (DictionaryResultsView pattern).
  requestId: number;
  setSelection: (selection: TextSelection) => void;
  startRequest: () => number;
  resolveRequest: (id: number, result: ExplainResult) => void;
  failRequest: (id: number, error: ExplainErrorState) => void;
  escalateContext: () => void;
}

export const useExplainStore = create<ExplainState>((set, get) => ({
  selection: null,
  status: 'idle',
  result: null,
  error: null,
  contextLevel: 0,
  requestId: 0,
  setSelection: (selection) => {
    const prev = get().selection;
    // Same-text republish (highlight stamp / quick-action hand-back, see
    // Annotator.tsx and the opener's text dedupe): refresh the payload but
    // keep the delivered explanation — nothing will re-fire runExplain.
    if (prev && prev.key === selection.key && prev.text === selection.text) {
      set({ selection });
      return;
    }
    set({ selection, status: 'idle', result: null, error: null, contextLevel: 0 });
  },
  startRequest: () => {
    const id = get().requestId + 1;
    set({ requestId: id, status: 'loading', error: null });
    return id;
  },
  resolveRequest: (id, result) => {
    if (id !== get().requestId) return;
    set({ status: 'success', result, error: null });
  },
  failRequest: (id, error) => {
    if (id !== get().requestId) return;
    set({ status: 'error', error });
  },
  escalateContext: () =>
    set((state) => ({
      contextLevel: Math.min(state.contextLevel + 1, MAX_CONTEXT_LEVEL) as ExplainContextLevel,
    })),
}));
