/**
 * Goat WebView Coalescer & High-Frequency Event Runtime Simulator
 *
 * Implements comprehensive multi-platform models for Task 10200:
 * - Generic Dedup-on-change & Trailing-Edge Throttling (GoatEventCoalescer)
 * - Deep JSON payload equality (primitives, nested objects, arrays, booleans, nulls)
 * - Thread-safe emission, independent eventKey timers, trailing execution
 * - IME Keyboard Manager simulation (height changes, 120Hz animations, show/hide)
 * - Safe Area Manager simulation (safe area insets, notch, dynamic island, rotation)
 * - Sensor Manager simulation (500Hz accelerometer, gyroscope, motion streams)
 * - Gesture Scroll Coordinator simulation (120Hz scroll offset, momentum fling, resting)
 * - Predictive Back Coordinator simulation (120 FPS progress, cancel vs commit)
 * - Native Bridge Action Handler & Dispatcher simulation
 * - Lifecycle & Fast Pool Teardown simulation (flush, cancelAll, flight teardown)
 */

export interface JsonObject {
  [key: string]: any;
}

export type DispatcherFn = (eventKey: string, payload: JsonObject) => void;

export interface DispatchedEvent {
  eventKey: string;
  payload: JsonObject;
  timestamp: number;
}

/**
 * Deep equality helper for JSON-serializable payloads
 */
export function arePayloadsEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') {
    return false;
  }
  if (Array.isArray(a) !== Array.isArray(b)) return false;

  if (Array.isArray(a)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!arePayloadsEqual(a[i], b[i])) return false;
    }
    return true;
  }

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
    if (!arePayloadsEqual(a[key], b[key])) return false;
  }
  return true;
}

/**
 * Deep clone helper
 */
export function clonePayload<T>(payload: T): T {
  if (payload === null || typeof payload !== 'object') {
    return payload;
  }
  return JSON.parse(JSON.stringify(payload));
}

/**
 * In-memory simulator for GoatEventCoalescer (Android & iOS runtime parity)
 */
export class GoatEventCoalescerSimulator {
  private lastEmitted: Map<string, JsonObject> = new Map();
  private pending: Map<string, JsonObject> = new Map();
  private timers: Map<string, any> = new Map();
  private dispatchers: Map<string, DispatcherFn> = new Map();
  private defaultMinIntervalMs: number;
  private isDestroyed = false;

  public dispatchLog: DispatchedEvent[] = [];
  public emitCallCount = 0;
  public deduplicatedCount = 0;
  public throttledCount = 0;

  constructor(defaultMinIntervalMs = 50) {
    this.defaultMinIntervalMs = defaultMinIntervalMs;
  }

  /**
   * Synchronous / async emit matching GoatEventCoalescer.emit API
   */
  public emit(
    eventKey: string,
    payload: JsonObject,
    minIntervalMs?: number,
    dispatcher?: DispatcherFn
  ): boolean {
    if (this.isDestroyed) {
      return false;
    }

    this.emitCallCount++;
    const interval = minIntervalMs !== undefined ? minIntervalMs : this.defaultMinIntervalMs;

    // 1. Dedup-on-change against last emitted OR pending if already scheduled
    const last = this.lastEmitted.get(eventKey);
    const pendingVal = this.pending.get(eventKey);

    // If there is a pending payload, compare with pending; otherwise compare with last emitted
    const reference = pendingVal !== undefined ? pendingVal : last;
    if (reference !== undefined && arePayloadsEqual(reference, payload)) {
      this.deduplicatedCount++;
      return false; // Dropped: duplicate payload
    }

    // Update pending payload with the latest sample
    const cloned = clonePayload(payload);
    this.pending.set(eventKey, cloned);
    if (dispatcher) {
      this.dispatchers.set(eventKey, dispatcher);
    }

    // 2. If 0ms interval, immediate dispatch
    if (interval <= 0) {
      this.flush(eventKey, dispatcher);
      return true;
    }

    // 3. If no timer is active for this eventKey, check if we can fire immediately or schedule
    if (!this.timers.has(eventKey)) {
      // First event for key or after idle interval: fire immediately (leading edge)
      this.flush(eventKey, dispatcher);
      // Set cooldown timer
      const timerId = setTimeout(() => {
        this.timers.delete(eventKey);
        // If another update arrived during cooldown, fire trailing edge
        if (this.pending.has(eventKey)) {
          const disp = this.dispatchers.get(eventKey);
          this.flush(eventKey, disp);
        }
      }, interval);
      this.timers.set(eventKey, timerId);
      return true;
    } else {
      // Timer already running: trailing-edge throttling (sample updated in pending)
      this.throttledCount++;
      return true;
    }
  }

