import { ApiAction } from '../api-matrix';

export const pushActions: ApiAction[] = [
  {
    id: 'push-get-token',
    action: 'PUSH_GET_TOKEN',
    aliases: ['push.getToken', 'getNotificationToken'],
    domain: 'Push Notifications',
    domainSlug: 'push-notifications',
    description: 'Retrieves native APNs / Firebase Cloud Messaging (FCM) device push registration token.',
    purpose: 'Registers device token with mini-app backend for targeted push alerts and order updates.',
    permissions: { manifest: [], scope: 'none', requiresGesture: false },
    params: [
      { name: 'appId', type: 'string', required: false, description: 'Calling mini-app identifier.' },
    ],
    returns: {
      type: 'PushTokenResult',
      schema: { token: 'string', appId: 'string' },
      description: 'APNs hex device token or FCM registration token string.',
    },
    errors: [],
    platforms: { android: true, ios: true, reactNative: true, flutter: true, web: true },
    snippets: {
      typescript: `const { token } = await goatBridge.callNative('PUSH_GET_TOKEN', {});
console.log('FCM / APNs Token:', token);`,
      kotlin: `FirebaseMessaging.getInstance().token.addOnSuccessListener { token -> reply(token) }`,
      swift: `// Convert deviceToken NSData to hex string`,
      dart: `final res = await goatController.callNativeAction('PUSH_GET_TOKEN', {});`,
    },
    executable: true,
    defaultPayload: {},
  },
  {
    id: 'get-push-token',
    action: 'GET_PUSH_TOKEN',
    aliases: ['getPushToken', 'push.getPushToken'],
    domain: 'Push Notifications',
    domainSlug: 'push-notifications',
    description: 'Alias for PUSH_GET_TOKEN.',
    purpose: 'Standard alias for push token retrieval.',
    permissions: { manifest: [], scope: 'none', requiresGesture: false },
    params: [],
    returns: {
      type: 'PushTokenResult',
      schema: { token: 'string', appId: 'string' },
      description: 'Device push registration token.',
    },
    errors: [],
    platforms: { android: true, ios: true, reactNative: true, flutter: true, web: true },
    snippets: {
      typescript: `const { token } = await goatBridge.callNative('GET_PUSH_TOKEN', {});`,
      kotlin: `// Query FCM token`,
      swift: `// Query APNs token`,
      dart: `final res = await goatController.callNativeAction('GET_PUSH_TOKEN', {});`,
    },
    executable: true,
    defaultPayload: {},
  },
  {
    id: 'push-request-permission',
    action: 'PUSH_REQUEST_PERMISSION',
    aliases: ['push.requestPermission', 'requestNotificationPermission'],
    domain: 'Push Notifications',
    domainSlug: 'push-notifications',
    description: 'Requests notification delivery permissions from the host operating system (POST_NOTIFICATIONS on Android 13+, UNUserNotificationCenter on iOS).',
    purpose: 'Prompts user to enable incoming push alert banners.',
    permissions: {
      manifest: ['android.permission.POST_NOTIFICATIONS'],
      scope: 'none',
      requiresGesture: false,
    },
    params: [],
    returns: {
      type: 'PushPermissionResult',
      schema: { granted: 'boolean' },
      description: 'True if user granted notification permissions.',
    },
    errors: [
      { code: 'USER_CANCEL', meaning: 'User tapped Don\'t Allow.', troubleshooting: 'Direct user to OPEN_SETTING if required.' },
    ],
    platforms: { android: true, ios: true, reactNative: true, flutter: true, web: true },
    snippets: {
      typescript: `const { granted } = await goatBridge.callNative('PUSH_REQUEST_PERMISSION', {});
if (granted) {
  // Notifications enabled
}`,
      kotlin: `ActivityCompat.requestPermissions(activity, arrayOf(Manifest.permission.POST_NOTIFICATIONS), REQ_CODE)`,
      swift: `UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .badge, .sound]) { granted, _ in }`,
      dart: `final res = await goatController.callNativeAction('PUSH_REQUEST_PERMISSION', {});`,
    },
    executable: true,
    defaultPayload: {},
  },
  {
    id: 'push-set-badge',
    action: 'PUSH_SET_BADGE',
    aliases: ['push.setBadge', 'setBadge', 'setBadgeCount'],
    domain: 'Push Notifications',
    domainSlug: 'push-notifications',
    description: 'Updates the numerical unread notification badge count on the host app launcher icon.',
    purpose: 'Displays unread message or item count on the home screen icon.',
    permissions: { manifest: [], scope: 'none', requiresGesture: false },
    params: [
      { name: 'count', type: 'number', required: true, description: 'Badge count integer (0 clears badge).' },
    ],
    returns: {
      type: 'PushBadgeResult',
      schema: { updated: 'boolean', count: 'number' },
      description: 'Applied badge count.',
    },
    errors: [
      { code: 'INVALID_ARGUMENT', meaning: 'Count is not a valid non-negative integer.', troubleshooting: 'Pass integer >= 0.' },
    ],
    platforms: { android: true, ios: true, reactNative: true, flutter: true, web: true },
    snippets: {
      typescript: `await goatBridge.callNative('PUSH_SET_BADGE', { count: 5 });`,
      kotlin: `// ShortcutBadger.applyCount(context, count)`,
      swift: `UNUserNotificationCenter.current().setBadgeCount(count) { error in }`,
      dart: `await goatController.callNativeAction('PUSH_SET_BADGE', {'count': 5});`,
    },
    executable: true,
    defaultPayload: { count: 3 },
  },
  {
    id: 'push-show-notification',
    action: 'PUSH_SHOW_NOTIFICATION',
    aliases: ['push.showNotification', 'showNotification', 'showLocalNotification'],
    domain: 'Push Notifications',
    domainSlug: 'push-notifications',
    description: 'Dispatches an immediate in-app local notification banner into the system status bar shade.',
    purpose: 'Alerts user when long-running background tasks (downloads, exports) finish.',
    permissions: { manifest: ['android.permission.POST_NOTIFICATIONS'], scope: 'none', requiresGesture: false },
    params: [
      { name: 'title', type: 'string', required: true, description: 'Notification headline.' },
      { name: 'content', type: 'string', required: true, description: 'Notification body.' },
      { name: 'channelId', type: 'string', required: false, description: 'Notification channel identifier.', defaultValue: '"default"' },
      { name: 'data', type: 'any', required: false, description: 'Custom payload delivered on tap.' },
    ],
    returns: {
      type: 'PushShowResult',
      schema: { shown: 'boolean', title: 'string' },
      description: 'Confirmation that local notification was scheduled.',
    },
    errors: [],
    platforms: { android: true, ios: true, reactNative: true, flutter: true, web: true },
    snippets: {
      typescript: `await goatBridge.callNative('PUSH_SHOW_NOTIFICATION', {
  title: 'Download Complete',
  content: 'Your report report_2026.pdf is ready to view.',
  channelId: 'downloads'
});`,
      kotlin: `val builder = NotificationCompat.Builder(context, channelId)
    .setContentTitle(title)
    .setContentText(content)
    .setSmallIcon(R.drawable.ic_notification)
notificationManager.notify(101, builder.build())`,
      swift: `let content = UNMutableNotificationContent()
content.title = title
content.body = self.content
let request = UNNotificationRequest(identifier: UUID().uuidString, content: content, trigger: nil)
UNUserNotificationCenter.current().add(request)`,
      dart: `await goatController.callNativeAction('PUSH_SHOW_NOTIFICATION', {
  'title': 'Download Complete',
  'content': 'Your report is ready.',
});`,
    },
    executable: true,
    defaultPayload: { title: 'Order Update', content: 'Your driver is 2 minutes away!' },
  },
  {
    id: 'subscribe-push-topic',
    action: 'SUBSCRIBE_PUSH_TOPIC',
    aliases: ['push.subscribeTopic', 'subscribePushTopic', 'subscribeTopic'],
    domain: 'Push Notifications',
    domainSlug: 'push-notifications',
    description: 'Subscribes device to a pub/sub broadcast notification topic (e.g. "flash_sales", "breaking_news").',
    purpose: 'Enables group topic broadcasts without individual token tracking.',
    permissions: { manifest: [], scope: 'none', requiresGesture: false },
    params: [
      { name: 'topic', type: 'string', required: true, description: 'Topic name string.' },
    ],
    returns: {
      type: 'PushTopicResult',
      schema: { subscribed: 'boolean', topic: 'string' },
      description: 'Topic subscription confirmation.',
    },
    errors: [
      { code: 'INVALID_ARGUMENT', meaning: 'Topic string was empty.', troubleshooting: 'Provide non-empty topic.' },
    ],
    platforms: { android: true, ios: true, reactNative: true, flutter: true, web: true },
    snippets: {
      typescript: `await goatBridge.callNative('SUBSCRIBE_PUSH_TOPIC', { topic: 'flash_deals' });`,
      kotlin: `FirebaseMessaging.getInstance().subscribeToTopic(topic)`,
      swift: `// Register topic with APNs topic dispatcher`,
      dart: `await goatController.callNativeAction('SUBSCRIBE_PUSH_TOPIC', {'topic': 'flash_deals'});`,
    },
    executable: true,
    defaultPayload: { topic: 'flash_deals' },
  },
  {
    id: 'unsubscribe-push-topic',
    action: 'UNSUBSCRIBE_PUSH_TOPIC',
    aliases: ['push.unsubscribeTopic', 'unsubscribePushTopic', 'unsubscribeTopic'],
    domain: 'Push Notifications',
    domainSlug: 'push-notifications',
    description: 'Unsubscribes device from a push broadcast topic.',
    purpose: 'Allows users to opt out of specific notification topics.',
    permissions: { manifest: [], scope: 'none', requiresGesture: false },
    params: [
      { name: 'topic', type: 'string', required: true, description: 'Topic name to leave.' },
    ],
    returns: {
      type: 'PushTopicResult',
      schema: { unsubscribed: 'boolean', topic: 'string' },
      description: 'Confirmation of topic cancellation.',
    },
    errors: [
      { code: 'INVALID_ARGUMENT', meaning: 'Topic missing.', troubleshooting: 'Specify topic name.' },
    ],
    platforms: { android: true, ios: true, reactNative: true, flutter: true, web: true },
    snippets: {
      typescript: `await goatBridge.callNative('UNSUBSCRIBE_PUSH_TOPIC', { topic: 'flash_deals' });`,
      kotlin: `FirebaseMessaging.getInstance().unsubscribeFromTopic(topic)`,
      swift: `// Unregister topic from APNs dispatcher`,
      dart: `await goatController.callNativeAction('UNSUBSCRIBE_PUSH_TOPIC', {'topic': 'flash_deals'});`,
    },
    executable: true,
    defaultPayload: { topic: 'flash_deals' },
  },
  {
    id: 'get-pending-notifications',
    action: 'GET_PENDING_NOTIFICATIONS',
    aliases: ['push.getPending', 'getPendingNotifications'],
    domain: 'Push Notifications',
    domainSlug: 'push-notifications',
    description: 'Retrieves array of queued or scheduled notifications waiting in the system tray.',
    purpose: 'Inspects upcoming alarms or pending reminder notifications.',
    permissions: { manifest: [], scope: 'none', requiresGesture: false },
    params: [],
    returns: {
      type: 'PendingNotificationsResult',
      schema: { count: 'number', notifications: 'any[]' },
      description: 'List of pending notification items.',
    },
    errors: [],
    platforms: { android: true, ios: true, reactNative: true, flutter: true, web: true },
    snippets: {
      typescript: `const { count, notifications } = await goatBridge.callNative('GET_PENDING_NOTIFICATIONS', {});`,
      kotlin: `val active = notificationManager.activeNotifications`,
      swift: `UNUserNotificationCenter.current().getPendingNotificationRequests { requests in }`,
      dart: `final res = await goatController.callNativeAction('GET_PENDING_NOTIFICATIONS', {});`,
    },
    executable: true,
    defaultPayload: {},
  },
  {
    id: 'clear-notifications',
    action: 'CLEAR_NOTIFICATIONS',
    aliases: ['push.clear', 'clearNotifications'],
    domain: 'Push Notifications',
    domainSlug: 'push-notifications',
    description: 'Clears all delivered and pending notifications posted by this mini-app.',
    purpose: 'Cleans up status bar tray when user opens the app.',
    permissions: { manifest: [], scope: 'none', requiresGesture: false },
    params: [],
    returns: {
      type: 'ClearNotificationsResult',
      schema: { cleared: 'boolean' },
      description: 'Confirmation that notifications were dismissed.',
    },
    errors: [],
    platforms: { android: true, ios: true, reactNative: true, flutter: true, web: true },
    snippets: {
      typescript: `await goatBridge.callNative('CLEAR_NOTIFICATIONS', {});`,
      kotlin: `notificationManager.cancelAll()`,
      swift: `UNUserNotificationCenter.current().removeAllDeliveredNotifications()`,
      dart: `await goatController.callNativeAction('CLEAR_NOTIFICATIONS', {});`,
    },
    executable: true,
    defaultPayload: {},
  },
];
