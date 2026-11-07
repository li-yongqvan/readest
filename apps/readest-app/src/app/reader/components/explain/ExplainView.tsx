'use client';

import React from 'react';

import { useTranslation } from '@/hooks/useTranslation';
import { MAX_CONTEXT_LEVEL, useExplainStore } from '@/store/explainStore';
import type { ExplainErrorKind } from '@/store/explainStore';
import type { TextSelection } from '@/utils/sel';
import { runExplain } from './runExplain';
import { getSelectionLocation, isCrossPageSelection } from './utils';

const ExplainView: React.FC<{ bookKey: string; isFixedLayout: boolean }> = ({
  bookKey,
  isFixedLayout,
}) => {
  const _ = useTranslation();
  const selection = useExplainStore((state) => state.selection);
  const status = useExplainStore((state) => state.status);
  const result = useExplainStore((state) => state.result);
  const error = useExplainStore((state) => state.error);
  const contextLevel = useExplainStore((state) => state.contextLevel);

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

  // errorMessages maps store error kinds to user-facing copy; 'unconfigured'
  // gets its own guidance card instead of a retry button.
  const errorMessages: Partial<Record<ExplainErrorKind, string>> = {
    auth: _('Invalid API key. Check Settings → AI.'),
    network: _('Network error. Check your connection and try again.'),
    timeout: _('Request timed out. Try again.'),
    parse: _('Could not parse the AI response. Try again.'),
    unknown: _('Failed to explain. Try again.'),
  };

  const onRetryWithMoreContext = () => {
    useExplainStore.getState().escalateContext();
    void runExplain();
  };

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
        <span className='text-base-content/40'>{_('Selected passage')}</span>
      </div>

      {(status === 'idle' || status === 'loading') && (
        <div className='flex flex-col gap-2' data-testid='explain-skeleton'>
          <div className='bg-base-200/50 h-4 w-1/3 animate-pulse rounded-sm' />
          <div className='bg-base-200/50 h-3 w-full animate-pulse rounded-sm' />
          <div className='bg-base-200/50 h-12 w-full animate-pulse rounded-sm' />
        </div>
      )}

      {status === 'success' && result && (
        <div className='flex flex-col gap-2'>
          <div className='text-base-content font-bold' dir='auto'>
            {result.term}
          </div>
          <div className='text-base-content/80 text-sm' dir='auto'>
            {result.def}
          </div>
          {result.zh && (
            <div className='text-base-content/80 text-sm italic' dir='auto'>
              {result.zh}
            </div>
          )}
          <div className='text-base-content text-sm whitespace-pre-wrap' dir='auto'>
            {result.explain}
          </div>
          <div className='flex items-center gap-2'>
            <button
              className='btn btn-contrast btn-sm'
              disabled={contextLevel >= MAX_CONTEXT_LEVEL}
              onClick={onRetryWithMoreContext}
            >
              {_('Retry with more context')}
            </button>
            {contextLevel >= MAX_CONTEXT_LEVEL && (
              <span className='text-base-content/50 text-xs'>{_('Max context reached')}</span>
            )}
          </div>
        </div>
      )}

      {status === 'error' && error?.kind === 'unconfigured' && (
        <div className='bg-base-200 flex flex-col gap-2 rounded-lg p-4'>
          <div className='text-base-content/80 text-sm'>
            {_(
              'Set up your AI provider in Settings → AI first (OpenAI Compatible, base URL https://api.deepseek.com, model deepseek-chat).',
            )}
          </div>
        </div>
      )}

      {status === 'error' && error && error.kind !== 'unconfigured' && (
        <div className='bg-base-200 flex flex-col gap-2 rounded-lg p-4'>
          <div className='text-error text-sm'>{errorMessages[error.kind]}</div>
          <div>
            <button className='btn btn-contrast btn-sm' onClick={() => void runExplain()}>
              {_('Retry')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExplainView;
