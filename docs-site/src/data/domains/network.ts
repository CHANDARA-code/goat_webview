import { ApiAction } from '../api-matrix';

export const networkActions: ApiAction[] = [
  {
    id: 'api-request',
    action: 'API_REQUEST',
    aliases: ['apiRequest', 'request'],
    domain: 'Networking, HTTP & WebSockets',
    domainSlug: 'networking-http',
    description: 'Dispatches an out-of-process HTTP/HTTPS request through native network stack with zero-trust anti-SSRF protections.',
    purpose: 'Bypasses browser CORS restrictions while blocking SSRF access to loopback (127.0.0.1), RFC1918 private subnets, and Cloud Metadata IMDS (169.254.169.254).',
    permissions: { manifest: ['android.permission.INTERNET'], scope: 'none', requiresGesture: false },
    params: [
      { name: 'url', type: 'string', required: true, description: 'Target remote HTTPS endpoint.' },
      { name: 'method', type: '"GET" | "POST" | "PUT" | "DELETE"', required: false, description: 'HTTP method.', defaultValue: '"GET"' },
      { name: 'headers', type: 'Record<string, string>', required: false, description: 'HTTP request headers.' },
      { name: 'body', type: 'string', required: false, description: 'Request payload string.' },
      { name: 'timeoutMs', type: 'number', required: false, description: 'Network timeout in milliseconds.', defaultValue: '30000' },
    ],
    returns: {
      type: 'ApiResponseData',
      schema: { status: 'number', statusText: 'string', headers: 'Record<string, string>', data: 'any', durationMs: 'number' },
      description: 'Response payload parsed as JSON or string with timing metrics.',
    },
    errors: [
      { code: 'INVALID_ARGUMENT', meaning: 'Malformed URL provided.', troubleshooting: 'Ensure URL includes protocol (https://).' },
      { code: 'SSRF_BLOCKED', meaning: 'Destination resolved to private IP, localhost, or cloud metadata endpoint.', troubleshooting: 'Requests must target public routable domain names.' },
      { code: 'NETWORK_OFFLINE', meaning: 'Host device is offline.', troubleshooting: 'Check network connectivity using GET_NETWORK_TYPE.' },
      { code: 'TIMEOUT', meaning: 'Server did not respond within timeoutMs.', troubleshooting: 'Increase timeout or verify backend availability.' },
    ],
    platforms: { android: true, ios: true, reactNative: true, flutter: true, web: true },
    snippets: {
      typescript: `const res = await goatBridge.callNative('API_REQUEST', {
  url: 'https://api.example.com/v1/products',
  method: 'GET',
  headers: { 'Accept': 'application/json' },
  timeoutMs: 15000
});
console.log('Status:', res.status, 'Data:', res.data);`,
      kotlin: `// OkHttp client with SSRF Interceptor and SSL Pinning
val request = Request.Builder().url(url).build()
val response = okHttpClient.newCall(request).execute()`,
      swift: `// URLSession dataTask with anti-SSRF IP filtering
let (data, response) = try await urlSession.data(for: request)`,
      dart: `final res = await goatController.callNativeAction('API_REQUEST', {
  'url': 'https://api.example.com/v1/products',
  'method': 'GET',
});`,
    },
    executable: true,
    defaultPayload: { url: 'https://httpbin.org/get', method: 'GET' },
  },
  {
    id: 'download-file',
    action: 'DOWNLOAD_FILE',
    aliases: ['downloadFile'],
    domain: 'Networking, HTTP & WebSockets',
    domainSlug: 'networking-http',
    description: 'Downloads a remote binary file in background and saves it into the sandboxed file system.',
    purpose: 'Fetches PDF invoices, media streams, and bundle assets with progress tracking.',
    permissions: { manifest: ['android.permission.INTERNET'], scope: 'none', requiresGesture: false },
    params: [
      { name: 'url', type: 'string', required: true, description: 'Remote resource URL.' },
      { name: 'filePath', type: 'string', required: false, description: 'Destination relative path in sandbox.' },
      { name: 'fileName', type: 'string', required: false, description: 'Suggested filename.' },
    ],
    returns: {
      type: 'DownloadResult',
      schema: { downloadId: 'number', status: 'string', fileName: 'string' },
      description: 'Download task tracker metadata.',
    },
    errors: [
      { code: 'INVALID_ARGUMENT', meaning: 'Missing URL.', troubleshooting: 'Provide target URL.' },
      { code: 'SSRF_BLOCKED', meaning: 'Blocked internal IP address.', troubleshooting: 'Only public URLs allowed.' },
      { code: 'NETWORK_OFFLINE', meaning: 'Device is offline.', troubleshooting: 'Retry with active connection.' },
    ],
    platforms: { android: true, ios: true, reactNative: true, flutter: true, web: true },
    snippets: {
      typescript: `const result = await goatBridge.callNative('DOWNLOAD_FILE', {
  url: 'https://example.com/assets/sample.pdf',
  filePath: 'downloads/sample.pdf'
});`,
      kotlin: `val downloadManager = context.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager`,
      swift: `let task = urlSession.downloadTask(with: url) { localUrl, ... in }`,
      dart: `final res = await goatController.callNativeAction('DOWNLOAD_FILE', {
  'url': 'https://example.com/assets/sample.pdf',
});`,
    },
    executable: true,
    defaultPayload: { url: 'https://httpbin.org/bytes/1024' },
  },
  {
    id: 'upload-file',
    action: 'UPLOAD_FILE',
    aliases: ['uploadFile'],
    domain: 'Networking, HTTP & WebSockets',
    domainSlug: 'networking-http',
    description: 'Streams a local sandboxed file to a remote server using multipart/form-data POST.',
    purpose: 'Enables photo/video uploads, receipt submissions, and crash report uploads.',
    permissions: { manifest: ['android.permission.INTERNET'], scope: 'none', requiresGesture: false },
    params: [
      { name: 'url', type: 'string', required: true, description: 'Remote upload endpoint.' },
      { name: 'filePath', type: 'string', required: true, description: 'Sandboxed file relative path.' },
      { name: 'name', type: 'string', required: false, description: 'Form field name.', defaultValue: '"file"' },
      { name: 'header', type: 'Record<string, string>', required: false, description: 'Custom headers.' },
      { name: 'formData', type: 'Record<string, string>', required: false, description: 'Additional multipart form fields.' },
    ],
    returns: {
      type: 'UploadFileResult',
      schema: { statusCode: 'number', data: 'string' },
      description: 'HTTP response status and response body from server.',
    },
    errors: [
      { code: 'INVALID_ARGUMENT', meaning: 'File does not exist or URL is invalid.', troubleshooting: 'Verify file exists in sandbox.' },
      { code: 'SSRF_BLOCKED', meaning: 'Target URL is on a private subnet.', troubleshooting: 'Upload only to public endpoints.' },
    ],
    platforms: { android: true, ios: true, reactNative: true, flutter: true, web: true },
    snippets: {
      typescript: `const res = await goatBridge.callNative('UPLOAD_FILE', {
  url: 'https://api.example.com/v1/uploads',
  filePath: 'photos/avatar.png',
  name: 'avatar',
  formData: { userId: '1001' }
});`,
      kotlin: `val multipartBody = MultipartBody.Builder().setType(MultipartBody.FORM)
multipartBody.addFormDataPart("file", file.name, file.asRequestBody())`,
      swift: `// URLSession upload task with multipart boundary encoding`,
      dart: `final res = await goatController.callNativeAction('UPLOAD_FILE', {
  'url': 'https://api.example.com/v1/uploads',
  'filePath': 'photos/avatar.png',
});`,
    },
    executable: true,
    defaultPayload: { url: 'https://httpbin.org/post', filePath: 'notes/sample.txt' },
  },
  {
    id: 'get-network-type',
    action: 'GET_NETWORK_TYPE',
    aliases: ['getNetworkType'],
    domain: 'Networking, HTTP & WebSockets',
    domainSlug: 'networking-http',
    description: 'Queries active network connection status and radio carrier technology.',
    purpose: 'Adapts video streaming resolution or prefetching strategy based on connection (Wi-Fi vs 2G/3G/4G/5G).',
    permissions: { manifest: ['android.permission.ACCESS_NETWORK_STATE'], scope: 'none', requiresGesture: false },
    params: [],
    returns: {
      type: 'GetNetworkTypeResult',
      schema: { networkType: '"wifi" | "5g" | "4g" | "3g" | "2g" | "unknown" | "none"', isConnected: 'boolean' },
      description: 'Active network category and connectivity flag.',
    },
    errors: [],
    platforms: { android: true, ios: true, reactNative: true, flutter: true, web: true },
    snippets: {
      typescript: `const { networkType, isConnected } = await goatBridge.callNative('GET_NETWORK_TYPE', {});
console.log('Connected:', isConnected, 'Type:', networkType);`,
      kotlin: `val connectivityManager = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
val activeNetwork = connectivityManager.activeNetwork`,
      swift: `// NWPathMonitor path inspection`,
      dart: `final res = await goatController.callNativeAction('GET_NETWORK_TYPE', {});`,
    },
    executable: true,
    defaultPayload: {},
  },
  {
    id: 'is-connected',
    action: 'IS_CONNECTED',
    aliases: ['isConnected', 'onNetworkStatusChange'],
    domain: 'Networking, HTTP & WebSockets',
    domainSlug: 'networking-http',
    description: 'Quick boolean probe checking if the host device has an active internet connection.',
    purpose: 'Displays offline banner when connection drops.',
    permissions: { manifest: ['android.permission.ACCESS_NETWORK_STATE'], scope: 'none', requiresGesture: false },
    params: [],
    returns: {
      type: 'IsConnectedResult',
      schema: { isConnected: 'boolean', networkType: 'string' },
      description: 'Connection status boolean.',
    },
    errors: [],
    platforms: { android: true, ios: true, reactNative: true, flutter: true, web: true },
    snippets: {
      typescript: `const { isConnected } = await goatBridge.callNative('IS_CONNECTED', {});`,
      kotlin: `val isOnline = activeNetworkCapabilities?.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) == true`,
      swift: `let isOnline = monitor.currentPath.status == .satisfied`,
      dart: `final res = await goatController.callNativeAction('IS_CONNECTED', {});`,
    },
    executable: true,
    defaultPayload: {},
  },
  {
    id: 'websocket-connect',
    action: 'WEBSOCKET_CONNECT',
    aliases: ['connectSocket'],
    domain: 'Networking, HTTP & WebSockets',
    domainSlug: 'networking-http',
    description: 'Establishes a native persistent WebSocket connection with automatic ping/pong heartbeats.',
    purpose: 'Enables real-time bi-directional streaming for chat apps, live game updates, and financial tickers.',
    permissions: { manifest: ['android.permission.INTERNET'], scope: 'none', requiresGesture: false },
    params: [
      { name: 'url', type: 'string', required: true, description: 'Target wss:// or ws:// URL.' },
      { name: 'protocols', type: 'string[]', required: false, description: 'Subprotocol negotiation list.' },
      { name: 'headers', type: 'Record<string, string>', required: false, description: 'Initial handshake headers.' },
    ],
    returns: {
      type: 'WebSocketConnectResult',
      schema: { connected: 'boolean', url: 'string' },
      description: 'Status of WebSocket handshake.',
    },
    errors: [
      { code: 'INVALID_ARGUMENT', meaning: 'Invalid WebSocket URL.', troubleshooting: 'Must start with ws:// or wss://.' },
      { code: 'NETWORK_OFFLINE', meaning: 'Device is offline.', troubleshooting: 'Check connection.' },
      { code: 'SSRF_BLOCKED', meaning: 'Target points to private subnet.', troubleshooting: 'Use public hostnames.' },
    ],
    platforms: { android: true, ios: true, reactNative: true, flutter: true, web: true },
    snippets: {
      typescript: `await goatBridge.callNative('WEBSOCKET_CONNECT', {
  url: 'wss://stream.example.com/v1/ticker'
});`,
      kotlin: `val wsRequest = Request.Builder().url(url).build()
val webSocket = okHttpClient.newWebSocket(wsRequest, listener)`,
      swift: `let webSocketTask = urlSession.webSocketTask(with: URL(string: url)!)
webSocketTask.resume()`,
      dart: `await goatController.callNativeAction('WEBSOCKET_CONNECT', {
  'url': 'wss://stream.example.com/v1/ticker',
});`,
    },
    executable: true,
    defaultPayload: { url: 'wss://echo.websocket.events' },
  },
  {
    id: 'websocket-send',
    action: 'WEBSOCKET_SEND',
    aliases: ['sendSocketMessage'],
    domain: 'Networking, HTTP & WebSockets',
    domainSlug: 'networking-http',
    description: 'Transmits a text or JSON frame over the active WebSocket bridge connection.',
    purpose: 'Sends chat messages, order requests, or subscribe events over open socket.',
    permissions: { manifest: [], scope: 'none', requiresGesture: false },
    params: [
      { name: 'data', type: 'string', required: true, description: 'Message payload string.' },
    ],
    returns: {
      type: 'WebSocketSendResult',
      schema: { sent: 'boolean' },
      description: 'Confirmation that frame was buffered for transmission.',
    },
    errors: [
      { code: 'INVALID_ARGUMENT', meaning: 'Data was missing or socket is closed.', troubleshooting: 'Verify socket is connected.' },
    ],
    platforms: { android: true, ios: true, reactNative: true, flutter: true, web: true },
    snippets: {
      typescript: `await goatBridge.callNative('WEBSOCKET_SEND', {
  data: JSON.stringify({ event: 'subscribe', channel: 'BTC_USD' })
});`,
      kotlin: `webSocket.send(data)`,
      swift: `webSocketTask.send(.string(data)) { error in }`,
      dart: `await goatController.callNativeAction('WEBSOCKET_SEND', {
  'data': '{"event": "ping"}',
});`,
    },
    executable: true,
    defaultPayload: { data: '{"type":"ping"}' },
  },
  {
    id: 'websocket-close',
    action: 'WEBSOCKET_CLOSE',
    aliases: ['closeSocket'],
    domain: 'Networking, HTTP & WebSockets',
    domainSlug: 'networking-http',
    description: 'Gracefully closes the active native WebSocket stream.',
    purpose: 'Cleans up network resources when exiting live streaming screen.',
    permissions: { manifest: [], scope: 'none', requiresGesture: false },
    params: [],
    returns: {
      type: 'WebSocketCloseResult',
      schema: { closed: 'boolean' },
      description: 'Confirmation of socket disconnection.',
    },
    errors: [],
    platforms: { android: true, ios: true, reactNative: true, flutter: true, web: true },
    snippets: {
      typescript: `await goatBridge.callNative('WEBSOCKET_CLOSE', {});`,
      kotlin: `webSocket.close(1000, "Normal Closure")`,
      swift: `webSocketTask.cancel(with: .normalClosure, reason: nil)`,
      dart: `await goatController.callNativeAction('WEBSOCKET_CLOSE', {});`,
    },
    executable: true,
    defaultPayload: {},
  },
  {
    id: 'verify-ssl-pin',
    action: 'VERIFY_SSL_PIN',
    aliases: ['verifySslPin', 'auditSslPinning'],
    domain: 'Networking, HTTP & WebSockets',
    domainSlug: 'networking-http',
    description: 'Verifies whether a remote server certificate matches the SHA-256 public key pin configured in the host security policy.',
    purpose: 'Protects financial and healthcare mini-apps against Man-in-the-Middle (MITM) proxy interception.',
    permissions: { manifest: ['android.permission.INTERNET'], scope: 'none', requiresGesture: false },
    params: [
      { name: 'hostname', type: 'string', required: true, description: 'Target domain (e.g., "api.bank.com").' },
      { name: 'pinSha256', type: 'string', required: false, description: 'Expected SPKI SHA-256 hash.' },
    ],
    returns: {
      type: 'SslPinAuditResult',
      schema: { hostname: 'string', isPinned: 'boolean', isCertificateValid: 'boolean', auditStatus: 'string', matchedPin: 'string (optional)' },
      description: 'Audit result and certificate chain validation status.',
    },
    errors: [
      { code: 'SECURITY_VIOLATION', meaning: 'Certificate chain did not match pinned SHA-256 public key.', troubleshooting: 'Ensure server public key matches the declared SPKI pin.' },
    ],
    platforms: { android: true, ios: true, reactNative: true, flutter: true, web: true },
    snippets: {
      typescript: `const audit = await goatBridge.callNative('VERIFY_SSL_PIN', {
  hostname: 'api.bank.com',
  pinSha256: 'sha256/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='
});
console.log('Pinned:', audit.isPinned);`,
      kotlin: `// OkHttp CertificatePinner check
val pinner = CertificatePinner.Builder().add(hostname, pinSha256).build()`,
      swift: `// URLSessionDelegate serverTrust evaluation`,
      dart: `final res = await goatController.callNativeAction('VERIFY_SSL_PIN', {
  'hostname': 'api.bank.com',
});`,
    },
    executable: true,
    defaultPayload: { hostname: 'api.github.com' },
  },
  {
    id: 'audit-network-certificate',
    action: 'AUDIT_NETWORK_CERTIFICATE',
    aliases: ['auditNetworkCertificate'],
    domain: 'Networking, HTTP & WebSockets',
    domainSlug: 'networking-http',
    description: 'Performs diagnostic inspection of SSL/TLS certificate chain, expiration, and issuer CA for target URL.',
    purpose: 'Enables security health checks and automated certificate expiration warnings.',
    permissions: { manifest: ['android.permission.INTERNET'], scope: 'none', requiresGesture: false },
    params: [
      { name: 'url', type: 'string', required: true, description: 'HTTPS endpoint to audit.' },
    ],
    returns: {
      type: 'NetworkCertAuditResult',
      schema: { hostname: 'string', isPinned: 'boolean', isCertificateValid: 'boolean', auditStatus: 'string' },
      description: 'TLS handshake certificate validity report.',
    },
    errors: [
      { code: 'INVALID_ARGUMENT', meaning: 'Invalid URL provided.', troubleshooting: 'Ensure URL starts with https://.' },
    ],
    platforms: { android: true, ios: true, reactNative: true, flutter: true, web: true },
    snippets: {
      typescript: `const report = await goatBridge.callNative('AUDIT_NETWORK_CERTIFICATE', { url: 'https://api.github.com' });`,
      kotlin: `// Inspect SSLSession peerCertificates`,
      swift: `// SecTrustEvaluateWithError on serverTrust`,
      dart: `final res = await goatController.callNativeAction('AUDIT_NETWORK_CERTIFICATE', {'url': 'https://api.github.com'});`,
    },
    executable: true,
    defaultPayload: { url: 'https://api.github.com' },
  },
];
