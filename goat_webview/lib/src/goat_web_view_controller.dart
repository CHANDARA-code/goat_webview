import 'dart:async';
import 'package:flutter/services.dart';
import 'goat_bridge_types.dart';
import 'goat_capability_plugin.dart';

/// Controller for programmatic interaction with the embedded Goat WebView instance.
class GoatWebViewController {
  final int viewId;
  final MethodChannel _channel;
  bool _isDisposed = false;

  /// Whether this controller has been disposed.
  bool get isDisposed => _isDisposed;

  StreamController<GoatBridgeMessage>? _bridgeMessageStreamCtrl;
  StreamController<GoatBridgeMessage> get _bridgeMessageStream =>
      _bridgeMessageStreamCtrl ??= StreamController<GoatBridgeMessage>.broadcast();
  StreamController<Map<String, dynamic>>? _downloadProgressStreamCtrl;
  StreamController<Map<String, dynamic>> get _downloadProgressStream =>
      _downloadProgressStreamCtrl ??= StreamController<Map<String, dynamic>>.broadcast();
  StreamController<int>? _progressStreamCtrl;
  StreamController<int> get _progressStream =>
      _progressStreamCtrl ??= StreamController<int>.broadcast();
  StreamController<String>? _pageStartedStreamCtrl;
  StreamController<String> get _pageStartedStream =>
      _pageStartedStreamCtrl ??= StreamController<String>.broadcast();
  StreamController<String>? _pageFinishedStreamCtrl;
  StreamController<String> get _pageFinishedStream =>
      _pageFinishedStreamCtrl ??= StreamController<String>.broadcast();
  StreamController<GoatSafeAreaInsets>? _safeAreaStreamCtrl;
  StreamController<GoatSafeAreaInsets> get _safeAreaStream =>
      _safeAreaStreamCtrl ??= StreamController<GoatSafeAreaInsets>.broadcast();
  StreamController<GoatKeyboardInsets>? _keyboardInsetsStreamCtrl;
  StreamController<GoatKeyboardInsets> get _keyboardInsetsStream =>
      _keyboardInsetsStreamCtrl ??= StreamController<GoatKeyboardInsets>.broadcast();
  StreamController<Map<String, dynamic>>? _miniAppClosedStreamCtrl;
  StreamController<Map<String, dynamic>> get _miniAppClosedStream =>
      _miniAppClosedStreamCtrl ??= StreamController<Map<String, dynamic>>.broadcast();
  StreamController<Map<String, dynamic>>? _appServiceReadyStreamCtrl;
  StreamController<Map<String, dynamic>> get _appServiceReadyStream =>
      _appServiceReadyStreamCtrl ??= StreamController<Map<String, dynamic>>.broadcast();
  StreamController<Map<String, dynamic>>? _appServiceCrashStreamCtrl;
  StreamController<Map<String, dynamic>> get _appServiceCrashStream =>
      _appServiceCrashStreamCtrl ??= StreamController<Map<String, dynamic>>.broadcast();
  StreamController<Map<String, dynamic>>? _appServiceTerminateStreamCtrl;
  StreamController<Map<String, dynamic>> get _appServiceTerminateStream =>
      _appServiceTerminateStreamCtrl ??= StreamController<Map<String, dynamic>>.broadcast();
  StreamController<GoatPopupRequest>? _popupRequestStreamCtrl;
  StreamController<GoatPopupRequest> get _popupRequestStream =>
      _popupRequestStreamCtrl ??= StreamController<GoatPopupRequest>.broadcast();
  StreamController<String>? _externalNavigationStreamCtrl;
  StreamController<String> get _externalNavigationStream =>
      _externalNavigationStreamCtrl ??= StreamController<String>.broadcast();
  StreamController<Map<String, dynamic>>? _receivedErrorStreamCtrl;
  StreamController<Map<String, dynamic>> get _receivedErrorStream =>
      _receivedErrorStreamCtrl ??= StreamController<Map<String, dynamic>>.broadcast();
  StreamController<Map<String, dynamic>>? _receivedHttpErrorStreamCtrl;
  StreamController<Map<String, dynamic>> get _receivedHttpErrorStream =>
      _receivedHttpErrorStreamCtrl ??= StreamController<Map<String, dynamic>>.broadcast();
  StreamController<String>? _pageCommitVisibleStreamCtrl;
  StreamController<String> get _pageCommitVisibleStream =>
      _pageCommitVisibleStreamCtrl ??= StreamController<String>.broadcast();
  StreamController<String>? _loadResourceStreamCtrl;
  StreamController<String> get _loadResourceStream =>
      _loadResourceStreamCtrl ??= StreamController<String>.broadcast();
  StreamController<Map<String, dynamic>>? _updateVisitedHistoryStreamCtrl;
  StreamController<Map<String, dynamic>> get _updateVisitedHistoryStream =>
      _updateVisitedHistoryStreamCtrl ??= StreamController<Map<String, dynamic>>.broadcast();
  StreamController<Map<String, dynamic>>? _consoleMessageStreamCtrl;
  StreamController<Map<String, dynamic>> get _consoleMessageStream =>
      _consoleMessageStreamCtrl ??= StreamController<Map<String, dynamic>>.broadcast();
  StreamController<void>? _pullToRefreshStreamCtrl;
  StreamController<void> get _pullToRefreshStream =>
      _pullToRefreshStreamCtrl ??= StreamController<void>.broadcast();

  Stream<GoatBridgeMessage> get onBridgeMessage => _bridgeMessageStream.stream;
  Stream<Map<String, dynamic>> get onDownloadProgress =>
      _downloadProgressStream.stream;
  Stream<int> get onProgressChanged => _progressStream.stream;
  Stream<String> get onPageStarted => _pageStartedStream.stream;
  Stream<String> get onPageFinished => _pageFinishedStream.stream;
  Stream<GoatSafeAreaInsets> get onSafeAreaChanged => _safeAreaStream.stream;
  Stream<GoatKeyboardInsets> get onKeyboardInsetsChanged =>
      _keyboardInsetsStream.stream;
  Stream<Map<String, dynamic>> get onMiniAppClosed =>
      _miniAppClosedStream.stream;
  Stream<Map<String, dynamic>> get onAppServiceReady =>
      _appServiceReadyStream.stream;
  Stream<Map<String, dynamic>> get onAppServiceCrash =>
      _appServiceCrashStream.stream;
  Stream<Map<String, dynamic>> get onAppServiceTerminate =>
      _appServiceTerminateStream.stream;
  Stream<GoatPopupRequest> get onPopupRequest => _popupRequestStream.stream;

  /// T7 compat: fires with the raw URL whenever the native external-scheme resolver
  /// resolves a navigation externally (only when `compatExternalSchemeResolver` is set
  /// on the widget). Fire-and-forget — this is a notice, not a navigation veto.
  Stream<String> get onExternalNavigation => _externalNavigationStream.stream;

  /// T8 compat: each of these only ever emits when the [GoatWebView] widget was built with the
  /// matching callback set (`enableOnX` creation param) — the native side skips the work
  /// entirely otherwise (G7). `{url, errorCode, description}`.
  Stream<Map<String, dynamic>> get onReceivedError => _receivedErrorStream.stream;

