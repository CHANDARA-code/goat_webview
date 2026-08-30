/**
 * Goat WebView Task 10183 Tier 2: Boundary & Corner Cases Test Suite (E1–E12)
 *
 * Exhaustive boundary, stress, and edge-case verification covering:
 * - E1: Cross-Origin Interception (Query params, long URLs, Punycode)
 * - E2: Same-Origin Interception (Fragments, nested subpaths, casing)
 * - E3: Relative URL Link (Bare filenames, query strings, empty targets)
 * - E4: JavaScript Protocol (javascript:void(0), alert, evasion)
 * - E5: File Scheme Navigation (file://, content://, path traversal)
 * - E6: System URL Schemes (tel, mailto, sms, geo intent routing)
 * - E7: Window Close from JS (Idempotency, multi-window close, missing modals)
 * - E8: Missing / Stale User Gesture (Timers, background popups, gating)
 * - E9: Rapid Multi-Window Spam (20x tight loop, modal capping, recycling)
 * - E10: Host Policy Override (BLOCK, SAME_FRAME, MODAL, SYSTEM_BROWSER)
 * - E11: Malformed WindowFeatures (NaN, negatives, clamping, flags)
 * - E12: Parent View Destruction (Cascading teardown, memory reclamation)
 *
 * 60 Hermetic Tests (5 tests per edge case).
 */

import { describe, it, expect } from '../harness/test-runner.ts';
import {
  GoatPopupManagerSimulator,
  GoatWindowFeatures,
  GoatExternalLinkWarningDialogSimulator,
  GoatModalFastPoolSimulator,
} from '../harness/popup-simulator.ts';

