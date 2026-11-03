import { describe, expect, test } from 'vitest';
import {
  getSelectionLocation,
  isCrossPageSelection,
  shouldPublishSelection,
} from '@/app/reader/components/explain/utils';
import type { SelectionSegment } from '@/utils/sel';

const segment: SelectionSegment = { range: {} as Range, index: 1, text: 'a' };

describe('explain selection helpers', () => {
  describe('isCrossPageSelection', () => {
    test('selection without segments is single-page', () => {
      expect(isCrossPageSelection({})).toBe(false);
      expect(isCrossPageSelection({ segments: undefined })).toBe(false);
    });

    test('selection with empty segments is single-page', () => {
      expect(isCrossPageSelection({ segments: [] })).toBe(false);
    });

    test('selection with segments is cross-page (upstream already split it)', () => {
      expect(isCrossPageSelection({ segments: [segment] })).toBe(true);
      expect(isCrossPageSelection({ segments: [segment, segment] })).toBe(true);
    });
  });

  describe('shouldPublishSelection', () => {
    test('rejects empty or whitespace-only text', () => {
      expect(shouldPublishSelection({ text: '', popup: undefined })).toBe(false);
      expect(shouldPublishSelection({ text: '   ', popup: undefined })).toBe(false);
    });

    test('rejects selections made inside a footnote/annotation popup', () => {
      expect(shouldPublishSelection({ text: 'deep module', popup: true })).toBe(false);
    });

    test('accepts an ordinary book selection', () => {
      expect(shouldPublishSelection({ text: 'deep module', popup: undefined })).toBe(true);
      expect(shouldPublishSelection({ text: 'deep module', popup: false })).toBe(true);
    });
  });

  describe('getSelectionLocation', () => {
    test('fixed layout (PDF) shows the page number', () => {
      expect(getSelectionLocation({ page: 74, cfi: 'epubcfi(/2/4)' }, true)).toEqual({
        kind: 'page',
        page: 74,
      });
    });

    test('reflowable layout (EPUB) shows the cfi instead of the page', () => {
      expect(getSelectionLocation({ page: 12, cfi: 'epubcfi(/6/4!/2/2)' }, false)).toEqual({
        kind: 'cfi',
        cfi: 'epubcfi(/6/4!/2/2)',
      });
    });

    test('reflowable layout without a cfi falls back to the page number', () => {
      expect(getSelectionLocation({ page: 12, cfi: undefined }, false)).toEqual({
        kind: 'page',
        page: 12,
      });
    });
  });
});
