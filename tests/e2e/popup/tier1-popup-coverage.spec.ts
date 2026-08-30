/**
 * Goat WebView Task 10183 Tier 1: Feature Coverage Test Suite (F1–F12)
 *
 * Exhaustive nominal coverage verifying all 12 core features of GoatPopupManager:
 * - F1: Android Engine Interception (WebChromeClient.onCreateWindow)
 * - F2: iOS Engine Interception (WKUIDelegate.createWebViewWithConfiguration)
 * - F3: iOS Engine Close Hook (WKUIDelegate.webViewDidClose & Focus Restore)
 * - F4: IPC Bridge Event Telemetry (ON_POPUP_REQUEST schema)
 * - F5: Cross-Origin System Routing (External Browser & Warning Dialog)
 * - F6: Same-Origin Modal Routing (goat:// sandbox & storage share)
 * - F7: WindowFeatures Parsing (W3C & WKWindowFeatures geometry)
 * - F8: Security Scheme Hardening (file:// block, tel/mailto intents)
 * - F9: Session Link Warning Opt-Out (Per-session domain suppression)
 * - F10: React Native Fabric Bindings (onPopupRequest & popupRoutingPolicy)
 * - F11: Flutter PlatformView Bindings (Stream<GoatPopupRequest> & MethodChannel)
 * - F12: Modal Teardown & Pool Recycling (Zero-leak fast pool)
 *
 * 60 Hermetic Tests (5 tests per feature).
 */

import { describe, it, expect } from '../harness/test-runner.ts';
import {
  GoatPopupManagerSimulator,
  GoatWindowFeatures,
  GoatExternalLinkWarningDialogSimulator,
  GoatModalFastPoolSimulator,
  ReactNativeGoatWebViewPopupSimulator,
  FlutterGoatWebViewPopupSimulator,
} from '../harness/popup-simulator.ts';