  /// `{url, statusCode}`.
  Stream<Map<String, dynamic>> get onReceivedHttpError =>
      _receivedHttpErrorStream.stream;
  Stream<String> get onPageCommitVisible => _pageCommitVisibleStream.stream;
  Stream<String> get onLoadResource => _loadResourceStream.stream;

  /// `{url, isReload}`.
  Stream<Map<String, dynamic>> get onUpdateVisitedHistory =>
      _updateVisitedHistoryStream.stream;

  /// `{message, messageLevel}`.
  Stream<Map<String, dynamic>> get onConsoleMessage =>
      _consoleMessageStream.stream;

  /// T9 compat: fires on every pull-to-refresh gesture, only when the widget's
  /// `onPullToRefresh` callback was supplied. The default (unsupplied) case never reaches
  /// Dart at all — native just reloads.
  Stream<void> get onPullToRefresh => _pullToRefreshStream.stream;

  GoatWebViewController({required this.viewId})
      : _channel = MethodChannel('com.goat.webview/bridge_$viewId') {
    _channel.setMethodCallHandler(_handleMethodCall);
  }

  Future<dynamic> _handleMethodCall(MethodCall call) async {
    if (_isDisposed) return null;
    switch (call.method) {
      case 'onPopupRequest':
        if (_popupRequestStreamCtrl?.hasListener == true) {
          final map = Map<String, dynamic>.from(call.arguments as Map);
          _popupRequestStream.add(GoatPopupRequest.fromMap(map));
        }
        return null;
      case 'onBridgeMessage':
        if (_bridgeMessageStreamCtrl?.hasListener == true) {
          final map = Map<String, dynamic>.from(call.arguments as Map);
          final msg = GoatBridgeMessage.fromMap(map);
          _bridgeMessageStream.add(msg);
        }
        return null;
      case 'onDownloadProgress':
        if (_downloadProgressStreamCtrl?.hasListener == true) {
          final map = Map<String, dynamic>.from(call.arguments as Map);
          _downloadProgressStream.add(map);
        }
        return null;
      case 'onProgressChanged':
        if (_progressStreamCtrl?.hasListener == true) {
          final progress = (call.arguments as num?)?.toInt() ?? 0;
          _progressStream.add(progress);
        }
        return null;
      case 'onPageStarted':
        if (_pageStartedStreamCtrl?.hasListener == true) {
          final url = call.arguments as String? ?? '';
          _pageStartedStream.add(url);
        }
        return null;
      case 'onPageFinished':
        if (_pageFinishedStreamCtrl?.hasListener == true) {
          final url = call.arguments as String? ?? '';
          _pageFinishedStream.add(url);
        }
        return null;
      case 'onSafeAreaChanged':
        if (_safeAreaStreamCtrl?.hasListener == true) {
          final map = Map<String, dynamic>.from(call.arguments as Map);
          _safeAreaStream.add(GoatSafeAreaInsets.fromMap(map));
        }
        return null;
      case 'onKeyboardInsetsChanged':
        if (_keyboardInsetsStreamCtrl?.hasListener == true) {
          final map = Map<String, dynamic>.from(call.arguments as Map);
          _keyboardInsetsStream.add(GoatKeyboardInsets.fromMap(map));
        }
        return null;
      case 'onMiniAppClosed':
        if (_miniAppClosedStreamCtrl?.hasListener == true) {
          final map = Map<String, dynamic>.from(call.arguments as Map);
          _miniAppClosedStream.add(map);
        }
        return null;
      case 'onAppServiceReady':
        if (_appServiceReadyStreamCtrl?.hasListener == true) {
          final map = Map<String, dynamic>.from(call.arguments as Map);
          _appServiceReadyStream.add(map);
        }
        return null;
      case 'onAppServiceCrash':
        if (_appServiceCrashStreamCtrl?.hasListener == true) {
          final map = Map<String, dynamic>.from(call.arguments as Map);
          _appServiceCrashStream.add(map);
        }
        return null;
      case 'onAppServiceTerminate':
        if (_appServiceTerminateStreamCtrl?.hasListener == true) {
          final map = Map<String, dynamic>.from(call.arguments as Map);
          _appServiceTerminateStream.add(map);
        }
        return null;
      case 'onExternalNavigation':
        if (_externalNavigationStreamCtrl?.hasListener == true) {
          _externalNavigationStream.add(call.arguments as String? ?? '');
        }
        return null;
      case 'onReceivedError':
        if (_receivedErrorStreamCtrl?.hasListener == true) {
          _receivedErrorStream.add(Map<String, dynamic>.from(call.arguments as Map));
        }
        return null;
      case 'onReceivedHttpError':
        if (_receivedHttpErrorStreamCtrl?.hasListener == true) {
          _receivedHttpErrorStream.add(Map<String, dynamic>.from(call.arguments as Map));
        }
        return null;
      case 'onPageCommitVisible':
        if (_pageCommitVisibleStreamCtrl?.hasListener == true) {
          _pageCommitVisibleStream.add(call.arguments as String? ?? '');
        }
        return null;
      case 'onLoadResource':
        if (_loadResourceStreamCtrl?.hasListener == true) {
          _loadResourceStream.add(call.arguments as String? ?? '');
        }
        return null;
      case 'onUpdateVisitedHistory':
        if (_updateVisitedHistoryStreamCtrl?.hasListener == true) {
          _updateVisitedHistoryStream.add(Map<String, dynamic>.from(call.arguments as Map));
        }
        return null;
      case 'onConsoleMessage':
        if (_consoleMessageStreamCtrl?.hasListener == true) {
          _consoleMessageStream.add(Map<String, dynamic>.from(call.arguments as Map));
        }
        return null;
      case 'onPullToRefresh':
        if (_pullToRefreshStreamCtrl?.hasListener == true) {
          _pullToRefreshStream.add(null);
        }
        return null;
      default:
        throw MissingPluginException();
    }
  }

  /// Evaluates JavaScript code inside the active WebView.
  Future<String?> evaluateJavascript(String script) async {
    return await _channel
        .invokeMethod<String>('evaluateJavascript', {'script': script});
  }

  /// Sends a structured native action message into the React SPA DOM.
  Future<GoatBridgeResponse> callJs(String action,
      [Map<String, dynamic> payload = const {}]) async {
    final res = await _channel.invokeMethod<Map>('callJs', {
      'action': action,
      'payload': payload,
    });
    if (res != null) {
      return GoatBridgeResponse.fromMap(Map<String, dynamic>.from(res));
    }
    return GoatBridgeResponse(id: '', success: false, error: 'Empty response');
  }

  Future<GoatBridgeResponse> onAppShow([Map<String, dynamic> options = const {}]) async {
    return await callJs('ON_APP_SHOW', options);
  }

  Future<GoatBridgeResponse> onAppHide() async {
    return await callJs('ON_APP_HIDE', {'timestamp': DateTime.now().millisecondsSinceEpoch});
  }

  Future<GoatBridgeResponse> onPageScroll({
    required int scrollTop,
    required int scrollLeft,
    required int scrollHeight,
    required int scrollWidth,
  }) async {
    return await callJs('ON_PAGE_SCROLL', {
      'scrollTop': scrollTop,
      'scrollLeft': scrollLeft,
      'scrollHeight': scrollHeight,
      'scrollWidth': scrollWidth,
    });
  }

