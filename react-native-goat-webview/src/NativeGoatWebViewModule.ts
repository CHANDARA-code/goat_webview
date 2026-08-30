import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export interface Spec extends TurboModule {
  prewarm(appId?: string): Promise<boolean>;
  clearCache(appId?: string): Promise<boolean>;
  getBundleVersion(appId?: string): Promise<string>;
  runHeadlessScript(script: string, appId?: string): Promise<string>;
  executeAction(action: string, payload: Object, appId?: string): Promise<Object>;
  triggerHaptic(type?: string, style?: string, notificationType?: string): Promise<Object>;
  setNavBarState(state: Object, appId?: string): Promise<boolean>;
  setBottomSheetState(state: Object, appId?: string): Promise<boolean>;
  notifyAppServiceReady(appId: string, details?: Object): Promise<boolean>;
  notifyAppServiceCrash(appId: string, error: string): Promise<boolean>;
  notifyAppServiceTerminate(appId: string): Promise<boolean>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('GoatWebViewModule');
