import { useEffect, useRef } from 'react';
import { bridge, GoatBridge } from '../miniapp-bridge.js';

export interface UseGoatLifecycleCallbacks {
  onPageLoaded?: (url?: string) => void;
  onError?: (error: any) => void;
  onPause?: () => void;
  onResume?: () => void;
  onDestroy?: () => void;
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

    const cleanups = [
      activeBridge.on('onPageLoaded', handleLoaded),
      activeBridge.on('onError', handleError),
      activeBridge.on('onPause', handlePause),
      activeBridge.on('onResume', handleResume),
      activeBridge.on('onDestroy', handleDestroy)
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
