import 'package:flutter/foundation.dart';

import 'enums.dart';
import 'web_uri.dart';

@immutable
class WebResourceError {
  final WebResourceErrorType type;
  final String description;

  const WebResourceError({required this.type, required this.description});
}

@immutable
class WebResourceRequest {
  final WebUri url;
  final Map<String, String>? headers;
  final String method;
  final bool isForMainFrame;
  final bool hasGesture;
  final bool isRedirect;

  const WebResourceRequest({
    required this.url,
    this.headers,
    this.method = 'GET',
    this.isForMainFrame = true,
    this.hasGesture = false,
    this.isRedirect = false,
  });
}

@immutable
class WebResourceResponse {
  final String? contentType;
  final String? contentEncoding;
  final Uint8List? data;
  final Map<String, String>? headers;
  final int? statusCode;
  final String? reasonPhrase;

  const WebResourceResponse({
    this.contentType,
    this.contentEncoding,
    this.data,
    this.headers,
    this.statusCode,
    this.reasonPhrase,
  });
}

@immutable
class LoadedResource {
  final WebUri? url;
  final double startTime;
  final double duration;

  const LoadedResource({
    this.url,
    this.startTime = 0,
    this.duration = 0,
  });
}
