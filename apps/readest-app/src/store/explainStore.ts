import { create } from 'zustand';
import type { TextSelection } from '@/utils/sel';

interface ExplainState {
  // The latest published selection, kept after the selection is dismissed so
  // the panel still shows the last looked-up passage (Q4: manual close only).
  selection: TextSelection | null;
  setSelection: (selection: TextSelection) => void;
}

export const useExplainStore = create<ExplainState>((set) => ({
  selection: null,
  setSelection: (selection) => set({ selection }),
}));
