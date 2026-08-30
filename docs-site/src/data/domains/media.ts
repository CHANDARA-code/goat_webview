import { ApiAction } from '../api-matrix';

export const mediaActions: ApiAction[] = [
  {
    id: 'scan-code',
    action: 'SCAN_CODE',
    aliases: ['scanCode'],
    domain: 'Media & Audio',
    domainSlug: 'media-audio',
    description: 'Launches full-screen native camera barcode/QR scanner viewfinder with automatic lighting toggle and multi-format decoding (QR, EAN-13, DataMatrix).',
    purpose: 'Enables instant QR payment scanning, asset tracking, and package barcode check-in.',
    permissions: {
      manifest: ['android.permission.CAMERA', 'NSCameraUsageDescription'],
      scope: 'scope.camera',
      requiresGesture: true,
    },
    params: [
      { name: 'onlyFromCamera', type: 'boolean', required: false, description: 'Disallow choosing barcode image from album.', defaultValue: 'false' },
      { name: 'scanType', type: '("QR_CODE" | "BARCODE" | "DATA_MATRIX")[]', required: false, description: 'Target symbology formats.' },
    ],
    returns: {
      type: 'ScanCodeResult',
      schema: { result: 'string', scanType: 'string', charSet: 'string (optional)' },
      description: 'Decoded payload string and detected barcode symbology.',
    },
    errors: [
      { code: 'PERMISSION_DENIED', meaning: 'Camera permission denied.', troubleshooting: 'Request scope.camera.' },
      { code: 'GESTURE_REQUIRED', meaning: 'Scanner invoked without recent user tap.', troubleshooting: 'Invoke from tap event.' },
      { code: 'USER_CANCEL', meaning: 'User dismissed the camera scanner.', troubleshooting: 'Handle scanner cancellation.' },
    ],
    platforms: { android: true, ios: true, reactNative: true, flutter: true, web: true },
    snippets: {
      typescript: `const { result, scanType } = await goatBridge.callNative('SCAN_CODE', {
  scanType: ['QR_CODE', 'BARCODE']
});
console.log(\`Scanned \${scanType}: \${result}\`);`,
      kotlin: `// MLKit Vision BarcodeScanner in CameraX preview`,
      swift: `// AVCaptureMetadataOutput scanning session`,
      dart: `final res = await goatController.callNativeAction('SCAN_CODE', {
  'scanType': ['QR_CODE'],
});`,
    },
    executable: true,
    defaultPayload: { scanType: ['QR_CODE', 'BARCODE'] },
  },
  {
    id: 'choose-media',
    action: 'CHOOSE_MEDIA',
    aliases: ['chooseMedia', 'chooseImage', 'chooseVideo'],
    domain: 'Media & Audio',
    domainSlug: 'media-audio',
    description: 'Presents native media picker for selecting photos or recording videos from camera or photo library.',
    purpose: 'Allows uploading profile avatars, KYC identity documents, and video clips.',
    permissions: {
      manifest: ['android.permission.CAMERA', 'android.permission.READ_MEDIA_IMAGES', 'NSPhotoLibraryUsageDescription'],
      scope: 'scope.camera',
      requiresGesture: false,
    },
    params: [
      { name: 'count', type: 'number', required: false, description: 'Maximum items to select (1 to 9).', defaultValue: '9' },
      { name: 'mediaType', type: '("image" | "video" | "mix")[]', required: false, description: 'Allowed media types.', defaultValue: '["image", "video"]' },
      { name: 'sourceType', type: '("album" | "camera")[]', required: false, description: 'Source options.', defaultValue: '["album", "camera"]' },
      { name: 'maxDuration', type: 'number', required: false, description: 'Max video length in seconds.', defaultValue: '60' },
    ],
    returns: {
      type: 'ChooseMediaResult',
      schema: { tempFiles: 'MediaFile[]', type: 'string' },
      description: 'Array of sandboxed media file descriptors (tempFilePath, size, duration, width, height).',
    },
    errors: [
      { code: 'PERMISSION_DENIED', meaning: 'Camera or Photo Library permission denied.', troubleshooting: 'Request scope.camera.' },
      { code: 'USER_CANCEL', meaning: 'User cancelled media picker.', troubleshooting: 'Handle picker dismissal.' },
    ],
    platforms: { android: true, ios: true, reactNative: true, flutter: true, web: true },
    snippets: {
      typescript: `const { tempFiles } = await goatBridge.callNative('CHOOSE_MEDIA', {
  count: 3,
  mediaType: ['image'],
  sourceType: ['album', 'camera']
});`,
      kotlin: `// ActivityResultContracts.PickMultipleVisualMedia`,
      swift: `// PHPickerViewController`,
      dart: `final res = await goatController.callNativeAction('CHOOSE_MEDIA', {'count': 3});`,
    },
    executable: true,
    defaultPayload: { count: 3, mediaType: ['image'] },
  },
  {
    id: 'preview-image',
    action: 'PREVIEW_IMAGE',
    aliases: ['previewImage'],
    domain: 'Media & Audio',
    domainSlug: 'media-audio',
    description: 'Launches full-screen multi-image gallery viewer with pinch-to-zoom and swipe gestures.',
    purpose: 'Displays high-resolution product photos or gallery collections.',
    permissions: { manifest: [], scope: 'none', requiresGesture: false },
    params: [
      { name: 'urls', type: 'string[]', required: true, description: 'Array of image HTTP URLs.' },
      { name: 'current', type: 'string | number', required: false, description: 'Starting image URL or 0-based index.', defaultValue: '0' },
    ],
    returns: {
      type: 'PreviewImageResult',
      schema: { previewed: 'boolean', count: 'number' },
      description: 'Confirmation that full-screen gallery was presented.',
    },
    errors: [
      { code: 'INVALID_ARGUMENT', meaning: 'urls array was empty.', troubleshooting: 'Provide array of image URLs.' },
    ],
    platforms: { android: true, ios: true, reactNative: true, flutter: true, web: true },
    snippets: {
      typescript: `await goatBridge.callNative('PREVIEW_IMAGE', {
  urls: [
    'https://images.example.com/item1.jpg',
    'https://images.example.com/item2.jpg'
  ],
  current: 0
});`,
      kotlin: `// Launch ImageViewerActivity with ViewPager2`,
      swift: `// Present UIViewController with UIPageViewController`,
      dart: `await goatController.callNativeAction('PREVIEW_IMAGE', {
  'urls': ['https://images.example.com/item1.jpg'],
});`,
    },
    executable: true,
    defaultPayload: { urls: ['https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=800'], current: 0 },
  },
  {
    id: 'audio-play',
    action: 'AUDIO_PLAY',
    aliases: ['audioPlay'],
    domain: 'Media & Audio',
    domainSlug: 'media-audio',
    description: 'Initiates background audio playback with lock screen media metadata (title, artist, album art).',
    purpose: 'Enables podcast, music, and voice narration playback.',
    permissions: { manifest: ['android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK'], scope: 'none', requiresGesture: false },
    params: [
      { name: 'src', type: 'string', required: true, description: 'Audio stream URL or sandbox file path.' },
      { name: 'title', type: 'string', required: false, description: 'Track title.' },
      { name: 'epname', type: 'string', required: false, description: 'Album/Episode name.' },
      { name: 'singer', type: 'string', required: false, description: 'Artist name.' },
      { name: 'coverImgUrl', type: 'string', required: false, description: 'Album art URL.' },
      { name: 'startTime', type: 'number', required: false, description: 'Starting position in seconds.', defaultValue: '0' },
    ],
    returns: {
      type: 'AudioStateResult',
      schema: { status: '"playing"', src: 'string', currentTime: 'number', duration: 'number' },
      description: 'Audio playback status and duration metrics.',
    },
    errors: [
      { code: 'INVALID_ARGUMENT', meaning: 'Missing audio src.', troubleshooting: 'Provide valid audio URL.' },
    ],
    platforms: { android: true, ios: true, reactNative: true, flutter: true, web: true },
    snippets: {
      typescript: `await goatBridge.callNative('AUDIO_PLAY', {
  src: 'https://audio.example.com/podcast-ep42.mp3',
  title: 'Goat WebView Deep Dive',
  singer: 'Engineering Team'
});`,
      kotlin: `// ExoPlayer / Media3 MediaSession setup`,
      swift: `// AVPlayer with MPNowPlayingInfoCenter setup`,
      dart: `await goatController.callNativeAction('AUDIO_PLAY', {
  'src': 'https://audio.example.com/sample.mp3',
  'title': 'Sample Audio',
});`,
    },
    executable: true,
    defaultPayload: { src: 'https://actions.google.com/sounds/v1/alarms/beep_short.ogg', title: 'Beep' },
  },
  {
    id: 'audio-pause',
    action: 'AUDIO_PAUSE',
    aliases: ['audioPause'],
    domain: 'Media & Audio',
    domainSlug: 'media-audio',
    description: 'Pauses active background audio playback.',
    purpose: 'Temporarily halts audio playback.',
    permissions: { manifest: [], scope: 'none', requiresGesture: false },
    params: [],
    returns: {
      type: 'AudioStateResult',
      schema: { status: '"paused"', currentTime: 'number', duration: 'number' },
      description: 'Current playback timestamp.',
    },
    errors: [],
    platforms: { android: true, ios: true, reactNative: true, flutter: true, web: true },
    snippets: {
      typescript: `await goatBridge.callNative('AUDIO_PAUSE', {});`,
      kotlin: `player.pause()`,
      swift: `player.pause()`,
      dart: `await goatController.callNativeAction('AUDIO_PAUSE', {});`,
    },
    executable: true,
    defaultPayload: {},
  },
  {
    id: 'audio-stop',
    action: 'AUDIO_STOP',
    aliases: ['audioStop'],
    domain: 'Media & Audio',
    domainSlug: 'media-audio',
    description: 'Stops audio playback and releases audio focus.',
    purpose: 'Stops audio playback completely.',
    permissions: { manifest: [], scope: 'none', requiresGesture: false },
    params: [],
    returns: {
      type: 'AudioStateResult',
      schema: { status: '"stopped"', currentTime: '0', duration: 'number' },
      description: 'Confirmation that audio stopped.',
    },
    errors: [],
    platforms: { android: true, ios: true, reactNative: true, flutter: true, web: true },
    snippets: {
      typescript: `await goatBridge.callNative('AUDIO_STOP', {});`,
      kotlin: `player.stop()`,
      swift: `player.replaceCurrentItem(with: nil)`,
      dart: `await goatController.callNativeAction('AUDIO_STOP', {});`,
    },
    executable: true,
    defaultPayload: {},
  },
  {
    id: 'audio-seek',
    action: 'AUDIO_SEEK',
    aliases: ['audioSeek'],
    domain: 'Media & Audio',
    domainSlug: 'media-audio',
    description: 'Seeks playback position to the specified timestamp in seconds.',
    purpose: 'Enables scrubber bar positioning.',
    permissions: { manifest: [], scope: 'none', requiresGesture: false },
    params: [
      { name: 'position', type: 'number', required: true, description: 'Target position in seconds.' },
    ],
    returns: {
      type: 'AudioStateResult',
      schema: { status: '"seeked"', currentTime: 'number', duration: 'number' },
      description: 'Updated playback position.',
    },
    errors: [
      { code: 'INVALID_ARGUMENT', meaning: 'position is missing or negative.', troubleshooting: 'Pass positive seconds.' },
    ],
    platforms: { android: true, ios: true, reactNative: true, flutter: true, web: true },
    snippets: {
      typescript: `await goatBridge.callNative('AUDIO_SEEK', { position: 120 });`,
      kotlin: `player.seekTo((position * 1000).toLong())`,
      swift: `player.seek(to: CMTime(seconds: position, preferredTimescale: 1000))`,
      dart: `await goatController.callNativeAction('AUDIO_SEEK', {'position': 120});`,
    },
    executable: true,
    defaultPayload: { position: 30 },
  },
];
