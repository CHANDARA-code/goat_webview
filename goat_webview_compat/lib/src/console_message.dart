import 'package:flutter/foundation.dart';

import 'enums.dart';

@immutable
class ConsoleMessage {
  final String message;
  final ConsoleMessageLevel messageLevel;

  const ConsoleMessage({
    this.message = '',
    this.messageLevel = ConsoleMessageLevel.log,
  });
}