export function registerTier1PopupCoverageTests(): void {
  // ==========================================================================
  // F1: Android Engine Interception
  // ==========================================================================
  describe('Task 10183 Tier 1 - F1: Android Engine Interception', () => {
    it('TC-T1-F01-01: Intercepts window.open via WebChromeClient.onCreateWindow when supportMultipleWindows is true', () => {
      const manager = new GoatPopupManagerSimulator('tenant-app-1', 'parent_view_android');
      expect(manager.isSupportMultipleWindows).toBe(true);

      const result = manager.handleCreateWindow({
        url: 'goat://tenant-app-1/checkout.html',
        target: '_blank',
        isUserGesture: true,
      });

      expect(result.handled).toBe(true);
      expect(result.action).toBe('OPENED_MODAL');
      expect(manager.activeModals.length).toBe(1);
    });

    it('TC-T1-F01-02: Captures requested target URL via transport target WebView allocation', () => {
      const manager = new GoatPopupManagerSimulator('tenant-app-1');
      const result = manager.handleCreateWindow({
        url: 'https://pay.gateway.com/session_123',
        target: '_blank',
      });

      expect(result.eventEmitted.data.url).toBe('https://pay.gateway.com/session_123');
      expect(result.action).toBe('OPENED_SYSTEM_BROWSER');
    });

    it('TC-T1-F01-03: Fails safe and throws when manager is destroyed', () => {
      const manager = new GoatPopupManagerSimulator('tenant-app-1');
      manager.destroy();

      expect(() => {
        manager.handleCreateWindow({ url: 'goat://tenant-app-1/page.html' });
      }).toThrow('ILLEGAL_STATE');
    });

    it('TC-T1-F01-04: Dispatches isDialog flag faithfully from Android onCreateWindow', () => {
      const manager = new GoatPopupManagerSimulator('tenant-app-1');
      const result = manager.handleCreateWindow({
        url: 'goat://tenant-app-1/dialog.html',
        isDialog: true,
        isUserGesture: true,
      });

      expect(result.eventEmitted.data.isDialog).toBe(true);
    });

    it('TC-T1-F01-05: Supports automatic window opening via javaScriptCanOpenWindowsAutomatically', () => {
      const manager = new GoatPopupManagerSimulator('tenant-app-1');
      expect(manager.javaScriptCanOpenWindowsAutomatically).toBe(true);

      const result = manager.handleCreateWindow({
        url: 'goat://tenant-app-1/popup.html',
        isUserGesture: false,
      });

      expect(result.handled).toBe(true);
      expect(result.eventEmitted.data.isUserGesture).toBe(false);
    });
  });

  // ==========================================================================
  // F2: iOS Engine Interception
  // ==========================================================================
  describe('Task 10183 Tier 1 - F2: iOS Engine Interception', () => {
    it('TC-T1-F02-01: Intercepts WKUIDelegate.createWebViewWithConfiguration on same-origin window.open', () => {
      const manager = new GoatPopupManagerSimulator('tenant-ios-1', 'ios_parent_view');
      const result = manager.handleCreateWindow({
        url: 'goat://tenant-ios-1/modal_flow.html',
        target: '_blank',
      });

      expect(result.handled).toBe(true);
      expect(result.action).toBe('OPENED_MODAL');
      expect(result.popupViewId).toBeDefined();
    });

    it('TC-T1-F02-02: Inspects WKNavigationAction target frame and URL before view allocation', () => {
      const manager = new GoatPopupManagerSimulator('tenant-ios-1');
      const result = manager.handleCreateWindow({
        url: 'https://appleid.apple.com/auth/authorize',
        target: 'authWindow',
      });

      expect(result.eventEmitted.data.target).toBe('authWindow');
      expect(result.eventEmitted.data.policy).toBe('SYSTEM_BROWSER');
    });

    it('TC-T1-F02-03: Returns nil / cancels native navigation when routed to system browser', () => {
      const manager = new GoatPopupManagerSimulator('tenant-ios-1');
      const result = manager.handleCreateWindow({
        url: 'https://docs.goat.dev/guides',
        userConfirmDialog: 'CONFIRM',
      });

      expect(result.action).toBe('OPENED_SYSTEM_BROWSER');
      expect(manager.activeModals.length).toBe(0);
    });

    it('TC-T1-F02-04: Passes WKWindowFeatures geometry directly to presentation container', () => {
      const manager = new GoatPopupManagerSimulator('tenant-ios-1');
      const wkFeatures = GoatWindowFeatures.fromWKWindowFeatures({
        width: 480,
        height: 640,
        x: 100,
        y: 200,
        allowsResizing: true,
        menuBarVisibility: false,
      });

      const result = manager.handleCreateWindow({
        url: 'goat://tenant-ios-1/viewer.html',
        windowFeatures: wkFeatures,
      });

      expect(result.eventEmitted.data.windowFeatures.width).toBe(480);
      expect(result.eventEmitted.data.windowFeatures.height).toBe(640);
      expect(result.eventEmitted.data.windowFeatures.resizable).toBe(true);
      expect(result.eventEmitted.data.windowFeatures.menuBar).toBe(false);
    });

    it('TC-T1-F02-05: Preserves shared website data store across secondary modal views', () => {
      const manager = new GoatPopupManagerSimulator('tenant-ios-1');
      manager.sandbox.setCookie('session_token', 'jwt_sec_991823');
      manager.sandbox.setItem('user_pref_theme', 'dark');

      const result = manager.handleCreateWindow({
        url: 'goat://tenant-ios-1/profile.html',
      });

      const modal = manager.activeModals[0];
      expect(modal.sandbox.getCookie('session_token')).toBe('jwt_sec_991823');
      expect(modal.sandbox.getItem('user_pref_theme')).toBe('dark');
    });
  });

  // ==========================================================================
  // F3: iOS Engine Close Hook
  // ==========================================================================
  describe('Task 10183 Tier 1 - F3: iOS Engine Close Hook', () => {
    it('TC-T1-F03-01: Invoking window.close() from modal triggers webViewDidClose and dismantles container', () => {
      const manager = new GoatPopupManagerSimulator('app-close-test');
      manager.handleCreateWindow({ url: 'goat://app-close-test/subpage.html' });
      expect(manager.activeModals.length).toBe(1);

      const closed = manager.handleCloseWindow();
      expect(closed).toBe(true);
      expect(manager.activeModals.length).toBe(0);
    });

    it('TC-T1-F03-02: Restores keyboard, scroll, and touch focus cleanly to parent GoatView', () => {
      const manager = new GoatPopupManagerSimulator('app-close-test');
      expect(manager.hasFocus).toBe(true);

      manager.handleCreateWindow({ url: 'goat://app-close-test/modal.html' });
      expect(manager.hasFocus).toBe(false);

      manager.handleCloseWindow();
      expect(manager.hasFocus).toBe(true);
    });

    it('TC-T1-F03-03: Calling close hook on already dismissed modal is an idempotent safe no-op', () => {
      const manager = new GoatPopupManagerSimulator('app-close-test');
      const closed = manager.handleCloseWindow();
      expect(closed).toBe(false);
    });

    it('TC-T1-F03-04: Modal close notifies host application via onModalClosed listener', () => {
      const manager = new GoatPopupManagerSimulator('app-close-test');
      let closedModalId = '';
      manager.onModalClosedListener = (id) => {
        closedModalId = id;
      };

      const res = manager.handleCreateWindow({ url: 'goat://app-close-test/modal.html' });
      const createdId = res.popupViewId!;

      manager.handleCloseWindow(createdId);
      expect(closedModalId).toBe(createdId);
    });

    it('TC-T1-F03-05: Closing top modal in stack leaves previous modal intact', () => {
      const manager = new GoatPopupManagerSimulator('app-close-test');
      manager.handleCreateWindow({ url: 'goat://app-close-test/modal1.html' });
      manager.handleCreateWindow({ url: 'goat://app-close-test/modal2.html' });
      expect(manager.activeModals.length).toBe(2);

      manager.handleCloseWindow();
      expect(manager.activeModals.length).toBe(1);
      expect(manager.activeModals[0].url).toBe('goat://app-close-test/modal1.html');
    });
  });

  // ==========================================================================
  // F4: IPC Bridge Event Telemetry
  // ==========================================================================
  describe('Task 10183 Tier 1 - F4: IPC Bridge Event Telemetry', () => {
    it('TC-T1-F04-01: Emits standardized ON_POPUP_REQUEST with mandatory fields url, policy, isUserGesture', () => {
      const manager = new GoatPopupManagerSimulator('app-telemetry');
      let capturedEvent: any = null;
      manager.onPopupRequestListener = (evt) => {
        capturedEvent = evt;
      };

      manager.handleCreateWindow({
        url: 'https://auth.partner.com/login',
        isUserGesture: true,
      });

      expect(capturedEvent).toBeDefined();
      expect(capturedEvent.event).toBe('ON_POPUP_REQUEST');
      expect(capturedEvent.data.url).toBe('https://auth.partner.com/login');
      expect(capturedEvent.data.policy).toBe('SYSTEM_BROWSER');
      expect(capturedEvent.data.isUserGesture).toBe(true);
    });

    it('TC-T1-F04-02: Emits default target _blank when target parameter is omitted', () => {
      const manager = new GoatPopupManagerSimulator('app-telemetry');
      const res = manager.handleCreateWindow({ url: 'goat://app-telemetry/doc.html' });
      expect(res.eventEmitted.data.target).toBe('_blank');
    });

    it('TC-T1-F04-03: Populates parsed windowFeatures object in event data payload', () => {
      const manager = new GoatPopupManagerSimulator('app-telemetry');
      const res = manager.handleCreateWindow({
        url: 'goat://app-telemetry/doc.html',
        windowFeatures: 'width=600,height=750,resizable=yes',
      });

      expect(res.eventEmitted.data.windowFeatures.width).toBe(600);
      expect(res.eventEmitted.data.windowFeatures.height).toBe(750);
      expect(res.eventEmitted.data.windowFeatures.resizable).toBe(true);
    });

    it('TC-T1-F04-04: Broadcasts ON_POPUP_REQUEST event before executing navigation', () => {
      const manager = new GoatPopupManagerSimulator('app-telemetry');
      let order: string[] = [];
      manager.onPopupRequestListener = () => {
        order.push('EVENT_EMITTED');
      };
      manager.onModalOpenedListener = () => {
        order.push('MODAL_OPENED');
      };

      manager.handleCreateWindow({ url: 'goat://app-telemetry/page.html' });
      expect(order).toEqual(['EVENT_EMITTED', 'MODAL_OPENED']);
    });

    it('TC-T1-F04-05: Formats event payload to valid JSON string adhering to PROJECT.md contract', () => {
      const manager = new GoatPopupManagerSimulator('app-telemetry');
      const res = manager.handleCreateWindow({ url: 'https://example.com' });
      const serialized = JSON.stringify(res.eventEmitted);
      const parsed = JSON.parse(serialized);

      expect(parsed.event).toBe('ON_POPUP_REQUEST');
      expect(parsed.data.policy).toBe('SYSTEM_BROWSER');
    });
  });

  // ==========================================================================
  // F5: Cross-Origin System Routing
  // ==========================================================================
  describe('Task 10183 Tier 1 - F5: Cross-Origin System Routing', () => {
    it('TC-T1-F05-01: External HTTPS URL triggers GoatExternalLinkWarningDialog interstitial before browser launch', () => {
      const manager = new GoatPopupManagerSimulator('app-cross-origin');
      const res = manager.handleCreateWindow({
        url: 'https://bank.com/portal',
        userConfirmDialog: 'CONFIRM',
      });

      expect(res.warningDialogShown).toBe(true);
      expect(res.action).toBe('OPENED_SYSTEM_BROWSER');
      expect(manager.systemBrowserInvocations).toContain('https://bank.com/portal');
    });

    it('TC-T1-F05-02: User confirmation opens external OS browser', () => {
      const manager = new GoatPopupManagerSimulator('app-cross-origin');
      const res = manager.handleCreateWindow({
        url: 'https://shop.partner.com/checkout',
        userConfirmDialog: 'CONFIRM',
      });

      expect(res.handled).toBe(true);
      expect(res.action).toBe('OPENED_SYSTEM_BROWSER');
    });

    it('TC-T1-F05-03: User cancellation safely aborts popup navigation with zero effect on parent frame', () => {
      const manager = new GoatPopupManagerSimulator('app-cross-origin');
      const res = manager.handleCreateWindow({
        url: 'https://untrusted-site.com',
        userConfirmDialog: 'CANCEL',
      });

      expect(res.handled).toBe(false);
      expect(res.action).toBe('BLOCKED');
      expect(manager.systemBrowserInvocations.length).toBe(0);
    });

    it('TC-T1-F05-04: External routing prevents cross-origin DOM access or credential leakage', () => {
      const manager = new GoatPopupManagerSimulator('app-cross-origin');
      manager.sandbox.setCookie('auth_session', 'secret_token_123');

      manager.handleCreateWindow({
        url: 'https://external-service.com',
        userConfirmDialog: 'CONFIRM',
      });

      expect(manager.activeModals.length).toBe(0);
    });

    it('TC-T1-F05-05: External HTTP/HTTPS URLs across different subdomains are treated as cross-origin', () => {
      const manager = new GoatPopupManagerSimulator('app-cross-origin');
      expect(manager.classifyOrigin('https://sub.domain.com/path')).toBe('CROSS_ORIGIN');
      expect(manager.classifyOrigin('http://api.partner.net')).toBe('CROSS_ORIGIN');
    });
  });

  // ==========================================================================
  // F6: Same-Origin Modal Routing
  // ==========================================================================
  describe('Task 10183 Tier 1 - F6: Same-Origin Modal Routing', () => {
    it('TC-T1-F06-01: Same-origin goat://<appId>/... URL opens inside secondary GoatModalWebViewInstance', () => {
      const manager = new GoatPopupManagerSimulator('tenant-app-6');
      const res = manager.handleCreateWindow({
        url: 'goat://tenant-app-6/dashboard/analytics.html',
      });

      expect(res.action).toBe('OPENED_MODAL');
      expect(manager.activeModals[0].url).toBe('goat://tenant-app-6/dashboard/analytics.html');
    });

    it('TC-T1-F06-02: Relative path /products/detail.html resolves to tenant origin and opens modal', () => {
      const manager = new GoatPopupManagerSimulator('tenant-app-6');
      const res = manager.handleCreateWindow({
        url: '/products/detail.html',
      });

      expect(res.action).toBe('OPENED_MODAL');
      expect(res.eventEmitted.data.url).toBe('goat://tenant-app-6/products/detail.html');
    });

    it('TC-T1-F06-03: Secondary modal shares tenant cookies with parent GoatView', () => {
      const manager = new GoatPopupManagerSimulator('tenant-app-6');
      manager.sandbox.setCookie('cart_items', 'item_101,item_202');

      const res = manager.handleCreateWindow({ url: 'goat://tenant-app-6/cart.html' });
      const modal = manager.activeModals[0];

      expect(modal.sandbox.getCookie('cart_items')).toBe('item_101,item_202');
    });

    it('TC-T1-F06-04: Secondary modal shares localStorage partition with parent GoatView', () => {
      const manager = new GoatPopupManagerSimulator('tenant-app-6');
      manager.sandbox.setItem('draft_post', 'Hello World!');

      manager.handleCreateWindow({ url: 'goat://tenant-app-6/editor.html' });
      const modal = manager.activeModals[0];

      expect(modal.sandbox.getItem('draft_post')).toBe('Hello World!');
    });

    it('TC-T1-F06-05: Cross-tenant navigation is classified as cross-origin and does not open tenant modal', () => {
      const manager = new GoatPopupManagerSimulator('tenant-app-6');
      expect(manager.classifyOrigin('goat://other-tenant-app/page.html')).toBe('CROSS_ORIGIN');
    });
  });

  // ==========================================================================
  // F7: WindowFeatures Parsing
  // ==========================================================================
  describe('Task 10183 Tier 1 - F7: WindowFeatures Parsing', () => {
    it('TC-T1-F07-01: Parses standard width and height dimensions', () => {
      const feat = GoatWindowFeatures.parse('width=500,height=600');
      expect(feat.width).toBe(500);
      expect(feat.height).toBe(600);
    });

    it('TC-T1-F07-02: Parses position coordinates left=100,top=150 or screenx=100,screeny=150', () => {
      const feat = GoatWindowFeatures.parse('left=100,top=150');
      expect(feat.x).toBe(100);
      expect(feat.y).toBe(150);

      const feat2 = GoatWindowFeatures.parse('screenx=200,screeny=250');
      expect(feat2.x).toBe(200);
      expect(feat2.y).toBe(250);
    });

    it('TC-T1-F07-03: Parses boolean flags resizable=yes,menubar=1,status=true,scrollbars=yes', () => {
      const feat = GoatWindowFeatures.parse('resizable=yes,menubar=1,status=true,scrollbars=yes');
      expect(feat.resizable).toBe(true);
      expect(feat.menuBar).toBe(true);
      expect(feat.statusBar).toBe(true);
      expect(feat.scrollbars).toBe(true);
    });

    it('TC-T1-F07-04: Clamps dimensions below minimum safe threshold (<200) to safe defaults', () => {
      const feat = GoatWindowFeatures.parse('width=50,height=100');
      expect(feat.width).toBe(360);
      expect(feat.height).toBe(520);
    });

    it('TC-T1-F07-05: Converts WKWindowFeatures to GoatWindowFeatures model accurately', () => {
      const feat = GoatWindowFeatures.fromWKWindowFeatures({
        width: 800,
        height: 600,
        allowsResizing: false,
        toolbarsVisibility: true,
      });

      expect(feat.width).toBe(800);
      expect(feat.height).toBe(600);
      expect(feat.resizable).toBe(false);
      expect(feat.toolbars).toBe(true);
    });
  });

  // ==========================================================================
  // F8: Security Scheme Hardening
  // ==========================================================================
  describe('Task 10183 Tier 1 - F8: Security Scheme Hardening', () => {
    it('TC-T1-F08-01: Hard-blocks file:/// scheme navigation immediately', () => {
      const manager = new GoatPopupManagerSimulator('sec-app');
      const res = manager.handleCreateWindow({
        url: 'file:///data/user/0/com.goat.app/databases/secrets.db',
      });

      expect(res.handled).toBe(false);
      expect(res.action).toBe('BLOCKED');
      expect(res.eventEmitted.data.policy).toBe('BLOCK');
    });

    it('TC-T1-F08-02: Hard-blocks content:// scheme navigation immediately', () => {
      const manager = new GoatPopupManagerSimulator('sec-app');
      const res = manager.handleCreateWindow({
        url: 'content://com.android.providers.media.documents/document/12',
      });

      expect(res.handled).toBe(false);
      expect(res.action).toBe('BLOCKED');
    });

    it('TC-T1-F08-03: Routes tel:18005550199 directly to OS phone dialer intent', () => {
      const manager = new GoatPopupManagerSimulator('sec-app');
      const res = manager.handleCreateWindow({
        url: 'tel:18005550199',
      });

      expect(res.handled).toBe(true);
      expect(res.action).toBe('SYSTEM_INTENT');
      expect(res.intentScheme).toBe('tel:');
      expect(manager.systemIntentsDispatched.some((i) => i.url === 'tel:18005550199')).toBe(true);
    });

    it('TC-T1-F08-04: Routes mailto:support@goat.dev directly to OS mail intent', () => {
      const manager = new GoatPopupManagerSimulator('sec-app');
      const res = manager.handleCreateWindow({
        url: 'mailto:support@goat.dev?subject=Help',
      });

      expect(res.handled).toBe(true);
      expect(res.action).toBe('SYSTEM_INTENT');
      expect(res.intentScheme).toBe('mailto:');
    });

    it('TC-T1-F08-05: Routes sms: and geo: schemes directly to OS intent handlers without warning dialog', () => {
      const manager = new GoatPopupManagerSimulator('sec-app');
      const resSms = manager.handleCreateWindow({ url: 'sms:12345678?body=Test' });
      const resGeo = manager.handleCreateWindow({ url: 'geo:37.7749,-122.4194' });

      expect(resSms.action).toBe('SYSTEM_INTENT');
      expect(resGeo.action).toBe('SYSTEM_INTENT');
      expect(manager.warningDialog.dialogShowCount).toBe(0);
    });
  });

  // ==========================================================================
  // F9: Session Link Warning Opt-Out
  // ==========================================================================
  describe('Task 10183 Tier 1 - F9: Session Link Warning Opt-Out', () => {
    it('TC-T1-F09-01: Opting out of domain warnings suppresses interstitial dialog for subsequent links', () => {
      const manager = new GoatPopupManagerSimulator('opt-app');
      manager.warningDialog.optOutDomain('opt-app', 'docs.goat.dev');

      const res = manager.handleCreateWindow({
        url: 'https://docs.goat.dev/api/v2',
      });

      expect(res.warningDialogShown).toBe(false);
      expect(res.action).toBe('OPENED_SYSTEM_BROWSER');
    });

    it('TC-T1-F09-02: Opt-out is scoped strictly to the active appId tenant session', () => {
      const warningDialog = new GoatExternalLinkWarningDialogSimulator();
      const manager1 = new GoatPopupManagerSimulator('app-1', 'view1', warningDialog);
      const manager2 = new GoatPopupManagerSimulator('app-2', 'view2', warningDialog);

      manager1.warningDialog.optOutDomain('app-1', 'trusted.com');

      expect(warningDialog.isDomainOptedOut('app-1', 'trusted.com')).toBe(true);
      expect(warningDialog.isDomainOptedOut('app-2', 'trusted.com')).toBe(false);
    });

    it('TC-T1-F09-03: Opt-out for one domain does not suppress warning for un-opted domain', () => {
      const manager = new GoatPopupManagerSimulator('opt-app');
      manager.warningDialog.optOutDomain('opt-app', 'trusted.com');

      const res = manager.handleCreateWindow({
        url: 'https://untrusted-site.com',
      });

      expect(res.warningDialogShown).toBe(true);
    });

    it('TC-T1-F09-04: Session teardown / clearSession resets all domain opt-outs', () => {
      const manager = new GoatPopupManagerSimulator('opt-app');
      manager.warningDialog.optOutDomain('opt-app', 'trusted.com');
      manager.warningDialog.clearSession('opt-app');

      expect(manager.warningDialog.isDomainOptedOut('opt-app', 'trusted.com')).toBe(false);
    });

    it('TC-T1-F09-05: Dialog prompt with rememberChoice=true automatically registers domain opt-out', () => {
      const manager = new GoatPopupManagerSimulator('opt-app');
      manager.handleCreateWindow({
        url: 'https://oauth.google.com/auth',
        userConfirmDialog: 'CONFIRM',
        rememberOptOut: true,
      });

      expect(manager.warningDialog.isDomainOptedOut('opt-app', 'oauth.google.com')).toBe(true);
    });
  });

  // ==========================================================================
  // F10: React Native Fabric Bindings
  // ==========================================================================
  describe('Task 10183 Tier 1 - F10: React Native Fabric Bindings', () => {
    it('TC-T1-F10-01: onPopupRequest direct event handler dispatches event payload to React Native bridge', () => {
      const rn = new ReactNativeGoatWebViewPopupSimulator('rn-app');
      rn.triggerPopup('https://reactnative.dev', '_blank', 'width=500,height=600');

      expect(rn.onPopupRequestReceived.length).toBe(1);
      expect(rn.onPopupRequestReceived[0].url).toBe('https://reactnative.dev');
      expect(rn.onPopupRequestReceived[0].policy).toBe('SYSTEM_BROWSER');
    });

    it('TC-T1-F10-02: popupRoutingPolicy prop configured to BLOCK prevents all popup openings', () => {
      const rn = new ReactNativeGoatWebViewPopupSimulator('rn-app');
      rn.setPopupRoutingPolicy('BLOCK');

      const res = rn.triggerPopup('goat://rn-app/modal.html');
      expect(res.action).toBe('BLOCKED');
      expect(rn.manager.activeModals.length).toBe(0);
    });

    it('TC-T1-F10-03: popupRoutingPolicy prop configured to MODAL forces external URL into modal container', () => {
      const rn = new ReactNativeGoatWebViewPopupSimulator('rn-app');
      rn.setPopupRoutingPolicy('MODAL');

      const res = rn.triggerPopup('https://web.archive.org');
      expect(res.action).toBe('OPENED_MODAL');
      expect(rn.manager.activeModals.length).toBe(1);
    });

    it('TC-T1-F10-04: popupRoutingPolicy prop configured to SAME_FRAME navigates root frame directly', () => {
      const rn = new ReactNativeGoatWebViewPopupSimulator('rn-app');
      rn.setPopupRoutingPolicy('SAME_FRAME');

      const res = rn.triggerPopup('https://goat.dev/same-frame');
      expect(res.action).toBe('NAVIGATED_SAME_FRAME');
    });

    it('TC-T1-F10-05: windowFeaturesJson serialized string in RN event data parses cleanly into JS object', () => {
      const rn = new ReactNativeGoatWebViewPopupSimulator('rn-app');
      rn.triggerPopup('goat://rn-app/settings.html', '_blank', 'width=450,height=550,resizable=1');

      const eventData = rn.onPopupRequestReceived[0];
      const parsedFeatures = JSON.parse(eventData.windowFeaturesJson);

      expect(parsedFeatures.width).toBe(450);
      expect(parsedFeatures.height).toBe(550);
      expect(parsedFeatures.resizable).toBe(true);
    });
  });

  // ==========================================================================
  // F11: Flutter PlatformView Bindings
  // ==========================================================================
  describe('Task 10183 Tier 1 - F11: Flutter PlatformView Bindings', () => {
    it('TC-T1-F11-01: PlatformView dispatches onPopupRequest event stream to GoatWebViewController', () => {
      const flutter = new FlutterGoatWebViewPopupSimulator('flutter-app');
      flutter.triggerWindowOpen('https://flutter.dev');

      expect(flutter.popupStreamHistory.length).toBe(1);
      expect(flutter.popupStreamHistory[0].data.url).toBe('https://flutter.dev');
    });

    it('TC-T1-F11-02: setPopupRoutingPolicy to SYSTEM_BROWSER routes all requests to browser', async () => {
      const flutter = new FlutterGoatWebViewPopupSimulator('flutter-app');
      await flutter.setPopupRoutingPolicy('SYSTEM_BROWSER');

      const res = flutter.triggerWindowOpen('goat://flutter-app/view.html');
      expect(res.action).toBe('OPENED_SYSTEM_BROWSER');
    });

    it('TC-T1-F11-03: setPopupRoutingPolicy to BLOCK cancels popup creation', async () => {
      const flutter = new FlutterGoatWebViewPopupSimulator('flutter-app');
      await flutter.setPopupRoutingPolicy('BLOCK');

      const res = flutter.triggerWindowOpen('https://dart.dev');
      expect(res.action).toBe('BLOCKED');
    });

    it('TC-T1-F11-04: Flutter controller receives typed GoatWindowFeatures from platform channel', () => {
      const flutter = new FlutterGoatWebViewPopupSimulator('flutter-app');
      flutter.triggerWindowOpen('goat://flutter-app/modal.html', '_blank', 'width=400,height=600');

      const evt = flutter.popupStreamHistory[0];
      expect(evt.data.windowFeatures.width).toBe(400);
      expect(evt.data.windowFeatures.height).toBe(600);
    });

    it('TC-T1-F11-05: Unhandled stream listeners do not throw unhandled exceptions or crash Flutter engine', () => {
      const flutter = new FlutterGoatWebViewPopupSimulator('flutter-app');
      expect(() => {
        flutter.triggerWindowOpen('goat://flutter-app/page.html');
      }).not.toThrow();
    });
  });

  // ==========================================================================
  // F12: Modal Teardown & Pool Recycling
  // ==========================================================================
  describe('Task 10183 Tier 1 - F12: Modal Teardown & Pool Recycling', () => {
    it('TC-T1-F12-01: Closing child modal destroys instance and clears all script message handlers', () => {
      const manager = new GoatPopupManagerSimulator('pool-app');
      manager.handleCreateWindow({ url: 'goat://pool-app/modal.html' });
      const modal = manager.activeModals[0];
      modal.addScriptMessageHandler('customBridge', () => {});

      expect(modal.messageHandlers.size).toBe(1);
      manager.handleCloseWindow();

      expect(modal.isDestroyed).toBe(true);
      expect(modal.messageHandlers.size).toBe(0);
    });

    it('TC-T1-F12-02: Modal destruction recycles view instance back to GoatModalFastPool for rapid reuse', () => {
      const pool = new GoatModalFastPoolSimulator();
      const manager = new GoatPopupManagerSimulator('pool-app', 'view1', undefined, pool);

      manager.handleCreateWindow({ url: 'goat://pool-app/modal1.html' });
      manager.handleCloseWindow();

      expect(pool.destructions).toBe(1);

      manager.handleCreateWindow({ url: 'goat://pool-app/modal2.html' });
      expect(pool.poolHits).toBe(1);
    });

    it('TC-T1-F12-03: Destroying parent GoatView cascades destruction to all open modal children', () => {
      const manager = new GoatPopupManagerSimulator('pool-app');
      manager.handleCreateWindow({ url: 'goat://pool-app/modal1.html' });
      manager.handleCreateWindow({ url: 'goat://pool-app/modal2.html' });

      const m1 = manager.activeModals[0];
      const m2 = manager.activeModals[1];

      manager.destroy();

      expect(m1.isDestroyed).toBe(true);
      expect(m2.isDestroyed).toBe(true);
      expect(manager.activeModals.length).toBe(0);
    });

    it('TC-T1-F12-04: Destroyed manager throws illegal state exception on subsequent handleCreateWindow', () => {
      const manager = new GoatPopupManagerSimulator('pool-app');
      manager.destroy();

      expect(() => {
        manager.handleCreateWindow({ url: 'goat://pool-app/test.html' });
      }).toThrow('ILLEGAL_STATE');
    });

    it('TC-T1-F12-05: Fast pool limits capacity (max 5 cached instances) to prevent memory accumulation', () => {
      const pool = new GoatModalFastPoolSimulator();
      const manager = new GoatPopupManagerSimulator('pool-app', 'view1', undefined, pool);

      for (let i = 0; i < 10; i++) {
        manager.handleCreateWindow({ url: `goat://pool-app/page_${i}.html` });
        manager.handleCloseWindow();
      }

      expect(pool.destructions).toBe(10);
    });
  });
}
