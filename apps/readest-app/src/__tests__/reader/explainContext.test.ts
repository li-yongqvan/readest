import { describe, expect, test } from 'vitest';
import {
  buildPdfParagraphs,
  MAX_CONTEXT_CHARS,
  rowParagraphIndexes,
  sliceContext,
  truncateContext,
} from '@/app/reader/components/explain/context';
import type { PdfLine, PdfLineBreak } from '@/utils/pdfText';

const line = (text: string): PdfLine => ({
  text,
  left: 0,
  right: 100,
  top: 0,
  em: 12,
  firstWordWidth: 10,
});

describe('buildPdfParagraphs', () => {
  test('space break joins lines with a space', () => {
    expect(buildPdfParagraphs([line('first'), line('second')], ['space'])).toEqual([
      'first second',
    ]);
  });

  test('paragraph break splits paragraphs', () => {
    expect(buildPdfParagraphs([line('a'), line('b'), line('c')], ['paragraph', 'space'])).toEqual([
      'a',
      'b c',
    ]);
  });

  test('dehyphenate strips the line-end hyphen and joins directly', () => {
    expect(buildPdfParagraphs([line('mod-'), line('ule')], ['dehyphenate'])).toEqual(['module']);
  });

  test('the last line (no break entry) always ends its paragraph', () => {
    expect(buildPdfParagraphs([line('a'), line('b')], ['space'])).toEqual(['a b']);
  });

  test('whitespace-only paragraphs are dropped', () => {
    expect(buildPdfParagraphs([line('a'), line('   ')], ['paragraph'])).toEqual(['a']);
  });
});

describe('rowParagraphIndexes', () => {
  test('maps each row to its paragraph index', () => {
    const breaks: PdfLineBreak[] = ['paragraph', 'space'];
    expect(rowParagraphIndexes(breaks, 3)).toEqual([0, 1, 1]);
  });

  test('no paragraph breaks means one paragraph', () => {
    expect(rowParagraphIndexes(['space'], 2)).toEqual([0, 0]);
  });
});

describe('sliceContext', () => {
  const paragraphs = ['p0', 'p1', 'p2'];

  test('level 0 returns only the selected paragraph', () => {
    expect(sliceContext(paragraphs, 1, 0)).toBe('p1');
  });

  test('level 1 returns the neighbouring paragraphs', () => {
    expect(sliceContext(paragraphs, 1, 1)).toBe('p0\n\np1\n\np2');
  });

  test('level 1 clamps at the edges', () => {
    expect(sliceContext(paragraphs, 0, 1)).toBe('p0\n\np1');
    expect(sliceContext(paragraphs, 2, 1)).toBe('p1\n\np2');
  });

  test('level 2 returns everything', () => {
    expect(sliceContext(paragraphs, 1, 2)).toBe('p0\n\np1\n\np2');
  });

  test('empty input returns an empty string', () => {
    expect(sliceContext([], 0, 0)).toBe('');
    expect(sliceContext(paragraphs, -1, 0)).toBe('');
  });
});

describe('truncateContext', () => {
  test('short text is unchanged', () => {
    expect(truncateContext('abc')).toBe('abc');
  });

  test('long text is cut at MAX_CONTEXT_CHARS with an ellipsis', () => {
    const long = 'x'.repeat(MAX_CONTEXT_CHARS + 100);
    const out = truncateContext(long);
    expect(out).toHaveLength(MAX_CONTEXT_CHARS + 1);
    expect(out.endsWith('…')).toBe(true);
  });
});
