enum CacheMode {
  loadDefault,
  loadCacheElseNetwork,
  loadNoCache,
  loadCacheOnly,
}

enum NavigationActionPolicy {
  cancel,
  allow,
  download,
}

enum ServerTrustAuthResponseAction {
  cancel,
  proceed,
}

enum WebResourceErrorType {
  unknown,
  hostLookup,
  timeout,
  connect,
  badUrl,
  failedSslHandshake,
  fileNotFound,
  tooManyRequests,
}

enum ConsoleMessageLevel {
  debug,
  error,
  log,
  tip,
  warning,
}

enum ScrollViewContentInsetAdjustmentBehavior {
  automatic,
  scrollableAxes,
  never,
  always,
}

enum MixedContentMode {
  alwaysAllow,
  neverAllow,
  compatibilityMode,
}
