import { useEffect, useRef } from 'react';
import { bridge, GoatBridge } from '../miniapp-bridge.js';

export interface UseGoatLifecycleCallbacks {
  onPageLoaded?: (url?: string) => void;
  onError?: (error: any) => void;
  onPause?: () => void;
  onResume?: () => void;
  onDestroy?: () => void;
  onAppShow?: (options?: any) => void;
  onAppHide?: () => void;
  onPageScroll?: (scroll: { scrollTop: number; scrollLeft: number; scrollHeight: number; scrollWidth: number }) => void;
  onMemoryWarning?: (info: { level?: number | string; memoryPressure?: string }) => void;
  onWindowResize?: (size: { width: number; height: number; windowWidth: number; windowHeight: number; orientation: string }) => void;
  bridgeInstance?: GoatBridge;
}

export function useGoatLifecycle(callbacks: UseGoatLifecycleCallbacks = {}) {
  const activeBridge = callbacks.bridgeInstance || bridge;
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  useEffect(() => {
    const handleLoaded = (payload: any) => {
      callbacksRef.current.onPageLoaded?.(typeof payload === 'string' ? payload : payload?.url);
    };

    const handleError = (payload: any) => {
      callbacksRef.current.onError?.(payload);
    };

    const handlePause = () => {
      callbacksRef.current.onPause?.();
    };

    const handleResume = () => {
      callbacksRef.current.onResume?.();
    };

    const handleDestroy = () => {
      callbacksRef.current.onDestroy?.();
    };

    const handleAppShow = (payload: any) => {
      callbacksRef.current.onAppShow?.(payload);
      callbacksRef.current.onResume?.();
    };

    const handleAppHide = () => {
      callbacksRef.current.onAppHide?.();
      callbacksRef.current.onPause?.();
    };

    const handlePageScroll = (payload: any) => {
      callbacksRef.current.onPageScroll?.(payload);
    };

    const handleMemoryWarning = (payload: any) => {
      callbacksRef.current.onMemoryWarning?.(payload);
    };

    const handleWindowResize = (payload: any) => {
      callbacksRef.current.onWindowResize?.(payload);
    };

    const cleanups = [
      activeBridge.on('onPageLoaded', handleLoaded),
      activeBridge.on('onError', handleError),
      activeBridge.on('onPause', handlePause),
      activeBridge.on('onResume', handleResume),
      activeBridge.on('onDestroy', handleDestroy),
      activeBridge.on('ON_APP_SHOW', handleAppShow),
      activeBridge.on('onAppShow', handleAppShow),
      activeBridge.on('ON_APP_HIDE', handleAppHide),
      activeBridge.on('onAppHide', handleAppHide),
      activeBridge.on('ON_PAGE_SCROLL', handlePageScroll),
      activeBridge.on('onPageScroll', handlePageScroll),
      activeBridge.on('ON_MEMORY_WARNING', handleMemoryWarning),
      activeBridge.on('onMemoryWarning', handleMemoryWarning),
      activeBridge.on('ON_WINDOW_RESIZE', handleWindowResize),
      activeBridge.on('onWindowResize', handleWindowResize)
    ];

    // Browser fallbacks
    const handleVisibility = () => {
      if (typeof document !== 'undefined') {
        if (document.hidden) {
          callbacksRef.current.onPause?.();
        } else {
          callbacksRef.current.onResume?.();
        }
      }
    };

    const handlePageHide = () => {
      callbacksRef.current.onPause?.();
    };

    const handlePageShow = () => {
      callbacksRef.current.onResume?.();
    };

    if (typeof document !== 'undefined' && typeof window !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibility);
      window.addEventListener('pagehide', handlePageHide);
      window.addEventListener('pageshow', handlePageShow);
    }

    return () => {
      cleanups.forEach((fn) => fn());
      if (typeof document !== 'undefined' && typeof window !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibility);
        window.removeEventListener('pagehide', handlePageHide);
        window.removeEventListener('pageshow', handlePageShow);
      }
    };
  }, [activeBridge]);
}
