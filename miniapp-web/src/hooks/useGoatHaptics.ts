import { useCallback } from 'react';
import { bridge, GoatBridge } from '../miniapp-bridge.js';
import type {
  ImpactStyle,
  NotificationHapticType,
  HapticPreset,
  HapticPayload,
  HapticType,
  HapticFeedbackResult
} from '../types.js';

export interface UseGoatHapticsOptions {
  bridgeInstance?: GoatBridge;
}

export function useGoatHaptics(options: UseGoatHapticsOptions = {}) {
  const activeBridge = options.bridgeInstance || bridge;

  const triggerImpact = useCallback(
    async (style: ImpactStyle = 'medium'): Promise<HapticFeedbackResult> => {
      return activeBridge.triggerImpact(style);
    },
    [activeBridge]
  );

  const triggerNotification = useCallback(
    async (notificationType: NotificationHapticType = 'success'): Promise<HapticFeedbackResult> => {
      return activeBridge.triggerNotification(notificationType);
    },
    [activeBridge]
  );

  const triggerSelection = useCallback(async (): Promise<HapticFeedbackResult> => {
    return activeBridge.triggerSelection();
  }, [activeBridge]);

  const triggerHaptic = useCallback(
    async (
      hapticOptions: HapticPayload | HapticType | HapticPreset
    ): Promise<HapticFeedbackResult> => {
      return activeBridge.triggerHaptic(hapticOptions);
    },
    [activeBridge]
  );

  return {
    triggerImpact,
    triggerNotification,
    triggerSelection,
    triggerHaptic
  };
}
