import { useState, useEffect, useCallback, useRef } from 'react';
import { bridge, GoatBridge } from '../miniapp-bridge.js';
import type {
  BottomSheetStateValue,
  SetSheetSnapPointsPayload,
  BottomSheetResult,
  TabHandle,
  TabOpenPayload,
  TabOpenResult,
  TabCloseResult,
  TabSwitchResult,
  TabCloseAllResult
} from '../types.js';

export interface UseGoatBottomSheetOptions {
  initialSnap?: number;
  isDismissible?: boolean;
  showDragHandle?: boolean;
  autoExpand?: boolean;
  onSnapChange?: (snap: number, sheetValue: BottomSheetStateValue) => void;
  onDismiss?: () => void;
  bridgeInstance?: GoatBridge;
}

export function useGoatBottomSheet(
  snapPoints: number[] = [0.25, 0.5, 0.9],
  options: UseGoatBottomSheetOptions = {}
) {
  const activeBridge = options.bridgeInstance || bridge;
  const initialSnap = options.initialSnap ?? snapPoints[1] ?? 0.5;

  const [currentSnap, setCurrentSnap] = useState<number>(initialSnap);
  const [sheetValue, setSheetValue] = useState<BottomSheetStateValue>('HALF');
  const [isDismissed, setIsDismissed] = useState<boolean>(false);

  const onSnapChangeRef = useRef(options.onSnapChange);
  onSnapChangeRef.current = options.onSnapChange;
  const onDismissRef = useRef(options.onDismiss);
  onDismissRef.current = options.onDismiss;

  const isExpanded = currentSnap >= Math.max(...snapPoints) || sheetValue === 'EXPANDED';
  const isCollapsed = currentSnap <= Math.min(...snapPoints) || sheetValue === 'COLLAPSED';

  // Apply snap points configuration
  const setSnapPointsConfig = useCallback(
    async (points: number[], initial?: number, dismissible?: boolean) => {
      const payload: SetSheetSnapPointsPayload = {
        snapPoints: points,
        initialSnap: initial ?? points[1] ?? 0.5,
        isDismissible: dismissible ?? options.isDismissible ?? true,
        showDragHandle: options.showDragHandle ?? true
      };
      return activeBridge.setSheetSnapPoints(payload);
    },
    [activeBridge, options.isDismissible, options.showDragHandle]
  );

  const expand = useCallback(
    async (snapPoint?: number): Promise<BottomSheetResult> => {
      const res = await activeBridge.expandBottomSheet(snapPoint);
      setCurrentSnap(res.currentSnap);
      setSheetValue(res.sheetValue);
      setIsDismissed(false);
      return res;
    },
    [activeBridge]
  );

  const collapse = useCallback(async (): Promise<BottomSheetResult> => {
    const res = await activeBridge.collapseBottomSheet();
    setCurrentSnap(res.currentSnap);
    setSheetValue(res.sheetValue);
    setIsDismissed(false);
    return res;
  }, [activeBridge]);

  const dismiss = useCallback(async (): Promise<BottomSheetResult> => {
    const res = await activeBridge.collapseBottomSheet();
    setIsDismissed(true);
    setSheetValue('HIDDEN');
    if (onDismissRef.current) {
      onDismissRef.current();
    }
    return res;
  }, [activeBridge]);

  // Initialize on mount
  useEffect(() => {
    setSnapPointsConfig(snapPoints, options.initialSnap, options.isDismissible);
    if (options.autoExpand) {
      expand();
    }
  }, [activeBridge]);

  // Listen to native sheet changes
  useEffect(() => {
    const handleStateChange = (payload: any) => {
      if (payload) {
        const snap = typeof payload.currentSnap === 'number' ? payload.currentSnap : currentSnap;
        const val = payload.sheetValue || (snap >= 0.8 ? 'EXPANDED' : snap <= 0.3 ? 'COLLAPSED' : 'HALF');
        setCurrentSnap(snap);
        setSheetValue(val);
        setIsDismissed(val === 'HIDDEN');
        if (onSnapChangeRef.current) {
          onSnapChangeRef.current(snap, val);
        }
      }
    };

    const handleDismiss = () => {
      setIsDismissed(true);
      setSheetValue('HIDDEN');
      if (onDismissRef.current) {
        onDismissRef.current();
      }
    };

    const cleanupState = activeBridge.on('onBottomSheetStateChange', handleStateChange);
    const cleanupDismiss = activeBridge.on('onBottomSheetDismiss', handleDismiss);

    return () => {
      cleanupState();
      cleanupDismiss();
    };
  }, [activeBridge, currentSnap]);

  return {
    currentSnap,
    sheetValue,
    isExpanded,
    isCollapsed,
    isDismissed,
    expand,
    collapse,
    dismiss,
    setSnapPoints: setSnapPointsConfig
  };
}

export interface UseGoatMultiTabOptions {
  bridgeInstance?: GoatBridge;
  onTabChange?: (tab: TabHandle) => void;
  onTabClose?: (tabId: string) => void;
}

/**
 * React hook for managing multi-tab bottom sheet stack (Task 10194 / Milestone 1).
 */
export function useGoatMultiTab(options: UseGoatMultiTabOptions = {}) {
  const activeBridge = options.bridgeInstance || bridge;
  const [tabs, setTabs] = useState<TabHandle[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);

  const onTabChangeRef = useRef(options.onTabChange);
  onTabChangeRef.current = options.onTabChange;
  const onTabCloseRef = useRef(options.onTabClose);
  onTabCloseRef.current = options.onTabClose;

  const refreshTabs = useCallback(async () => {
    const res = await activeBridge.getTabs();
    setTabs(res?.tabs || []);
    const active = await activeBridge.getActiveTab();
    setActiveTabId(active?.tabId || null);
    return res;
  }, [activeBridge]);

  const openTab = useCallback(
    async (payload: TabOpenPayload = {}): Promise<TabOpenResult> => {
      const res = await activeBridge.openTab(payload);
      setTabs((prev) => [...prev.filter((t) => t.tabId !== res.tabId), res]);
      setActiveTabId(res.tabId);
      if (onTabChangeRef.current) {
        onTabChangeRef.current(res);
      }
      return res;
    },
    [activeBridge]
  );

  const closeTab = useCallback(
    async (tabId: string): Promise<TabCloseResult> => {
      const res = await activeBridge.closeTab(tabId);
      setTabs((prev) => prev.filter((t) => t.tabId !== tabId));
      if (activeTabId === tabId) {
        setActiveTabId(null);
      }
      if (onTabCloseRef.current) {
        onTabCloseRef.current(tabId);
      }
      return res;
    },
    [activeBridge, activeTabId]
  );

  const switchToTab = useCallback(
    async (tabId: string): Promise<TabSwitchResult> => {
      const res = await activeBridge.switchToTab(tabId);
      setActiveTabId(tabId);
      const target = tabs.find((t) => t.tabId === tabId);
      if (target && onTabChangeRef.current) {
        onTabChangeRef.current(target);
      }
      return res;
    },
    [activeBridge, tabs]
  );

  const closeAllTabs = useCallback(async (): Promise<TabCloseAllResult> => {
    const res = await activeBridge.closeAllTabs();
    setTabs([]);
    setActiveTabId(null);
    return res;
  }, [activeBridge]);

  return {
    tabs,
    activeTabId,
    openTab,
    closeTab,
    switchToTab,
    closeAllTabs,
    refreshTabs
  };
}