  Future<GoatBridgeResponse> onMemoryWarning({
    required int level,
    String memoryPressure = 'warning',
  }) async {
    return await callJs('ON_MEMORY_WARNING', {
      'level': level,
      'memoryPressure': memoryPressure,
    });
  }

  Future<GoatBridgeResponse> onWindowResize({
    required int width,
    required int height,
    required int windowWidth,
    required int windowHeight,
    required String orientation,
  }) async {
    return await callJs('ON_WINDOW_RESIZE', {
      'width': width,
      'height': height,
      'windowWidth': windowWidth,
      'windowHeight': windowHeight,
      'orientation': orientation,
    });
  }

  /// Executes a native bridge action directly on the host platform engine (Android / iOS)
  /// or dynamic companion capability plugin via SPI (Task 10202).
  Future<GoatBridgeResponse> executeAction(
    String action, [
    Map<String, dynamic> payload = const {},
  ]) async {
    if (GoatCapabilityRegistry.instance.canHandle(action)) {
      try {
        final result = await GoatCapabilityRegistry.instance
            .dispatchAction(action, payload);
        return GoatBridgeResponse(
          id: 'plugin_${DateTime.now().millisecondsSinceEpoch}',
          success: true,
          data: result ?? <String, dynamic>{},
        );
      } catch (e) {
        return GoatBridgeResponse(
          id: 'plugin_${DateTime.now().millisecondsSinceEpoch}',
          success: false,
          error: e.toString(),
        );
      }
    }

    final res = await _channel.invokeMethod<Map>('executeAction', {
      'action': action,
      'payload': payload,
    });
    if (res != null) {
      return GoatBridgeResponse.fromMap(Map<String, dynamic>.from(res));
    }
    return GoatBridgeResponse(
        id: '', success: false, error: 'Empty native response');
  }

  /// Sets dark/light mode theme in WebView and synchronization settings.
  Future<bool> setTheme(bool isDark) async {
    final res =
        await _channel.invokeMethod<bool>('setTheme', {'isDark': isDark});
    return res ?? true;
  }

  /// Prewarms the WebView instance engine.
  Future<bool> prewarm() async {
    final res = await _channel.invokeMethod<bool>('prewarm');
    return res ?? true;
  }

  /// Navigates back in web history if possible.
  Future<bool> goBack() async {
    final result = await _channel.invokeMethod<bool>('goBack');
    return result ?? false;
  }

  /// Reloads current WebView page.
  Future<void> reload() async {
    await _channel.invokeMethod<void>('reload');
  }

  /// Current page URL, or null before any navigation.
  Future<String?> getUrl() async => _channel.invokeMethod<String>('getUrl');

  /// Current page title, or null before any navigation.
  Future<String?> getTitle() async => _channel.invokeMethod<String>('getTitle');

  /// Can the WebView navigate forward in history?
  Future<bool> canGoForward() async {
    final res = await _channel.invokeMethod<bool>('canGoForward');
    return res ?? false;
  }

  /// Navigates forward in history.
  Future<void> goForward() async {
    await _channel.invokeMethod<void>('goForward');
  }

  /// Loads [url] directly on the live WebView — a raw navigation, not a mini-app switch
  /// ([switchMiniApp]/[openMiniApp] go through the warm pool and sandbox model).
  Future<bool> loadUrl(String url) async {
    final res = await _channel.invokeMethod<bool>('loadUrl', {'url': url});
    return res ?? false;
  }

  /// The WebView's back-forward list: `{currentIndex, history: [{url, title}]}`.
  Future<Map<String, dynamic>> getCopyBackForwardList() async {
    final res = await _channel.invokeMethod<Map>('getCopyBackForwardList');
    return res != null
        ? Map<String, dynamic>.from(res)
        : {'currentIndex': -1, 'history': const []};
  }

  /// Switches the mini-app shown in this already-mounted view to [url] without
  /// recreating the Flutter platform view. When [url] has been shown before, the
  /// swap re-attaches the still-warm WebView (typically 5–20 ms). Listen on
  /// [onPageFinished] for the ready signal.
  Future<bool> switchMiniApp(String url, {String appId = 'default'}) async {
    final ok = await _channel.invokeMethod<bool>(
      'openMiniApp',
      {'url': url, 'appId': appId},
    );
    return ok ?? false;
  }

  /// Pauses timers and JS execution for background RAM saving (Pillar 5).
  Future<bool> pause() async {
    final res = await _channel.invokeMethod<bool>('pause');
    return res ?? true;
  }

  /// Resumes timers and JS execution when screen is active.
  Future<bool> resume() async {
    final res = await _channel.invokeMethod<bool>('resume');
    return res ?? true;
  }

  /// T9 compat: programmatically shows/hides the pull-to-refresh spinner. No-op if
  /// `pullToRefreshEnabled` wasn't set on the widget.
  Future<bool> setRefreshing(bool refreshing) async {
    final res = await _channel
        .invokeMethod<bool>('setRefreshing', {'refreshing': refreshing});
    return res ?? false;
  }

  /// Real, live state — not cached — for compat's `PullToRefreshController.isRefreshing()`.
  Future<bool> isRefreshing() async {
    final res = await _channel.invokeMethod<bool>('isRefreshing');
    return res ?? false;
  }

  /// Triggers a native HUD toast notification (Task 10109).
  ///
  /// [title] is the notification text to display.
  /// [icon] can be 'success', 'error', 'loading', or 'none'.
  /// [duration] is the display duration in milliseconds.
  Future<GoatBridgeResponse> showToast({
    required String title,
    String icon = 'none',
    int duration = 1500,
  }) async {
    return await executeAction('SHOW_TOAST', {
      'title': title,
      'icon': icon,
      'duration': duration,
    });
  }

  /// Displays a native modal confirmation dialog (Task 10109).
  Future<GoatBridgeResponse> showModal({
    required String title,
    required String content,
    bool showCancel = true,
    String confirmText = 'OK',
    String cancelText = 'Cancel',
  }) async {
    return await executeAction('SHOW_MODAL', {
      'title': title,
      'content': content,
      'showCancel': showCancel,
      'confirmText': confirmText,
      'cancelText': cancelText,
    });
  }

  /// Displays a native selectable bottom action sheet (Task 10109).
  Future<GoatBridgeResponse> showActionSheet({
    required List<String> itemList,
  }) async {
    return await executeAction('SHOW_ACTION_SHEET', {
      'itemList': itemList,
    });
  }

  /// Queries whether a native bridge action capability is supported (including registered SPI companion plugins).
  Future<bool> canIUse(String action) async {
    if (GoatCapabilityRegistry.instance.canHandle(action)) {
      return true;
    }
    final res = await executeAction('CAN_I_USE', {'action': action});
    if (res.success && res.data != null) {
      return (res.data['supported'] as bool?) ?? false;
    }
    return false;
  }

  /// Sets screen brightness (0.0 to 1.0) (Task 10104).
  Future<GoatBridgeResponse> setScreenBrightness(double value) async {
    return await executeAction('SET_SCREEN_BRIGHTNESS', {'value': value});
  }

  /// Retrieves current screen brightness (Task 10104).
  Future<double> getScreenBrightness() async {
    final res = await executeAction('GET_SCREEN_BRIGHTNESS');
    if (res.success && res.data != null) {
      return (res.data['value'] as num?)?.toDouble() ?? 0.8;
    }
    return 0.8;
  }

