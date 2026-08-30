import { useEffect, useCallback, useRef } from 'react';
import { bridge, GoatBridge } from '../miniapp-bridge.js';
import type {
  GoatNavButtonType,
  SetNavBarColorPayload,
  SetNavBarButtonsPayload,
  SetNavBarProgressPayload,
  NavBarConfigPayload
} from '../types.js';

export interface UseGoatNavBarOptions {
  title?: string;
  subtitle?: string;
  backgroundColor?: string;
  textColor?: string;
  isDark?: boolean;
  leftButton?: GoatNavButtonType;
  rightButtons?: GoatNavButtonType[];
  loading?: boolean;
  progress?: number;
  visible?: boolean;
  onButtonClick?: (button: string) => void;
  restoreOnUnmount?: boolean;
  bridgeInstance?: GoatBridge;
}

export function useGoatNavBar(options: UseGoatNavBarOptions = {}) {
  const activeBridge = options.bridgeInstance || bridge;
  const onButtonClickRef = useRef(options.onButtonClick);
  onButtonClickRef.current = options.onButtonClick;

  const initialOptionsRef = useRef(options);

  const setTitle = useCallback(
    async (title: string, subtitle?: string) => {
      return activeBridge.setNavBarTitle(title, subtitle);
    },
    [activeBridge]
  );

  const setSubtitle = useCallback(
    async (subtitle: string) => {
      return activeBridge.setNavBarTitle(options.title || '', subtitle);
    },
    [activeBridge, options.title]
  );

  const setColor = useCallback(
    async (colorOptions: SetNavBarColorPayload) => {
      return activeBridge.setNavBarColor(colorOptions);
    },
    [activeBridge]
  );

  const setButtons = useCallback(
    async (buttonOptions: SetNavBarButtonsPayload) => {
      return activeBridge.setNavBarButtons(buttonOptions);
    },
    [activeBridge]
  );

  const setProgress = useCallback(
    async (progressOptions: SetNavBarProgressPayload | boolean, progress?: number) => {
      return activeBridge.setNavBarProgress(progressOptions, progress);
    },
    [activeBridge]
  );

  const setLoading = useCallback(
    async (loading: boolean) => {
      return activeBridge.setNavBarProgress(loading);
    },
    [activeBridge]
  );

  const setNavBar = useCallback(
    async (config: NavBarConfigPayload) => {
      return activeBridge.setNavBar(config);
    },
    [activeBridge]
  );

  // Synchronize options on mount and changes
  useEffect(() => {
    const config: NavBarConfigPayload = {
      title: options.title,
      subtitle: options.subtitle,
      backgroundColor: options.backgroundColor,
      textColor: options.textColor,
      isDark: options.isDark,
      leftButton: options.leftButton,
      rightButtons: options.rightButtons,
      isProgressVisible: options.loading ?? (options.progress !== undefined ? options.progress >= 0 : undefined),
      progress: options.progress,
      isVisible: options.visible
    };
    activeBridge.setNavBar(config);
  }, [
    activeBridge,
    options.title,
    options.subtitle,
    options.backgroundColor,
    options.textColor,
    options.isDark,
    options.leftButton,
    options.rightButtons,
    options.loading,
    options.progress,
    options.visible
  ]);

  // Listen to native nav bar button clicks
  useEffect(() => {
    const handleButtonClick = (payload: any) => {
      const buttonName = typeof payload === 'string' ? payload : (payload?.button || payload?.id || '');
      if (onButtonClickRef.current) {
        onButtonClickRef.current(buttonName);
      }
    };

    const cleanup1 = activeBridge.on('onNavBarButtonClick', handleButtonClick);
    const cleanup2 = activeBridge.on('onButtonClick', handleButtonClick);

    return () => {
      cleanup1();
      cleanup2();
      if (initialOptionsRef.current.restoreOnUnmount) {
        activeBridge.setNavBarTitle('');
      }
    };
  }, [activeBridge]);

  return {
    setTitle,
    setSubtitle,
    setColor,
    setButtons,
    setProgress,
    setLoading,
    setNavBar
  };
}
