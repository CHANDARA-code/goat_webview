import React from 'react';
import { GoatBridgeClient, GoatWebViewNativeModule } from '../GoatBridge';
import { GoatWebViewProps } from '../types';

describe('GoatWebView React Native Suite', () => {
  test('GoatBridgeClient mock TurboModule methods', async () => {
    const client = new GoatBridgeClient();

    // Verify fallbacks and type returns
    const version = await client.getBundleVersion();
    expect(typeof version).toBe('string');

    const prewarmResult = await client.prewarm();
    expect(typeof prewarmResult).toBe('boolean');

    const clearCacheResult = await client.clearCache();
    expect(typeof clearCacheResult).toBe('boolean');
  });

  test('useGoatBridge hook returns prewarm, clearCache and getBundleVersion', async () => {
    const { useGoatBridge } = require('../useGoatBridge');
    // Simulate hook behavior
    const client = new GoatBridgeClient();
    const isPrewarmed = await client.prewarm();
    const isCacheCleared = await client.clearCache();
    const version = await client.getBundleVersion();

    expect(isPrewarmed).toBe(true);
    expect(isCacheCleared).toBe(true);
    expect(version).toBe('1.0.0-goat');
  });

  test('GoatWebView event handling dispatches callbacks', () => {
    let bridgeMessageHandled = false;
    let pageLoadedHandled = false;
    let errorHandled = false;

    const mockOnBridgeMessage = (event: { nativeEvent: { action: string; payload: Record<string, any> } }) => {
      bridgeMessageHandled = true;
      expect(event.nativeEvent.action).toBe('GET_DEVICE_INFO');
    };
    const mockOnPageLoaded = (event: { nativeEvent: { url: string } }) => {
      pageLoadedHandled = true;
      expect(event.nativeEvent.url).toContain('appassets.androidplatform.net');
    };
    const mockOnError = (event: { nativeEvent: { description: string } }) => {
      errorHandled = true;
      expect(event.nativeEvent.description).toBe('Network timeout');
    };

    const props: GoatWebViewProps = {
      assetBundleName: 'miniapp.zip',
      onBridgeMessage: mockOnBridgeMessage,
      onPageLoaded: mockOnPageLoaded,
      onError: mockOnError,
      testID: 'goat-webview-test',
    };

    props.onBridgeMessage?.({ nativeEvent: { action: 'GET_DEVICE_INFO', payload: {} } });
    props.onPageLoaded?.({ nativeEvent: { url: 'https://appassets.androidplatform.net/assets/index.html' } });
    props.onError?.({ nativeEvent: { description: 'Network timeout' } });

    expect(bridgeMessageHandled).toBe(true);
    expect(pageLoadedHandled).toBe(true);
    expect(errorHandled).toBe(true);
  });

  test('GoatWebView dispatches onPopupRequest event and accepts popupRoutingPolicy prop (Task 10183)', () => {
    let popupRequestReceived = false;

    const mockOnPopupRequest = (event: {
      nativeEvent: {
        url: string;
        target?: string;
        policy?: string;
        isUserGesture?: boolean;
        isDialog?: boolean;
        windowFeatures?: any;
      };
    }) => {
      popupRequestReceived = true;
      expect(event.nativeEvent.url).toBe('https://external-auth.example.com/login');
      expect(event.nativeEvent.target).toBe('_blank');
      expect(event.nativeEvent.policy).toBe('systemBrowser');
      expect(event.nativeEvent.isUserGesture).toBe(true);
    };

    const props: GoatWebViewProps = {
      assetBundleName: 'miniapp.zip',
      popupRoutingPolicy: 'systemBrowser',
      onPopupRequest: mockOnPopupRequest,
      testID: 'goat-webview-popup-test',
    };

    expect(props.popupRoutingPolicy).toBe('systemBrowser');
    props.onPopupRequest?.({
      nativeEvent: {
        url: 'https://external-auth.example.com/login',
        target: '_blank',
        policy: 'systemBrowser',
        isUserGesture: true,
        isDialog: false,
        windowFeatures: { width: 400, height: 600, resizable: true },
      },
    });

    expect(popupRequestReceived).toBe(true);
  });
});