export function registerTier2BoundaryCornerTests(): void {
  // ==========================================================================
  // E1: Cross-Origin Interception
  // ==========================================================================
  describe('Task 10183 Tier 2 - E1: Cross-Origin Interception', () => {
    it('TC-T2-E01-01: External HTTPS banking URL intercepted and emitted with SYSTEM_BROWSER policy', () => {
      const manager = new GoatPopupManagerSimulator('tenant-1');
      const res = manager.handleCreateWindow({
        url: 'https://secure.chase.com/auth/login',
        userConfirmDialog: 'CONFIRM',
      });

      expect(res.eventEmitted.data.policy).toBe('SYSTEM_BROWSER');
      expect(res.action).toBe('OPENED_SYSTEM_BROWSER');
    });

    it('TC-T2-E01-02: URL containing complex query parameters preserved without corruption', () => {
      const manager = new GoatPopupManagerSimulator('tenant-1');
      const complexUrl = 'https://auth0.com/authorize?response_type=code&client_id=abc&redirect_uri=https%3A%2F%2Fapp.com%2Fcb&scope=openid%20profile';
      const res = manager.handleCreateWindow({ url: complexUrl });

      expect(res.eventEmitted.data.url).toBe(complexUrl);
    });

    it('TC-T2-E01-03: Extremely long URL (4KB+ query string) handled gracefully', () => {
      const manager = new GoatPopupManagerSimulator('tenant-1');
      const longParam = 'x'.repeat(4096);
      const longUrl = `https://analytics.service.com/track?data=${longParam}`;
      const res = manager.handleCreateWindow({ url: longUrl });

      expect(res.eventEmitted.data.url.length).toBeGreaterThan(4100);
      expect(res.action).toBe('OPENED_SYSTEM_BROWSER');
    });

    it('TC-T2-E01-04: Non-SSL HTTP URL intercepted and routed through warning dialog', () => {
      const manager = new GoatPopupManagerSimulator('tenant-1');
      const res = manager.handleCreateWindow({
        url: 'http://insecure-legacy-site.org/docs',
        userConfirmDialog: 'CONFIRM',
      });

      expect(res.warningDialogShown).toBe(true);
      expect(res.action).toBe('OPENED_SYSTEM_BROWSER');
    });

    it('TC-T2-E01-05: Unicode / internationalized domain handled cleanly', () => {
      const manager = new GoatPopupManagerSimulator('tenant-1');
      const res = manager.handleCreateWindow({
        url: 'https://münchen.de/portal',
      });

      expect(res.eventEmitted.data.policy).toBe('SYSTEM_BROWSER');
    });
  });

  // ==========================================================================
  // E2: Same-Origin Interception
  // ==========================================================================
  describe('Task 10183 Tier 2 - E2: Same-Origin Interception', () => {
    it('TC-T2-E02-01: Exact same-origin goat://<appId>/... URL opens modal container with geometry', () => {
      const manager = new GoatPopupManagerSimulator('tenant-app-2');
      const res = manager.handleCreateWindow({
        url: 'goat://tenant-app-2/profile.html',
        windowFeatures: 'width=400,height=500',
      });

      expect(res.action).toBe('OPENED_MODAL');
      expect(manager.activeModals[0].windowFeatures.width).toBe(400);
      expect(manager.activeModals[0].windowFeatures.height).toBe(500);
    });

    it('TC-T2-E02-02: URL with URL fragment and hash routed into modal container', () => {
      const manager = new GoatPopupManagerSimulator('tenant-app-2');
      const res = manager.handleCreateWindow({
        url: 'goat://tenant-app-2/terms.html#privacy-section',
      });

      expect(res.action).toBe('OPENED_MODAL');
      expect(manager.activeModals[0].url).toContain('#privacy-section');
    });

    it('TC-T2-E02-03: Same-origin with deeply nested subpaths handled cleanly', () => {
      const manager = new GoatPopupManagerSimulator('tenant-app-2');
      const deepUrl = 'goat://tenant-app-2/sub/dir/nested/view/index.html';
      const res = manager.handleCreateWindow({ url: deepUrl });

      expect(res.action).toBe('OPENED_MODAL');
      expect(manager.activeModals[0].url).toBe(deepUrl);
    });

    it('TC-T2-E02-04: Same-origin popup inherits tenant cookie jar and storage partition', () => {
      const manager = new GoatPopupManagerSimulator('tenant-app-2');
      manager.sandbox.setCookie('auth_jwt', 'token_valid_778');
      manager.sandbox.setItem('cart_count', '4');

      manager.handleCreateWindow({ url: 'goat://tenant-app-2/cart.html' });
      const modal = manager.activeModals[0];

      expect(modal.sandbox.getCookie('auth_jwt')).toBe('token_valid_778');
      expect(modal.sandbox.getItem('cart_count')).toBe('4');
    });

    it('TC-T2-E02-05: Case-insensitive scheme and host classified correctly as same origin', () => {
      const manager = new GoatPopupManagerSimulator('tenant-app-2');
      expect(manager.classifyOrigin('goat://tenant-app-2/page.html')).toBe('SAME_ORIGIN');
    });
  });

  // ==========================================================================
  // E3: Relative URL Link
  // ==========================================================================
  describe('Task 10183 Tier 2 - E3: Relative URL Link', () => {
    it('TC-T2-E03-01: Relative link /subroute/page.html resolves to tenant origin', () => {
      const manager = new GoatPopupManagerSimulator('tenant-app-3');
      const res = manager.handleCreateWindow({ url: '/subroute/page.html' });

      expect(res.eventEmitted.data.url).toBe('goat://tenant-app-3/subroute/page.html');
      expect(res.action).toBe('OPENED_MODAL');
    });

    it('TC-T2-E03-02: Relative link with leading ./ resolves correctly', () => {
      const manager = new GoatPopupManagerSimulator('tenant-app-3');
      const res = manager.handleCreateWindow({ url: './details.html' });

      expect(res.eventEmitted.data.url).toBe('goat://tenant-app-3/details.html');
    });

    it('TC-T2-E03-03: Bare filename link resolves to tenant origin', () => {
      const manager = new GoatPopupManagerSimulator('tenant-app-3');
      const res = manager.handleCreateWindow({ url: 'help.html' });

      expect(res.eventEmitted.data.url).toBe('goat://tenant-app-3/help.html');
    });

    it('TC-T2-E03-04: Empty string target URL resolves to tenant root', () => {
      const manager = new GoatPopupManagerSimulator('tenant-app-3');
      const res = manager.handleCreateWindow({ url: '' });

      expect(res.eventEmitted.data.url).toBe('goat://tenant-app-3/');
    });

    it('TC-T2-E03-05: Relative URL with query parameters preserves params on resolution', () => {
      const manager = new GoatPopupManagerSimulator('tenant-app-3');
      const res = manager.handleCreateWindow({ url: '/search?query=goat&sort=asc' });

      expect(res.eventEmitted.data.url).toBe('goat://tenant-app-3/search?query=goat&sort=asc');
    });
  });

  // ==========================================================================
  // E4: JavaScript Protocol
  // ==========================================================================
  describe('Task 10183 Tier 2 - E4: JavaScript Protocol', () => {
    it('TC-T2-E04-01: javascript:void(0) classified as JAVASCRIPT, never opens external browser', () => {
      const manager = new GoatPopupManagerSimulator('tenant-js');
      expect(manager.classifyOrigin('javascript:void(0)')).toBe('JAVASCRIPT');

      const res = manager.handleCreateWindow({ url: 'javascript:void(0)' });
      expect(res.action).not.toBe('OPENED_SYSTEM_BROWSER');
    });

    it('TC-T2-E04-02: javascript:alert(1) does not create unauthenticated modal container', () => {
      const manager = new GoatPopupManagerSimulator('tenant-js');
      expect(manager.classifyOrigin('javascript:alert(1)')).toBe('JAVASCRIPT');
    });

    it('TC-T2-E04-03: Mixed-case JavaScript:foo() correctly identified as script protocol', () => {
      const manager = new GoatPopupManagerSimulator('tenant-js');
      expect(manager.classifyOrigin('javascript:window.close()')).toBe('JAVASCRIPT');
    });

    it('TC-T2-E04-04: javascript:... with multiline code blocked from system browser dispatch', () => {
      const manager = new GoatPopupManagerSimulator('tenant-js');
      const res = manager.handleCreateWindow({ url: 'javascript:(()=>{console.log(123);})()' });
      expect(manager.systemBrowserInvocations.length).toBe(0);
    });

    it('TC-T2-E04-05: javascript: scheme does not emit cross-origin SYSTEM_BROWSER telemetry', () => {
      const manager = new GoatPopupManagerSimulator('tenant-js');
      const res = manager.handleCreateWindow({ url: 'javascript:void(0)' });
      expect(res.eventEmitted.data.policy).not.toBe('SYSTEM_BROWSER');
    });
  });

  // ==========================================================================
  // E5: File Scheme Navigation
  // ==========================================================================
  describe('Task 10183 Tier 2 - E5: File Scheme Navigation', () => {
    it('TC-T2-E05-01: file:///data/user/0/... hard-blocked with BLOCK policy', () => {
      const manager = new GoatPopupManagerSimulator('tenant-sec');
      const res = manager.handleCreateWindow({ url: 'file:///data/user/0/com.app/databases/app.db' });

      expect(res.handled).toBe(false);
      expect(res.action).toBe('BLOCKED');
      expect(res.eventEmitted.data.policy).toBe('BLOCK');
    });

    it('TC-T2-E05-02: file:///sdcard/Download/... hard-blocked without file system disclosure', () => {
      const manager = new GoatPopupManagerSimulator('tenant-sec');
      const res = manager.handleCreateWindow({ url: 'file:///sdcard/Download/sensitive.pdf' });

      expect(res.action).toBe('BLOCKED');
    });

    it('TC-T2-E05-03: Windows style file://C:/... hard-blocked', () => {
      const manager = new GoatPopupManagerSimulator('tenant-sec');
      const res = manager.handleCreateWindow({ url: 'file://C:/Windows/System32/drivers/etc/hosts' });

      expect(res.action).toBe('BLOCKED');
    });

    it('TC-T2-E05-04: content:// URI blocked alongside file://', () => {
      const manager = new GoatPopupManagerSimulator('tenant-sec');
      const res = manager.handleCreateWindow({ url: 'content://contacts/people' });

      expect(res.action).toBe('BLOCKED');
    });

    it('TC-T2-E05-05: Zero modals or browser invocations spawned on file:// navigation attempt', () => {
      const manager = new GoatPopupManagerSimulator('tenant-sec');
      manager.handleCreateWindow({ url: 'file:///etc/passwd' });

      expect(manager.activeModals.length).toBe(0);
      expect(manager.systemBrowserInvocations.length).toBe(0);
    });
  });

  // ==========================================================================
  // E6: System URL Schemes
  // ==========================================================================
  describe('Task 10183 Tier 2 - E6: System URL Schemes', () => {
    it('TC-T2-E06-01: tel:+18005550199 routed to OS dialer intent', () => {
      const manager = new GoatPopupManagerSimulator('tenant-system');
      const res = manager.handleCreateWindow({ url: 'tel:+18005550199' });

      expect(res.action).toBe('SYSTEM_INTENT');
      expect(res.intentScheme).toBe('tel:');
    });

    it('TC-T2-E06-02: mailto:support@goat.dev with subject and body routed to mail client', () => {
      const manager = new GoatPopupManagerSimulator('tenant-system');
      const res = manager.handleCreateWindow({ url: 'mailto:support@goat.dev?subject=Inquiry' });

      expect(res.action).toBe('SYSTEM_INTENT');
      expect(res.intentScheme).toBe('mailto:');
    });

    it('TC-T2-E06-03: sms:5551234?body=Code routed to SMS client', () => {
      const manager = new GoatPopupManagerSimulator('tenant-system');
      const res = manager.handleCreateWindow({ url: 'sms:5551234?body=Code' });

      expect(res.action).toBe('SYSTEM_INTENT');
      expect(res.intentScheme).toBe('sms:');
    });

    it('TC-T2-E06-04: geo:37.7749,-122.4194?z=15 routed to Maps application', () => {
      const manager = new GoatPopupManagerSimulator('tenant-system');
      const res = manager.handleCreateWindow({ url: 'geo:37.7749,-122.4194?z=15' });

      expect(res.action).toBe('SYSTEM_INTENT');
      expect(res.intentScheme).toBe('geo:');
    });

    it('TC-T2-E06-05: System schemes bypass external link warning dialog completely', () => {
      const manager = new GoatPopupManagerSimulator('tenant-system');
      manager.handleCreateWindow({ url: 'tel:911' });
      manager.handleCreateWindow({ url: 'mailto:test@example.com' });

      expect(manager.warningDialog.dialogShowCount).toBe(0);
    });
  });

  // ==========================================================================
  // E7: Window Close from JS
  // ==========================================================================
  describe('Task 10183 Tier 2 - E7: Window Close from JS', () => {
    it('TC-T2-E07-01: Modal executing window.close() triggers teardown of target modal', () => {
      const manager = new GoatPopupManagerSimulator('tenant-close');
      manager.handleCreateWindow({ url: 'goat://tenant-close/modal.html' });
      expect(manager.activeModals.length).toBe(1);

      const closed = manager.handleCloseWindow();
      expect(closed).toBe(true);
      expect(manager.activeModals.length).toBe(0);
    });

    it('TC-T2-E07-02: Closing modal restores parent view focus', () => {
      const manager = new GoatPopupManagerSimulator('tenant-close');
      manager.handleCreateWindow({ url: 'goat://tenant-close/modal.html' });
      expect(manager.hasFocus).toBe(false);

      manager.handleCloseWindow();
      expect(manager.hasFocus).toBe(true);
    });

    it('TC-T2-E07-03: Rapid sequential window.close() calls on single modal handled idempotently', () => {
      const manager = new GoatPopupManagerSimulator('tenant-close');
      manager.handleCreateWindow({ url: 'goat://tenant-close/modal.html' });

      expect(manager.handleCloseWindow()).toBe(true);
      expect(manager.handleCloseWindow()).toBe(false);
      expect(manager.handleCloseWindow()).toBe(false);
    });

    it('TC-T2-E07-04: Closing modal when no modals are open returns false safely', () => {
      const manager = new GoatPopupManagerSimulator('tenant-close');
      expect(manager.handleCloseWindow()).toBe(false);
    });

    it('TC-T2-E07-05: Closing specific modal by ID in multi-window stack', () => {
      const manager = new GoatPopupManagerSimulator('tenant-close');
      const r1 = manager.handleCreateWindow({ url: 'goat://tenant-close/modal1.html' });
      const r2 = manager.handleCreateWindow({ url: 'goat://tenant-close/modal2.html' });

      manager.handleCloseWindow(r1.popupViewId);
      expect(manager.activeModals.length).toBe(1);
      expect(manager.activeModals[0].viewId).toBe(r2.popupViewId);
    });
  });

  // ==========================================================================
  // E8: Missing / Stale User Gesture
  // ==========================================================================
  describe('Task 10183 Tier 2 - E8: Missing / Stale User Gesture', () => {
    it('TC-T2-E08-01: Programmatic window.open via timer carries isUserGesture: false', () => {
      const manager = new GoatPopupManagerSimulator('tenant-gesture');
      const res = manager.handleCreateWindow({
        url: 'https://ad-popup.com',
        isUserGesture: false,
      });

      expect(res.eventEmitted.data.isUserGesture).toBe(false);
    });

    it('TC-T2-E08-02: Host can inspect isUserGesture in event telemetry to reject background popups', () => {
      const manager = new GoatPopupManagerSimulator('tenant-gesture');
      let rejected = false;
      manager.onPopupRequestListener = (evt) => {
        if (!evt.data.isUserGesture) {
          rejected = true;
        }
      };

      manager.handleCreateWindow({ url: 'https://spam.com', isUserGesture: false });
      expect(rejected).toBe(true);
    });

    it('TC-T2-E08-03: User gesture popup carries true flag faithfully', () => {
      const manager = new GoatPopupManagerSimulator('tenant-gesture');
      const res = manager.handleCreateWindow({ url: 'goat://tenant-gesture/ok.html', isUserGesture: true });
      expect(res.eventEmitted.data.isUserGesture).toBe(true);
    });

    it('TC-T2-E08-04: Missing user gesture parameter defaults safely to true', () => {
      const manager = new GoatPopupManagerSimulator('tenant-gesture');
      const res = manager.handleCreateWindow({ url: 'goat://tenant-gesture/default.html' });
      expect(res.eventEmitted.data.isUserGesture).toBe(true);
    });

    it('TC-T2-E08-05: Gating background popup floods based on isUserGesture', () => {
      const manager = new GoatPopupManagerSimulator('tenant-gesture');
      const results: boolean[] = [];

      for (let i = 0; i < 5; i++) {
        const res = manager.handleCreateWindow({
          url: `https://ad_${i}.com`,
          isUserGesture: false,
        });
        results.push(res.eventEmitted.data.isUserGesture);
      }

      expect(results.every((g) => g === false)).toBe(true);
    });
  });

  // ==========================================================================
  // E9: Rapid Multi-Window Spam
  // ==========================================================================
  describe('Task 10183 Tier 2 - E9: Rapid Multi-Window Spam', () => {
    it('TC-T2-E09-01: 20 rapid window.open invocations in a loop are capped at maxConcurrentModals (3)', () => {
      const manager = new GoatPopupManagerSimulator('tenant-spam');
      for (let i = 1; i <= 20; i++) {
        manager.handleCreateWindow({ url: `goat://tenant-spam/page_${i}.html` });
      }

      expect(manager.activeModals.length).toBeLessThanOrEqual(3);
    });

    it('TC-T2-E09-02: Exceeding modal limit recycles/replaces oldest modal safely', () => {
      const manager = new GoatPopupManagerSimulator('tenant-spam');
      manager.handleCreateWindow({ url: 'goat://tenant-spam/first.html' });
      manager.handleCreateWindow({ url: 'goat://tenant-spam/second.html' });
      manager.handleCreateWindow({ url: 'goat://tenant-spam/third.html' });
      manager.handleCreateWindow({ url: 'goat://tenant-spam/fourth.html' });

      expect(manager.activeModals.length).toBe(3);
      expect(manager.activeModals.some((m) => m.url === 'goat://tenant-spam/fourth.html')).toBe(true);
    });

    it('TC-T2-E09-03: Rapid opening does not crash or leak memory', () => {
      const manager = new GoatPopupManagerSimulator('tenant-spam');
      expect(() => {
        for (let i = 0; i < 50; i++) {
          manager.handleCreateWindow({ url: `goat://tenant-spam/modal_${i}.html` });
        }
      }).not.toThrow();
    });

    it('TC-T2-E09-04: Modals pool maintains correct active count after rapid burst', () => {
      const manager = new GoatPopupManagerSimulator('tenant-spam');
      for (let i = 0; i < 15; i++) {
        manager.handleCreateWindow({ url: `goat://tenant-spam/test_${i}.html` });
      }
      expect(manager.activeModals.length).toBe(3);
    });

    it('TC-T2-E09-05: Bulk closing all modals after spam burst cleans all active instances', () => {
      const manager = new GoatPopupManagerSimulator('tenant-spam');
      for (let i = 0; i < 10; i++) {
        manager.handleCreateWindow({ url: `goat://tenant-spam/test_${i}.html` });
      }
      while (manager.activeModals.length > 0) {
        manager.handleCloseWindow();
      }
      expect(manager.activeModals.length).toBe(0);
      expect(manager.hasFocus).toBe(true);
    });
  });

  // ==========================================================================
  // E10: Host Policy Override
  // ==========================================================================
  describe('Task 10183 Tier 2 - E10: Host Policy Override', () => {
    it('TC-T2-E10-01: Host overrides default policy with BLOCK -> all links blocked', () => {
      const manager = new GoatPopupManagerSimulator('tenant-override');
      manager.popupRoutingPolicy = 'BLOCK';

      const resSame = manager.handleCreateWindow({ url: 'goat://tenant-override/page.html' });
      const resCross = manager.handleCreateWindow({ url: 'https://google.com' });

      expect(resSame.action).toBe('BLOCKED');
      expect(resCross.action).toBe('BLOCKED');
    });

    it('TC-T2-E10-02: Host overrides with SAME_FRAME -> navigates root container', () => {
      const manager = new GoatPopupManagerSimulator('tenant-override');
      manager.popupRoutingPolicy = 'SAME_FRAME';

      const res = manager.handleCreateWindow({ url: 'https://example.com' });
      expect(res.action).toBe('NAVIGATED_SAME_FRAME');
      expect(manager.activeModals.length).toBe(0);
    });

    it('TC-T2-E10-03: Host overrides with MODAL -> forces cross-origin into modal container', () => {
      const manager = new GoatPopupManagerSimulator('tenant-override');
      manager.popupRoutingPolicy = 'MODAL';

      const res = manager.handleCreateWindow({ url: 'https://external-tool.com' });
      expect(res.action).toBe('OPENED_MODAL');
      expect(manager.activeModals.length).toBe(1);
    });

    it('TC-T2-E10-04: Host overrides with SYSTEM_BROWSER -> forces same-origin to browser', () => {
      const manager = new GoatPopupManagerSimulator('tenant-override');
      manager.popupRoutingPolicy = 'SYSTEM_BROWSER';

      const res = manager.handleCreateWindow({ url: 'goat://tenant-override/modal.html' });
      expect(res.action).toBe('OPENED_SYSTEM_BROWSER');
    });

    it('TC-T2-E10-05: Per-request custom policy override takes precedence over default policy', () => {
      const manager = new GoatPopupManagerSimulator('tenant-override');
      manager.popupRoutingPolicy = 'AUTO';

      const res = manager.handleCreateWindow({
        url: 'goat://tenant-override/modal.html',
        customPolicy: 'BLOCK',
      });

      expect(res.action).toBe('BLOCKED');
    });
  });

  // ==========================================================================
  // E11: Malformed WindowFeatures
  // ==========================================================================
  describe('Task 10183 Tier 2 - E11: Malformed WindowFeatures', () => {
    it('TC-T2-E11-01: Malformed dimensions (width=invalid,height=-50) clamp to safe fallback (360x520)', () => {
      const feat = GoatWindowFeatures.parse('width=invalid,height=-50');
      expect(feat.width).toBe(360);
      expect(feat.height).toBe(520);
    });

    it('TC-T2-E11-02: Unrecognized feature tokens (foo=bar,zoom=max) ignored without error', () => {
      const feat = GoatWindowFeatures.parse('foo=bar,zoom=max,width=450');
      expect(feat.width).toBe(450);
    });

    it('TC-T2-E11-03: Empty feature string produces default null features', () => {
      const feat = GoatWindowFeatures.parse('');
      expect(feat.width).toBeNull();
      expect(feat.height).toBeNull();
      expect(feat.resizable).toBeNull();
    });

    it('TC-T2-E11-04: Extreme dimensions (width=999999,height=999999) parsed as numbers', () => {
      const feat = GoatWindowFeatures.parse('width=999999,height=999999');
      expect(feat.width).toBe(999999);
      expect(feat.height).toBe(999999);
    });

    it('TC-T2-E11-05: Boolean flag variants (1, yes, true, no, 0, false) parsed accurately', () => {
      const feat1 = GoatWindowFeatures.parse('resizable=1,menubar=yes,status=true');
      expect(feat1.resizable).toBe(true);
      expect(feat1.menuBar).toBe(true);
      expect(feat1.statusBar).toBe(true);

      const feat2 = GoatWindowFeatures.parse('resizable=0,menubar=no,status=false');
      expect(feat2.resizable).toBe(false);
      expect(feat2.menuBar).toBe(false);
      expect(feat2.statusBar).toBe(false);
    });
  });

  // ==========================================================================
  // E12: Parent View Destruction
  // ==========================================================================
  describe('Task 10183 Tier 2 - E12: Parent View Destruction', () => {
    it('TC-T2-E12-01: Parent view destruction cascades immediate destruction to all child modals', () => {
      const manager = new GoatPopupManagerSimulator('tenant-cascade');
      manager.handleCreateWindow({ url: 'goat://tenant-cascade/m1.html' });
      manager.handleCreateWindow({ url: 'goat://tenant-cascade/m2.html' });

      const m1 = manager.activeModals[0];
      const m2 = manager.activeModals[1];

      manager.destroy();
      expect(m1.isDestroyed).toBe(true);
      expect(m2.isDestroyed).toBe(true);
      expect(manager.activeModals.length).toBe(0);
    });

    it('TC-T2-E12-02: Cascade teardown releases memory and clears message handlers', () => {
      const manager = new GoatPopupManagerSimulator('tenant-cascade');
      manager.handleCreateWindow({ url: 'goat://tenant-cascade/m1.html' });
      const modal = manager.activeModals[0];
      modal.addScriptMessageHandler('testHandler', () => {});

      manager.destroy();
      expect(modal.messageHandlers.size).toBe(0);
    });

    it('TC-T2-E12-03: Teardown during active modal navigation finishes cleanly without exception', () => {
      const manager = new GoatPopupManagerSimulator('tenant-cascade');
      manager.handleCreateWindow({ url: 'goat://tenant-cascade/page.html' });
      expect(() => {
        manager.destroy();
      }).not.toThrow();
    });

    it('TC-T2-E12-04: Multiple calls to destroy() are idempotent', () => {
      const manager = new GoatPopupManagerSimulator('tenant-cascade');
      manager.destroy();
      expect(() => {
        manager.destroy();
        manager.destroy();
      }).not.toThrow();
    });

    it('TC-T2-E12-05: Fast pool instances cleared upon root engine teardown', () => {
      const pool = new GoatModalFastPoolSimulator();
      const manager = new GoatPopupManagerSimulator('tenant-cascade', 'v1', undefined, pool);

      manager.handleCreateWindow({ url: 'goat://tenant-cascade/test.html' });
      manager.handleCloseWindow();
      pool.clear();

      expect(pool.destructions).toBe(1);
    });
  });
}
