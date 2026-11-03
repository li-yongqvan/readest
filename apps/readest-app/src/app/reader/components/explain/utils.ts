import type { TextSelection } from '@/utils/sel';

export type SelectionLocation = { kind: 'page'; page: number } | { kind: 'cfi'; cfi: string };

// A selection the upstream selector already split into per-section segments is
// a cross-page (PDF) / cross-section (EPUB) selection; v1 explains single-page
// selections only, so the view turns these into a "not supported yet" notice.
export const isCrossPageSelection = (selection: Pick<TextSelection, 'segments'>): boolean =>
  !!selection.segments && selection.segments.length > 0;

// Only genuine in-book selections reach the explain sidebar: empty strands and
// selections made inside a footnote/annotation popup (their cfi points at the
// pristine section, explaining them out of context reads wrong) are skipped.
export const shouldPublishSelection = (selection: Pick<TextSelection, 'text' | 'popup'>): boolean =>
  !selection.popup && selection.text.trim().length > 0;

// Q6: fixed-layout books (PDF) have a meaningful page number; reflowable books
// (EPUB) only have a cfi, shown in small type where the page badge would sit.
export const getSelectionLocation = (
  selection: Pick<TextSelection, 'page' | 'cfi'>,
  isFixedLayout: boolean,
): SelectionLocation => {
  if (isFixedLayout) return { kind: 'page', page: selection.page };
  return selection.cfi
    ? { kind: 'cfi', cfi: selection.cfi }
    : { kind: 'page', page: selection.page };
};
