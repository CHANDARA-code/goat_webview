import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { GoatBridge } from '../miniapp-bridge.js';
import { useGoatMultiTab } from '../hooks/useGoatBottomSheet.js';

describe('Milestone 1 Test Suite — Native UX & Bridge APIs (Tasks 10192, 10194, 10198)', () => {
  let bridge: GoatBridge;

  beforeEach(() => {
    bridge = new GoatBridge();
  });

  // =========================================================================
  // Task 10192: External Link Warning Interstitial Tests
  // =========================================================================
  describe('Task 10192: External Link Warning Interstitial', () => {
    it('should open external link via bridge and resolve destination host', async () => {
      const result = await bridge.openExternalLink({
        url: 'https://checkout.stripe.com/pay/cs_test_123',
        skipWarningIfOptedOut: true,
        appId: 'tenant_shop'
      });

      assert.equal(result.opened, true);
      assert.equal(result.destinationHost, 'checkout.stripe.com');
    });

    it('should register and cleanup ON_EXTERNAL_LINK_WARNING_SHOWN event listener', () => {
      let eventPayload: any = null;
      const unsubscribe = bridge.onExternalLinkWarningShown((data) => {
        eventPayload = data;
      });

      assert.equal(typeof unsubscribe, 'function');

      // Dispatch event
      bridge.emit('ON_EXTERNAL_LINK_WARNING_SHOWN', {
        destinationHost: 'partner-bank.com'
      });

      assert.deepEqual(eventPayload, { destinationHost: 'partner-bank.com' });

      // Unsubscribe and verify no further triggers
      unsubscribe();
      bridge.emit('ON_EXTERNAL_LINK_WARNING_SHOWN', {
        destinationHost: 'other-site.com'
      });
      assert.deepEqual(eventPayload, { destinationHost: 'partner-bank.com' });
    });
  });

  // =========================================================================
  // Task 10194: Multi-Tab Bottom Sheet WebView Overlay Tests
  // =========================================================================
  describe('Task 10194: Multi-Tab Bottom Sheet Stack', () => {
    it('should manage tab lifecycle via bridge methods (open, switch, list, close, closeAll)', async () => {
      // 1. Open tab
      const tab1 = await bridge.openTab({
        appId: 'tenant_chat',
        initialRoute: '/rooms/general',
        title: 'General Chat'
      });

      assert.ok(tab1.tabId);
      assert.equal(tab1.appId, 'tenant_chat');
      assert.equal(tab1.initialRoute, '/rooms/general');
      assert.equal(tab1.title, 'General Chat');
      assert.equal(tab1.isBackgrounded, false);

      // 2. Switch tab
      const switchRes = await bridge.switchToTab(tab1.tabId);
      assert.equal(switchRes.switched, true);
      assert.equal(switchRes.tabId, tab1.tabId);

      // 3. Get active tab & list tabs
      const activeTab = await bridge.getActiveTab();
      assert.ok(activeTab);

      const tabList = await bridge.getTabs();
      assert.ok(Array.isArray(tabList.tabs));

      // 4. Close tab
      const closeRes = await bridge.closeTab(tab1.tabId);
      assert.equal(closeRes.closed, true);
      assert.equal(closeRes.tabId, tab1.tabId);

      // 5. Close all tabs
      const closeAllRes = await bridge.closeAllTabs();
      assert.equal(closeAllRes.closedAll, true);
    });

    it('should operate useGoatMultiTab hook methods in React environment', async () => {
      let hookResult: any = null;
      let activeTabFromCallback: any = null;
      let closedTabFromCallback: any = null;

      function TestComponent() {
        hookResult = useGoatMultiTab({
          bridgeInstance: bridge,
          onTabChange: (tab) => { activeTabFromCallback = tab; },
          onTabClose: (tabId) => { closedTabFromCallback = tabId; }
        });
        return React.createElement('div', null, 'MultiTabTest');
      }

      ReactDOMServer.renderToString(React.createElement(TestComponent));

      assert.ok(hookResult);
      assert.ok(Array.isArray(hookResult.tabs));
      assert.equal(typeof hookResult.openTab, 'function');
      assert.equal(typeof hookResult.closeTab, 'function');
      assert.equal(typeof hookResult.switchToTab, 'function');
      assert.equal(typeof hookResult.closeAllTabs, 'function');
      assert.equal(typeof hookResult.refreshTabs, 'function');

      // Test openTab
      const opened = await hookResult.openTab({ appId: 'app_test', initialRoute: '/feed' });
      assert.ok(opened.tabId);
      assert.equal(activeTabFromCallback?.appId, 'app_test');

      // Test closeTab
      await hookResult.closeTab(opened.tabId);
      assert.equal(closedTabFromCallback, opened.tabId);
    });
  });

  // =========================================================================
  // Task 10198: Native Permission Priming Dialog Tests
  // =========================================================================
  describe('Task 10198: Native Permission Priming Dialog', () => {
    it('should request permission with structured rationale metadata', async () => {
      const res = await bridge.requestPermission('scope.camera', {
        appId: 'scanner_app',
        rationale: 'Camera access is needed to scan event tickets.'
      });

      assert.equal(res.scope, 'scope.camera');
      assert.equal(res.granted, true);
      assert.equal(res.isDeclaredInManifest, true);
    });

    it('should support legacy string appId overload for requestPermission', async () => {
      const res = await bridge.requestPermission('scope.userLocation', 'location_app');
      assert.equal(res.scope, 'scope.userLocation');
      assert.equal(res.granted, true);
    });

    it('should check permission, query settings, and open settings modal', async () => {
      const checkRes = await bridge.checkPermission('scope.record', 'audio_app');
      assert.equal(checkRes.scope, 'scope.record');
      assert.equal(checkRes.granted, true);

      const settings = await bridge.getSetting('audio_app');
      assert.ok(settings.authSetting);
      assert.equal(settings.authSetting['scope.camera'], true);

      const openSettings = await bridge.openSetting('audio_app');
      assert.ok(openSettings.authSetting);

      const authRes = await bridge.authorize('scope.bluetooth', true, 'audio_app');
      assert.equal(authRes.scope, 'scope.bluetooth');
      assert.equal(authRes.granted, true);
    });
  });
});