  /// Toggles whether screen stays permanently awake (Task 10104).
  Future<GoatBridgeResponse> setKeepScreenOn(bool keepScreenOn) async {
    return await executeAction(
        'SET_KEEP_SCREEN_ON', {'keepScreenOn': keepScreenOn});
  }

  /// Triggers system dialer intent for phone number (Task 10104).
  Future<GoatBridgeResponse> makePhoneCall(String phoneNumber) async {
    return await executeAction('MAKE_PHONE_CALL', {'phoneNumber': phoneNumber});
  }

  /// Triggers native SMS messaging composer (Task 10104).
  Future<GoatBridgeResponse> sendSms(String phoneNumber,
      [String body = '']) async {
    return await executeAction(
        'SEND_SMS', {'phoneNumber': phoneNumber, 'body': body});
  }

  /// Obtains current GPS/network location (Task 10107).
  Future<GoatBridgeResponse> getLocation({
    String type = 'wgs84',
    bool highAccuracy = true,
  }) async {
    return await executeAction('GET_LOCATION', {
      'type': type,
      'highAccuracy': highAccuracy,
    });
  }

  /// Opens native location destination picker UI (Task 10107).
  Future<GoatBridgeResponse> chooseLocation() async {
    return await executeAction('CHOOSE_LOCATION');
  }

  /// Launches native map turn-by-turn navigation or POI viewing (Task 10107).
  Future<GoatBridgeResponse> openLocation({
    required double latitude,
    required double longitude,
    String name = '',
    String address = '',
    double scale = 18.0,
  }) async {
    return await executeAction('OPEN_LOCATION', {
      'latitude': latitude,
      'longitude': longitude,
      'name': name,
      'address': address,
      'scale': scale,
    });
  }

  /// Checks if biometric hardware is supported (Task 10103).
  Future<GoatBridgeResponse> checkBiometricSupport() async {
    return await executeAction('CHECK_BIOMETRIC_SUPPORT');
  }

  /// Prompts user with native Biometric Authentication prompt (Task 10103).
  Future<GoatBridgeResponse> authenticateBiometric({
    String title = 'Authenticate',
    String subtitle = '',
  }) async {
    return await executeAction('BIOMETRIC_AUTH', {
      'title': title,
      'subtitle': subtitle,
    });
  }

  /// Launches native code scanner (Task 10103).
  Future<GoatBridgeResponse> scanCode({
    List<String> scanType = const ['QR_CODE'],
  }) async {
    return await executeAction('SCAN_CODE', {
      'scanType': scanType,
    });
  }

  /// Obtains active network connectivity telemetry (Task 10110).
  Future<GoatBridgeResponse> getNetworkType() async {
    return await executeAction('GET_NETWORK_TYPE');
  }

  /// Uploads local file in background (Task 10110).
  Future<GoatBridgeResponse> uploadFile({
    required String url,
    required String filePath,
    String name = 'file',
    Map<String, String>? formData,
  }) async {
    return await executeAction('UPLOAD_FILE', {
      'url': url,
      'filePath': filePath,
      'name': name,
      'formData': formData ?? {},
    });
  }

  /// Launches native system share sheet (Task 10128).
  Future<GoatBridgeResponse> shareSheet({
    String title = '',
    String text = '',
    String url = '',
    String mediaPath = '',
  }) async {
    return await executeAction('SHARE_SHEET', {
      'title': title,
      'text': text,
      'url': url,
      'mediaPath': mediaPath,
    });
  }

  /// Shares media to social story (Task 10128).
  Future<GoatBridgeResponse> shareToStory(String mediaPath) async {
    return await executeAction('SHARE_TO_STORY', {
      'mediaPath': mediaPath,
    });
  }

  /// Launches photo and video picker with compression (Task 10106).
  Future<GoatBridgeResponse> chooseMedia({
    int count = 9,
    List<String> mediaType = const ['image', 'video'],
    List<String> sourceType = const ['album', 'camera'],
  }) async {
    return await executeAction('CHOOSE_MEDIA', {
      'count': count,
      'mediaType': mediaType,
      'sourceType': sourceType,
    });
  }

  /// Opens gesture-zoomable fullscreen image previewer (Task 10106).
  Future<GoatBridgeResponse> previewImage({
    required List<String> urls,
    String current = '',
  }) async {
    return await executeAction('PREVIEW_IMAGE', {
      'urls': urls,
      'current':
          current.isNotEmpty ? current : (urls.isNotEmpty ? urls.first : ''),
    });
  }

  /// Starts background audio playback with lock-screen media notification (Task 10106).
  Future<GoatBridgeResponse> playAudio({
    required String src,
    String title = '',
    String singer = '',
  }) async {
    return await executeAction('AUDIO_PLAY', {
      'src': src,
      'title': title,
      'singer': singer,
    });
  }

  /// Pauses background audio playback (Task 10106).
  Future<GoatBridgeResponse> pauseAudio() async {
    return await executeAction('AUDIO_PAUSE');
  }

  /// Stops background audio playback (Task 10106).
  Future<GoatBridgeResponse> stopAudio() async {
    return await executeAction('AUDIO_STOP');
  }

  /// Seeks audio position in seconds (Task 10106).
  Future<GoatBridgeResponse> seekAudio(double position) async {
    return await executeAction('AUDIO_SEEK', {
      'position': position,
    });
  }

  /// Sets an AES-256-GCM hardware encrypted secure key-value pair (Task 10123).
  Future<GoatBridgeResponse> secureStorageSet(String key, String value,
      {String? appId}) async {
    return await executeAction('SECURE_STORAGE_SET', {
      'key': key,
      'value': value,
      if (appId != null) 'appId': appId,
    });
  }

  /// Retrieves an AES-256-GCM hardware encrypted secure key-value pair (Task 10123).
  Future<GoatBridgeResponse> secureStorageGet(String key,
      {String? appId}) async {
    return await executeAction('SECURE_STORAGE_GET', {
      'key': key,
      if (appId != null) 'appId': appId,
    });
  }

  /// Removes an AES-256-GCM hardware encrypted secure key-value pair (Task 10123).
  Future<GoatBridgeResponse> secureStorageRemove(String key,
      {String? appId}) async {
    return await executeAction('SECURE_STORAGE_REMOVE', {
      'key': key,
      if (appId != null) 'appId': appId,
    });
  }

  /// Clears all AES-256-GCM hardware encrypted key-value pairs for the tenant (Task 10123).
  Future<GoatBridgeResponse> secureStorageClear({String? appId}) async {
    return await executeAction('SECURE_STORAGE_CLEAR', {
      if (appId != null) 'appId': appId,
    });
  }

  /// Reports Core Web Vitals and bridge latency metrics (Task 10124).
  Future<GoatBridgeResponse> reportMetrics({
    double? fcpMs,
    double? lcpMs,
    double? inpMs,
    double? bridgeLatencyAvgMs,
  }) async {
    return await executeAction('REPORT_METRICS', {
      if (fcpMs != null) 'fcpMs': fcpMs,
      if (lcpMs != null) 'lcpMs': lcpMs,
      if (inpMs != null) 'inpMs': inpMs,
      if (bridgeLatencyAvgMs != null) 'bridgeLatencyAvgMs': bridgeLatencyAvgMs,
    });
  }

