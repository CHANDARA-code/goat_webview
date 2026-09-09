import 'package:flutter/foundation.dart';

import 'url_request.dart';

enum NavigationType {
  linkActivated,
  formSubmitted,
  backForward,
  reload,
  formResubmitted,
  other,
}

@immutable
class NavigationAction {
  final URLRequest request;
  final bool isForMainFrame;
  final bool hasGesture;
  final bool isRedirect;
  final NavigationType navigationType;

  const NavigationAction({
    required this.request,
    this.isForMainFrame = true,
    this.hasGesture = false,
    this.isRedirect = false,
    this.navigationType = NavigationType.other,
  });
}
