import 'package:flutter_test/flutter_test.dart';
import 'package:goat_webview_compat/goat_webview_compat.dart';

void main() {
  group('T1 value types', () {
    test('WebUri is const-constructible and parses lazily', () {
      const uri = WebUri('https://example.com/path?x=1');
      expect(uri.scheme, 'https');
      expect(uri.host, 'example.com');
      expect(uri.isHttps, isTrue);
      expect(uri.toString(), 'https://example.com/path?x=1');
    });

    test('WebUri equality is value-based', () {
      const a = WebUri('https://example.com');
      const b = WebUri('https://example.com');
      expect(a, equals(b));
      expect(a.hashCode, equals(b.hashCode));
    });

    test('URLRequest is const-constructible with a WebUri', () {
      const req = URLRequest(
        url: WebUri('https://example.com'),
        method: 'GET',
      );
      expect(req.url?.host, 'example.com');
      expect(req.method, 'GET');
    });

    test('InAppWebViewSettings is const-constructible with drop-in defaults', () {
      const settings = InAppWebViewSettings(
        applicationNameForUserAgent: 'DgSuperApp',
        transparentBackground: true,
        cacheMode: CacheMode.loadNoCache,
        thirdPartyCookiesEnabled: true,
        allowsInlineMediaPlayback: true,
        allowFileAccessFromFileURLs: true,
        isInspectable: true,
        useHybridComposition: true,
        supportZoom: false,
        useShouldOverrideUrlLoading: true,
        mediaPlaybackRequiresUserGesture: false,
        allowsBackForwardNavigationGestures: true,
        contentInsetAdjustmentBehavior:
            ScrollViewContentInsetAdjustmentBehavior.automatic,
      );
      expect(settings.applicationNameForUserAgent, 'DgSuperApp');
      expect(settings.cacheMode, CacheMode.loadNoCache);
      expect(settings.isInspectable, isTrue);
    });

    test('InAppWebViewGroupOptions/InAppWebViewOptions (legacy T10 shape) are const', () {
      const group = InAppWebViewGroupOptions(
        crossPlatform: InAppWebViewOptions(userAgent: 'legacy-ua'),
      );
      expect(group.crossPlatform.userAgent, 'legacy-ua');
    });

    test('T10: legacy InAppWebViewOptions.toSettings() maps onto InAppWebViewSettings', () {
      // ignore: deprecated_member_use_from_same_package
      final settings = const InAppWebViewOptions(
        javaScriptEnabled: false,
        transparentBackground: true,
        useShouldOverrideUrlLoading: true,
        clearCache: true,
        userAgent: 'legacy-ua',
        supportZoom: false,
      ).toSettings();
      expect(settings.javaScriptEnabled, isFalse);
      expect(settings.transparentBackground, isTrue);
      expect(settings.useShouldOverrideUrlLoading, isTrue);
      expect(settings.clearCache, isTrue);
      expect(settings.userAgent, 'legacy-ua');
      expect(settings.supportZoom, isFalse);
    });

    test('T10: legacy InAppWebViewGroupOptions.toSettings() delegates to crossPlatform', () {
      // ignore: deprecated_member_use_from_same_package
      final settings = const InAppWebViewGroupOptions(
        crossPlatform: InAppWebViewOptions(userAgent: 'group-legacy-ua'),
      ).toSettings();
      expect(settings.userAgent, 'group-legacy-ua');
    });

    test('NavigationAction + NavigationActionPolicy resolve', () {
      const action = NavigationAction(
        request: URLRequest(url: WebUri('https://example.com')),
        navigationType: NavigationType.linkActivated,
      );
      expect(action.navigationType, NavigationType.linkActivated);
      expect(NavigationActionPolicy.values, contains(NavigationActionPolicy.cancel));
    });

    test('ServerTrustAuthResponse(Action) resolves', () {
      const response =
          ServerTrustAuthResponse(action: ServerTrustAuthResponseAction.proceed);
      expect(response.action, ServerTrustAuthResponseAction.proceed);
    });

    test('PullToRefreshSettings is const; PullToRefreshController scaffolds', () {
      const settings = PullToRefreshSettings(enabled: true, color: 0xFFFF0000);
      final controller = PullToRefreshController(settings: settings);
      expect(controller.settings.color, 0xFFFF0000);
    });

    test('WebResourceError/Request/Response + LoadedResource resolve', () {
      const error = WebResourceError(
        type: WebResourceErrorType.hostLookup,
        description: 'DNS failure',
      );
      const request = WebResourceRequest(url: WebUri('https://example.com'));
      const response = WebResourceResponse(statusCode: 200);
      const resource = LoadedResource(url: WebUri('https://example.com/a.js'));
      expect(error.type, WebResourceErrorType.hostLookup);
      expect(request.url.host, 'example.com');
      expect(response.statusCode, 200);
      expect(resource.url?.path, '/a.js');
    });

    test('ConsoleMessage + ConsoleMessageLevel resolve', () {
      const msg = ConsoleMessage(
        message: 'hello',
        messageLevel: ConsoleMessageLevel.warning,
      );
      expect(msg.messageLevel, ConsoleMessageLevel.warning);
    });

    test('CacheMode and ScrollViewContentInsetAdjustmentBehavior enums resolve', () {
      expect(CacheMode.values.length, 4);
      expect(
        ScrollViewContentInsetAdjustmentBehavior.values,
        contains(ScrollViewContentInsetAdjustmentBehavior.never),
      );
    });
  });
}
