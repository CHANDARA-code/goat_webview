import 'package:flutter/foundation.dart';

@immutable
class WebUri {
  final String rawValue;

  const WebUri(this.rawValue);

  WebUri.uri(Uri uri) : rawValue = uri.toString();

  Uri get uriValue => Uri.parse(rawValue);

  String get scheme => uriValue.scheme;

  String get host => uriValue.host;

  String get path => uriValue.path;

  Map<String, String> get queryParameters => uriValue.queryParameters;

  bool get isHttp => scheme == 'http';

  bool get isHttps => scheme == 'https';

  @override
  String toString() => rawValue;

  @override
  bool operator ==(Object other) =>
      other is WebUri && other.rawValue == rawValue;

  @override
  int get hashCode => rawValue.hashCode;
}
