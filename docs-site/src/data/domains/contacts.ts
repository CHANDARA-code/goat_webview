import { ApiAction } from '../api-matrix';

export const contactsActions: ApiAction[] = [
  {
    id: 'choose-contact',
    action: 'CHOOSE_CONTACT',
    aliases: ['chooseContact', 'pickContacts'],
    domain: 'Contacts & Social Sharing',
    domainSlug: 'contacts-social',
    description: 'Launches native contact picker allowing user to select a single contact without exposing the entire address book.',
    purpose: 'Enables contact selection for money transfers, airtime top-ups, and gift sending while preserving user privacy.',
    permissions: {
      manifest: ['android.permission.READ_CONTACTS (optional)', 'NSContactsUsageDescription'],
      scope: 'scope.address',
      requiresGesture: false,
    },
    params: [],
    returns: {
      type: 'ContactResult',
      schema: { name: 'string', phoneNumber: 'string', email: 'string (optional)' },
      description: 'Selected contact name, normalized phone number, and email.',
    },
    errors: [
      { code: 'PERMISSION_DENIED', meaning: 'Contacts permission denied.', troubleshooting: 'Request scope.address.' },
    ],
    platforms: { android: true, ios: true, reactNative: true, flutter: true, web: true },
    snippets: {
      typescript: `const contact = await goatBridge.callNative('CHOOSE_CONTACT', {});
console.log('Recipient:', contact.name, contact.phoneNumber);`,
      kotlin: `// ActivityResultContracts.PickContact()`,
      swift: `// CNContactPickerViewController`,
      dart: `final res = await goatController.callNativeAction('CHOOSE_CONTACT', {});`,
    },
    executable: true,
    defaultPayload: {},
  },
  {
    id: 'pick-contacts',
    action: 'PICK_CONTACTS',
    aliases: ['pickContacts'],
    domain: 'Contacts & Social Sharing',
    domainSlug: 'contacts-social',
    description: 'Alias for CHOOSE_CONTACT.',
    purpose: 'Standard alias for address book contact selection.',
    permissions: { manifest: [], scope: 'scope.address', requiresGesture: false },
    params: [],
    returns: {
      type: 'ContactResult',
      schema: { name: 'string', phoneNumber: 'string', email: 'string (optional)' },
      description: 'Chosen contact details.',
    },
    errors: [],
    platforms: { android: true, ios: true, reactNative: true, flutter: true, web: true },
    snippets: {
      typescript: `const contact = await goatBridge.callNative('PICK_CONTACTS', {});`,
      kotlin: `// Launch contact picker`,
      swift: `// Present CNContactPickerViewController`,
      dart: `final res = await goatController.callNativeAction('PICK_CONTACTS', {});`,
    },
    executable: true,
    defaultPayload: {},
  },
  {
    id: 'get-contacts-count',
    action: 'GET_CONTACTS_COUNT',
    aliases: ['getContactsCount'],
    domain: 'Contacts & Social Sharing',
    domainSlug: 'contacts-social',
    description: 'Returns the total number of contacts available in the device address book.',
    purpose: 'Checks if address book is populated before suggesting contact import.',
    permissions: { manifest: [], scope: 'scope.address', requiresGesture: false },
    params: [],
    returns: {
      type: 'ContactsCountResult',
      schema: { count: 'number' },
      description: 'Total number of contacts.',
    },
    errors: [
      { code: 'PERMISSION_DENIED', meaning: 'Contacts permission not granted.', troubleshooting: 'Request scope.address.' },
    ],
    platforms: { android: true, ios: true, reactNative: true, flutter: true, web: true },
    snippets: {
      typescript: `const { count } = await goatBridge.callNative('GET_CONTACTS_COUNT', {});`,
      kotlin: `// Query ContactsContract count`,
      swift: `// CNContactStore count`,
      dart: `final res = await goatController.callNativeAction('GET_CONTACTS_COUNT', {});`,
    },
    executable: true,
    defaultPayload: {},
  },
  {
    id: 'share-sheet',
    action: 'SHARE_SHEET',
    aliases: ['shareSheet', 'share', 'shareAppMessage'],
    domain: 'Contacts & Social Sharing',
    domainSlug: 'contacts-social',
    description: 'Displays the native system share sheet (UIActivityViewController on iOS, Intent.ACTION_SEND on Android).',
    purpose: 'Enables sharing referral links, product cards, or photos to WhatsApp, Telegram, iMessage, and Twitter.',
    permissions: { manifest: [], scope: 'none', requiresGesture: false },
    params: [
      { name: 'title', type: 'string', required: false, description: 'Share card title.' },
      { name: 'text', type: 'string', required: false, description: 'Share message body.' },
      { name: 'url', type: 'string', required: false, description: 'Share link URL.' },
      { name: 'mediaPath', type: 'string', required: false, description: 'Local image/file path to share.' },
    ],
    returns: {
      type: 'ShareSheetResult',
      schema: { shared: 'boolean', activityType: 'string (optional)' },
      description: 'Confirmation and target app activity name.',
    },
    errors: [],
    platforms: { android: true, ios: true, reactNative: true, flutter: true, web: true },
    snippets: {
      typescript: `await goatBridge.callNative('SHARE_SHEET', {
  title: 'Check out Goat WebView',
  text: 'High-performance mini-app engine with 120 FPS rendering!',
  url: 'https://goat-webview.github.io'
});`,
      kotlin: `val intent = Intent(Intent.ACTION_SEND).apply {
    type = "text/plain"
    putExtra(Intent.EXTRA_TEXT, text)
}
context.startActivity(Intent.createChooser(intent, title))`,
      swift: `let activityVC = UIActivityViewController(activityItems: [text, URL(string: url)!], applicationActivities: nil)
present(activityVC, animated: true)`,
      dart: `await goatController.callNativeAction('SHARE_SHEET', {
  'title': 'Check out Goat WebView',
  'url': 'https://goat-webview.github.io',
});`,
    },
    executable: true,
    defaultPayload: { title: 'Goat WebView', text: 'Build high performance mini-apps', url: 'https://goat-webview.github.io' },
  },
  {
    id: 'share-to-story',
    action: 'SHARE_TO_STORY',
    aliases: ['shareToStory', 'shareToTimeline'],
    domain: 'Contacts & Social Sharing',
    domainSlug: 'contacts-social',
    description: 'Directly shares media sticker and background assets into Instagram Stories or Snapchat Story.',
    purpose: 'Enables high-conversion viral social story sharing with interactive attribution link.',
    permissions: { manifest: [], scope: 'none', requiresGesture: false },
    params: [
      { name: 'mediaPath', type: 'string', required: true, description: 'Path to background image/video asset.' },
      { name: 'backgroundTopColor', type: 'string', required: false, description: 'Gradient top hex color.', defaultValue: '"#3b82f6"' },
      { name: 'backgroundBottomColor', type: 'string', required: false, description: 'Gradient bottom hex color.', defaultValue: '"#1d4ed8"' },
      { name: 'attributionUrl', type: 'string', required: false, description: 'Deep link back into mini-app.' },
    ],
    returns: {
      type: 'ShareStoryResult',
      schema: { shared: 'boolean' },
      description: 'Status of Story app launch.',
    },
    errors: [
      { code: 'INVALID_ARGUMENT', meaning: 'mediaPath missing.', troubleshooting: 'Provide path to media.' },
    ],
    platforms: { android: true, ios: true, reactNative: true, flutter: true, web: true },
    snippets: {
      typescript: `await goatBridge.callNative('SHARE_TO_STORY', {
  mediaPath: 'photos/badge.png',
  backgroundTopColor: '#6366f1',
  attributionUrl: 'https://miniapp.example.com'
});`,
      kotlin: `// Intent for com.instagram.share.ADD_TO_STORY`,
      swift: `// UIPasteboard item for instagram-stories://share`,
      dart: `await goatController.callNativeAction('SHARE_TO_STORY', {
  'mediaPath': 'photos/badge.png',
});`,
    },
    executable: true,
    defaultPayload: { mediaPath: 'notes/sample.png' },
  },
];