  /// Retrieves aggregated APM summary statistics (Task 10124).
  Future<GoatBridgeResponse> getApmMetrics() async {
    return await executeAction('GET_APM_METRICS');
  }

  /// Retrieves device push notification token (Task 10127).
  Future<GoatBridgeResponse> getPushToken() async {
    return await executeAction('PUSH_GET_TOKEN');
  }

  /// Requests push notification permission (Task 10127).
  Future<GoatBridgeResponse> requestPushPermission() async {
    return await executeAction('PUSH_REQUEST_PERMISSION');
  }

  /// Updates app icon badge count (Task 10127).
  Future<GoatBridgeResponse> setPushBadge(int count) async {
    return await executeAction('PUSH_SET_BADGE', {'count': count});
  }

  /// Displays local push notification banner (Task 10127).
  Future<GoatBridgeResponse> showPushNotification({
    required String title,
    required String content,
    String? channelId,
  }) async {
    return await executeAction('PUSH_SHOW_NOTIFICATION', {
      'title': title,
      'content': content,
      if (channelId != null) 'channelId': channelId,
    });
  }

  /// Starts Bluetooth Low Energy scanning (Task 10108).
  Future<GoatBridgeResponse> startBleScan({int timeoutMs = 10000}) async {
    return await executeAction('BLE_START_SCAN', {'timeoutMs': timeoutMs});
  }

  /// Stops Bluetooth Low Energy scanning (Task 10108).
  Future<GoatBridgeResponse> stopBleScan() async {
    return await executeAction('BLE_STOP_SCAN');
  }

  /// Connects to a remote BLE GATT peripheral (Task 10108).
  Future<GoatBridgeResponse> connectBle(String deviceId) async {
    return await executeAction('BLE_CONNECT', {'deviceId': deviceId});
  }

  /// Reads a BLE GATT characteristic (Task 10108).
  Future<GoatBridgeResponse> readBleCharacteristic(
      String deviceId, String characteristicUuid) async {
    return await executeAction('BLE_READ_CHARACTERISTIC', {
      'deviceId': deviceId,
      'characteristicUuid': characteristicUuid,
    });
  }

  /// Writes a BLE GATT characteristic (Task 10108).
  Future<GoatBridgeResponse> writeBleCharacteristic(
      String deviceId, String characteristicUuid, String value) async {
    return await executeAction('BLE_WRITE_CHARACTERISTIC', {
      'deviceId': deviceId,
      'characteristicUuid': characteristicUuid,
      'value': value,
    });
  }

  /// Reads an NFC NDEF tag message (Task 10108).
  Future<GoatBridgeResponse> readNfcTag() async {
    return await executeAction('NFC_READ_TAG');
  }

  /// Writes an NDEF record to an NFC tag (Task 10108).
  Future<GoatBridgeResponse> writeNfcTag(String payload) async {
    return await executeAction('NFC_WRITE_TAG', {'payload': payload});
  }

  /// Securely picks a contact from address book (Task 10129).
  Future<GoatBridgeResponse> chooseContact() async {
    return await executeAction('CHOOSE_CONTACT');
  }

  /// Starts a background geofence (Task 10129).
  Future<GoatBridgeResponse> startGeofence(
    String geofenceId,
    double latitude,
    double longitude, {
    double radiusMeters = 100.0,
    String transitionType = 'BOTH',
  }) async {
    return await executeAction('START_GEOFENCE', {
      'geofenceId': geofenceId,
      'latitude': latitude,
      'longitude': longitude,
      'radiusMeters': radiusMeters,
      'transitionType': transitionType,
    });
  }

  /// Stops a background geofence (Task 10129).
  Future<GoatBridgeResponse> stopGeofence(String geofenceId) async {
    return await executeAction('STOP_GEOFENCE', {'geofenceId': geofenceId});
  }

  /// Lists all active registered geofences (Task 10129).
  Future<GoatBridgeResponse> listGeofences() async {
    return await executeAction('LIST_GEOFENCES');
  }

  /// Connects to a Web3 crypto wallet (Task 10120).
  Future<GoatBridgeResponse> web3ConnectWallet({
    String network = 'ton-mainnet',
    String? manifestUrl,
  }) async {
    return await executeAction('WEB3_CONNECT_WALLET', {
      'network': network,
      if (manifestUrl != null) 'manifestUrl': manifestUrl,
    });
  }

  /// Signs a crypto transaction with native gas confirmation (Task 10120).
  Future<GoatBridgeResponse> web3SignTransaction({
    required String to,
    required String amount,
    String? payload,
  }) async {
    return await executeAction('WEB3_SIGN_TRANSACTION', {
      'to': to,
      'amount': amount,
      if (payload != null) 'payload': payload,
    });
  }

  /// Signs an off-chain message: `personal_sign`, or EIP-712 typed data via
  /// `eth_signTypedData_v4`.
  ///
  /// Gesture-gated on both platforms. An off-chain Permit2 allowance can drain a wallet without
  /// ever producing a transaction, so this is gated exactly like [web3SignTransaction].
  Future<GoatBridgeResponse> web3SignMessage({
    required String message,
    String messageType = 'personal_sign',
    String? chainFamily,
    String? network,
  }) async {
    return await executeAction('WEB3_SIGN_MESSAGE', {
      'message': message,
      'messageType': messageType,
      if (chainFamily != null) 'chainFamily': chainFamily,
      if (network != null) 'network': network,
    });
  }

  /// Switches the connected wallet session to another chain (EIP-1193
  /// `wallet_switchEthereumChain`). Accepts a bare id ("137") or CAIP-2 ("eip155:137").
  Future<GoatBridgeResponse> web3SwitchChain({
    required String chainId,
    String? chainFamily,
    Map<String, dynamic>? addChainParams,
  }) async {
    return await executeAction('WEB3_SWITCH_CHAIN', {
      'chainId': chainId,
      if (chainFamily != null) 'chainFamily': chainFamily,
      if (addChainParams != null) 'addChainParams': addChainParams,
    });
  }

  /// Reports whether this device can run a W3C WebAuthn passkey ceremony, and which hardware
  /// vault mode is available.
  Future<GoatBridgeResponse> passkeyCheckSupport() async {
    return await executeAction('PASSKEY_CHECK_SUPPORT');
  }

  /// Runs a WebAuthn registration ceremony against the platform authenticator.
  ///
  /// [rpId] must be declared in the mini-app manifest under `security.allowedRpIds`, or native
  /// rejects with `RP_ID_NOT_ALLOWED` — every tenant shares one virtual origin, so that list is
  /// the only thing separating them.
  Future<GoatBridgeResponse> passkeyRegister({
    required String optionsJson,
    String? rpId,
  }) async {
    return await executeAction('PASSKEY_REGISTER', {
      'optionsJson': optionsJson,
      if (rpId != null) 'rpId': rpId,
    });
  }

  /// Runs a WebAuthn assertion ceremony. `clientExtensionResults.prf` is stripped natively and
  /// can never be read from Dart.
  Future<GoatBridgeResponse> passkeyAssert({
    required String optionsJson,
    String? rpId,
  }) async {
    return await executeAction('PASSKEY_ASSERT', {
      'optionsJson': optionsJson,
      if (rpId != null) 'rpId': rpId,
    });
  }

