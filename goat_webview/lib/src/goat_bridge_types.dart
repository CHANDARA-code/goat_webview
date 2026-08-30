import 'dart:convert';

/// Represents an incoming or outgoing message through Goat WebView bridge.
class GoatBridgeMessage {
  final String id;
  final String action;
  final Map<String, dynamic> payload;

  GoatBridgeMessage({
    required this.id,
    required this.action,
    this.payload = const {},
  });

  Map<String, dynamic> toMap() => {
        'id': id,
        'action': action,
        'payload': payload,
      };

  String toJson() => jsonEncode(toMap());

  factory GoatBridgeMessage.fromMap(Map<String, dynamic> map) {
    Map<String, dynamic> parsedPayload = {};
    final rawPayload = map['payload'];
    if (rawPayload is Map) {
      parsedPayload = rawPayload.cast<String, dynamic>();
    } else if (rawPayload is String && rawPayload.isNotEmpty) {
      try {
        final decoded = jsonDecode(rawPayload);
        if (decoded is Map) {
          parsedPayload = decoded.cast<String, dynamic>();
        }
      } catch (_) {}
    }

    return GoatBridgeMessage(
      id: map['id'] as String? ?? '',
      action: map['action'] as String? ?? '',
      payload: parsedPayload,
    );
  }

  factory GoatBridgeMessage.fromJson(String source) =>
      GoatBridgeMessage.fromMap(jsonDecode(source) as Map<String, dynamic>);
}

/// Response returned by the native bridge.
class GoatBridgeResponse {
  final String id;
  final bool success;
  final dynamic data;
  final String? error;

  GoatBridgeResponse({
    required this.id,
    required this.success,
    this.data,
    this.error,
  });

  factory GoatBridgeResponse.fromMap(Map<String, dynamic> map) {
    return GoatBridgeResponse(
      id: map['id'] as String? ?? '',
      success: map['success'] as bool? ?? false,
      data: map['data'],
      error: map['error'] as String?,
    );
  }
}

/// Represents safe area insets of the active WebView container.
class GoatSafeAreaInsets {
  final double top;
  final double bottom;
  final double left;
  final double right;

  const GoatSafeAreaInsets({
    this.top = 0.0,
    this.bottom = 0.0,
    this.left = 0.0,
    this.right = 0.0,
  });

  factory GoatSafeAreaInsets.fromMap(Map<String, dynamic> map) {
    return GoatSafeAreaInsets(
      top: (map['top'] as num?)?.toDouble() ?? 0.0,
      bottom: (map['bottom'] as num?)?.toDouble() ?? 0.0,
      left: (map['left'] as num?)?.toDouble() ?? 0.0,
      right: (map['right'] as num?)?.toDouble() ?? 0.0,
    );
  }

  Map<String, dynamic> toMap() => {
        'top': top,
        'bottom': bottom,
        'left': left,
        'right': right,
      };
}

/// Represents soft keyboard insets and transition duration.
class GoatKeyboardInsets {
  final int keyboardHeight;
  final int durationMs;
  final bool isVisible;

  const GoatKeyboardInsets({
    this.keyboardHeight = 0,
    this.durationMs = 250,
    this.isVisible = false,
  });

  factory GoatKeyboardInsets.fromMap(Map<String, dynamic> map) {
    final height = (map['keyboardHeight'] ?? map['heightPx'] as num?)?.toInt() ?? 0;
    return GoatKeyboardInsets(
      keyboardHeight: height,
      durationMs: (map['durationMs'] as num?)?.toInt() ?? 250,
      isVisible: (map['isVisible'] as bool?) ?? (height > 0),
    );
  }

  Map<String, dynamic> toMap() => {
        'keyboardHeight': keyboardHeight,
        'durationMs': durationMs,
        'isVisible': isVisible,
      };
}

/// Structured device metadata, telemetry, and install-scoped GUID (Task 10203 / R3).
class GoatDeviceInfo {
  final String model;
  final String manufacturer;
  final String brand;
  final String platform;
  final String androidVersion;
  final int sdkInt;
  final int screenWidthDp;
  final int screenHeightDp;
  final double density;
  final int batteryLevel;
  final bool isCharging;
  final bool isAlgorithmicDarkening;
  final String appVersion;
  final String installGuid;

  const GoatDeviceInfo({
    this.model = '',
    this.manufacturer = '',
    this.brand = '',
    this.platform = '',
    this.androidVersion = '',
    this.sdkInt = 0,
    this.screenWidthDp = 0,
    this.screenHeightDp = 0,
    this.density = 1.0,
    this.batteryLevel = 100,
    this.isCharging = false,
    this.isAlgorithmicDarkening = false,
    this.appVersion = '1.0.0-goat',
    this.installGuid = '',
  });

  factory GoatDeviceInfo.fromMap(Map<String, dynamic> map) {
    return GoatDeviceInfo(
      model: map['model'] as String? ?? '',
      manufacturer: map['manufacturer'] as String? ?? '',
      brand: map['brand'] as String? ?? '',
      platform: map['platform'] as String? ?? '',
      androidVersion: (map['androidVersion'] ?? map['osVersion'] ?? map['systemVersion']) as String? ?? '',
      sdkInt: (map['sdkInt'] as num?)?.toInt() ?? 0,
      screenWidthDp: (map['screenWidthDp'] as num?)?.toInt() ?? 0,
      screenHeightDp: (map['screenHeightDp'] as num?)?.toInt() ?? 0,
      density: (map['density'] as num?)?.toDouble() ?? 1.0,
      batteryLevel: (map['batteryLevel'] as num?)?.toInt() ?? 100,
      isCharging: map['isCharging'] as bool? ?? false,
      isAlgorithmicDarkening: map['isAlgorithmicDarkening'] as bool? ?? false,
      appVersion: map['appVersion'] as String? ?? '1.0.0-goat',
      installGuid: map['installGuid'] as String? ?? '',
    );
  }

