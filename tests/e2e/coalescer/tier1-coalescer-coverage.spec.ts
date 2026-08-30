/**
 * Goat WebView Task 10200 — Tier 1: Feature Coverage (Category-Partition)
 *
 * Implements 5 comprehensive nominal test cases for each of the 7 core coalescer features:
 * - Feature 1: IME Keyboard Insets & Height Tracking (F1)
 * - Feature 2: Safe Area & Viewport Geometry Updates (F2)
 * - Feature 3: Hardware Sensor Streams (F3)
 * - Feature 4: Gesture & Page Scroll Tracking (F4)
 * - Feature 5: Predictive Back Gesture Progress (F5)
 * - Feature 6: Generic Bridge Action Handler & Core IPC Engine (F6)
 * - Feature 7: Deterministic Lifecycle, Teardown & Fast Pool Management (F7)
 *
 * Total: 35 Tier-1 Feature Coverage Test Cases
 */

import { describe, it, expect } from '../harness/test-runner.ts';
import {
  GoatEventCoalescerSimulator,
  GoatKeyboardManagerSimulator,
  GoatSafeAreaManagerSimulator,
  GoatSensorManagerSimulator,
  GoatGestureScrollCoordinatorSimulator,
  GoatPredictiveBackCoordinatorSimulator,
} from '../harness/coalescer-simulator.ts';