  /// Encrypts [plaintext] with a hardware-anchored AES-256-GCM key derived entirely inside
  /// native memory. Returns a ciphertext envelope carrying no key material.
  Future<GoatBridgeResponse> vaultEncrypt({
    required String vaultId,
    required String plaintext,
  }) async {
    return await executeAction('VAULT_ENCRYPT', {
      'vaultId': vaultId,
      'plaintext': plaintext,
    });
  }

  /// Decrypts a vault envelope natively and returns only the plaintext. The key is bound to
  /// `appId` + [vaultId], so an envelope from another mini-app can never be opened.
  Future<GoatBridgeResponse> vaultDecrypt({
    required String vaultId,
    required Map<String, dynamic> envelope,
  }) async {
    return await executeAction('VAULT_DECRYPT', {
      'vaultId': vaultId,
      'envelope': envelope,
    });
  }

  /// Disconnects active Web3 wallet session (Task 10120).
  Future<GoatBridgeResponse> web3Disconnect() async {
    return await executeAction('WEB3_DISCONNECT');
  }

  /// Retrieves active Web3 account session (Task 10120).
  Future<GoatBridgeResponse> web3GetAccount() async {
    return await executeAction('WEB3_GET_ACCOUNT');
  }

  /// Opens an in-app checkout invoice sheet (Task 10121).
  Future<GoatBridgeResponse> openInvoice({
    required String invoiceSlug,
    required String title,
    required int amount,
    String currency = 'USD',
  }) async {
    return await executeAction('OPEN_INVOICE', {
      'invoiceSlug': invoiceSlug,
      'title': title,
      'amount': amount,
      'currency': currency,
    });
  }

  /// Retrieves in-app purchase product catalog (Task 10121).
  Future<GoatBridgeResponse> getPurchaseProducts(
      {List<String>? productIds}) async {
    return await executeAction('GET_PURCHASE_PRODUCTS', {
      if (productIds != null) 'productIds': productIds,
    });
  }

  /// Restores active in-app purchases (Task 10121).
  Future<GoatBridgeResponse> restorePurchases() async {
    return await executeAction('RESTORE_PURCHASES');
  }

  /// Creates a dedicated binary port channel (Task 10130).
  Future<GoatBridgeResponse> createBinaryPort(String portId) async {
    return await executeAction('CREATE_BINARY_PORT', {'portId': portId});
  }

  /// Posts a Base64-encoded binary message packet (Task 10130).
  Future<GoatBridgeResponse> postBinaryMessage(
      String portId, String dataBase64) async {
    return await executeAction('POST_BINARY_MESSAGE', {
      'portId': portId,
      'dataBase64': dataBase64,
    });
  }

  /// Reads a binary message packet from port (Task 10130).
  Future<GoatBridgeResponse> readBinaryMessage(String portId) async {
    return await executeAction('READ_BINARY_MESSAGE', {'portId': portId});
  }

  /// Closes a binary port channel (Task 10130).
  Future<GoatBridgeResponse> closeBinaryPort(String portId) async {
    return await executeAction('CLOSE_BINARY_PORT', {'portId': portId});
  }

  /// Verifies an SSL public key SHA-256 pin (Task 10131).
  Future<GoatBridgeResponse> verifySslPin(
      String hostname, String pinSha256) async {
    return await executeAction('VERIFY_SSL_PIN', {
      'hostname': hostname,
      'pinSha256': pinSha256,
    });
  }

  /// Audits network certificate for security compliance (Task 10131).
  Future<GoatBridgeResponse> auditNetworkCertificate(String url) async {
    return await executeAction('AUDIT_NETWORK_CERTIFICATE', {'url': url});
  }

  /// Checks if a permission scope is granted (Task 10101).
  Future<GoatBridgeResponse> checkPermission(String scope,
      {String appId = 'default'}) async {
    return await executeAction(
        'CHECK_PERMISSION', {'scope': scope, 'appId': appId});
  }

  /// Requests authorization for a permission scope (Task 10101).
  Future<GoatBridgeResponse> requestPermission(String scope,
      {String appId = 'default'}) async {
    return await executeAction(
        'REQUEST_PERMISSION', {'scope': scope, 'appId': appId});
  }

  /// Retrieves authorization settings for a mini-app (Task 10101).
  Future<GoatBridgeResponse> getSetting({String appId = 'default'}) async {
    return await executeAction('GET_SETTING', {'appId': appId});
  }

  /// Opens authorization settings modal (Task 10101).
  Future<GoatBridgeResponse> openSetting({String appId = 'default'}) async {
    return await executeAction('OPEN_SETTING', {'appId': appId});
  }

  /// Directly updates authorization status for a scope (Task 10101).
  Future<GoatBridgeResponse> authorize(String scope,
      {String appId = 'default', bool granted = true}) async {
    return await executeAction(
        'AUTHORIZE', {'scope': scope, 'appId': appId, 'granted': granted});
  }

  /// Gets current IME keyboard insets state (Task 10068).
  Future<GoatBridgeResponse> getKeyboardInsets() async {
    return await executeAction('GET_KEYBOARD_INSETS');
  }

  /// Sets or updates IME keyboard insets (Task 10068).
  Future<GoatBridgeResponse> setKeyboardInsets(int heightPx,
      {int durationMs = 250}) async {
    return await executeAction('SET_KEYBOARD_INSETS',
        {'heightPx': heightPx, 'durationMs': durationMs});
  }

  /// Updates predictive back gesture tracking progress (Task 10126).
  Future<GoatBridgeResponse> predictiveBackProgress(
    double progress, {
    double touchX = 0,
    double touchY = 0,
    int swipeEdge = 0,
  }) async {
    return await executeAction('PREDICTIVE_BACK_PROGRESS', {
      'progress': progress,
      'touchX': touchX,
      'touchY': touchY,
      'swipeEdge': swipeEdge,
    });
  }

  /// Commits predictive back navigation (Task 10126).
  Future<GoatBridgeResponse> predictiveBackInvoke() async {
    return await executeAction('PREDICTIVE_BACK_INVOKE');
  }

  /// Cancels predictive back navigation (Task 10126).
  Future<GoatBridgeResponse> predictiveBackCancel() async {
    return await executeAction('PREDICTIVE_BACK_CANCEL');
  }

  /// Validates WebAssembly SIMD and WebWorker capabilities (Task 10132).
  Future<GoatBridgeResponse> validateWasmSupport() async {
    return await executeAction('VALIDATE_WASM_SUPPORT');
  }

  /// Audits sandbox isolation response headers (Task 10132).
  Future<GoatBridgeResponse> auditSandboxHeaders(
      Map<String, String> headers) async {
    return await executeAction('AUDIT_SANDBOX_HEADERS', {'headers': headers});
  }

  /// Precompiles JavaScript bundle to V8 bytecode cache (Task 10084).
  Future<GoatBridgeResponse> precompileBytecode(String bundlePath,
      {String appId = 'default'}) async {
    return await executeAction(
        'PRECOMPILE_BYTECODE', {'bundlePath': bundlePath, 'appId': appId});
  }

  /// Checks if V8 bytecode cache is warm (Task 10084).
  Future<GoatBridgeResponse> isBytecodeWarm({String appId = 'default'}) async {
    return await executeAction('IS_BYTECODE_WARM', {'appId': appId});
  }

