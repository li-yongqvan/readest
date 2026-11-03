'use client';

import React from 'react';

import { useTranslation } from '@/hooks/useTranslation';
import { useExplainStore } from '@/store/explainStore';
import type { TextSelection } from '@/utils/sel';
import { getSelectionLocation, isCrossPageSelection } from './utils';

// M2 skeleton: echo the selected passage and its location into the sidebar's
// "Explain" tab. No AI call here — that lands in M3 behind this same panel.
const ExplainView: React.FC<{ bookKey: string; isFixedLayout: boolean }> = ({
  bookKey,
  isFixedLayout,
}) => {
  const _ = useTranslation();
  const selection = useExplainStore((state) => state.selection);
  const sel: TextSelection | null =
    selection && selection.key === bookKey && selection.text.trim().length > 0 ? selection : null;

  if (!sel) {
    return (
      <div className='text-base-content/60 flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-sm'>
        <span className='text-2xl'>✨</span>
        <span>{_('Select text in the book and an AI explanation will appear here.')}</span>
      </div>
    );
  }

  if (isCrossPageSelection(sel)) {
    return (
      <div className='flex flex-col gap-3 p-1'>
        <div className='bg-base-200 flex flex-col gap-2 rounded-lg p-4'>
          <div className='text-base-content font-bold'>
            🚧 {_('Cross-page selection is not supported yet')}
          </div>
          <div className='text-base-content/80 text-sm'>
            {_(
              'Please select within a single page. Long passages can be looked up in several parts.',
            )}
          </div>
        </div>
        <div className='text-base-content/50 text-xs italic' dir='auto'>
          {_('Captured but not explained:')} “{sel.text}”
        </div>
      </div>
    );
  }

  const location = getSelectionLocation(sel, isFixedLayout);

  return (
    <div className='flex flex-col gap-3 p-1'>
      <blockquote
        className='border-base-content/25 text-base-content border-l-2 pl-3 text-sm italic'
        dir='auto'
      >
        {sel.text}
      </blockquote>
      <div className='flex items-center gap-2 text-xs'>
        {location.kind === 'page' ? (
          <span className='bg-base-300 text-base-content rounded-full px-2.5 py-0.5 font-semibold'>
            P.{location.page}
          </span>
        ) : (
          <span className='text-base-content/60 break-all'>{location.cfi}</span>
        )}
        <span className='text-base-content/40'>{_('Selected text')}</span>
      </div>
    </div>
  );
};

export default ExplainView;
