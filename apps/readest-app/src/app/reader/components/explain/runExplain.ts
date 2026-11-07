import { getAIProvider } from '@/services/ai/providers';
import { useBookDataStore } from '@/store/bookDataStore';
import { useExplainStore } from '@/store/explainStore';
import { useSettingsStore } from '@/store/settingsStore';
import { extractSelectionContext } from './context';
import { classifyExplainError, ExplainRequestError, requestExplanation } from './service';
import { isCrossPageSelection } from './utils';

// Drives one explain request for the store's current selection + contextLevel.
// Called by ExplainSidebarOpener on a fresh selection and by ExplainView's
// retry / retry-with-more-context buttons. Plain function (not a hook) so it
// works from event handlers; staleness is handled by the store's requestId.
export const runExplain = async (): Promise<void> => {
  const { selection, contextLevel } = useExplainStore.getState();
  if (!selection || selection.text.trim().length === 0) return;
  // v1: cross-page selections get the M2 notice card, never a request.
  if (isCrossPageSelection(selection)) return;

  const aiSettings = useSettingsStore.getState().settings?.aiSettings;
  const requestId = useExplainStore.getState().startRequest();

  try {
    if (
      !aiSettings?.enabled ||
      aiSettings.provider !== 'openrouter' ||
      !aiSettings.openrouterApiKey
    ) {
      throw new ExplainRequestError('unconfigured', 'OpenAI Compatible provider is not configured');
    }
    const isFixedLayout =
      useBookDataStore.getState().getBookData(selection.key)?.isFixedLayout ?? false;
    const context = extractSelectionContext(selection, isFixedLayout, contextLevel);
    const model = getAIProvider(aiSettings).getModel();
    const result = await requestExplanation({ model, text: selection.text, context });
    useExplainStore.getState().resolveRequest(requestId, result);
  } catch (error) {
    useExplainStore.getState().failRequest(requestId, classifyExplainError(error));
  }
};
