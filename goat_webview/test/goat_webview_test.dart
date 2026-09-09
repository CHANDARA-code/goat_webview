import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:goat_webview/goat_webview.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('GoatBridgeMessage Serialization', () {
    test('serializes and deserializes message correctly', () {
      final msg = GoatBridgeMessage(
        id: 'req_123',
        action: 'STORAGE_SET',
        payload: {'key': 'theme', 'value': 'dark'},
      );

      final jsonStr = msg.toJson();
      final parsed = GoatBridgeMessage.fromJson(jsonStr);

      expect(parsed.id, equals('req_123'));
      expect(parsed.action, equals('STORAGE_SET'));
      expect(parsed.payload['key'], equals('theme'));
      expect(parsed.payload['value'], equals('dark'));
    });

    test('parses success response correctly', () {
      final map = {
        'id': 'req_456',
        'success': true,
        'data': {'battery': 99},
        'error': null,
      };

      final response = GoatBridgeResponse.fromMap(map);
      expect(response.id, equals('req_456'));
      expect(response.success, isTrue);
      expect(response.data['battery'], equals(99));
      expect(response.error, isNull);
    });

    test('parses error response correctly', () {
      final map = {
        'id': 'req_789',
        'success': false,
        'data': null,
        'error': 'Unsupported action',
      };

      final response = GoatBridgeResponse.fromMap(map);
      expect(response.id, equals('req_789'));
      expect(response.success, isFalse);
      expect(response.error, equals('Unsupported action'));
    });
  });

  group('GoatWebViewController Method Channel tests', () {
    const channelName = 'com.goat.webview/bridge_0';
    final List<MethodCall> log = <MethodCall>[];

    setUp(() {
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(
        const MethodChannel(channelName),
        (MethodCall methodCall) async {
          log.add(methodCall);
          switch (methodCall.method) {
            case 'evaluateJavascript':
              return 'evaluated_result';
            case 'goBack':
              return true;
            case 'reload':
              return null;
            case 'pause':
              return true;
            case 'resume':
              return true;
            case 'setTheme':
              return true;
            case 'prewarm':
              return true;
            case 'executeAction':
              final action = (methodCall.arguments as Map)['action'];
              if (action == 'GET_SCREEN_BRIGHTNESS') {
                return {
                  'id': 'req_exec_1',
                  'success': true,
                  'data': {'value': 0.8},
                };
              }
              return {
                'id': 'req_exec_1',
                'success': true,
                'data': {'status': 'ok'},
              };
            case 'callJs':
              return {
                'id': 'req_js_1',
                'success': true,
                'data': {'status': 'ok'},
              };
            default:
              return null;
          }
        },
      );
    });

    tearDown(() {
      log.clear();
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(
        const MethodChannel(channelName),
        null,
      );
    });

    test('evaluates javascript code', () async {
      final controller = GoatWebViewController(viewId: 0);
      final res = await controller.evaluateJavascript("console.log('test')");

      expect(res, equals('evaluated_result'));
      expect(log.length, equals(1));
      expect(log.first.method, equals('evaluateJavascript'));
      controller.dispose();
    });

    test('executes callJs, executeAction, setTheme, prewarm, pause and resume', () async {
      final controller = GoatWebViewController(viewId: 0);
      final jsRes = await controller.callJs('PING');
      final execRes = await controller.executeAction('PING');
      final themeRes = await controller.setTheme(true);
      final prewarmRes = await controller.prewarm();
      final pauseRes = await controller.pause();
      final resumeRes = await controller.resume();

      expect(jsRes.success, isTrue);
      expect(execRes.success, isTrue);
      expect(themeRes, isTrue);
      expect(prewarmRes, isTrue);
      expect(pauseRes, isTrue);
      expect(resumeRes, isTrue);
      controller.dispose();
    });

    test('navigates back', () async {
      final controller = GoatWebViewController(viewId: 0);
      final canGoBack = await controller.goBack();

      expect(canGoBack, isTrue);
      expect(log.last.method, equals('goBack'));
      controller.dispose();
    });

    test('reloads webview', () async {
      final controller = GoatWebViewController(viewId: 0);
      await controller.reload();

      expect(log.last.method, equals('reload'));
      controller.dispose();
    });

    test('receives onBridgeMessage and onDownloadProgress via event stream', () async {
      final controller = GoatWebViewController(viewId: 0);
      final bridgeMessages = <GoatBridgeMessage>[];
      final progressUpdates = <Map<String, dynamic>>[];

      final sub1 = controller.onBridgeMessage.listen(bridgeMessages.add);
      final sub2 = controller.onDownloadProgress.listen(progressUpdates.add);

      const codec = StandardMethodCodec();
      final ByteData bridgeCall = codec.encodeMethodCall(const MethodCall('onBridgeMessage', {
        'id': 'msg_001',
        'action': 'CUSTOM_EVENT',
        'payload': {'status': 'active'},
      }));
      await TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .handlePlatformMessage(channelName, bridgeCall, (ByteData? reply) {});

      final ByteData progressCall = codec.encodeMethodCall(const MethodCall('onDownloadProgress', {
        'downloadId': 101,
        'bytesRead': 500,
        'totalBytes': 1000,
      }));
      await TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .handlePlatformMessage(channelName, progressCall, (ByteData? reply) {});

      await Future<void>.delayed(Duration.zero);

      expect(bridgeMessages.length, equals(1));
      expect(bridgeMessages.first.id, equals('msg_001'));
      expect(bridgeMessages.first.action, equals('CUSTOM_EVENT'));
      expect(bridgeMessages.first.payload['status'], equals('active'));

      expect(progressUpdates.length, equals(1));
      expect(progressUpdates.first['downloadId'], equals(101));
      expect(progressUpdates.first['bytesRead'], equals(500));

      await sub1.cancel();
      await sub2.cancel();
      controller.dispose();
    });

    test('invokes showToast, showModal, showActionSheet, and canIUse', () async {
      final controller = GoatWebViewController(viewId: 0);

      final toastRes = await controller.showToast(title: 'Saved', icon: 'success', duration: 2000);
      expect(toastRes.success, isTrue);
      expect(log.last.method, equals('executeAction'));
      expect(log.last.arguments['action'], equals('SHOW_TOAST'));

      final modalRes = await controller.showModal(
        title: 'Delete',
        content: 'Confirm delete item?',
        showCancel: true,
      );
      expect(modalRes.success, isTrue);
      expect(log.last.method, equals('executeAction'));
      expect(log.last.arguments['action'], equals('SHOW_MODAL'));

      final sheetRes = await controller.showActionSheet(itemList: ['A', 'B']);
      expect(sheetRes.success, isTrue);
      expect(log.last.method, equals('executeAction'));
      expect(log.last.arguments['action'], equals('SHOW_ACTION_SHEET'));

      final isSupported = await controller.canIUse('SHOW_TOAST');
      expect(isSupported, isFalse); // Mock returned {'status': 'ok'} without 'supported' bool

      controller.dispose();
    });

    test('invokes screen and telephony methods (Task 10104)', () async {
      final controller = GoatWebViewController(viewId: 0);

      final brightnessRes = await controller.setScreenBrightness(0.9);
      expect(brightnessRes.success, isTrue);
      expect(log.last.arguments['action'], equals('SET_SCREEN_BRIGHTNESS'));

      final getBrightness = await controller.getScreenBrightness();
      expect(getBrightness, equals(0.8));

      final keepOnRes = await controller.setKeepScreenOn(true);
      expect(keepOnRes.success, isTrue);
      expect(log.last.arguments['action'], equals('SET_KEEP_SCREEN_ON'));

      final callRes = await controller.makePhoneCall('+18005550199');
      expect(callRes.success, isTrue);
      expect(log.last.arguments['action'], equals('MAKE_PHONE_CALL'));

      final smsRes = await controller.sendSms('+18005550199', 'Test message');
      expect(smsRes.success, isTrue);
      expect(log.last.arguments['action'], equals('SEND_SMS'));

      controller.dispose();
    });

    test('invokes location and map methods (Task 10107)', () async {
      final controller = GoatWebViewController(viewId: 0);

      final getLocRes = await controller.getLocation(type: 'gcj02', highAccuracy: true);
      expect(getLocRes.success, isTrue);
      expect(log.last.arguments['action'], equals('GET_LOCATION'));

      final chooseLocRes = await controller.chooseLocation();
      expect(chooseLocRes.success, isTrue);
      expect(log.last.arguments['action'], equals('CHOOSE_LOCATION'));

      final openLocRes = await controller.openLocation(
        latitude: 37.7749,
        longitude: -122.4194,
        name: 'Headquarters',
      );
      expect(openLocRes.success, isTrue);
      expect(log.last.arguments['action'], equals('OPEN_LOCATION'));

      controller.dispose();
    });

    test('invokes biometrics, network, and sharing methods (Tasks 10103, 10110, 10128)', () async {
      final controller = GoatWebViewController(viewId: 0);

      // Biometrics & Scanner
      final bioCheck = await controller.checkBiometricSupport();
      expect(bioCheck.success, isTrue);
      expect(log.last.arguments['action'], equals('CHECK_BIOMETRIC_SUPPORT'));

      final bioAuth = await controller.authenticateBiometric(title: 'Auth');
      expect(bioAuth.success, isTrue);
      expect(log.last.arguments['action'], equals('BIOMETRIC_AUTH'));

      final scan = await controller.scanCode(scanType: ['QR_CODE']);
      expect(scan.success, isTrue);
      expect(log.last.arguments['action'], equals('SCAN_CODE'));

      // Network & Upload
      final net = await controller.getNetworkType();
      expect(net.success, isTrue);
      expect(log.last.arguments['action'], equals('GET_NETWORK_TYPE'));

      final upload = await controller.uploadFile(url: 'https://api.io/up', filePath: '/cache/a.png');
      expect(upload.success, isTrue);
      expect(log.last.arguments['action'], equals('UPLOAD_FILE'));

      // Sharing
      final share = await controller.shareSheet(title: 'Deal', url: 'https://goat.io');
      expect(share.success, isTrue);
      expect(log.last.arguments['action'], equals('SHARE_SHEET'));

      final story = await controller.shareToStory('/cache/story.jpg');
      expect(story.success, isTrue);
      expect(log.last.arguments['action'], equals('SHARE_TO_STORY'));

      // Media Picker & Audio (Task 10106)
      final media = await controller.chooseMedia(count: 2);
      expect(media.success, isTrue);
      expect(log.last.arguments['action'], equals('CHOOSE_MEDIA'));

      final preview = await controller.previewImage(urls: ['https://cdn.io/a.jpg']);
      expect(preview.success, isTrue);
      expect(log.last.arguments['action'], equals('PREVIEW_IMAGE'));

      final play = await controller.playAudio(src: 'https://cdn.io/t.mp3', title: 'Pod');
      expect(play.success, isTrue);
      expect(log.last.arguments['action'], equals('AUDIO_PLAY'));

      final pause = await controller.pauseAudio();
      expect(pause.success, isTrue);
      expect(log.last.arguments['action'], equals('AUDIO_PAUSE'));

      final seek = await controller.seekAudio(30.0);
      expect(seek.success, isTrue);
      expect(log.last.arguments['action'], equals('AUDIO_SEEK'));

      final stop = await controller.stopAudio();
      expect(stop.success, isTrue);
      expect(log.last.arguments['action'], equals('AUDIO_STOP'));

      // Secure Storage at Rest (Task 10123)
      final secSet = await controller.secureStorageSet('auth_jwt', 'token_123');
      expect(secSet.success, isTrue);
      expect(log.last.arguments['action'], equals('SECURE_STORAGE_SET'));

      final secGet = await controller.secureStorageGet('auth_jwt');
      expect(secGet.success, isTrue);
      expect(log.last.arguments['action'], equals('SECURE_STORAGE_GET'));

      final secRemove = await controller.secureStorageRemove('auth_jwt');
      expect(secRemove.success, isTrue);
      expect(log.last.arguments['action'], equals('SECURE_STORAGE_REMOVE'));

      final secClear = await controller.secureStorageClear();
      expect(secClear.success, isTrue);
      expect(log.last.arguments['action'], equals('SECURE_STORAGE_CLEAR'));

      // APM Telemetry (Task 10124)
      final apmReport = await controller.reportMetrics(fcpMs: 45.0, lcpMs: 500.0);
      expect(apmReport.success, isTrue);
      expect(log.last.arguments['action'], equals('REPORT_METRICS'));

      final apmGet = await controller.getApmMetrics();
      expect(apmGet.success, isTrue);
      expect(log.last.arguments['action'], equals('GET_APM_METRICS'));

      // Push Notifications (Task 10127)
      final pushToken = await controller.getPushToken();
      expect(pushToken.success, isTrue);
      expect(log.last.arguments['action'], equals('PUSH_GET_TOKEN'));

      final pushBadge = await controller.setPushBadge(3);
      expect(pushBadge.success, isTrue);
      expect(log.last.arguments['action'], equals('PUSH_SET_BADGE'));

      // BLE & NFC (Task 10108)
      final bleScan = await controller.startBleScan();
      expect(bleScan.success, isTrue);
      expect(log.last.arguments['action'], equals('BLE_START_SCAN'));

      final nfcRead = await controller.readNfcTag();
      expect(nfcRead.success, isTrue);
      expect(log.last.arguments['action'], equals('NFC_READ_TAG'));

      // Contacts & Geofence (Task 10129)
      final contactRes = await controller.chooseContact();
      expect(contactRes.success, isTrue);
      expect(log.last.arguments['action'], equals('CHOOSE_CONTACT'));

      final geoRes = await controller.startGeofence('geo_test', 37.7749, -122.4194);
      expect(geoRes.success, isTrue);
      expect(log.last.arguments['action'], equals('START_GEOFENCE'));

      // Web3 Wallet (Task 10120)
      final w3Res = await controller.web3ConnectWallet();
      expect(w3Res.success, isTrue);
      expect(log.last.arguments['action'], equals('WEB3_CONNECT_WALLET'));

      // Wallet SPI additions: off-chain signing and chain switching.
      final signMsgRes = await controller.web3SignMessage(
        message: '{"primaryType":"PermitSingle"}',
        messageType: 'eth_signTypedData_v4',
      );
      expect(signMsgRes.success, isTrue);
      expect(log.last.arguments['action'], equals('WEB3_SIGN_MESSAGE'));
      expect(log.last.arguments['payload']['messageType'], equals('eth_signTypedData_v4'));

      final switchRes = await controller.web3SwitchChain(chainId: 'eip155:137');
      expect(switchRes.success, isTrue);
      expect(log.last.arguments['action'], equals('WEB3_SWITCH_CHAIN'));

      // Passkeys & the hardware vault.
      final pkSupportRes = await controller.passkeyCheckSupport();
      expect(pkSupportRes.success, isTrue);
      expect(log.last.arguments['action'], equals('PASSKEY_CHECK_SUPPORT'));

      final pkRegRes = await controller.passkeyRegister(
        optionsJson: '{"rp":{"id":"shop.example.com"}}',
        rpId: 'shop.example.com',
      );
      expect(pkRegRes.success, isTrue);
      expect(log.last.arguments['action'], equals('PASSKEY_REGISTER'));
      expect(log.last.arguments['payload']['rpId'], equals('shop.example.com'));

      final pkAssertRes = await controller.passkeyAssert(
        optionsJson: '{"rpId":"shop.example.com"}',
      );
      expect(pkAssertRes.success, isTrue);
      expect(log.last.arguments['action'], equals('PASSKEY_ASSERT'));

      final vaultEncRes = await controller.vaultEncrypt(vaultId: 'notes', plaintext: 'secret');
      expect(vaultEncRes.success, isTrue);
      expect(log.last.arguments['action'], equals('VAULT_ENCRYPT'));

      final vaultDecRes = await controller.vaultDecrypt(
        vaultId: 'notes',
        envelope: const {'ciphertext': 'Y2k'},
      );
      expect(vaultDecRes.success, isTrue);
      expect(log.last.arguments['action'], equals('VAULT_DECRYPT'));

      // IAP Invoices (Task 10121)
      final iapRes = await controller.openInvoice(invoiceSlug: 'inv_1', title: 'Credits', amount: 100);
      expect(iapRes.success, isTrue);
      expect(log.last.arguments['action'], equals('OPEN_INVOICE'));

      // Binary Channel (Task 10130)
      final binRes = await controller.createBinaryPort('port_1');
      expect(binRes.success, isTrue);
      expect(log.last.arguments['action'], equals('CREATE_BINARY_PORT'));

      // SSL Pinning (Task 10131)
      final sslRes = await controller.verifySslPin('appassets.androidplatform.net', 'sha256/pin');
      expect(sslRes.success, isTrue);
      expect(log.last.arguments['action'], equals('VERIFY_SSL_PIN'));

      // Permissions (Task 10101)
      final permRes = await controller.checkPermission('scope.camera');
      expect(permRes.success, isTrue);
      expect(log.last.arguments['action'], equals('CHECK_PERMISSION'));

      // Keyboard (Task 10068)
      final kbRes = await controller.getKeyboardInsets();
      expect(kbRes.success, isTrue);
      expect(log.last.arguments['action'], equals('GET_KEYBOARD_INSETS'));

      // Predictive Back (Task 10126)
      final backRes = await controller.predictiveBackProgress(0.5);
      expect(backRes.success, isTrue);
      expect(log.last.arguments['action'], equals('PREDICTIVE_BACK_PROGRESS'));

      // WASM (Task 10132)
      final wasmRes = await controller.validateWasmSupport();
      expect(wasmRes.success, isTrue);
      expect(log.last.arguments['action'], equals('VALIDATE_WASM_SUPPORT'));

      // Bytecode Precompile (Task 10084)
      final v8Res = await controller.getBytecodeStats();
      expect(v8Res.success, isTrue);
      expect(log.last.arguments['action'], equals('GET_BYTECODE_STATS'));

      // File Chooser (Task 10076)
      final fcRes = await controller.cancelFileChooser();
      expect(fcRes.success, isTrue);
      expect(log.last.arguments['action'], equals('CANCEL_FILE_CHOOSER'));

      // Back Navigation (Task 10094)
      final navRes = await controller.canGoBackInHistory();
      expect(navRes.success, isTrue);
      expect(log.last.arguments['action'], equals('CAN_GO_BACK'));

      // Visual Renderer (Task 10113)
      final renderRes = await controller.getRenderLayerConfig();
      expect(renderRes.success, isTrue);
      expect(log.last.arguments['action'], equals('GET_RENDER_LAYER_CONFIG'));

      // Gesture Scroll Sync (Task 10079)
      final scrollRes = await controller.updateGestureScrollPosition(100, 500);
      expect(scrollRes.success, isTrue);
      expect(log.last.arguments['action'], equals('GESTURE_SCROLL_UPDATE'));

      // Native Page Stack (Task 10091)
      final stackRes = await controller.getPageStack();
      expect(stackRes.success, isTrue);
      expect(log.last.arguments['action'], equals('GET_PAGE_STACK'));

      // Dynamic Subpackages (Task 10092)
      final subpkgRes = await controller.loadSubpackage('game');
      expect(subpkgRes.success, isTrue);
      expect(log.last.arguments['action'], equals('LOAD_SUBPACKAGE'));

      // Same-Layer Rendering (Task 10100)
      final layerRes = await controller.removeNativeView('video_1');
      expect(layerRes.success, isTrue);
      expect(log.last.arguments['action'], equals('REMOVE_NATIVE_VIEW'));

      // API Capabilities (Task 10102)
      final apiRes = await controller.getApiCapabilities();
      expect(apiRes.success, isTrue);
      expect(log.last.arguments['action'], equals('GET_API_CAPABILITIES'));

      // Process Sandbox Status (Task 10090)
      final sandboxRes = await controller.getSandboxProcessStatus();
      expect(sandboxRes.success, isTrue);
      expect(log.last.arguments['action'], equals('GET_SANDBOX_PROCESS_STATUS'));

      // Startup Benchmark Report (Task 10085)
      // Cross-Mini-App Launch & Windowed Presentation (Task 10201)
      final openRes = await controller.openMiniApp(
        targetAppId: 'checkout_widget',
        presentation: 'WINDOWED',
        params: {'orderId': 'ORD_123'},
        windowConfig: {'width': 360, 'height': 520},
        jsApiAlias: {'CONFIRM': 'PARENT_CONFIRM'},
      );
      expect(openRes.success, isTrue);
      expect(log.last.arguments['action'], equals('OPEN_MINI_APP'));
      expect(log.last.arguments['payload']['targetAppId'], equals('checkout_widget'));

      final closeRes = await controller.closeMiniApp(
        instanceId: 'inst_1',
        result: {'status': 'SUCCESS'},
      );
      expect(closeRes.success, isTrue);
      expect(log.last.arguments['action'], equals('CLOSE_MINI_APP'));

      controller.dispose();
    });
  });

  group('GoatWebViewEngine Global Channel tests', () {
    const globalChannel = 'com.goat.webview/global';
    final List<MethodCall> globalLog = <MethodCall>[];

    setUp(() {
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(
        const MethodChannel(globalChannel),
        (MethodCall call) async {
          globalLog.add(call);
          switch (call.method) {
            case 'prewarm':
              return true;
            case 'clearCache':
              return true;
            case 'getBundleVersion':
              return '1.0.0-goat';
            default:
              return null;
          }
        },
      );
    });

    tearDown(() {
      globalLog.clear();
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(
        const MethodChannel(globalChannel),
        null,
      );
    });

    test('GoatWebViewEngine global operations', () async {
      final prewarmOk = await GoatWebViewEngine.prewarm();
      final clearOk = await GoatWebViewEngine.clearCache();
      final version = await GoatWebViewEngine.getBundleVersion();

      expect(prewarmOk, isTrue);
      expect(clearOk, isTrue);
      expect(version, equals('1.0.0-goat'));
      expect(globalLog.length, equals(3));
    });
  });

  group('GoatWebView Widget Popup Configuration tests (Task 10183 / R2)', () {
    testWidgets('GoatWebView accepts popupRoutingPolicy and onPopupRequest callback', (WidgetTester tester) async {
      bool popupCallbackCalled = false;
      GoatPopupRequest? capturedPopup;

      final widget = GoatWebView(
        appId: 'test_app',
        assetBundleName: 'test.zip',
        popupRoutingPolicy: GoatPopupRoutingPolicy.systemBrowser,
        onPopupRequest: (request) {
          popupCallbackCalled = true;
          capturedPopup = request;
        },
      );

      expect(widget.popupRoutingPolicy, equals(GoatPopupRoutingPolicy.systemBrowser));
      expect(widget.appId, equals('test_app'));
      expect(widget.assetBundleName, equals('test.zip'));
      expect(widget.onPopupRequest, isNotNull);

      widget.onPopupRequest?.call(const GoatPopupRequest(
        url: 'https://example.com/popup',
        policy: GoatPopupRoutingPolicy.systemBrowser,
      ));
      expect(popupCallbackCalled, isTrue);
      expect(capturedPopup?.url, equals('https://example.com/popup'));
      expect(capturedPopup?.policy, equals(GoatPopupRoutingPolicy.systemBrowser));
    });
  });
}
