import type { TextSelection } from '@/utils/sel';
import {
  classifyPdfLineBreaks,
  getPdfTextLayer,
  type PdfLine,
  type PdfLineBreak,
} from '@/utils/pdfText';
import type { ExplainContextLevel } from '@/store/explainStore';

// Surrounding-context extraction for the explain feature (decisions/0002):
// level 0 = the paragraph holding the selection, 1 = ±1 paragraph,
// 2 = whole section, always truncated at MAX_CONTEXT_CHARS.

export const MAX_CONTEXT_CHARS = 4000;

// ---------- pure helpers (unit-tested) ----------

export const truncateContext = (text: string, max: number = MAX_CONTEXT_CHARS): string =>
  text.length <= max ? text : `${text.slice(0, max)}…`;

// Join pdf.js text-layer lines into paragraphs. breaks[i] describes the break
// AFTER lines[i] (classifyPdfLineBreaks); 'paragraph' ends the current
// paragraph, 'dehyphenate' drops a line-end hyphen, 'space'/'join' continue.
export const buildPdfParagraphs = (lines: PdfLine[], breaks: PdfLineBreak[]): string[] => {
  const paragraphs: string[] = [];
  let current = '';
  const flush = () => {
    const trimmed = current.trim();
    if (trimmed) paragraphs.push(trimmed);
    current = '';
  };
  lines.forEach((line, i) => {
    const kind = breaks[i];
    let text = line.text;
    if (kind === 'dehyphenate') text = text.replace(/[-\u2010\u00AD]\s*$/u, '');
    current += text;
    if (kind === undefined || kind === 'paragraph') flush();
    else if (kind === 'space') current += ' ';
  });
  flush();
  return paragraphs;
};

// Paragraph index of each row, derived from the same breaks array.
export const rowParagraphIndexes = (breaks: PdfLineBreak[], rowCount: number): number[] => {
  const indexes: number[] = [];
  let paragraph = 0;
  for (let i = 0; i < rowCount; i++) {
    indexes.push(paragraph);
    if (i < breaks.length && breaks[i] === 'paragraph') paragraph++;
  }
  return indexes;
};

// The context window around the selected paragraph, per level.
export const sliceContext = (
  paragraphs: string[],
  selectedIndex: number,
  level: ExplainContextLevel,
): string => {
  if (!paragraphs.length || selectedIndex < 0 || selectedIndex >= paragraphs.length) return '';
  if (level === 2) return truncateContext(paragraphs.join('\n\n'));
  const from = level === 1 ? Math.max(0, selectedIndex - 1) : selectedIndex;
  const to = level === 1 ? Math.min(paragraphs.length - 1, selectedIndex + 1) : selectedIndex;
  return truncateContext(paragraphs.slice(from, to + 1).join('\n\n'));
};

// ---------- DOM extraction (covered by manual acceptance, not unit tests) ----------

// pdf.js renders one row of spans + a <br> per printed line. Row splitting and
// measuring mirror the private helpers in utils/pdfText.ts (splitRows /
// measureRow) — kept private there, so this module maintains its own copy.
interface PdfRows {
  lines: PdfLine[];
  rows: Element[][];
}

const collectPdfRows = (textLayer: Element): PdfRows => {
  const lines: PdfLine[] = [];
  const rows: Element[][] = [];
  let spans: Element[] = [];
  const flush = () => {
    if (!spans.length) return;
    const line: PdfLine = {
      text: '',
      left: Infinity,
      right: -Infinity,
      top: 0,
      em: 0,
      firstWordWidth: 0,
    };
    let dominantLength = 0;
    for (const span of spans) {
      const text = span.textContent ?? '';
      line.text += text;
      const trimmed = text.trim();
      if (!trimmed) continue;
      const rect = span.getBoundingClientRect();
      line.left = Math.min(line.left, rect.left);
      line.right = Math.max(line.right, rect.right);
      if (trimmed.length > dominantLength) {
        dominantLength = trimmed.length;
        line.top = rect.top;
        line.em = rect.height;
      }
      if (!line.firstWordWidth) {
        const word = trimmed.split(/\s+/)[0] ?? '';
        line.firstWordWidth = (rect.width * word.length) / trimmed.length;
      }
    }
    lines.push(line);
    rows.push(spans);
    spans = [];
  };
  for (const child of Array.from(textLayer.children)) {
    if (child.tagName === 'BR') flush();
    else spans.push(child);
  }
  flush();
  return { lines, rows };
};

const extractPdfContext = (range: Range, level: ExplainContextLevel): string => {
  const textLayer = getPdfTextLayer(range);
  if (!textLayer) return '';
  const { lines, rows } = collectPdfRows(textLayer);
  const breaks = classifyPdfLineBreaks(lines);
  const paragraphs = buildPdfParagraphs(lines, breaks);
  const paragraphOfRow = rowParagraphIndexes(breaks, rows.length);
  const rowIndex = rows.findIndex((spans) => spans.some((s) => range.intersectsNode(s)));
  const selectedIndex = rowIndex >= 0 ? (paragraphOfRow[rowIndex] ?? -1) : -1;
  return sliceContext(paragraphs, selectedIndex, level);
};

// EPUB: walk up from the range to the nearest block element (same idiom as
// getBlockAncestor in utils/sel.ts, which is module-private there).
const isInlineDisplay = (el: Element): boolean => {
  const display = el.ownerDocument.defaultView?.getComputedStyle(el).display ?? '';
  return display === 'inline' || display.startsWith('ruby');
};

const getBlockAncestor = (node: Node): Element | null => {
  let el: Element | null =
    node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
  while (el && isInlineDisplay(el)) el = el.parentElement;
  return el;
};

const normalize = (text: string): string => text.replace(/\s+/g, ' ').trim();

const extractEpubContext = (range: Range, level: ExplainContextLevel): string => {
  const block = getBlockAncestor(range.startContainer);
  if (!block) return '';
  if (level === 2) return truncateContext(normalize(block.ownerDocument.body?.textContent ?? ''));
  const parent = block.parentElement;
  const siblings = parent
    ? Array.from(parent.children).filter(
        (el) => !isInlineDisplay(el) && normalize(el.textContent ?? ''),
      )
    : [block];
  const paragraphs = siblings.map((el) => normalize(el.textContent ?? ''));
  const index = Math.max(0, siblings.indexOf(block));
  return sliceContext(paragraphs, index, level);
};

// Single entry point. Any DOM failure (detached range, missing text layer)
// degrades to the selection text itself — the request still goes out.
export const extractSelectionContext = (
  selection: TextSelection,
  isFixedLayout: boolean,
  level: ExplainContextLevel,
): string => {
  try {
    const range = selection.range;
    if (!range) return truncateContext(selection.text);
    const context = isFixedLayout
      ? extractPdfContext(range, level)
      : extractEpubContext(range, level);
    return context || truncateContext(selection.text);
  } catch {
    return truncateContext(selection.text);
  }
};
