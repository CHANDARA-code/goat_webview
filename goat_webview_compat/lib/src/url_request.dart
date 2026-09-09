import 'package:flutter/foundation.dart';

import 'web_uri.dart';

@immutable
class URLRequest {
  final WebUri? url;
  final String method;
  final Map<String, String>? headers;
  final Uint8List? body;
  final bool allowsCellularAccess;
  final bool allowsConstrainedNetworkAccess;
  final bool allowsExpensiveNetworkAccess;

  const URLRequest({
    this.url,
    this.method = 'GET',
    this.headers,
    this.body,
    this.allowsCellularAccess = true,
    this.allowsConstrainedNetworkAccess = true,
    this.allowsExpensiveNetworkAccess = true,
  });

  @override
  String toString() => 'URLRequest(url: $url, method: $method)';
}
