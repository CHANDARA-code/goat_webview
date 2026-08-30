declare module 'react-native' {
  export const NativeModules: {
    GoatWebViewModule?: any;
    [key: string]: any;
  };
  export const Platform: {
    OS: string;
    select: (obj: Record<string, any>) => any;
  };
  export const UIManager: {
    getViewManagerConfig: (name: string) => any;
  };
  export const TurboModuleRegistry: {
    get: <T>(name: string) => T | null;
    getEnforcing: <T>(name: string) => T;
  };
  export interface TurboModule {}
  export interface HostComponent<T> extends React.ComponentType<T> {}
  export interface ViewProps {
    [key: string]: any;
  }
  export function requireNativeComponent<T = any>(name: string): React.ComponentType<T>;
  export interface ViewStyle {
    [key: string]: any;
  }
}

declare module 'react-native/Libraries/Utilities/codegenNativeComponent' {
  import type { HostComponent } from 'react-native';
  export default function codegenNativeComponent<T>(name: string, options?: any): HostComponent<T>;
}

declare module 'react-native/Libraries/Types/CodegenTypes' {
  export type DirectEventHandler<T, EventPriority = never> = (event: { nativeEvent: T }) => void;
  export type BubblingEventHandler<T, EventPriority = never> = (event: { nativeEvent: T }) => void;
  export type WithDefault<T, V> = T;
  export type Int32 = number;
  export type Double = number;
  export type Float = number;
}

declare const __DEV__: boolean;
