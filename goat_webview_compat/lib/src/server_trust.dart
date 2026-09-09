import 'package:flutter/foundation.dart';

import 'enums.dart';

@immutable
class ServerTrustChallenge {
  final String host;
  final int port;
  final String protocol;

  const ServerTrustChallenge({
    required this.host,
    required this.port,
    required this.protocol,
  });
}

@immutable
class ServerTrustAuthResponse {
  final ServerTrustAuthResponseAction action;

  const ServerTrustAuthResponse({
    this.action = ServerTrustAuthResponseAction.cancel,
  });
}
