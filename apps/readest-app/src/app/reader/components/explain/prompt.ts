// Prompt construction for the explain feature. Single template, both languages
// (decisions/0001: 中文书/英文书同管线); bump EXPLAIN_PROMPT_VERSION on edits
// (ROADMAP 风险表: 提示词留版本号，迭代提示词不动架构).

export type ExplainKind = 'term' | 'passage';

export const EXPLAIN_PROMPT_VERSION = 'v1';

// CJK unified ideographs + extension A + compat ideographs.
const CJK_RE = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/;

// ≤3 whitespace-separated words, or ≤6 hanzi for CJK text (no spaces to split
// on), counts as a dictionary-style term lookup; anything longer is a passage.
export const classifySelection = (text: string): ExplainKind => {
  const t = text.trim();
  const cjkCount = [...t].filter((ch) => CJK_RE.test(ch)).length;
  if (cjkCount > 0) return cjkCount <= 6 ? 'term' : 'passage';
  return t.split(/\s+/).filter(Boolean).length <= 3 ? 'term' : 'passage';
};

export interface ExplainPromptInput {
  kind: ExplainKind;
  text: string;
  context: string;
}

export const buildExplainPrompt = ({
  kind,
  text,
  context,
}: ExplainPromptInput): { system: string; prompt: string } => {
  const task =
    kind === 'term'
      ? 'The user selected a word or short term. Give its Chinese definition and explain its usage in the provided context.'
      : 'The user selected a sentence or passage. Give a faithful Chinese translation and explain what it means in the provided context.';
  const system = [
    'You are a reading companion helping a Chinese-speaking developer understand technical books.',
    task,
    'Reply with a JSON object: {"term": string, "def": string, "explain": string, "zh"?: string}.',
    '- term: the selected text, trimmed.',
    '- def: for a term, a concise Chinese definition; for a passage, a one-line Chinese summary.',
    '- explain: a clear explanation in Chinese, 2-5 sentences, grounded in the provided context.',
    '- zh: for an English passage, its faithful Chinese translation; omit it when the selection is already Chinese.',
  ].join('\n');
  const prompt = `Context (surrounding passage):\n${context}\n\nSelected text:\n${text}`;
  return { system, prompt };
};
