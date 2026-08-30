import { ApiAction } from '../api-matrix';

export const biometricActions: ApiAction[] = [
  {
    id: 'check-biometric-support',
    action: 'CHECK_BIOMETRIC_SUPPORT',
    aliases: ['checkBiometricSupport', 'checkBiometricsSupport'],
    domain: 'Biometrics & Permissions',
    domainSlug: 'biometrics-security',
    description: 'Probes host device hardware for biometric enrollment and supported sensor modality (FaceID, TouchID, OpticID, Fingerprint).',
    purpose: 'Allows mini-apps to conditionally show "Log in with Face ID" or "Biometric Checkout" buttons.',
    permissions: {
      manifest: ['android.permission.USE_BIOMETRIC', 'NSFaceIDUsageDescription'],
      scope: 'none',
      requiresGesture: false,
    },
    params: [],
    returns: {
      type: 'BiometricSupportResult',
      schema: { supported: 'boolean', biometryType: '"faceID" | "touchID" | "opticID" | "fingerprint" | "none"' },
      description: 'Hardware availability and sensor type.',
    },
    errors: [],
    platforms: { android: true, ios: true, reactNative: true, flutter: true, web: true },
    snippets: {
      typescript: `const { supported, biometryType } = await goatBridge.callNative('CHECK_BIOMETRIC_SUPPORT', {});
console.log('Biometrics supported:', supported, 'Type:', biometryType);`,
      kotlin: `val biometricManager = BiometricManager.from(context)
val canAuthenticate = biometricManager.canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG) == BiometricManager.BIOMETRIC_SUCCESS`,
      swift: `var error: NSError?
let context = LAContext()
let supported = context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error)`,
      dart: `final res = await goatController.callNativeAction('CHECK_BIOMETRIC_SUPPORT', {});`,
    },
    executable: true,
    defaultPayload: {},
  },
  {
    id: 'biometric-auth',
    action: 'BIOMETRIC_AUTH',
    aliases: ['biometricAuth', 'authenticateWithBiometrics'],
    domain: 'Biometrics & Permissions',
    domainSlug: 'biometrics-security',
    description: 'Displays the native system biometric authentication prompt (TouchID, FaceID, Android BiometricPrompt) under active user gesture gate.',
    purpose: 'Authorizes high-security transactions, funds transfers, and confidential record access.',
    permissions: {
      manifest: ['android.permission.USE_BIOMETRIC', 'NSFaceIDUsageDescription'],
      scope: 'scope.biometrics',
      requiresGesture: true,
    },
    params: [
      { name: 'title', type: 'string', required: false, description: 'Authentication prompt title.', defaultValue: '"Biometric Authentication"' },
      { name: 'subtitle', type: 'string', required: false, description: 'Prompt subtitle.' },
      { name: 'reason', type: 'string', required: false, description: 'Detailed justification string shown to user.' },
      { name: 'negativeButtonText', type: 'string', required: false, description: 'Cancel button label.', defaultValue: '"Cancel"' },
    ],
    returns: {
      type: 'BiometricAuthResult',
      schema: { authenticated: 'boolean', biometryType: 'string (optional)', token: 'string (optional)' },
      description: 'Authentication result and optional cryptographic verification signature.',
    },
    errors: [
      { code: 'GESTURE_REQUIRED', meaning: 'Biometric prompt triggered without recent user touch gesture (<10s).', troubleshooting: 'Trigger BIOMETRIC_AUTH directly inside an onClick/onTap handler.' },
      { code: 'PERMISSION_DENIED', meaning: 'User denied biometric authorization.', troubleshooting: 'Handle fallback authentication.' },
      { code: 'BIOMETRIC_LOCKOUT', meaning: 'Too many failed biometric attempts. Device locked.', troubleshooting: 'Prompt user to unlock with device passcode.' },
      { code: 'BIOMETRIC_UNAVAILABLE', meaning: 'No biometrics enrolled or hardware disabled.', troubleshooting: 'Fallback to PIN or password.' },
      { code: 'USER_CANCEL', meaning: 'User dismissed the biometric dialog.', troubleshooting: 'Allow user to retry or cancel.' },
    ],
    platforms: { android: true, ios: true, reactNative: true, flutter: true, web: true },
    snippets: {
      typescript: `const result = await goatBridge.callNative('BIOMETRIC_AUTH', {
  title: 'Confirm Payment',
  subtitle: 'Authorize transfer of $50.00',
  reason: 'Scan your face to authorize transaction'
});
if (result.authenticated) {
  // Transfer authorized
}`,
      kotlin: `val promptInfo = BiometricPrompt.PromptInfo.Builder()
    .setTitle(title)
    .setSubtitle(subtitle)
    .setNegativeButtonText(negativeButtonText)
    .build()
BiometricPrompt(activity, executor, callback).authenticate(promptInfo)`,
      swift: `let context = LAContext()
context.evaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, localizedReason: reason) { success, error in
    // handle success
}`,
      dart: `final res = await goatController.callNativeAction('BIOMETRIC_AUTH', {
  'title': 'Confirm Payment',
  'reason': 'Authorize payment',
});`,
    },
    executable: true,
    defaultPayload: { title: 'Confirm Payment', reason: 'Authenticate to complete purchase' },
  },
  {
    id: 'check-permission',
    action: 'CHECK_PERMISSION',
    aliases: ['checkPermission'],
    domain: 'Biometrics & Permissions',
    domainSlug: 'biometrics-security',
    description: 'Checks authorization status for a specific permission scope (e.g., "scope.camera", "scope.userLocation", "scope.bluetooth").',
    purpose: 'Determines whether permission priming or direct request is required before invoking hardware features.',
    permissions: { manifest: [], scope: 'none', requiresGesture: false },
    params: [
      { name: 'scope', type: 'string', required: true, description: 'Permission scope identifier (e.g. "scope.camera", "scope.userLocation").' },
    ],
    returns: {
      type: 'PermissionResult',
      schema: { scope: 'string', granted: 'boolean', isDeclaredInManifest: 'boolean' },
      description: 'Current permission grant status.',
    },
    errors: [
      { code: 'INVALID_ARGUMENT', meaning: 'Missing scope string.', troubleshooting: 'Pass a valid permission scope.' },
    ],
    platforms: { android: true, ios: true, reactNative: true, flutter: true, web: true },
    snippets: {
      typescript: `const { granted } = await goatBridge.callNative('CHECK_PERMISSION', { scope: 'scope.camera' });
if (!granted) {
  // Show priming dialog
}`,
      kotlin: `val granted = ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED`,
      swift: `let status = AVCaptureDevice.authorizationStatus(for: .video)
let granted = status == .authorized`,
      dart: `final res = await goatController.callNativeAction('CHECK_PERMISSION', {'scope': 'scope.camera'});`,
    },
    executable: true,
    defaultPayload: { scope: 'scope.camera' },
  },
  {
    id: 'request-permission',
    action: 'REQUEST_PERMISSION',
    aliases: ['requestPermission', 'requestPermissionWithPriming'],
    domain: 'Biometrics & Permissions',
    domainSlug: 'biometrics-security',
    description: 'Triggers a two-stage permission priming dialog explaining rationale before showing native OS permission prompt.',
    purpose: 'Significantly improves permission opt-in rates by providing context before OS dialog.',
    permissions: { manifest: [], scope: 'none', requiresGesture: false },
    params: [
      { name: 'scope', type: 'string', required: true, description: 'Permission scope identifier.' },
      { name: 'rationale', type: 'string', required: false, description: 'Custom explanation text shown in priming dialog.' },
    ],
    returns: {
      type: 'PermissionResult',
      schema: { scope: 'string', granted: 'boolean', isDeclaredInManifest: 'boolean' },
      description: 'Outcome of permission request.',
    },
    errors: [
      { code: 'INVALID_ARGUMENT', meaning: 'scope missing.', troubleshooting: 'Specify valid scope.' },
      { code: 'USER_CANCEL', meaning: 'User dismissed the priming dialog.', troubleshooting: 'Do not prompt again immediately.' },
    ],
    platforms: { android: true, ios: true, reactNative: true, flutter: true, web: true },
    snippets: {
      typescript: `const { granted } = await goatBridge.callNative('REQUEST_PERMISSION', {
  scope: 'scope.camera',
  rationale: 'Camera access is required to scan QR tickets.'
});`,
      kotlin: `// Show PrimingDialog then requestPermissions(arrayOf(Manifest.permission.CAMERA), REQ_CODE)`,
      swift: `// Show custom priming sheet then AVCaptureDevice.requestAccess(for: .video)`,
      dart: `final res = await goatController.callNativeAction('REQUEST_PERMISSION', {
  'scope': 'scope.camera',
  'rationale': 'Scan QR codes',
});`,
    },
    executable: true,
    defaultPayload: { scope: 'scope.camera', rationale: 'Camera access is needed to scan QR codes.' },
  },
  {
    id: 'get-setting',
    action: 'GET_SETTING',
    aliases: ['getSetting', 'getAppAuthorizeSetting'],
    domain: 'Biometrics & Permissions',
    domainSlug: 'biometrics-security',
    description: 'Queries the complete dictionary of user authorization settings and granted permissions for this mini-app.',
    purpose: 'Renders the mini-app permission settings summary page.',
    permissions: { manifest: [], scope: 'none', requiresGesture: false },
    params: [],
    returns: {
      type: 'AuthSettingResult',
      schema: { authSetting: 'Record<string, boolean>' },
      description: 'Map of permission scopes and their granted boolean states.',
    },
    errors: [],
    platforms: { android: true, ios: true, reactNative: true, flutter: true, web: true },
    snippets: {
      typescript: `const { authSetting } = await goatBridge.callNative('GET_SETTING', {});
console.log('Location granted:', authSetting['scope.userLocation']);`,
      kotlin: `// Query AppPermissionStore`,
      swift: `// Return authorization status map`,
      dart: `final res = await goatController.callNativeAction('GET_SETTING', {});`,
    },
    executable: true,
    defaultPayload: {},
  },
  {
    id: 'open-setting',
    action: 'OPEN_SETTING',
    aliases: ['openSetting', 'openAppPermissionSettings'],
    domain: 'Biometrics & Permissions',
    domainSlug: 'biometrics-security',
    description: 'Deep-links the user directly into the native OS application permissions settings page.',
    purpose: 'Allows users to re-enable permissions previously rejected with "Don\'t ask again".',
    permissions: { manifest: [], scope: 'none', requiresGesture: false },
    params: [],
    returns: {
      type: 'OpenSettingResult',
      schema: { opened: 'boolean', authSetting: 'Record<string, boolean>' },
      description: 'Status of settings launch and updated permissions dictionary.',
    },
    errors: [],
    platforms: { android: true, ios: true, reactNative: true, flutter: true, web: true },
    snippets: {
      typescript: `await goatBridge.callNative('OPEN_SETTING', {});`,
      kotlin: `val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.fromParts("package", context.packageName, null))
context.startActivity(intent)`,
      swift: `if let url = URL(string: UIApplication.openSettingsURLString) { UIApplication.shared.open(url) }`,
      dart: `await goatController.callNativeAction('OPEN_SETTING', {});`,
    },
    executable: true,
    defaultPayload: {},
  },
  {
    id: 'authorize',
    action: 'AUTHORIZE',
    aliases: ['authorize'],
    domain: 'Biometrics & Permissions',
    domainSlug: 'biometrics-security',
    description: 'Explicitly requests pre-authorization for a scope without immediately invoking the hardware feature.',
    purpose: 'Pre-authorizes location or camera in onboarding steps.',
    permissions: { manifest: [], scope: 'none', requiresGesture: false },
    params: [
      { name: 'scope', type: 'string', required: true, description: 'Scope to authorize.' },
      { name: 'granted', type: 'boolean', required: false, description: 'Explicit grant override (for mock testing).' },
    ],
    returns: {
      type: 'PermissionResult',
      schema: { scope: 'string', granted: 'boolean', isDeclaredInManifest: 'boolean' },
      description: 'Result of authorization request.',
    },
    errors: [
      { code: 'INVALID_ARGUMENT', meaning: 'scope missing.', troubleshooting: 'Provide valid scope string.' },
    ],
    platforms: { android: true, ios: true, reactNative: true, flutter: true, web: true },
    snippets: {
      typescript: `await goatBridge.callNative('AUTHORIZE', { scope: 'scope.camera' });`,
      kotlin: `// Request permission`,
      swift: `// Request permission`,
      dart: `await goatController.callNativeAction('AUTHORIZE', {'scope': 'scope.camera'});`,
    },
    executable: true,
    defaultPayload: { scope: 'scope.userLocation' },
  },
  {
    id: 'audit-sandbox-headers',
    action: 'AUDIT_SANDBOX_HEADERS',
    aliases: ['auditSandboxHeaders'],
    domain: 'Biometrics & Permissions',
    domainSlug: 'biometrics-security',
    description: 'Audits COOP (Cross-Origin-Opener-Policy) and COEP (Cross-Origin-Embedder-Policy) security headers for hermetic process isolation.',
    purpose: 'Verifies the mini-app runtime meets OWASP MASVS requirements for cross-origin isolation and SharedArrayBuffer availability.',
    permissions: { manifest: [], scope: 'none', requiresGesture: false },
    params: [],
    returns: {
      type: 'SandboxHeadersAuditResult',
      schema: { coopHeaderPresent: 'boolean', coepHeaderPresent: 'boolean', isIsolatedContext: 'boolean', status: 'string' },
      description: 'Security header compliance report.',
    },
    errors: [],
    platforms: { android: true, ios: true, reactNative: true, flutter: true, web: true },
    snippets: {
      typescript: `const audit = await goatBridge.callNative('AUDIT_SANDBOX_HEADERS', {});
console.log('COOP present:', audit.coopHeaderPresent, 'Isolated:', audit.isIsolatedContext);`,
      kotlin: `// Audit WebViewAssetLoader header injection`,
      swift: `// WKURLSchemeHandler header verification`,
      dart: `final res = await goatController.callNativeAction('AUDIT_SANDBOX_HEADERS', {});`,
    },
    executable: true,
    defaultPayload: {},
  },
];
