import 'package:flutter_test/flutter_test.dart';
import 'package:goat_webview/src/goat_web_view_widget.dart';

/// The allowlist only does anything if it survives into creationParams and is read natively before
/// initialization. This covers the Dart half. The native halves assign goatView.hostDomainAllowlist
/// at GoatPlatformView.kt:121 and GoatPlatformView.swift:59, both ahead of the initialize calls
/// (Kotlin 274/278, Swift 124).
void main() {
  group('hostDomainAllowlist reaches the platform view', () {
    test('an empty allowlist sends no key, keeping the unfiltered default', () {
      final params = buildGoatCreationParams(const GoatWebView(appId: 'tenant1'));
      expect(params.containsKey('hostDomainAllowlist'), isFalse);
    });

    test('a declared allowlist is forwarded as a plain list', () {
      final params = buildGoatCreationParams(const GoatWebView(
        appId: 'tenant1',
        hostDomainAllowlist: <String>['api.example.com', '*.cdn.example.com'],
      ));
      expect(params['hostDomainAllowlist'],
          <String>['api.example.com', '*.cdn.example.com']);
    });

    test('it reaches params for a URL-mode mini-app, which has no manifest to read', () {
      final params = buildGoatCreationParams(const GoatWebView(
        appId: 'tenant1',
        initialUrl: 'https://merchant.example.com/shop',
        hostDomainAllowlist: <String>['merchant.example.com'],
      ));
      expect(params['initialUrl'], 'https://merchant.example.com/shop');
      expect(params['hostDomainAllowlist'], <String>['merchant.example.com']);
    });

    test('the existing params are unaffected', () {
      final params = buildGoatCreationParams(const GoatWebView(
        appId: 'tenant1',
        hostDomainAllowlist: <String>['api.example.com'],
      ));
      expect(params['appId'], 'tenant1');
      expect(params.containsKey('popupRoutingPolicy'), isTrue);
    });
  });
}
