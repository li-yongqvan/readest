import { generateObject, type LanguageModel } from 'ai';
import { z } from 'zod';

import { AI_RETRY_CONFIGS, AI_TIMEOUTS, withRetryAndTimeout } from '@/services/ai/utils/retry';
import type { ExplainErrorKind, ExplainErrorState, ExplainResult } from '@/store/explainStore';
import { buildExplainPrompt, classifySelection } from './prompt';

// Runtime twin of the ExplainResult interface in store/explainStore.ts
// (decisions/0002: JSON contract {term, def, explain, zh?}).
export const explainResultSchema = z.object({
  term: z.string(),
  def: z.string(),
  explain: z.string(),
  zh: z.string().optional(),
});

// Error whose kind is already known at the throw site (e.g. unconfigured).
export class ExplainRequestError extends Error {
  kind: ExplainErrorKind;
  constructor(kind: ExplainErrorKind, message: string) {
    super(message);
    this.name = 'ExplainRequestError';
    this.kind = kind;
  }
}

export interface ExplainRequestInput {
  model: LanguageModel;
  text: string;
  context: string;
  signal?: AbortSignal;
}

// One DeepSeek round-trip: classify, build the prompt, generate a validated
// JSON object. Retry policy from the roadmap: auto-retry exactly once, then
// surface the error. generateObject's own retries are disabled so the policy
// lives in one place (withRetryAndTimeout).
export const requestExplanation = async ({
  model,
  text,
  context,
  signal,
}: ExplainRequestInput): Promise<ExplainResult> => {
  const kind = classifySelection(text);
  const { system, prompt } = buildExplainPrompt({ kind, text: text.trim(), context });
  const { object } = await withRetryAndTimeout(
    () =>
      generateObject({
        model,
        schema: explainResultSchema,
        system,
        prompt,
        maxRetries: 0,
        abortSignal: signal,
      }),
    AI_TIMEOUTS.CHAT_STREAM,
    { ...AI_RETRY_CONFIGS.CHAT, maxRetries: 1 },
  );
  return object;
};

// ai-sdk errors are duck-typed: APICallError carries statusCode, aborts arrive
// as AbortError or a "Timeout after Nms" message from withTimeout.
const getStatusCode = (error: unknown): number | undefined => {
  const e = error as { statusCode?: unknown; status?: unknown };
  const code = e?.statusCode ?? e?.status;
  return typeof code === 'number' ? code : undefined;
};

export const classifyExplainError = (error: unknown): ExplainErrorState => {
  if (error instanceof ExplainRequestError) {
    return { kind: error.kind, message: error.message };
  }
  const err = error as { name?: string; message?: string };
  const name = err?.name ?? '';
  const message = err?.message ?? String(error);
  const status = getStatusCode(error);
  if (status === 401 || status === 403) return { kind: 'auth', message: `HTTP ${status}` };
  if (name === 'AbortError' || /time[d]? ?out/i.test(message)) {
    return { kind: 'timeout', message };
  }
  if (
    name === 'TypeError' ||
    /failed to fetch|network ?error|econnrefused|enotfound/i.test(message)
  ) {
    return { kind: 'network', message };
  }
  if (/noobjectgenerated|json|schema|parse/i.test(`${name} ${message}`)) {
    return { kind: 'parse', message };
  }
  return { kind: 'unknown', message };
};
