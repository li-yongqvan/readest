'use client';

import React, { useEffect, useRef } from 'react';

import { useBookDataStore } from '@/store/bookDataStore';
import { useExplainStore } from '@/store/explainStore';
import { useSidebarStore } from '@/store/sidebarStore';
import { runExplain } from './runExplain';

// Watches the explain store and, whenever a *new* selection lands, opens the
// sidebar on the explain tab — whatever tab was active (Q1/Q11: "select and
// explain" is one gesture in v1). Republishes of the same text (handle
// suppression, highlight stamps, quick-action hand-backs) are ignored, so
// closing the sidebar while the text stays selected is not fought.
const ExplainSidebarOpener: React.FC = () => {
  const selection = useExplainStore((state) => state.selection);
  const lastTextRef = useRef<string | null>(null);
  const { setSideBarBookKey, setSideBarVisible } = useSidebarStore();
  const { getConfig, setConfig } = useBookDataStore();

  useEffect(() => {
    if (!selection) return;
    const isNewSelection = selection.text !== lastTextRef.current;
    lastTextRef.current = selection.text;
    if (!isNewSelection) return;

    const bookKey = selection.key;
    setSideBarBookKey(bookKey);
    setSideBarVisible(true);
    const config = getConfig(bookKey);
    if (config?.viewSettings && config.viewSettings.sideBarTab !== 'explain') {
      setConfig(bookKey, {
        viewSettings: { ...config.viewSettings, sideBarTab: 'explain' },
      });
    }
    void runExplain();
  }, [selection, setSideBarBookKey, setSideBarVisible, getConfig, setConfig]);

  return null;
};

export default ExplainSidebarOpener;