  /**
   * Synchronously advances virtual time or flushes pending items
   */
  public flush(eventKey: string, dispatcher?: DispatcherFn): boolean {
    if (this.isDestroyed) return false;
    const pendingPayload = this.pending.get(eventKey);
    if (pendingPayload === undefined) {
      return false;
    }

    // Remove from pending
    this.pending.delete(eventKey);

    // Record last emitted
    this.lastEmitted.set(eventKey, clonePayload(pendingPayload));

    // Dispatch
    const disp = dispatcher || this.dispatchers.get(eventKey);
    if (disp) {
      disp(eventKey, pendingPayload);
    }
    this.dispatchLog.push({
      eventKey,
      payload: clonePayload(pendingPayload),
      timestamp: Date.now(),
    });
    return true;
  }

  public flushAll(dispatcher?: DispatcherFn): number {
    if (this.isDestroyed) return 0;
    let count = 0;
    const keys = Array.from(this.pending.keys());
    for (const key of keys) {
      if (this.flush(key, dispatcher)) {
        count++;
      }
    }
    return count;
  }

  public cancel(eventKey: string): void {
    const timerId = this.timers.get(eventKey);
    if (timerId !== undefined) {
      clearTimeout(timerId);
      this.timers.delete(eventKey);
    }
    this.pending.delete(eventKey);
  }

  public cancelAll(): void {
    for (const [, timerId] of this.timers) {
      clearTimeout(timerId);
    }
    this.timers.clear();
    this.pending.clear();
  }

  public reset(): void {
    this.cancelAll();
    this.lastEmitted.clear();
    this.dispatchers.clear();
    this.dispatchLog = [];
    this.emitCallCount = 0;
    this.deduplicatedCount = 0;
    this.throttledCount = 0;
    this.isDestroyed = false;
  }

  public destroy(): void {
    this.cancelAll();
    this.isDestroyed = true;
  }

  public getLastEmitted(eventKey: string): JsonObject | null {
    return this.lastEmitted.get(eventKey) ? clonePayload(this.lastEmitted.get(eventKey)!) : null;
  }

  public getPending(eventKey: string): JsonObject | null {
    return this.pending.get(eventKey) ? clonePayload(this.pending.get(eventKey)!) : null;
  }

  public getDispatchedCount(eventKey?: string): number {
    if (!eventKey) return this.dispatchLog.length;
    return this.dispatchLog.filter((e) => e.eventKey === eventKey).length;
  }
}

/**
 * Simulated Producer: GoatKeyboardManager
 */
export class GoatKeyboardManagerSimulator {
  private coalescer: GoatEventCoalescerSimulator;
  private currentHeight = 0;
  private isVisible = false;

  constructor(coalescer: GoatEventCoalescerSimulator) {
    this.coalescer = coalescer;
  }

  public onKeyboardInsetsChange(height: number, isVisible: boolean, durationMs = 250): void {
    this.currentHeight = height;
    this.isVisible = isVisible;
    this.coalescer.emit(
      'ON_KEYBOARD_HEIGHT_CHANGE',
      {
        height,
        isVisible,
        duration: durationMs,
      },
      50
    );
  }

  public simulateKeyboardOpenAnimation(targetHeight: number, steps = 15): void {
    const stepHeight = targetHeight / steps;
    for (let i = 1; i <= steps; i++) {
      const h = Math.round(stepHeight * i);
      this.onKeyboardInsetsChange(h, true, 250);
    }
  }

  public simulateKeyboardClose(): void {
    this.onKeyboardInsetsChange(0, false, 200);
  }
}

/**
 * Simulated Producer: GoatSafeAreaManager
 */
export class GoatSafeAreaManagerSimulator {
  private coalescer: GoatEventCoalescerSimulator;
  public top = 0;
  public bottom = 0;
  public left = 0;
  public right = 0;
  public orientation: 'portrait' | 'landscape' = 'portrait';

  constructor(coalescer: GoatEventCoalescerSimulator) {
    this.coalescer = coalescer;
  }

  public updateInsets(top: number, bottom: number, left: number, right: number): void {
    this.top = top;
    this.bottom = bottom;
    this.left = left;
    this.right = right;
    this.coalescer.emit(
      'ON_SAFE_AREA_CHANGED',
      {
        top,
        bottom,
        left,
        right,
        orientation: this.orientation,
      },
      50
    );
  }

  public rotateDevice(orientation: 'portrait' | 'landscape'): void {
    this.orientation = orientation;
    if (orientation === 'landscape') {
      this.updateInsets(0, 21, 47, 47);
    } else {
      this.updateInsets(47, 34, 0, 0);
    }
  }
}

/**
 * Simulated Producer: GoatSensorManager
 */
export class GoatSensorManagerSimulator {
  private coalescer: GoatEventCoalescerSimulator;
  private isListening = false;
  private intervalMs = 50;

  constructor(coalescer: GoatEventCoalescerSimulator) {
    this.coalescer = coalescer;
  }