  /// Retrieves global V8 bytecode cache statistics (Task 10084).
  Future<GoatBridgeResponse> getBytecodeStats() async {
    return await executeAction('GET_BYTECODE_STATS');
  }

  /// Resolves active file chooser with selected URIs (Task 10076).
  Future<GoatBridgeResponse> chooseFiles(List<String> uris) async {
    return await executeAction('CHOOSE_FILES', {'uris': uris});
  }

  /// Cancels active file chooser interaction (Task 10076).
  Future<GoatBridgeResponse> cancelFileChooser() async {
    return await executeAction('CANCEL_FILE_CHOOSER');
  }

  /// Checks if web history can rewind (Task 10094).
  Future<GoatBridgeResponse> canGoBackInHistory() async {
    return await executeAction('CAN_GO_BACK');
  }

  /// Handles hardware back press or gesture pop (Task 10094).
  Future<GoatBridgeResponse> handleBackPress() async {
    return await executeAction('HANDLE_BACK_PRESS');
  }

  /// Pushes a virtual route to history stack (Task 10094).
  Future<GoatBridgeResponse> pushHistoryState(String route) async {
    return await executeAction('PUSH_HISTORY_STATE', {'route': route});
  }

  /// Configures transparent canvas and background color (Task 10113).
  Future<GoatBridgeResponse> configureTransparency(bool isTransparent,
      {String? customBgHex}) async {
    return await executeAction('CONFIGURE_TRANSPARENCY', {
      'isTransparent': isTransparent,
      if (customBgHex != null) 'customBgHex': customBgHex,
    });
  }

  /// Synchronizes theme background to avoid white flash (Task 10113).
  Future<GoatBridgeResponse> syncThemeBackground(bool isDark) async {
    return await executeAction('SYNC_THEME_BACKGROUND', {'isDark': isDark});
  }

  /// Retrieves current render layer configuration (Task 10113).
  Future<GoatBridgeResponse> getRenderLayerConfig() async {
    return await executeAction('GET_RENDER_LAYER_CONFIG');
  }

  /// Updates scroll offset & boundaries for gesture conflict resolution (Task 10079).
  Future<GoatBridgeResponse> updateGestureScrollPosition(
      int scrollY, int maxScrollY,
      {String direction = 'VERTICAL'}) async {
    return await executeAction('GESTURE_SCROLL_UPDATE', {
      'scrollY': scrollY,
      'maxScrollY': maxScrollY,
      'direction': direction,
    });
  }

  /// Checks if parent container should intercept touches (Task 10079).
  Future<GoatBridgeResponse> shouldParentInterceptTouch(double deltaY,
      {bool isOverscrollAllowed = false}) async {
    return await executeAction('SHOULD_PARENT_INTERCEPT', {
      'deltaY': deltaY,
      'isOverscrollAllowed': isOverscrollAllowed,
    });
  }

  /// Pushes a page onto the multi-WebView stack (Task 10091).
  Future<GoatBridgeResponse> navPush(String route, {String title = ''}) async {
    return await executeAction('NAV_PUSH', {'route': route, 'title': title});
  }

  /// Pops the top page from the stack (Task 10091).
  Future<GoatBridgeResponse> navPop() async {
    return await executeAction('NAV_POP');
  }

  /// Pops all pages to root (Task 10091).
  Future<GoatBridgeResponse> navPopToRoot() async {
    return await executeAction('NAV_POP_TO_ROOT');
  }

  /// Retrieves full multi-WebView page stack (Task 10091).
  Future<GoatBridgeResponse> getPageStack() async {
    return await executeAction('GET_PAGE_STACK');
  }

  /// Dynamically loads a subpackage module (Task 10092).
  Future<GoatBridgeResponse> loadSubpackage(String subpackageName,
      {String appId = 'default'}) async {
    return await executeAction(
        'LOAD_SUBPACKAGE', {'subpackageName': subpackageName, 'appId': appId});
  }

  /// Checks if a subpackage is cached (Task 10092).
  Future<GoatBridgeResponse> isSubpackageCached(String subpackageName,
      {String appId = 'default'}) async {
    return await executeAction('IS_SUBPACKAGE_CACHED',
        {'subpackageName': subpackageName, 'appId': appId});
  }

  /// Embeds a same-layer native component (Task 10100 & Compositing Engine).
  Future<GoatBridgeResponse> embedNativeView(
    String componentId,
    String componentType, {
    double x = 0,
    double y = 0,
    double width = 360,
    double height = 240,
    int zIndex = 0,
    double opacity = 1.0,
    double cornerRadius = 0.0,
  }) async {
    return await executeAction('EMBED_NATIVE_VIEW', {
      'componentId': componentId,
      'componentType': componentType,
      'x': x,
      'y': y,
      'width': width,
      'height': height,
      'zIndex': zIndex,
      'opacity': opacity,
      'cornerRadius': cornerRadius,
    });
  }

  /// Updates bounds and clipping for an embedded same-layer native component.
  Future<GoatBridgeResponse> updateNativeViewBounds(
    String componentId, {
    double x = 0,
    double y = 0,
    double width = 360,
    double height = 240,
    int zIndex = 0,
    double opacity = 1.0,
    double cornerRadius = 0.0,
    bool isVisible = true,
  }) async {
    return await executeAction('UPDATE_NATIVE_VIEW_BOUNDS', {
      'componentId': componentId,
      'x': x,
      'y': y,
      'width': width,
      'height': height,
      'zIndex': zIndex,
      'opacity': opacity,
      'cornerRadius': cornerRadius,
      'isVisible': isVisible,
    });
  }

  /// Removes an embedded same-layer native component (Task 10100).
  Future<GoatBridgeResponse> removeNativeView(String componentId) async {
    return await executeAction(
        'REMOVE_NATIVE_VIEW', {'componentId': componentId});
  }

  /// Retrieves all supported API capabilities (Task 10102).
  Future<GoatBridgeResponse> getApiCapabilities({String? category}) async {
    return await executeAction('GET_API_CAPABILITIES', {
      if (category != null) 'category': category,
    });
  }

  /// Retrieves isolated sub-process sandbox status (Task 10090).
  Future<GoatBridgeResponse> getSandboxProcessStatus() async {
    return await executeAction('GET_SANDBOX_PROCESS_STATUS');
  }

  /// Retrieves startup Macrobenchmark SLA compliance report (Task 10085).
  Future<GoatBridgeResponse> getStartupBenchmarkReport() async {
    return await executeAction('GET_STARTUP_BENCHMARK_REPORT');
  }

  // --- Milestone 2/3 UI Subsystem Methods ---

  /// Sets the native navigation bar title and subtitle.
  Future<GoatBridgeResponse> setNavBarTitle(String title,
      {String? subtitle}) async {
    return await executeAction('SET_NAV_BAR_TITLE', {
      'title': title,
      if (subtitle != null) 'subtitle': subtitle,
    });
  }

  /// Sets the native navigation bar background and text color.
  Future<GoatBridgeResponse> setNavBarColor({
    required String backgroundColor,
    String? textColor,
    bool isDark = false,
  }) async {
    return await executeAction('SET_NAV_BAR_COLOR', {
      'backgroundColor': backgroundColor,
      if (textColor != null) 'textColor': textColor,
      'isDark': isDark,
    });
  }

