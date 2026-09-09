import { ApiAction } from '../api-matrix';

const providerParam = {
  name: 'provider',
  type: 'string',
  required: false,
  description: '"GOOGLE_WALLET" | "APPLE_WALLET" | "GENERIC". Defaults to GENERIC for lookups.',
};

export const walletPassActions: ApiAction[] = [
  {
    id: 'wallet-save-pass',
    action: 'WALLET_SAVE_PASS',
    aliases: ['walletSavePass', 'savePass'],
    domain: 'Digital Wallet',
    domainSlug: 'digital-wallet',
    description: 'Saves a pass to Google Wallet, Apple Wallet, or goat\'s own encrypted pass store.',
    purpose: 'Adds loyalty cards, boarding passes, event tickets and gift cards to the device wallet.',
    permissions: { manifest: [], scope: 'none', requiresGesture: true },
    params: [
      { ...providerParam, required: true },
      { name: 'payload', type: 'string', required: true, description: 'A Google Wallet "save to wallet" JWT, a Base64 .pkpass bundle, or the raw pass body for GENERIC.' },
      { name: 'metadata', type: 'object', required: false, description: 'passTypeIdentifier, serialNumber, description, organizationName and an optional barcode { format, message }. Required for GENERIC.' },
    ],
    returns: {
      type: 'PassSaveResult',
      schema: {
        state: '"ADDED" | "NOT_ADDED" | "UNKNOWN" | "UNSUPPORTED"',
        passId: 'string — "{passTypeIdentifier}:{serialNumber}"',
        provider: 'string',
        alreadyAdded: 'boolean — true when the wallet already held this pass',
      },
      description: 'Where the pass ended up. `alreadyAdded` is a success, not an error.',
    },
    errors: [
      { code: 'PASS_INVALID', meaning: 'The JWT or .pkpass payload is structurally malformed.', troubleshooting: 'goat validates shape only — it holds no issuer key and cannot verify the signature. The platform performs real verification.' },
      { code: 'PASS_PROVIDER_UNAVAILABLE', meaning: 'No wallet on this device, or the host has not wired the platform SDK.', troubleshooting: 'Register a GoogleWalletLauncher / ApplePassLibrary on the host.' },
      { code: 'USER_CANCELLED', meaning: 'The user dismissed the save sheet.', troubleshooting: 'Not a failure; offer the pass again later.' },
      { code: 'INVALID_PARAMETERS', meaning: 'Missing provider, payload, or (for GENERIC) metadata identifiers.', troubleshooting: 'A generic pass needs passTypeIdentifier and serialNumber.' },
    ],
    platforms: { android: true, ios: true, reactNative: true, flutter: true, web: true },
    snippets: {
      typescript: `const res = await goatBridge.callNative('WALLET_SAVE_PASS', {
  provider: 'GOOGLE_WALLET',
  payload: signedSaveToWalletJwt,
  metadata: { passTypeIdentifier: 'pass.com.example.loyalty', serialNumber: 'SN-1' }
});
if (res.alreadyAdded) console.log('User already had this pass');`,
      kotlin: `// Routed to the registered GoatPassAdapter.savePass()`,
      swift: `// Routed to the registered GoatPassAdapter.savePass(payload:metadata:)`,
      dart: `final res = await goatController.callNativeAction('WALLET_SAVE_PASS', {...});`,
    },
    executable: false,
    defaultPayload: { provider: 'GENERIC', payload: 'demo-pass-body', metadata: { passTypeIdentifier: 'pass.com.example.demo', serialNumber: 'SN-1' } },
  },
  {
    id: 'wallet-get-pass-state',
    action: 'WALLET_GET_PASS_STATE',
    aliases: ['walletGetPassState', 'hasPass'],
    domain: 'Digital Wallet',
    domainSlug: 'digital-wallet',
    description: 'Reports whether a pass is currently held by the wallet.',
    purpose: 'Lets a mini-app show "Add to Wallet" or "View in Wallet" without guessing.',
    permissions: { manifest: [], scope: 'none', requiresGesture: false },
    params: [
      { name: 'passId', type: 'string', required: true, description: '"{passTypeIdentifier}:{serialNumber}".' },
      providerParam,
    ],
    returns: {
      type: 'PassStateResult',
      schema: { passId: 'string', provider: 'string', state: '"ADDED" | "NOT_ADDED" | "UNKNOWN" | "UNSUPPORTED"' },
      description: 'UNKNOWN means the provider cannot answer — never treat it as NOT_ADDED.',
    },
    errors: [
      { code: 'INVALID_PARAMETERS', meaning: 'Missing passId.', troubleshooting: 'Pass the full "{type}:{serial}" id.' },
    ],
    platforms: { android: true, ios: true, reactNative: true, flutter: true, web: true },
    snippets: {
      typescript: `const { state } = await goatBridge.callNative('WALLET_GET_PASS_STATE', {
  provider: 'APPLE_WALLET', passId: 'pass.com.example.loyalty:SN-1'
});
// Google Wallet cannot be queried, so it answers UNKNOWN rather than NOT_ADDED —
// issuing a duplicate pass on UNKNOWN is the mistake this prevents.`,
      kotlin: `// GoatPassAdapter.getPassState()`,
      swift: `// PKPassLibrary.pass(withPassTypeIdentifier:serialNumber:)`,
      dart: `final res = await goatController.callNativeAction('WALLET_GET_PASS_STATE', {'passId': id});`,
    },
    executable: true,
    defaultPayload: { provider: 'GENERIC', passId: 'pass.com.example.demo:SN-1' },
  },
  {
    id: 'wallet-open-pass',
    action: 'WALLET_OPEN_PASS',
    aliases: ['walletOpenPass', 'openPass'],
    domain: 'Digital Wallet',
    domainSlug: 'digital-wallet',
    description: 'Opens a saved pass in the platform wallet app.',
    purpose: 'Takes the user straight to their boarding pass or loyalty card.',
    permissions: { manifest: [], scope: 'none', requiresGesture: true },
    params: [
      { name: 'passId', type: 'string', required: true, description: '"{passTypeIdentifier}:{serialNumber}".' },
      providerParam,
    ],
    returns: {
      type: 'PassOpenResult',
      schema: { passId: 'string', opened: 'boolean' },
      description: 'False when the pass could not be shown; GENERIC passes are rendered in-app, not by a wallet.',
    },
    errors: [
      { code: 'INVALID_PARAMETERS', meaning: 'Missing passId.', troubleshooting: 'Pass the full pass id.' },
    ],
    platforms: { android: true, ios: true, reactNative: true, flutter: true, web: true },
    snippets: {
      typescript: `await goatBridge.callNative('WALLET_OPEN_PASS', { provider: 'APPLE_WALLET', passId });`,
      kotlin: `// GoatPassAdapter.openPass()`,
      swift: `// UIApplication.open(pass.passURL)`,
      dart: `await goatController.callNativeAction('WALLET_OPEN_PASS', {'passId': id});`,
    },
    executable: false,
    defaultPayload: { provider: 'APPLE_WALLET', passId: 'pass.com.example.demo:SN-1' },
  },
  {
    id: 'wallet-list-passes',
    action: 'WALLET_LIST_PASSES',
    aliases: ['walletListPasses', 'listPasses'],
    domain: 'Digital Wallet',
    domainSlug: 'digital-wallet',
    description: "Lists the pass ids this mini-app has stored in goat's own encrypted pass store.",
    purpose: 'Renders a wallet screen inside the mini-app.',
    permissions: { manifest: [], scope: 'none', requiresGesture: false },
    params: [],
    returns: {
      type: 'PassListResult',
      schema: { count: 'number', passIds: 'string[]' },
      description: "Only this mini-app's own passes. Platform wallet contents are never enumerable.",
    },
    errors: [],
    platforms: { android: true, ios: true, reactNative: true, flutter: true, web: true },
    snippets: {
      typescript: `const { passIds } = await goatBridge.callNative('WALLET_LIST_PASSES', {});`,
      kotlin: `// GenericPassStore.listPasses(appId)`,
      swift: `// GenericPassStore.listPasses(appId:)`,
      dart: `final res = await goatController.callNativeAction('WALLET_LIST_PASSES', {});`,
    },
    executable: true,
    defaultPayload: {},
  },
  {
    id: 'wallet-delete-pass',
    action: 'WALLET_DELETE_PASS',
    aliases: ['walletDeletePass', 'deletePass'],
    domain: 'Digital Wallet',
    domainSlug: 'digital-wallet',
    description: "Deletes a pass from goat's own encrypted pass store.",
    purpose: 'Lets a user remove a pass the mini-app issued.',
    permissions: { manifest: [], scope: 'none', requiresGesture: true },
    params: [
      { name: 'passId', type: 'string', required: true, description: '"{passTypeIdentifier}:{serialNumber}".' },
    ],
    returns: {
      type: 'PassDeleteResult',
      schema: { passId: 'string', deleted: 'boolean' },
      description: 'False when this mini-app holds no such pass. Passes in Google Wallet or Apple Wallet are never deleted — neither platform offers programmatic removal.',
    },
    errors: [
      { code: 'INVALID_PARAMETERS', meaning: 'Missing passId.', troubleshooting: 'Pass the full pass id.' },
    ],
    platforms: { android: true, ios: true, reactNative: true, flutter: true, web: true },
    snippets: {
      typescript: `const { deleted } = await goatBridge.callNative('WALLET_DELETE_PASS', { passId });`,
      kotlin: `// GenericPassStore.deletePass(appId, passId)`,
      swift: `// GenericPassStore.deletePass(appId:passId:)`,
      dart: `await goatController.callNativeAction('WALLET_DELETE_PASS', {'passId': id});`,
    },
    executable: false,
    defaultPayload: { passId: 'pass.com.example.demo:SN-1' },
  },
];