  Map<String, dynamic> toMap() => {
        'model': model,
        'manufacturer': manufacturer,
        'brand': brand,
        'platform': platform,
        'androidVersion': androidVersion,
        'sdkInt': sdkInt,
        'screenWidthDp': screenWidthDp,
        'screenHeightDp': screenHeightDp,
        'density': density,
        'batteryLevel': batteryLevel,
        'isCharging': isCharging,
        'isAlgorithmicDarkening': isAlgorithmicDarkening,
        'appVersion': appVersion,
        'installGuid': installGuid,
      };
}

/// Host-configurable popup window and target="_blank" routing policy (Task 10183 / R1 / R2).
enum GoatPopupRoutingPolicy {
  auto,
  systemBrowser,
  modal,
  sameFrame,
  block,
}

/// Parses string representation of [GoatPopupRoutingPolicy] (case-insensitive, snake/camel).
GoatPopupRoutingPolicy parseGoatPopupRoutingPolicy(String? value) {
  if (value == null || value.trim().isEmpty) return GoatPopupRoutingPolicy.auto;
  final clean = value.trim().toLowerCase().replaceAll('_', '');
  switch (clean) {
    case 'auto':
      return GoatPopupRoutingPolicy.auto;
    case 'systembrowser':
      return GoatPopupRoutingPolicy.systemBrowser;
    case 'modal':
      return GoatPopupRoutingPolicy.modal;
    case 'sameframe':
      return GoatPopupRoutingPolicy.sameFrame;
    case 'block':
    case 'cancel':
    case 'reject':
      return GoatPopupRoutingPolicy.block;
    default:
      return GoatPopupRoutingPolicy.auto;
  }
}

/// Parsed window geometry and display features requested via `window.open()` (Task 10183 / R3).
class GoatWindowFeatures {
  final double? width;
  final double? height;
  final double? x;
  final double? y;
  final bool? menuBar;
  final bool? statusBar;
  final bool? toolbars;
  final bool? resizable;
  final bool? scrollbars;

  const GoatWindowFeatures({
    this.width,
    this.height,
    this.x,
    this.y,
    this.menuBar,
    this.statusBar,
    this.toolbars,
    this.resizable,
    this.scrollbars,
  });

  factory GoatWindowFeatures.fromMap(Map<String, dynamic> map) {
    return GoatWindowFeatures(
      width: (map['width'] as num?)?.toDouble(),
      height: (map['height'] as num?)?.toDouble(),
      x: (map['x'] ?? map['left'] as num?)?.toDouble(),
      y: (map['y'] ?? map['top'] as num?)?.toDouble(),
      menuBar: map['menuBar'] as bool?,
      statusBar: map['statusBar'] as bool?,
      toolbars: map['toolbars'] as bool?,
      resizable: map['resizable'] as bool?,
      scrollbars: map['scrollbars'] as bool?,
    );
  }

  Map<String, dynamic> toMap() => {
        if (width != null) 'width': width,
        if (height != null) 'height': height,
        if (x != null) 'x': x,
        if (y != null) 'y': y,
        if (menuBar != null) 'menuBar': menuBar,
        if (statusBar != null) 'statusBar': statusBar,
        if (toolbars != null) 'toolbars': toolbars,
        if (resizable != null) 'resizable': resizable,
        if (scrollbars != null) 'scrollbars': scrollbars,
      };
}

/// Structured popup window creation request intercepted natively (Task 10183 / Pillar 1).
class GoatPopupRequest {
  final String url;
  final String target;
  final GoatPopupRoutingPolicy policy;
  final bool isUserGesture;
  final bool isDialog;
  final GoatWindowFeatures? windowFeatures;

  const GoatPopupRequest({
    required this.url,
    this.target = '_blank',
    this.policy = GoatPopupRoutingPolicy.auto,
    this.isUserGesture = true,
    this.isDialog = false,
    this.windowFeatures,
  });

  factory GoatPopupRequest.fromMap(Map<String, dynamic> map) {
    final rawWf = map['windowFeatures'];
    GoatWindowFeatures? wf;
    if (rawWf is Map) {
      wf = GoatWindowFeatures.fromMap(Map<String, dynamic>.from(rawWf));
    }

    return GoatPopupRequest(
      url: map['url'] as String? ?? '',
      target: map['target'] as String? ?? '_blank',
      policy: parseGoatPopupRoutingPolicy(map['policy'] as String?),
      isUserGesture: (map['isUserGesture'] as bool?) ?? true,
      isDialog: (map['isDialog'] as bool?) ?? false,
      windowFeatures: wf,
    );
  }

  Map<String, dynamic> toMap() => {
        'url': url,
        'target': target,
        'policy': policy.name,
        'isUserGesture': isUserGesture,
        'isDialog': isDialog,
        if (windowFeatures != null) 'windowFeatures': windowFeatures!.toMap(),
      };
}