  public startAccelerometer(intervalMs = 50): void {
    this.isListening = true;
    this.intervalMs = intervalMs;
  }

  public stopAccelerometer(): void {
    this.isListening = false;
    this.coalescer.cancel('ON_ACCELEROMETER_CHANGE');
  }

  public pushReading(x: number, y: number, z: number): void {
    if (!this.isListening) return;
    this.coalescer.emit(
      'ON_ACCELEROMETER_CHANGE',
      {
        x,
        y,
        z,
        timestamp: Date.now(),
      },
      this.intervalMs
    );
  }

  public pushGyroscopeReading(alpha: number, beta: number, gamma: number): void {
    this.coalescer.emit(
      'ON_GYROSCOPE_CHANGE',
      {
        alpha,
        beta,
        gamma,
        timestamp: Date.now(),
      },
      this.intervalMs
    );
  }
}

/**
 * Simulated Producer: GoatGestureScrollCoordinator
 */
export class GoatGestureScrollCoordinatorSimulator {
  private coalescer: GoatEventCoalescerSimulator;
  public scrollX = 0;
  public scrollY = 0;

  constructor(coalescer: GoatEventCoalescerSimulator) {
    this.coalescer = coalescer;
  }

  public onScroll(scrollX: number, scrollY: number): void {
    this.scrollX = scrollX;
    this.scrollY = scrollY;
    this.coalescer.emit(
      'ON_PAGE_SCROLL',
      {
        scrollX,
        scrollY,
      },
      50
    );
  }

  public simulateFling(fromY: number, toY: number, steps = 20): void {
    const delta = (toY - fromY) / steps;
    for (let i = 1; i <= steps; i++) {
      const y = Math.round(fromY + delta * i);
      this.onScroll(0, y);
    }
  }
}

/**
 * Simulated Producer: GoatPredictiveBackCoordinator
 */
export class GoatPredictiveBackCoordinatorSimulator {
  private coalescer: GoatEventCoalescerSimulator;
  public progress = 0.0;
  public touchX = 0;
  public touchY = 0;
  public edge: 'left' | 'right' = 'left';

  constructor(coalescer: GoatEventCoalescerSimulator) {
    this.coalescer = coalescer;
  }

  public onBackProgress(progress: number, touchX: number, touchY: number, edge: 'left' | 'right' = 'left'): void {
    this.progress = progress;
    this.touchX = touchX;
    this.touchY = touchY;
    this.edge = edge;
    this.coalescer.emit(
      'ON_PREDICTIVE_BACK_PROGRESS',
      {
        progress,
        touchX,
        touchY,
        edge,
      },
      16 // 60-120 FPS high resolution interval
    );
  }

  public onBackCancelled(cancelId?: number): void {
    this.coalescer.cancel('ON_PREDICTIVE_BACK_PROGRESS');
    this.coalescer.emit(
      'ON_PREDICTIVE_BACK_CANCELLED',
      {
        cancelled: true,
        cancelId: cancelId !== undefined ? cancelId : 1,
      },
      0
    );
  }

  public onBackCommitted(commitId?: number): void {
    this.coalescer.flush('ON_PREDICTIVE_BACK_PROGRESS');
    this.coalescer.emit(
      'ON_PREDICTIVE_BACK_COMMITTED',
      {
        committed: true,
        commitId: commitId !== undefined ? commitId : 1,
      },
      0
    );
  }
}

/**
 * Simulated Mini-App Runtime Container (Multi-instance Fast Pool)
 */
export class GoatMiniAppRuntimeContainerSimulator {
  public appId: string;
  public coalescer: GoatEventCoalescerSimulator;
  public keyboardManager: GoatKeyboardManagerSimulator;
  public safeAreaManager: GoatSafeAreaManagerSimulator;
  public sensorManager: GoatSensorManagerSimulator;
  public scrollCoordinator: GoatGestureScrollCoordinatorSimulator;
  public backCoordinator: GoatPredictiveBackCoordinatorSimulator;
  public isDestroyed = false;

  constructor(appId: string) {
    this.appId = appId;
    this.coalescer = new GoatEventCoalescerSimulator(50);
    this.keyboardManager = new GoatKeyboardManagerSimulator(this.coalescer);
    this.safeAreaManager = new GoatSafeAreaManagerSimulator(this.coalescer);
    this.sensorManager = new GoatSensorManagerSimulator(this.coalescer);
    this.scrollCoordinator = new GoatGestureScrollCoordinatorSimulator(this.coalescer);
    this.backCoordinator = new GoatPredictiveBackCoordinatorSimulator(this.coalescer);
  }

  public destroy(): void {
    this.sensorManager.stopAccelerometer();
    this.coalescer.cancelAll();
    this.coalescer.destroy();
    this.isDestroyed = true;
  }
}
