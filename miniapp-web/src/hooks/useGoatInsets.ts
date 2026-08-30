import { useState, useEffect, useCallback } from 'react';
import { bridge, GoatBridge } from '../miniapp-bridge.js';
import type { SafeAreaInsetsResult } from '../types.js';

export interface UseGoatInsetsOptions {
  syncCssVariables?: boolean;
  bridgeInstance?: GoatBridge;
}

export function useGoatInsets(options: UseGoatInsetsOptions = {}) {
  const activeBridge = options.bridgeInstance || bridge;
  const syncCssVariables = options.syncCssVariables ?? true;

  const [insets, setInsets] = useState<SafeAreaInsetsResult>({
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    keyboardHeight: 0,
    totalBottom: 0
  });

  const isKeyboardVisible = insets.keyboardHeight > 0;
  const totalBottom = insets.bottom + insets.keyboardHeight;

  const applyCssVariables = useCallback(
    (current: SafeAreaInsetsResult) => {
      if (!syncCssVariables || typeof document === 'undefined') return;
      const root = document.documentElement;
      root.style.setProperty('--goat-safe-area-top', `${current.top}px`);
      root.style.setProperty('--goat-safe-area-bottom', `${current.bottom}px`);
      root.style.setProperty('--goat-safe-area-left', `${current.left}px`);
      root.style.setProperty('--goat-safe-area-right', `${current.right}px`);
      root.style.setProperty('--goat-keyboard-height', `${current.keyboardHeight}px`);
      root.style.setProperty('--goat-viewport-bottom', `${current.bottom + current.keyboardHeight}px`);
    },
    [syncCssVariables]
  );

  const refresh = useCallback(async (): Promise<SafeAreaInsetsResult> => {
    try {
      const res = await activeBridge.getSafeAreaInsets();
      const updated: SafeAreaInsetsResult = {
        top: res.top ?? 0,
        bottom: res.bottom ?? 0,
        left: res.left ?? 0,
        right: res.right ?? 0,
        keyboardHeight: res.keyboardHeight ?? 0,
        totalBottom: (res.bottom ?? 0) + (res.keyboardHeight ?? 0)
      };
      setInsets(updated);
      applyCssVariables(updated);
      return updated;
    } catch {
      return insets;
    }
  }, [activeBridge, applyCssVariables, insets]);

  useEffect(() => {
    refresh();

    const handleSafeArea = (payload: any) => {
      if (payload) {
        setInsets((prev) => {
          const updated: SafeAreaInsetsResult = {
            ...prev,
            top: payload.top ?? prev.top,
            bottom: payload.bottom ?? prev.bottom,
            left: payload.left ?? prev.left,
            right: payload.right ?? prev.right,
            totalBottom: (payload.bottom ?? prev.bottom) + prev.keyboardHeight
          };
          applyCssVariables(updated);
          return updated;
        });
      }
    };

    const handleKeyboard = (payload: any) => {
      if (payload) {
        const height = payload.keyboardHeight ?? payload.heightPx ?? 0;
        setInsets((prev) => {
          const updated: SafeAreaInsetsResult = {
            ...prev,
            keyboardHeight: height,
            totalBottom: prev.bottom + height
          };
          applyCssVariables(updated);
          return updated;
        });
      }
    };

    const cleanupSafe = activeBridge.on('onSafeAreaChanged', handleSafeArea);
    const cleanupKeyboard = activeBridge.on('onKeyboardInsetsChanged', handleKeyboard);

    return () => {
      cleanupSafe();
      cleanupKeyboard();
    };
  }, [activeBridge, applyCssVariables]);

  return {
    ...insets,
    totalBottom,
    isKeyboardVisible,
    refresh
  };
}