export function registerCoalescerTier1CoverageTests(): void {
  // --------------------------------------------------------------------------
  // Feature 1: IME Keyboard Inset & Viewport Height Tracking
  // --------------------------------------------------------------------------
  describe('Tier 1: Feature 1 — IME Keyboard Inset & Height Tracking', () => {
    it('T1.F01.01: Emits keyboard height change on single focus transition', () => {
      const coalescer = new GoatEventCoalescerSimulator(50);
      const keyboard = new GoatKeyboardManagerSimulator(coalescer);

      keyboard.onKeyboardInsetsChange(310, true, 250);

      expect(coalescer.getDispatchedCount('ON_KEYBOARD_HEIGHT_CHANGE')).toBe(1);
      const last = coalescer.getLastEmitted('ON_KEYBOARD_HEIGHT_CHANGE');
      expect(last?.height).toBe(310);
      expect(last?.isVisible).toBe(true);
      expect(last?.duration).toBe(250);
    });

    it('T1.F01.02: Deduplicates identical keyboard height events on redundant layout passes', () => {
      const coalescer = new GoatEventCoalescerSimulator(50);
      const keyboard = new GoatKeyboardManagerSimulator(coalescer);

      // First emission passes
      keyboard.onKeyboardInsetsChange(300, true);
      expect(coalescer.getDispatchedCount('ON_KEYBOARD_HEIGHT_CHANGE')).toBe(1);

      // Redundant layout passes with identical payload are dropped
      keyboard.onKeyboardInsetsChange(300, true);
      keyboard.onKeyboardInsetsChange(300, true);
      keyboard.onKeyboardInsetsChange(300, true);

      expect(coalescer.getDispatchedCount('ON_KEYBOARD_HEIGHT_CHANGE')).toBe(1);
      expect(coalescer.deduplicatedCount).toBe(3);
    });

    it('T1.F01.03: Throttles 120Hz smooth keyboard open animation to latest target height', async () => {
      const coalescer = new GoatEventCoalescerSimulator(50);
      const keyboard = new GoatKeyboardManagerSimulator(coalescer);

      // Simulate 15-frame animation from 0 to 330px
      keyboard.simulateKeyboardOpenAnimation(330, 15);

      // Leading edge fires frame 1 (22px)
      expect(coalescer.getDispatchedCount('ON_KEYBOARD_HEIGHT_CHANGE')).toBe(1);

      // Trailing edge flushed
      coalescer.flush('ON_KEYBOARD_HEIGHT_CHANGE');

      // Final state carries full 330px target height
      const last = coalescer.getLastEmitted('ON_KEYBOARD_HEIGHT_CHANGE');
      expect(last?.height).toBe(330);
      expect(last?.isVisible).toBe(true);
    });

    it('T1.F01.04: Emits zero-height and isVisible=false on keyboard dismiss', () => {
      const coalescer = new GoatEventCoalescerSimulator(50);
      const keyboard = new GoatKeyboardManagerSimulator(coalescer);

      keyboard.onKeyboardInsetsChange(280, true);
      keyboard.simulateKeyboardClose();
      coalescer.flush('ON_KEYBOARD_HEIGHT_CHANGE');

      const last = coalescer.getLastEmitted('ON_KEYBOARD_HEIGHT_CHANGE');
      expect(last?.height).toBe(0);
      expect(last?.isVisible).toBe(false);
    });

    it('T1.F01.05: Correctly handles split/floating keyboard geometry transition', () => {
      const coalescer = new GoatEventCoalescerSimulator(50);

      coalescer.emit('ON_KEYBOARD_HEIGHT_CHANGE', {
        height: 120,
        isVisible: true,
        isFloating: true,
        docked: false,
      });

      const last = coalescer.getLastEmitted('ON_KEYBOARD_HEIGHT_CHANGE');
      expect(last?.height).toBe(120);
      expect(last?.isFloating).toBe(true);
      expect(last?.docked).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // Feature 2: Safe Area & Viewport Geometry Updates
  // --------------------------------------------------------------------------
  describe('Tier 1: Feature 2 — Safe Area & Viewport Geometry Updates', () => {
    it('T1.F02.01: Emits safe area insets for notched portrait display', () => {
      const coalescer = new GoatEventCoalescerSimulator(50);
      const safeArea = new GoatSafeAreaManagerSimulator(coalescer);

      safeArea.updateInsets(47, 34, 0, 0);

      expect(coalescer.getDispatchedCount('ON_SAFE_AREA_CHANGED')).toBe(1);
      const last = coalescer.getLastEmitted('ON_SAFE_AREA_CHANGED');
      expect(last?.top).toBe(47);
      expect(last?.bottom).toBe(34);
      expect(last?.left).toBe(0);
      expect(last?.right).toBe(0);
    });

    it('T1.F02.02: Deduplicates repeated layout pass insets with zero bridge overhead', () => {
      const coalescer = new GoatEventCoalescerSimulator(50);
      const safeArea = new GoatSafeAreaManagerSimulator(coalescer);

      safeArea.updateInsets(47, 34, 0, 0);
      safeArea.updateInsets(47, 34, 0, 0);
      safeArea.updateInsets(47, 34, 0, 0);

      expect(coalescer.getDispatchedCount('ON_SAFE_AREA_CHANGED')).toBe(1);
      expect(coalescer.deduplicatedCount).toBe(2);
    });

    it('T1.F02.03: Coalesces dynamic device rotation insets to landscape', () => {
      const coalescer = new GoatEventCoalescerSimulator(50);
      const safeArea = new GoatSafeAreaManagerSimulator(coalescer);

      safeArea.updateInsets(47, 34, 0, 0);
      safeArea.rotateDevice('landscape');
      coalescer.flush('ON_SAFE_AREA_CHANGED');

      const last = coalescer.getLastEmitted('ON_SAFE_AREA_CHANGED');
      expect(last?.top).toBe(0);
      expect(last?.bottom).toBe(21);
      expect(last?.left).toBe(47);
      expect(last?.right).toBe(47);
      expect(last?.orientation).toBe('landscape');
    });

    it('T1.F02.04: Preserves Dynamic Island sub-pixel insets accurately', () => {
      const coalescer = new GoatEventCoalescerSimulator(50);

      coalescer.emit('ON_SAFE_AREA_CHANGED', {
        top: 59.33,
        bottom: 34.0,
        left: 0.0,
        right: 0.0,
        hasDynamicIsland: true,
      });

      const last = coalescer.getLastEmitted('ON_SAFE_AREA_CHANGED');
      expect(last?.top).toBe(59.33);
      expect(last?.hasDynamicIsland).toBe(true);
    });

    it('T1.F02.05: Emits viewport resize dimensions alongside safe area', () => {
      const coalescer = new GoatEventCoalescerSimulator(50);

      coalescer.emit('ON_VIEWPORT_RESIZE', {
        width: 393,
        height: 852,
        scale: 3.0,
      });

      const last = coalescer.getLastEmitted('ON_VIEWPORT_RESIZE');
      expect(last?.width).toBe(393);
      expect(last?.height).toBe(852);
      expect(last?.scale).toBe(3.0);
    });
  });

  // --------------------------------------------------------------------------
  // Feature 3: Hardware Sensor Streams
  // --------------------------------------------------------------------------
  describe('Tier 1: Feature 3 — Hardware Sensor Streams', () => {
    it('T1.F03.01: Throttles 500Hz high-frequency accelerometer stream to configured interval', () => {
      const coalescer = new GoatEventCoalescerSimulator(50);
      const sensors = new GoatSensorManagerSimulator(coalescer);

      sensors.startAccelerometer(50);

      // Push 50 rapid readings in burst
      for (let i = 1; i <= 50; i++) {
        sensors.pushReading(0.1 * i, 0.2 * i, 9.8);
      }

      // First sample was dispatched immediately (leading edge)
      expect(coalescer.getDispatchedCount('ON_ACCELEROMETER_CHANGE')).toBe(1);

      // Flush trailing edge
      coalescer.flush('ON_ACCELEROMETER_CHANGE');
      expect(coalescer.getDispatchedCount('ON_ACCELEROMETER_CHANGE')).toBe(2);

      // Trailing sample carried latest 50th reading
      const last = coalescer.getLastEmitted('ON_ACCELEROMETER_CHANGE');
      expect(last?.x).toBeCloseTo(5.0);
      expect(last?.y).toBeCloseTo(10.0);
      expect(last?.z).toBe(9.8);
    });

    it('T1.F03.02: Deduplicates stationary identical sensor readings', () => {
      const coalescer = new GoatEventCoalescerSimulator(50);
      const sensors = new GoatSensorManagerSimulator(coalescer);

      sensors.startAccelerometer(50);
      sensors.pushReading(0.0, 0.0, 9.81);
      sensors.pushReading(0.0, 0.0, 9.81);
      sensors.pushReading(0.0, 0.0, 9.81);

      expect(coalescer.getDispatchedCount('ON_ACCELEROMETER_CHANGE')).toBe(1);
      expect(coalescer.deduplicatedCount).toBe(2);
    });

    it('T1.F03.03: Handles independent gyroscope stream alongside accelerometer', () => {
      const coalescer = new GoatEventCoalescerSimulator(50);
      const sensors = new GoatSensorManagerSimulator(coalescer);

      sensors.startAccelerometer(50);
      sensors.pushReading(0.5, 0.5, 9.8);
      sensors.pushGyroscopeReading(1.2, 0.0, -0.5);

      expect(coalescer.getDispatchedCount('ON_ACCELEROMETER_CHANGE')).toBe(1);
      expect(coalescer.getDispatchedCount('ON_GYROSCOPE_CHANGE')).toBe(1);

      const gyro = coalescer.getLastEmitted('ON_GYROSCOPE_CHANGE');
      expect(gyro?.alpha).toBe(1.2);
      expect(gyro?.gamma).toBe(-0.5);
    });

    it('T1.F03.04: Supports custom 20Hz (50ms) vs 60Hz (16ms) interval configuration', () => {
      const coalescer = new GoatEventCoalescerSimulator(16);

      coalescer.emit('ON_DEVICE_MOTION_CHANGE', { acceleration: { x: 1, y: 2, z: 3 } }, 16);
      expect(coalescer.getDispatchedCount('ON_DEVICE_MOTION_CHANGE')).toBe(1);
    });

    it('T1.F03.05: Cancels pending sensor timers when sensor listener stops', () => {
      const coalescer = new GoatEventCoalescerSimulator(50);
      const sensors = new GoatSensorManagerSimulator(coalescer);

      sensors.startAccelerometer(50);
      sensors.pushReading(0.1, 0.2, 9.8);
      sensors.pushReading(0.3, 0.4, 9.8); // scheduled in pending

      expect(coalescer.getPending('ON_ACCELEROMETER_CHANGE')).not.toBeNull();

      // Stop sensor cancels pending
      sensors.stopAccelerometer();
      expect(coalescer.getPending('ON_ACCELEROMETER_CHANGE')).toBeNull();
    });
  });

  // --------------------------------------------------------------------------
  // Feature 4: Gesture & Page Scroll Tracking
  // --------------------------------------------------------------------------
  describe('Tier 1: Feature 4 — Gesture & Page Scroll Tracking', () => {
    it('T1.F04.01: Emits initial scroll offset upon scroll gesture start', () => {
      const coalescer = new GoatEventCoalescerSimulator(50);
      const scroll = new GoatGestureScrollCoordinatorSimulator(coalescer);

      scroll.onScroll(0, 45);

      expect(coalescer.getDispatchedCount('ON_PAGE_SCROLL')).toBe(1);
      const last = coalescer.getLastEmitted('ON_PAGE_SCROLL');
      expect(last?.scrollX).toBe(0);
      expect(last?.scrollY).toBe(45);
    });

    it('T1.F04.02: Coalesces 120Hz high-velocity fling momentum to latest position', () => {
      const coalescer = new GoatEventCoalescerSimulator(50);
      const scroll = new GoatGestureScrollCoordinatorSimulator(coalescer);

      // Simulate 20-frame fling from 0 to 1200px
      scroll.simulateFling(0, 1200, 20);

      expect(coalescer.getDispatchedCount('ON_PAGE_SCROLL')).toBe(1); // Leading edge
      coalescer.flush('ON_PAGE_SCROLL'); // Trailing edge

      const last = coalescer.getLastEmitted('ON_PAGE_SCROLL');
      expect(last?.scrollY).toBe(1200);
    });

    it('T1.F04.03: Deduplicates stationary scroll position when finger holds still', () => {
      const coalescer = new GoatEventCoalescerSimulator(50);
      const scroll = new GoatGestureScrollCoordinatorSimulator(coalescer);

      scroll.onScroll(0, 300);
      scroll.onScroll(0, 300);
      scroll.onScroll(0, 300);

      expect(coalescer.getDispatchedCount('ON_PAGE_SCROLL')).toBe(1);
      expect(coalescer.deduplicatedCount).toBe(2);
    });

    it('T1.F04.04: Captures direction reversal with latest inverted offset', () => {
      const coalescer = new GoatEventCoalescerSimulator(50);
      const scroll = new GoatGestureScrollCoordinatorSimulator(coalescer);

      scroll.onScroll(0, 500); // initial
      scroll.onScroll(0, 600); // up
      scroll.onScroll(0, 400); // reversed down

      coalescer.flush('ON_PAGE_SCROLL');
      const last = coalescer.getLastEmitted('ON_PAGE_SCROLL');
      expect(last?.scrollY).toBe(400);
    });

    it('T1.F04.05: Flushes final resting scroll offset on gesture end', () => {
      const coalescer = new GoatEventCoalescerSimulator(50);
      const scroll = new GoatGestureScrollCoordinatorSimulator(coalescer);

      scroll.onScroll(0, 100);
      scroll.onScroll(0, 250);

      const flushed = coalescer.flush('ON_PAGE_SCROLL');
      expect(flushed).toBe(true);
      expect(coalescer.getLastEmitted('ON_PAGE_SCROLL')?.scrollY).toBe(250);
      expect(coalescer.getPending('ON_PAGE_SCROLL')).toBeNull();
    });
  });

  // --------------------------------------------------------------------------
  // Feature 5: Predictive Back Gesture Progress
  // --------------------------------------------------------------------------
  describe('Tier 1: Feature 5 — Predictive Back Gesture Progress', () => {
    it('T1.F05.01: Emits 120 FPS predictive back progress on swipe start', () => {
      const coalescer = new GoatEventCoalescerSimulator(16);
      const back = new GoatPredictiveBackCoordinatorSimulator(coalescer);

      back.onBackProgress(0.05, 20, 350, 'left');

      expect(coalescer.getDispatchedCount('ON_PREDICTIVE_BACK_PROGRESS')).toBe(1);
      const last = coalescer.getLastEmitted('ON_PREDICTIVE_BACK_PROGRESS');
      expect(last?.progress).toBe(0.05);
      expect(last?.edge).toBe('left');
    });

    it('T1.F05.02: Deduplicates static finger hold during back gesture', () => {
      const coalescer = new GoatEventCoalescerSimulator(16);
      const back = new GoatPredictiveBackCoordinatorSimulator(coalescer);

      back.onBackProgress(0.5, 150, 350, 'left');
      back.onBackProgress(0.5, 150, 350, 'left');
      back.onBackProgress(0.5, 150, 350, 'left');

      expect(coalescer.getDispatchedCount('ON_PREDICTIVE_BACK_PROGRESS')).toBe(1);
      expect(coalescer.deduplicatedCount).toBe(2);
    });

    it('T1.F05.03: Cancels pending progress updates immediately upon swipe abort', () => {
      const coalescer = new GoatEventCoalescerSimulator(16);
      const back = new GoatPredictiveBackCoordinatorSimulator(coalescer);

      back.onBackProgress(0.3, 80, 300, 'left');
      back.onBackProgress(0.4, 110, 300, 'left'); // pending

      back.onBackCancelled();

      expect(coalescer.getPending('ON_PREDICTIVE_BACK_PROGRESS')).toBeNull();
      expect(coalescer.getDispatchedCount('ON_PREDICTIVE_BACK_CANCELLED')).toBe(1);
    });

    it('T1.F05.04: Flushes full commit event upon completed back swipe', () => {
      const coalescer = new GoatEventCoalescerSimulator(16);
      const back = new GoatPredictiveBackCoordinatorSimulator(coalescer);

      back.onBackProgress(0.2, 50, 300, 'left');
      back.onBackProgress(0.95, 290, 300, 'left');

      back.onBackCommitted();

      expect(coalescer.getDispatchedCount('ON_PREDICTIVE_BACK_COMMITTED')).toBe(1);
      const lastProgress = coalescer.getLastEmitted('ON_PREDICTIVE_BACK_PROGRESS');
      expect(lastProgress?.progress).toBe(0.95);
    });

    it('T1.F05.05: Distinguishes left edge vs right edge back gestures', () => {
      const coalescer = new GoatEventCoalescerSimulator(16);
      const back = new GoatPredictiveBackCoordinatorSimulator(coalescer);

      back.onBackProgress(0.1, 380, 200, 'right');

      const last = coalescer.getLastEmitted('ON_PREDICTIVE_BACK_PROGRESS');
      expect(last?.edge).toBe('right');
      expect(last?.touchX).toBe(380);
    });
  });

  // --------------------------------------------------------------------------
  // Feature 6: Generic Bridge Action Handler & Core IPC Engine
  // --------------------------------------------------------------------------
  describe('Tier 1: Feature 6 — Generic Bridge Action Handler & Core IPC Engine', () => {
    it('T1.F06.01: Verified acceptance criteria: 1000 duplicate flood yields exactly 1 dispatch', () => {
      const coalescer = new GoatEventCoalescerSimulator(50);
      let bridgeDispatches = 0;

      const payload = { latitude: 37.7749, longitude: -122.4194, accuracy: 5.0 };

      // Flood 1000 times
      for (let i = 0; i < 1000; i++) {
        coalescer.emit('ON_LOCATION_CHANGE', payload, 50, () => {
          bridgeDispatches++;
        });
      }

      expect(bridgeDispatches).toBe(1);
      expect(coalescer.deduplicatedCount).toBe(999);
      expect(coalescer.getDispatchedCount('ON_LOCATION_CHANGE')).toBe(1);
    });

    it('T1.F06.02: Schedules independent timers across distinct event keys without interference', () => {
      const coalescer = new GoatEventCoalescerSimulator(50);

      coalescer.emit('KEY_A', { val: 1 });
      coalescer.emit('KEY_B', { val: 100 });
      coalescer.emit('KEY_C', { val: 1000 });

      expect(coalescer.getDispatchedCount('KEY_A')).toBe(1);
      expect(coalescer.getDispatchedCount('KEY_B')).toBe(1);
      expect(coalescer.getDispatchedCount('KEY_C')).toBe(1);
      expect(coalescer.getDispatchedCount()).toBe(3);
    });

    it('T1.F06.03: Handles deep nested JSON equality accurately', () => {
      const coalescer = new GoatEventCoalescerSimulator(50);

      const nested1 = { user: { id: 101, meta: { roles: ['admin', 'mini-app'] } }, count: 5 };
      const nested2 = { user: { id: 101, meta: { roles: ['admin', 'mini-app'] } }, count: 5 };
      const nested3 = { user: { id: 101, meta: { roles: ['admin', 'user'] } }, count: 5 };

      coalescer.emit('ON_USER_STATE', nested1);
      coalescer.emit('ON_USER_STATE', nested2); // dropped
      coalescer.emit('ON_USER_STATE', nested3); // scheduled
      coalescer.flush('ON_USER_STATE'); // trailing flush

      expect(coalescer.getDispatchedCount('ON_USER_STATE')).toBe(2);
      expect(coalescer.deduplicatedCount).toBe(1);
    });

    it('T1.F06.04: Supports 0ms interval for immediate unthrottled passthrough', () => {
      const coalescer = new GoatEventCoalescerSimulator(50);

      coalescer.emit('ON_CRITICAL_EVENT', { seq: 1 }, 0);
      coalescer.emit('ON_CRITICAL_EVENT', { seq: 2 }, 0);
      coalescer.emit('ON_CRITICAL_EVENT', { seq: 3 }, 0);

      expect(coalescer.getDispatchedCount('ON_CRITICAL_EVENT')).toBe(3);
    });

    it('T1.F06.05: Mutating input object post-emission does not corrupt internal coalescer state', () => {
      const coalescer = new GoatEventCoalescerSimulator(50);

      const mutableObj = { count: 10 };
      coalescer.emit('ON_COUNTER', mutableObj);

      // Mutate external object
      mutableObj.count = 999;

      const last = coalescer.getLastEmitted('ON_COUNTER');
      expect(last?.count).toBe(10); // Internal state remained pristine
    });
  });

  // --------------------------------------------------------------------------
  // Feature 7: Deterministic Lifecycle, Teardown & Fast Pool Management
  // --------------------------------------------------------------------------
  describe('Tier 1: Feature 7 — Deterministic Lifecycle, Teardown & Fast Pool', () => {
    it('T1.F07.01: Explicit single-key flush dispatches pending payload immediately', () => {
      const coalescer = new GoatEventCoalescerSimulator(50);

      coalescer.emit('ON_DATA', { v: 1 });
      coalescer.emit('ON_DATA', { v: 2 }); // pending in trailing window

      expect(coalescer.getPending('ON_DATA')).not.toBeNull();
      const flushed = coalescer.flush('ON_DATA');

      expect(flushed).toBe(true);
      expect(coalescer.getLastEmitted('ON_DATA')?.v).toBe(2);
      expect(coalescer.getPending('ON_DATA')).toBeNull();
    });

    it('T1.F07.02: flushAll flushes all pending updates across all registered keys atomically', () => {
      const coalescer = new GoatEventCoalescerSimulator(50);

      coalescer.emit('KEY_1', { val: 'a1' });
      coalescer.emit('KEY_1', { val: 'a2' }); // pending

      coalescer.emit('KEY_2', { val: 'b1' });
      coalescer.emit('KEY_2', { val: 'b2' }); // pending

      coalescer.emit('KEY_3', { val: 'c1' });
      coalescer.emit('KEY_3', { val: 'c2' }); // pending

      const flushedCount = coalescer.flushAll();
      expect(flushedCount).toBe(3);
      expect(coalescer.getLastEmitted('KEY_1')?.val).toBe('a2');
      expect(coalescer.getLastEmitted('KEY_2')?.val).toBe('b2');
      expect(coalescer.getLastEmitted('KEY_3')?.val).toBe('c2');
    });

    it('T1.F07.03: cancel(eventKey) drops pending timer and prevents trailing dispatch', () => {
      const coalescer = new GoatEventCoalescerSimulator(50);

      coalescer.emit('ON_SENSOR', { s: 1 });
      coalescer.emit('ON_SENSOR', { s: 2 }); // pending

      coalescer.cancel('ON_SENSOR');

      expect(coalescer.getPending('ON_SENSOR')).toBeNull();
      expect(coalescer.getDispatchedCount('ON_SENSOR')).toBe(1);
    });

    it('T1.F07.04: cancelAll clears all pending timers upon mini-app session close', () => {
      const coalescer = new GoatEventCoalescerSimulator(50);

      coalescer.emit('EVT_A', { x: 1 });
      coalescer.emit('EVT_A', { x: 2 });
      coalescer.emit('EVT_B', { y: 1 });
      coalescer.emit('EVT_B', { y: 2 });

      coalescer.cancelAll();

      expect(coalescer.getPending('EVT_A')).toBeNull();
      expect(coalescer.getPending('EVT_B')).toBeNull();
    });

    it('T1.F07.05: Teardown during active in-flight timers executes safely without errors', () => {
      const coalescer = new GoatEventCoalescerSimulator(50);

      coalescer.emit('IN_FLIGHT', { step: 1 });
      coalescer.emit('IN_FLIGHT', { step: 2 });

      coalescer.destroy();

      // Subsequent emit rejected cleanly
      const emitRes = coalescer.emit('IN_FLIGHT', { step: 3 });
      expect(emitRes).toBe(false);
      expect(coalescer.flush('IN_FLIGHT')).toBe(false);
    });
  });
}
