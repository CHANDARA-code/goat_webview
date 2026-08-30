import type React from 'react';

declare module 'react-native' {
  export const NativeModules: {
    GoatWebViewModule?: any;
    [key: string]: any;
  };

  export const Platform: {
    OS: 'ios' | 'android' | 'windows' | 'macos' | 'web';
    select: <T>(obj: { ios?: T; android?: T; default?: T; [key: string]: any }) => T;
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

  export interface ViewStyle {
    flex?: number;
    flexDirection?: 'row' | 'column' | 'row-reverse' | 'column-reverse';
    justifyContent?: 'flex-start' | 'flex-end' | 'center' | 'space-between' | 'space-around' | 'space-evenly';
    alignItems?: 'flex-start' | 'flex-end' | 'center' | 'stretch' | 'baseline';
    alignSelf?: 'auto' | 'flex-start' | 'flex-end' | 'center' | 'stretch' | 'baseline';
    flexWrap?: 'wrap' | 'nowrap' | 'wrap-reverse';
    gap?: number;
    width?: number | string;
    height?: number | string;
    minWidth?: number | string;
    minHeight?: number | string;
    maxWidth?: number | string;
    maxHeight?: number | string;
    margin?: number | string;
    marginHorizontal?: number | string;
    marginVertical?: number | string;
    marginTop?: number | string;
    marginBottom?: number | string;
    marginLeft?: number | string;
    marginRight?: number | string;
    padding?: number | string;
    paddingHorizontal?: number | string;
    paddingVertical?: number | string;
    paddingTop?: number | string;
    paddingBottom?: number | string;
    paddingLeft?: number | string;
    paddingRight?: number | string;
    position?: 'absolute' | 'relative';
    top?: number | string;
    bottom?: number | string;
    left?: number | string;
    right?: number | string;
    zIndex?: number;
    backgroundColor?: string;
    borderColor?: string;
    borderWidth?: number;
    borderRadius?: number;
    borderTopLeftRadius?: number;
    borderTopRightRadius?: number;
    borderBottomLeftRadius?: number;
    borderBottomRightRadius?: number;
    borderBottomWidth?: number;
    borderTopWidth?: number;
    borderLeftWidth?: number;
    borderRightWidth?: number;
    opacity?: number;
    overflow?: 'visible' | 'hidden' | 'scroll';
    shadowColor?: string;
    shadowOffset?: { width: number; height: number };
    shadowOpacity?: number;
    shadowRadius?: number;
    elevation?: number;
    transform?: any[];
    display?: 'none' | 'flex';
  }

  export interface TextStyle extends ViewStyle {
    color?: string;
    fontSize?: number;
    fontWeight?: 'normal' | 'bold' | '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900';
    fontFamily?: string;
    fontStyle?: 'normal' | 'italic';
    textAlign?: 'auto' | 'left' | 'right' | 'center' | 'justify';
    lineHeight?: number;
    letterSpacing?: number;
    textDecorationLine?: 'none' | 'underline' | 'line-through' | 'underline line-through';
    textTransform?: 'none' | 'capitalize' | 'uppercase' | 'lowercase';
  }

  export interface ImageStyle extends ViewStyle {
    resizeMode?: 'cover' | 'contain' | 'stretch' | 'repeat' | 'center';
  }

  export type NamedStyles<T> = { [P in keyof T]: ViewStyle | TextStyle | ImageStyle };

  export const StyleSheet: {
    create: <T extends NamedStyles<T> | NamedStyles<any>>(styles: T | NamedStyles<T>) => T;
    flatten: (style: any) => any;
    absoluteFillObject: ViewStyle;
    absoluteFill: ViewStyle;
    hairlineWidth: number;
  };

  export interface ViewProps {
    style?: ViewStyle | ViewStyle[] | (ViewStyle | undefined | false)[];
    testID?: string;
    children?: React.ReactNode;
    pointerEvents?: 'box-none' | 'none' | 'box-only' | 'auto';
    [key: string]: any;
  }

  export interface TextProps extends ViewProps {
    style?: TextStyle | TextStyle[] | (TextStyle | undefined | false)[];
    numberOfLines?: number;
    ellipsizeMode?: 'head' | 'middle' | 'tail' | 'clip';
    selectable?: boolean;
    onPress?: () => void;
  }

  export interface TouchableOpacityProps extends ViewProps {
    onPress?: (event?: any) => void;
    onLongPress?: (event?: any) => void;
    activeOpacity?: number;
    disabled?: boolean;
  }

  export interface ScrollViewProps extends ViewProps {
    horizontal?: boolean;
    showsHorizontalScrollIndicator?: boolean;
    showsVerticalScrollIndicator?: boolean;
    contentContainerStyle?: ViewStyle | ViewStyle[];
    scrollEnabled?: boolean;
    onScroll?: (event: any) => void;
    scrollEventThrottle?: number;
  }

  export interface TextInputProps extends ViewProps {
    value?: string;
    defaultValue?: string;
    placeholder?: string;
    placeholderTextColor?: string;
    onChangeText?: (text: string) => void;
    secureTextEntry?: boolean;
    keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad' | 'number-pad' | 'decimal-pad';
    multiline?: boolean;
    numberOfLines?: number;
    editable?: boolean;
    autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  }

  export interface SwitchProps extends ViewProps {
    value?: boolean;
    onValueChange?: (val: boolean) => void;
    disabled?: boolean;
    trackColor?: { false?: string; true?: string };
    thumbColor?: string;
  }

  export interface ModalProps extends ViewProps {
    visible?: boolean;
    animationType?: 'none' | 'slide' | 'fade';
    transparent?: boolean;
    onRequestClose?: () => void;
    onShow?: () => void;
  }

  export interface StatusBarProps {
    barStyle?: 'default' | 'light-content' | 'dark-content';
    backgroundColor?: string;
    hidden?: boolean;
    translucent?: boolean;
  }

  export const View: React.FC<ViewProps>;
  export const SafeAreaView: React.FC<ViewProps>;
  export const Text: React.FC<TextProps>;
  export const TouchableOpacity: React.FC<TouchableOpacityProps>;
  export const TouchableHighlight: React.FC<TouchableOpacityProps>;
  export const Pressable: React.FC<TouchableOpacityProps>;
  export const ScrollView: React.FC<ScrollViewProps>;
  export const TextInput: React.FC<TextInputProps>;
  export const Switch: React.FC<SwitchProps>;
  export const Modal: React.FC<ModalProps>;
  export const StatusBar: React.FC<StatusBarProps>;
  export const ActivityIndicator: React.FC<ViewProps & { size?: 'small' | 'large' | number; color?: string }>;

  export const Alert: {
    alert: (
      title: string,
      message?: string,
      buttons?: Array<{
        text?: string;
        onPress?: () => void;
        style?: 'default' | 'cancel' | 'destructive';
      }>,
      options?: { cancelable?: boolean }
    ) => void;
  };

  export const Dimensions: {
    get: (dim: 'window' | 'screen') => { width: number; height: number; scale: number; fontScale: number };
    addEventListener: (type: 'change', handler: (dims: { window: any; screen: any }) => void) => { remove: () => void };
  };

  export const PanResponder: {
    create: (config: any) => {
      panHandlers: any;
    };
  };

  export const Animated: {
    Value: new (val: number) => any;
    ValueXY: new (value?: { x: number; y: number }) => any;
    timing: (value: any, config: any) => { start: (callback?: (result: { finished: boolean }) => void) => void };
    spring: (value: any, config: any) => { start: (callback?: (result: { finished: boolean }) => void) => void };
    event: (argMapping: any[], config?: any) => (...args: any[]) => void;
    View: React.FC<ViewProps>;
  };

  export function requireNativeComponent<T = any>(name: string): React.ComponentType<T>;
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
