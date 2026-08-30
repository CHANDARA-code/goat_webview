import { ApiAction } from '../api-matrix';

export const coreActions: ApiAction[] = [
  {
    id: 'get-device-info',
    action: 'GET_DEVICE_INFO',
    aliases: ['getDeviceInfo', 'getSystemInfo'],
    domain: 'Core & System Lifecycle',
    domainSlug: 'core-system',
    description: 'Retrieves comprehensive hardware specifications, operating system release, screen display metrics, and power status of the host device.',
    purpose: 'Allows mini-apps to adapt responsive layouts, feature tiers, and dark/light system theme rendering based on host hardware attributes.',
    permissions: {
      manifest: [],
      scope: 'none',
      requiresGesture: false,
    },
    params: [],
    returns: {
      type: 'DeviceInfo',
      schema: {
        model: 'string',
        manufacturer: 'string',
        brand: 'string',
        platform: 'string (optional)',
        androidVersion: 'string (optional)',
        systemVersion: 'string (optional)',
        sdkInt: 'number',
        screenWidthDp: 'number',
        screenHeightDp: 'number',
        density: 'number',
        batteryLevel: 'number',
        isCharging: 'boolean',
        isAlgorithmicDarkening: 'boolean',
        appVersion: 'string',
        installGuid: 'string',
      },
      description: 'Device hardware details, display metrics, battery status, and application build metadata.',
    },
    errors: [
      {
        code: 'NATIVE_EXECUTION_ERROR',
        meaning: 'Host platform failed to query WindowManager or BatteryManager service.',
        troubleshooting: 'Ensure the host Activity is in a valid resumed lifecycle state.',
      },
    ],
    platforms: {
      android: true,
      ios: true,
      reactNative: true,
      flutter: true,
      web: true,
    },
    snippets: {
      typescript: `import { goatBridge } from '@goat/sdk';

const info = await goatBridge.callNative('GET_DEVICE_INFO', {});
console.log(\`Device: \${info.manufacturer} \${info.model}, Battery: \${info.batteryLevel}%\`);`,
      kotlin: `// Android Kotlin Bridge Handler
val info = buildJsonObject {
    put("model", Build.MODEL)
    put("manufacturer", Build.MANUFACTURER)
    put("sdkInt", Build.VERSION.SDK_INT)
    put("batteryLevel", batteryManager.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY))
    put("isCharging", isDeviceCharging())
}
bridge.sendResponse(requestId, info)`,
      swift: `// iOS Swift Bridge Handler
let info: [String: Any] = [
    "platform": "iOS",
    "model": UIDevice.current.model,
    "systemVersion": UIDevice.current.systemVersion,
    "batteryLevel": Int(UIDevice.current.batteryLevel * 100),
    "isCharging": UIDevice.current.batteryState == .charging
]
replyHandler(info, nil)`,
      dart: `// Flutter Dart Bridge Channel
final res = await goatController.callNativeAction('GET_DEVICE_INFO', {});
final model = res.data['model'];
final battery = res.data['batteryLevel'];`,
    },
    executable: true,
    defaultPayload: {},
  },
  {
    id: 'haptic-feedback',
    action: 'HAPTIC_FEEDBACK',
    aliases: ['triggerHaptic', 'hapticFeedback'],
    domain: 'Core & System Lifecycle',
    domainSlug: 'core-system',
    description: 'Triggers tactile haptic feedback impulses on supported hardware actuators (Taptic Engine / Android Vibrator).',
    purpose: 'Provides subtle physical confirmation for user UI gestures such as button taps, pull-to-refresh snaps, and error states.',
    permissions: {
      manifest: ['android.permission.VIBRATE'],
      scope: 'none',
      requiresGesture: false,
    },
    params: [
      {
        name: 'type',
        type: '"impact" | "notification" | "selection"',
        required: false,
        description: 'Haptic feedback category.',
        defaultValue: '"impact"',
      },
      {
        name: 'style',
        type: '"light" | "medium" | "heavy" | "rigid" | "soft"',
        required: false,
        description: 'Intensity style for impact feedback.',
        defaultValue: '"medium"',
      },
      {
        name: 'notificationType',
        type: '"success" | "warning" | "error"',
        required: false,
        description: 'Semantic pattern for notification haptics.',
      },
    ],
    returns: {
      type: 'HapticResult',
      schema: {
        triggered: 'boolean',
        type: 'string',
        style: 'string (optional)',
        notificationType: 'string (optional)',
      },
      description: 'Confirmation that the haptic impulse was submitted to the native vibrator engine.',
    },
    errors: [
      {
        code: 'INVALID_ARGUMENT',
        meaning: 'Unrecognized haptic style or invalid type string.',
        troubleshooting: 'Use valid style strings: light, medium, heavy, rigid, or soft.',
      },
    ],
    platforms: {
      android: true,
      ios: true,
      reactNative: true,
      flutter: true,
      web: true,
    },
    snippets: {
      typescript: `await goatBridge.callNative('HAPTIC_FEEDBACK', {
  type: 'impact',
  style: 'heavy'
});`,
      kotlin: `// Android VibratorEffect
val vibrator = context.getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
vibrator.vibrate(VibrationEffect.createPredefined(VibrationEffect.EFFECT_HEAVY_CLICK))`,
      swift: `// iOS UIImpactFeedbackGenerator
let generator = UIImpactFeedbackGenerator(style: .heavy)
generator.impactOccurred()`,
      dart: `await goatController.callNativeAction('HAPTIC_FEEDBACK', {
  'type': 'impact',
  'style': 'heavy'
});`,
    },
    executable: true,
    defaultPayload: { type: 'impact', style: 'medium' },
  },
  {
    id: 'set-status-bar-theme',
    action: 'SET_STATUS_BAR_THEME',
    aliases: ['setStatusBarTheme'],
    domain: 'Core & System Lifecycle',
    domainSlug: 'core-system',
    description: 'Configures the host status bar icon and text tinting between dark and light modes.',
    purpose: 'Ensures status bar icons (clock, battery, Wi-Fi) remain clearly legible over custom mini-app header backgrounds.',
    permissions: {
      manifest: [],
      scope: 'none',
      requiresGesture: false,
    },
    params: [
      {
        name: 'isDark',
        type: 'boolean',
        required: true,
        description: 'True for dark icons (light background), false for light icons (dark background).',
      },
    ],
    returns: {
      type: 'StatusBarResult',
      schema: {
        updated: 'boolean',
        isDark: 'boolean',
      },
      description: 'Status of window insets controller update.',
    },
    errors: [
      {
        code: 'INVALID_ARGUMENT',
        meaning: 'isDark property missing or not a boolean.',
        troubleshooting: 'Provide a boolean isDark parameter.',
      },
    ],
    platforms: {
      android: true,
      ios: true,
      reactNative: true,
      flutter: true,
      web: true,
    },
    snippets: {
      typescript: `await goatBridge.callNative('SET_STATUS_BAR_THEME', { isDark: true });`,
      kotlin: `WindowInsetsControllerCompat(window, window.decorView).isAppearanceLightStatusBars = isDark`,
      swift: `UIApplication.shared.statusBarStyle = isDark ? .darkContent : .lightContent`,
      dart: `await goatController.callNativeAction('SET_STATUS_BAR_THEME', {'isDark': true});`,
    },
    executable: true,
    defaultPayload: { isDark: true },
  },
  {
    id: 'set-screen-brightness',
    action: 'SET_SCREEN_BRIGHTNESS',
    aliases: ['setScreenBrightness', 'setBrightness'],
    domain: 'Core & System Lifecycle',
    domainSlug: 'core-system',
    description: 'Overrides the current window display brightness level between 0.0 (minimum) and 1.0 (maximum).',
    purpose: 'Useful for high-visibility situations such as presenting barcode/QR tickets at payment counters.',
    permissions: {
      manifest: [],
      scope: 'none',
      requiresGesture: false,
    },
    params: [
      {
        name: 'value',
        type: 'number',
        required: true,
        description: 'Brightness intensity value between 0.0 and 1.0.',
      },
    ],
    returns: {
      type: 'BrightnessResult',
      schema: {
        value: 'number',
        updated: 'boolean',
      },
      description: 'The applied window brightness value.',
    },
    errors: [
      {
        code: 'INVALID_ARGUMENT',
        meaning: 'Brightness value is out of bounds (must be between 0.0 and 1.0).',
        troubleshooting: 'Clamp brightness input values to the range [0.0, 1.0].',
      },
    ],
    platforms: {
      android: true,
      ios: true,
      reactNative: true,
      flutter: true,
      web: true,
    },
    snippets: {
      typescript: `await goatBridge.callNative('SET_SCREEN_BRIGHTNESS', { value: 0.9 });`,
      kotlin: `val layoutParams = window.attributes
layoutParams.screenBrightness = value.toFloat()
window.attributes = layoutParams`,
      swift: `UIScreen.main.brightness = CGFloat(value)`,
      dart: `await goatController.callNativeAction('SET_SCREEN_BRIGHTNESS', {'value': 0.9});`,
    },
    executable: true,
    defaultPayload: { value: 0.8 },
  },
  {
    id: 'get-screen-brightness',
    action: 'GET_SCREEN_BRIGHTNESS',
    aliases: ['getScreenBrightness', 'getBrightness'],
    domain: 'Core & System Lifecycle',
    domainSlug: 'core-system',
    description: 'Queries the current active screen brightness level of the host window.',
    purpose: 'Allows mini-apps to cache original user brightness before boosting it for barcode scanning.',
    permissions: {
      manifest: [],
      scope: 'none',
      requiresGesture: false,
    },
    params: [],
    returns: {
      type: 'BrightnessResult',
      schema: {
        value: 'number',
      },
      description: 'Current brightness floating point level between 0.0 and 1.0.',
    },
    errors: [],
    platforms: {
      android: true,
      ios: true,
      reactNative: true,
      flutter: true,
      web: true,
    },
    snippets: {
      typescript: `const { value } = await goatBridge.callNative('GET_SCREEN_BRIGHTNESS', {});`,
      kotlin: `val brightness = window.attributes.screenBrightness`,
      swift: `let brightness = Double(UIScreen.main.brightness)`,
      dart: `final res = await goatController.callNativeAction('GET_SCREEN_BRIGHTNESS', {});`,
    },
    executable: true,
    defaultPayload: {},
  },
  {
    id: 'set-keep-screen-on',
    action: 'SET_KEEP_SCREEN_ON',
    aliases: ['setKeepScreenOn'],
    domain: 'Core & System Lifecycle',
    domainSlug: 'core-system',
    description: 'Acquires or releases the host window screen wake lock preventing the display from dimming or locking.',
    purpose: 'Keeps the screen awake during video playback, route navigation, or continuous scanner reading.',
    permissions: {
      manifest: ['android.permission.WAKE_LOCK'],
      scope: 'none',
      requiresGesture: false,
    },
    params: [
      {
        name: 'keepScreenOn',
        type: 'boolean',
        required: true,
        description: 'True to lock screen awake, false to restore standard display timeout.',
      },
    ],
    returns: {
      type: 'KeepScreenOnResult',
      schema: {
        keepScreenOn: 'boolean',
        updated: 'boolean',
      },
      description: 'Updated screen wake lock status.',
    },
    errors: [
      {
        code: 'INVALID_ARGUMENT',
        meaning: 'keepScreenOn parameter was not provided as a boolean.',
        troubleshooting: 'Pass { keepScreenOn: true } or { keepScreenOn: false }.',
      },
    ],
    platforms: {
      android: true,
      ios: true,
      reactNative: true,
      flutter: true,
      web: true,
    },
    snippets: {
      typescript: `await goatBridge.callNative('SET_KEEP_SCREEN_ON', { keepScreenOn: true });`,
      kotlin: `if (keepScreenOn) window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
else window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)`,
      swift: `UIApplication.shared.isIdleTimerDisabled = keepScreenOn`,
      dart: `await goatController.callNativeAction('SET_KEEP_SCREEN_ON', {'keepScreenOn': true});`,
    },
    executable: true,
    defaultPayload: { keepScreenOn: true },
  },
  {
    id: 'clipboard-set',
    action: 'CLIPBOARD_SET',
    aliases: ['setClipboard', 'setClipboardData'],
    domain: 'Core & System Lifecycle',
    domainSlug: 'core-system',
    description: 'Copies plain text strings onto the native system clipboard.',
    purpose: 'Enables quick copy-to-clipboard functionality for order numbers, coupon codes, and shareable links.',
    permissions: {
      manifest: [],
      scope: 'none',
      requiresGesture: false,
    },
    params: [
      {
        name: 'text',
        type: 'string',
        required: true,
        description: 'String payload to write into system clipboard.',
      },
    ],
    returns: {
      type: 'ClipboardSetResult',
      schema: {
        copied: 'boolean',
        length: 'number',
      },
      description: 'Confirmation that string was committed to the clipboard buffer.',
    },
    errors: [
      {
        code: 'INVALID_ARGUMENT',
        meaning: 'text parameter was missing or not a string.',
        troubleshooting: 'Provide a valid string in the text field.',
      },
    ],
    platforms: {
      android: true,
      ios: true,
      reactNative: true,
      flutter: true,
      web: true,
    },
    snippets: {
      typescript: `await goatBridge.callNative('CLIPBOARD_SET', { text: 'GOAT-DISCOUNT-2026' });`,
      kotlin: `val clip = ClipData.newPlainText("text", text)
clipboardManager.setPrimaryClip(clip)`,
      swift: `UIPasteboard.general.string = text`,
      dart: `await goatController.callNativeAction('CLIPBOARD_SET', {'text': 'GOAT-DISCOUNT-2026'});`,
    },
    executable: true,
    defaultPayload: { text: 'GOAT-2026-COUPON' },
  },
  {
    id: 'clipboard-get',
    action: 'CLIPBOARD_GET',
    aliases: ['getClipboard', 'getClipboardData'],
    domain: 'Core & System Lifecycle',
    domainSlug: 'core-system',
    description: 'Reads current plain text string from system clipboard under active user gesture gate.',
    purpose: 'Allows pasting tracking codes, invite tokens, or addresses directly into mini-app forms.',
    permissions: {
      manifest: [],
      scope: 'none',
      requiresGesture: true,
    },
    params: [],
    returns: {
      type: 'ClipboardGetResult',
      schema: {
        text: 'string',
        hasContent: 'boolean',
      },
      description: 'Content of the clipboard and presence indicator.',
    },
    errors: [
      {
        code: 'GESTURE_REQUIRED',
        meaning: 'Clipboard read was invoked without recent user interaction touch gesture.',
        troubleshooting: 'Trigger CLIPBOARD_GET directly inside an onClick/onTouch handler.',
      },
    ],
    platforms: {
      android: true,
      ios: true,
      reactNative: true,
      flutter: true,
      web: true,
    },
    snippets: {
      typescript: `const { text } = await goatBridge.callNative('CLIPBOARD_GET', {});`,
      kotlin: `val clip = clipboardManager.primaryClip?.getItemAt(0)?.text?.toString() ?: ""`,
      swift: `let text = UIPasteboard.general.string ?? ""`,
      dart: `final res = await goatController.callNativeAction('CLIPBOARD_GET', {});`,
    },
    executable: true,
    defaultPayload: {},
  },
  {
    id: 'navigate-back',
    action: 'NAVIGATE_BACK',
    aliases: ['navigateBack'],
    domain: 'Core & System Lifecycle',
    domainSlug: 'core-system',
    description: 'Signals the host container to pop the top page or finish the mini-app activity if on root page.',
    purpose: 'Standardizes physical back gesture and custom mini-app header back button handling.',
    permissions: {
      manifest: [],
      scope: 'none',
      requiresGesture: false,
    },
    params: [],
    returns: {
      type: 'NavigateBackResult',
      schema: {
        handled: 'boolean',
        canGoBack: 'boolean',
      },
      description: 'Indicates whether the back navigation was handled inside WebView stack or host activity.',
    },
    errors: [],
    platforms: {
      android: true,
      ios: true,
      reactNative: true,
      flutter: true,
      web: true,
    },
    snippets: {
      typescript: `await goatBridge.callNative('NAVIGATE_BACK', {});`,
      kotlin: `if (webView.canGoBack()) webView.goBack() else activity.finish()`,
      swift: `if webView.canGoBack { webView.goBack() } else { navigationController?.popViewController(animated: true) }`,
      dart: `await goatController.callNativeAction('NAVIGATE_BACK', {});`,
    },
    executable: true,
    defaultPayload: {},
  },
  {
    id: 'can-i-use',
    action: 'CAN_I_USE',
    aliases: ['canIUse'],
    domain: 'Core & System Lifecycle',
    domainSlug: 'core-system',
    description: 'Probes host bridge runtime support for a specific action string or capability.',
    purpose: 'Allows progressive enhancement and graceful fallback when running on older host app versions.',
    permissions: {
      manifest: [],
      scope: 'none',
      requiresGesture: false,
    },
    params: [
      {
        name: 'action',
        type: 'string',
        required: true,
        description: 'Action string or feature key to probe (e.g., "BIOMETRIC_AUTH" or "BLE_START_SCAN").',
      },
    ],
    returns: {
      type: 'CanIUseResult',
      schema: {
        supported: 'boolean',
        action: 'string',
      },
      description: 'True if host container registers an active handler for the action.',
    },
    errors: [
      {
        code: 'INVALID_ARGUMENT',
        meaning: 'Action parameter is missing.',
        troubleshooting: 'Provide an action name string to test.',
      },
    ],
    platforms: {
      android: true,
      ios: true,
      reactNative: true,
      flutter: true,
      web: true,
    },
    snippets: {
      typescript: `const { supported } = await goatBridge.callNative('CAN_I_USE', { action: 'BIOMETRIC_AUTH' });
if (supported) {
  // Use biometrics
}`,
      kotlin: `val isSupported = handlerRegistry.containsKey(action.uppercase())`,
      swift: `let isSupported = registeredHandlers[action.uppercased()] != nil`,
      dart: `final res = await goatController.callNativeAction('CAN_I_USE', {'action': 'BIOMETRIC_AUTH'});`,
    },
    executable: true,
    defaultPayload: { action: 'BIOMETRIC_AUTH' },
  },
  {
    id: 'start-oauth-session',
    action: 'START_OAUTH_SESSION',
    aliases: ['startOAuthSession'],
    domain: 'Core & System Lifecycle',
    domainSlug: 'core-system',
    description: 'Launches a secure in-app authentication session (ASWebAuthenticationSession on iOS, Chrome Custom Tabs on Android).',
    purpose: 'Enables single sign-on (SSO) OAuth2/OIDC authorization with isolated cookie jars and zero plain credential leakage.',
    permissions: {
      manifest: [],
      scope: 'none',
      requiresGesture: false,
    },
    params: [
      {
        name: 'authUrl',
        type: 'string',
        required: true,
        description: 'HTTPS authorization endpoint URL.',
      },
      {
        name: 'redirectScheme',
        type: 'string',
        required: false,
        description: 'Custom URI callback scheme (e.g., "goat://oauth-callback").',
      },
      {
        name: 'state',
        type: 'string',
        required: false,
        description: 'CSRF state verification token.',
      },
    ],
    returns: {
      type: 'OAuthSessionResult',
      schema: {
        callbackUrl: 'string',
        status: '"SUCCESS" | "CANCELLED"',
      },
      description: 'The final redirect URL containing authorization code or access token.',
    },
    errors: [
      {
        code: 'INVALID_ARGUMENT',
        meaning: 'authUrl was missing or not a valid HTTPS URL.',
        troubleshooting: 'Ensure authUrl starts with https://.',
      },
      {
        code: 'SECURITY_VIOLATION',
        meaning: 'Cleartext HTTP URL supplied to OAuth session.',
        troubleshooting: 'OAuth endpoints must strictly use TLS (HTTPS).',
      },
      {
        code: 'USER_CANCEL',
        meaning: 'User dismissed the authentication sheet before completing login.',
        troubleshooting: 'Handle user cancellation gracefully in login UI.',
      },
    ],
    platforms: {
      android: true,
      ios: true,
      reactNative: true,
      flutter: true,
      web: true,
    },
    snippets: {
      typescript: `const result = await goatBridge.callNative('START_OAUTH_SESSION', {
  authUrl: 'https://auth.example.com/oauth/authorize?client_id=goat_app&response_type=code',
  redirectScheme: 'goat://oauth-callback'
});`,
      kotlin: `// CustomTabsIntent launch with redirect listener
val intent = CustomTabsIntent.Builder().build()
intent.launchUrl(activity, Uri.parse(authUrl))`,
      swift: `// ASWebAuthenticationSession
let session = ASWebAuthenticationSession(url: URL(string: authUrl)!, callbackURLScheme: redirectScheme) { url, error in
    // handle callback
}
session.start()`,
      dart: `final res = await goatController.callNativeAction('START_OAUTH_SESSION', {
  'authUrl': 'https://auth.example.com/oauth/authorize',
  'redirectScheme': 'goat://oauth-callback'
});`,
    },
    executable: true,
    defaultPayload: {
      authUrl: 'https://auth.example.com/oauth/authorize?client_id=123',
      redirectScheme: 'goat://oauth-callback',
    },
  },
  {
    id: 'cancel-oauth-session',
    action: 'CANCEL_OAUTH_SESSION',
    aliases: ['cancelOAuthSession'],
    domain: 'Core & System Lifecycle',
    domainSlug: 'core-system',
    description: 'Dismisses an active in-app OAuth authentication browser sheet.',
    purpose: 'Allows programmatic timeout or user cancellation of pending OAuth authentication requests.',
    permissions: {
      manifest: [],
      scope: 'none',
      requiresGesture: false,
    },
    params: [],
    returns: {
      type: 'OAuthCancelResult',
      schema: {
        cancelled: 'boolean',
      },
      description: 'Indicates the OAuth session was aborted.',
    },
    errors: [],
    platforms: {
      android: true,
      ios: true,
      reactNative: true,
      flutter: true,
      web: true,
    },
    snippets: {
      typescript: `await goatBridge.callNative('CANCEL_OAUTH_SESSION', {});`,
      kotlin: `activeCustomTabSession?.cancel()`,
      swift: `activeAuthSession?.cancel()`,
      dart: `await goatController.callNativeAction('CANCEL_OAUTH_SESSION', {});`,
    },
    executable: true,
    defaultPayload: {},
  },
];
