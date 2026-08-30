import { ApiAction } from '../api-matrix';

export const binaryActions: ApiAction[] = [
  {
    id: 'create-binary-port',
    action: 'CREATE_BINARY_PORT',
    aliases: ['createBinaryPort'],
    domain: 'Binary IPC Channels',
    domainSlug: 'binary-ipc',
    description: 'Initializes a high-throughput, zero-copy ArrayBuffer binary message port channel between WebView and native host.',
    purpose: 'Enables streaming large binary payloads (WASM memory heap, camera image frame buffers, audio PCM buffers) without JSON stringification overhead.',
    permissions: { manifest: [], scope: 'none', requiresGesture: false },
    params: [
      { name: 'portId', type: 'string', required: false, description: 'Optional custom port identifier.' },
    ],
    returns: {
      type: 'BinaryPortCreateResult',
      schema: { portId: 'string', created: 'boolean' },
      description: 'Allocated binary port handle.',
    },
    errors: [],
    platforms: { android: true, ios: true, reactNative: true, flutter: true, web: true },
    snippets: {
      typescript: `const { portId } = await goatBridge.callNative('CREATE_BINARY_PORT', {});
console.log('Opened binary port:', portId);`,
      kotlin: `// Create WebMessagePortCompat channel`,
      swift: `// WKScriptMessageHandler sendWithReply ArrayBuffer channel`,
      dart: `final res = await goatController.callNativeAction('CREATE_BINARY_PORT', {});`,
    },
    executable: true,
    defaultPayload: {},
  },
  {
    id: 'post-binary-message',
    action: 'POST_BINARY_MESSAGE',
    aliases: ['postBinaryMessage'],
    domain: 'Binary IPC Channels',
    domainSlug: 'binary-ipc',
    description: 'Transmits a binary ArrayBuffer frame through the active binary port.',
    purpose: 'High-speed transfer of raw byte arrays.',
    permissions: { manifest: [], scope: 'none', requiresGesture: false },
    params: [
      { name: 'portId', type: 'string', required: true, description: 'Active port identifier.' },
      { name: 'dataBase64', type: 'string', required: true, description: 'Base64 encoded binary buffer.' },
    ],
    returns: {
      type: 'BinaryPortPacketResult',
      schema: { posted: 'boolean', portId: 'string', byteSize: 'number', sequenceNumber: 'number' },
      description: 'Transfer acknowledgment with byte length and sequence counter.',
    },
    errors: [
      { code: 'PORT_NOT_FOUND', meaning: 'The specified portId does not exist or has been closed.', troubleshooting: 'Ensure port is opened with CREATE_BINARY_PORT before sending.' },
    ],
    platforms: { android: true, ios: true, reactNative: true, flutter: true, web: true },
    snippets: {
      typescript: `await goatBridge.callNative('POST_BINARY_MESSAGE', {
  portId: 'port_01',
  dataBase64: btoa('Raw PCM audio bytes...')
});`,
      kotlin: `webMessagePort.postMessage(WebMessageCompat(payloadBytes))`,
      swift: `// Transfer raw Data over IPC port`,
      dart: `await goatController.callNativeAction('POST_BINARY_MESSAGE', {
  'portId': 'port_01',
  'dataBase64': '...',
});`,
    },
    executable: true,
    defaultPayload: { portId: 'port_01', dataBase64: 'AAAA////' },
  },
  {
    id: 'read-binary-message',
    action: 'READ_BINARY_MESSAGE',
    aliases: ['readBinaryMessage', 'onBinaryMessage'],
    domain: 'Binary IPC Channels',
    domainSlug: 'binary-ipc',
    description: 'Reads or dequeues the next available binary message packet from the designated port buffer.',
    purpose: 'Receives native-generated camera frames or sensor buffers.',
    permissions: { manifest: [], scope: 'none', requiresGesture: false },
    params: [
      { name: 'portId', type: 'string', required: true, description: 'Port identifier to read from.' },
    ],
    returns: {
      type: 'BinaryPortReadResult',
      schema: { portId: 'string', dataBase64: 'string | null', byteSize: 'number' },
      description: 'Dequeued binary packet in Base64 or null if queue is empty.',
    },
    errors: [
      { code: 'PORT_NOT_FOUND', meaning: 'Invalid portId.', troubleshooting: 'Check portId.' },
    ],
    platforms: { android: true, ios: true, reactNative: true, flutter: true, web: true },
    snippets: {
      typescript: `const packet = await goatBridge.callNative('READ_BINARY_MESSAGE', { portId: 'port_01' });`,
      kotlin: `// Dequeue from port buffer`,
      swift: `// Read next packet from buffer`,
      dart: `final packet = await goatController.callNativeAction('READ_BINARY_MESSAGE', {'portId': 'port_01'});`,
    },
    executable: true,
    defaultPayload: { portId: 'port_01' },
  },
  {
    id: 'close-binary-port',
    action: 'CLOSE_BINARY_PORT',
    aliases: ['closeBinaryPort'],
    domain: 'Binary IPC Channels',
    domainSlug: 'binary-ipc',
    description: 'Closes and disposes the binary IPC port, freeing native ring buffers.',
    purpose: 'Cleans up binary streaming channels.',
    permissions: { manifest: [], scope: 'none', requiresGesture: false },
    params: [
      { name: 'portId', type: 'string', required: true, description: 'Port identifier to close.' },
    ],
    returns: {
      type: 'BinaryPortCloseResult',
      schema: { closed: 'boolean', portId: 'string' },
      description: 'Confirmation that port resources were freed.',
    },
    errors: [],
    platforms: { android: true, ios: true, reactNative: true, flutter: true, web: true },
    snippets: {
      typescript: `await goatBridge.callNative('CLOSE_BINARY_PORT', { portId: 'port_01' });`,
      kotlin: `webMessagePort.close()`,
      swift: `// Invalidate port channel`,
      dart: `await goatController.callNativeAction('CLOSE_BINARY_PORT', {'portId': 'port_01'});`,
    },
    executable: true,
    defaultPayload: { portId: 'port_01' },
  },
];