  /// Sets the native navigation bar buttons.
  Future<GoatBridgeResponse> setNavBarButtons({
    String? left,
    List<String>? right,
  }) async {
    return await executeAction('SET_NAV_BAR_BUTTONS', {
      if (left != null) 'left': left,
      if (right != null) 'right': right,
    });
  }

  /// Sets the native navigation bar indeterminate progress indicator.
  Future<GoatBridgeResponse> setNavBarProgress({
    required bool visible,
    int? progress,
  }) async {
    return await executeAction('SET_NAV_BAR_PROGRESS', {
      'visible': visible,
      if (progress != null) 'progress': progress,
    });
  }

  /// Expands the native bottom sheet container.
  Future<GoatBridgeResponse> expandBottomSheet([double? snapPoint]) async {
    return await executeAction('EXPAND_BOTTOM_SHEET', {
      if (snapPoint != null) 'snapPoint': snapPoint,
    });
  }

  /// Collapses the native bottom sheet container.
  Future<GoatBridgeResponse> collapseBottomSheet() async {
    return await executeAction('COLLAPSE_BOTTOM_SHEET');
  }

  /// Sets snap points configuration for the native bottom sheet.
  Future<GoatBridgeResponse> setSheetSnapPoints(
    List<double> snapPoints, {
    double initialSnap = 0.5,
    bool isDismissible = true,
  }) async {
    return await executeAction('SET_SHEET_SNAP_POINTS', {
      'snapPoints': snapPoints,
      'initialSnap': initialSnap,
      'isDismissible': isDismissible,
    });
  }

  /// Retrieves safe area insets of the active WebView container.
  Future<GoatSafeAreaInsets> getSafeAreaInsets() async {
    final res = await executeAction('GET_SAFE_AREA_INSETS');
    if (res.success && res.data is Map) {
      return GoatSafeAreaInsets.fromMap(
          Map<String, dynamic>.from(res.data as Map));
    }
    return const GoatSafeAreaInsets();
  }

  /// Retrieves comprehensive device telemetry and hardware specifications (Task 10203 / R3).
  Future<GoatDeviceInfo> getDeviceInfo() async {
    final res = await executeAction('GET_DEVICE_INFO');
    if (res.success && res.data is Map) {
      return GoatDeviceInfo.fromMap(Map<String, dynamic>.from(res.data as Map));
    }
    return const GoatDeviceInfo();
  }

  /// Retrieves stable, install-scoped anonymous GUID (Task 10203 / R2 & R3).
  Future<String> getInstallGuid() async {
    final info = await getDeviceInfo();
    return info.installGuid;
  }

  /// Triggers a native haptic feedback vibration.
  Future<GoatBridgeResponse> triggerHapticFeedback({
    required String type,
    String? style,
    String? notificationType,
  }) async {
    return await executeAction('HAPTIC_FEEDBACK', {
      'type': type,
      if (style != null) 'style': style,
      if (notificationType != null) 'notificationType': notificationType,
    });
  }

  /// Triggers an impact haptic waveform.
  Future<GoatBridgeResponse> impactHaptic([String style = 'medium']) =>
      triggerHapticFeedback(type: 'impact', style: style);

  /// Triggers a notification haptic waveform.
  Future<GoatBridgeResponse> notificationHaptic([String type = 'success']) =>
      triggerHapticFeedback(type: 'notification', notificationType: type);

  /// Triggers a selection click haptic waveform.
  Future<GoatBridgeResponse> selectionHaptic() =>
      triggerHapticFeedback(type: 'selection');

  /// Opens a cross-mini-app session with optional window configuration and JSAPI aliasing (Task 10201).
  Future<GoatBridgeResponse> openMiniApp({
    required String targetAppId,
    String presentation = 'WINDOWED',
    Map<String, dynamic>? params,
    Map<String, dynamic>? windowConfig,
    Map<String, String>? jsApiAlias,
  }) async {
    return await executeAction('OPEN_MINI_APP', {
      'targetAppId': targetAppId,
      'presentation': presentation,
      if (params != null) 'params': params,
      if (windowConfig != null) 'windowConfig': windowConfig,
      if (jsApiAlias != null) 'jsApiAlias': jsApiAlias,
    });
  }

  /// Closes an active cross-mini-app session (Task 10201).
  Future<GoatBridgeResponse> closeMiniApp({
    String? instanceId,
    Map<String, dynamic>? result,
  }) async {
    return await executeAction('CLOSE_MINI_APP', {
      if (instanceId != null) 'instanceId': instanceId,
      if (result != null) 'result': result,
    });
  }

  /// Dispatches an AppService Worker ready lifecycle signal (Task F9).
  Future<GoatBridgeResponse> notifyAppServiceReady({
    String appId = 'default',
    Map<String, dynamic>? details,
  }) async {
    return await executeAction('ON_APP_SERVICE_READY', {
      'appId': appId,
      if (details != null) 'details': details,
    });
  }

  /// Dispatches an AppService Worker crash lifecycle signal (Task F9).
  Future<GoatBridgeResponse> notifyAppServiceCrash({
    String appId = 'default',
    required String error,
    Map<String, dynamic>? details,
  }) async {
    return await executeAction('ON_APP_SERVICE_CRASH', {
      'appId': appId,
      'error': error,
      if (details != null) 'details': details,
    });
  }

  /// Dispatches an AppService Worker terminate lifecycle signal (Task F9).
  Future<GoatBridgeResponse> notifyAppServiceTerminate({
    String appId = 'default',
    Map<String, dynamic>? details,
  }) async {
    return await executeAction('ON_APP_SERVICE_TERMINATE', {
      'appId': appId,
      if (details != null) 'details': details,
    });
  }

  /// Configures default popup window routing policy dynamically (Task 10183 / R2).
  Future<void> setPopupRoutingPolicy(GoatPopupRoutingPolicy policy) async {
    await _channel.invokeMethod<void>('setPopupRoutingPolicy', {
      'policy': policy.name,
    });
  }

  /// Disposes controller streams and unbinds method channel listener.
  void dispose() {
    if (_isDisposed) return;
    _isDisposed = true;
    _channel.setMethodCallHandler(null);
    _bridgeMessageStreamCtrl?.close();
    _downloadProgressStreamCtrl?.close();
    _progressStreamCtrl?.close();
    _pageStartedStreamCtrl?.close();
    _pageFinishedStreamCtrl?.close();
    _safeAreaStreamCtrl?.close();
    _keyboardInsetsStreamCtrl?.close();
    _miniAppClosedStreamCtrl?.close();
    _appServiceReadyStreamCtrl?.close();
    _appServiceCrashStreamCtrl?.close();
    _appServiceTerminateStreamCtrl?.close();
    _popupRequestStreamCtrl?.close();
    _externalNavigationStreamCtrl?.close();
    _receivedErrorStreamCtrl?.close();
    _receivedHttpErrorStreamCtrl?.close();
    _pageCommitVisibleStreamCtrl?.close();
    _loadResourceStreamCtrl?.close();
    _updateVisitedHistoryStreamCtrl?.close();
    _consoleMessageStreamCtrl?.close();
    _pullToRefreshStreamCtrl?.close();
  }
}
