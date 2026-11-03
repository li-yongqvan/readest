import { useExplainStore } from '@/store/explainStore';
import type { TextSelection } from '@/utils/sel';
import { shouldPublishSelection } from './utils';

// Single writer into the explain store: Annotator's selection effect forwards
// every publish here. Sidebar opening/tab-switching is NOT done here — it
// lives in ExplainSidebarOpener (mounted by SideBar) so Annotator unit tests,
// which hand-mock the other stores, never see those calls.
export const publishExplainSelection = (selection: TextSelection | null): void => {
  if (!selection || !shouldPublishSelection(selection)) return;
  useExplainStore.getState().setSelection(selection);
};
