import Foundation

/**
 * Native iOS Bridge Event Coalescing and Throttling Coordinator (Task 10200 / Pillar 3).
 *
 * Implements:
 * 1. Dedup-on-change: Drops redundant events when the JSON payload has not changed.
 * 2. Trailing-edge throttling: Coalesces high-frequency native updates (scroll, sensor, layout) to a configurable interval (default 50ms).
 * 3. Deterministic flush and cancellation for clean teardown during navigation and destruction.
 * 4. Thread-safe concurrency with recursive lock re-entrancy protection.
 */
public class GoatEventCoalescer {
    public static let shared = GoatEventCoalescer()

    private let lock = NSRecursiveLock()
    private var lastEmittedPayloads: [String: [String: Any]] = [:]
    private var pendingPayloads: [String: [String: Any]] = [:]
    private var pendingWorkItems: [String: DispatchWorkItem] = [:]
    private var pendingDispatchers: [String: (String, [String: Any]) -> Void] = [:]
    private var lastEmitTimes: [String: TimeInterval] = [:]

    public let defaultMinInterval: TimeInterval

    public init(defaultMinInterval: TimeInterval = 0.05) {
        self.defaultMinInterval = defaultMinInterval
    }

    /**
     * Emits a native event with change deduplication and interval throttling.
     *
     * @param eventKey Unique event identifier or event name.
     * @param payload Dictionary of event data.
     * @param minInterval Optional minimum interval in seconds. Defaults to `defaultMinInterval` (50ms).
     * @param dispatcher Closure invoked when the event is emitted to the JS bridge.
     * @return `true` if payload is new/changed and scheduled or delivered immediately; `false` if dropped as duplicate.
     */
    @discardableResult
    public func emit(
        eventKey: String,
        payload: [String: Any],
        minInterval: TimeInterval? = nil,
        dispatcher: @escaping (String, [String: Any]) -> Void
    ) -> Bool {
        lock.lock()
        defer { lock.unlock() }

        let interval = max(0, minInterval ?? defaultMinInterval)

        // 1. Dedup check (Deep dictionary equality)
        if let last = lastEmittedPayloads[eventKey], NSDictionary(dictionary: last).isEqual(to: payload) {
            return false
        }

        let now = Date().timeIntervalSince1970
        let lastTime = lastEmitTimes[eventKey] ?? 0
        let elapsed = now - lastTime

        pendingPayloads[eventKey] = payload
        pendingDispatchers[eventKey] = dispatcher

        if elapsed >= interval && pendingWorkItems[eventKey] == nil {
            // Emit immediately on leading edge
            lastEmittedPayloads[eventKey] = payload
            lastEmitTimes[eventKey] = now
            pendingPayloads.removeValue(forKey: eventKey)
            pendingDispatchers.removeValue(forKey: eventKey)
            dispatcher(eventKey, payload)
            return true
        }

        // Schedule trailing-edge delivery
        let delay = max(0.001, interval - elapsed)
        pendingWorkItems[eventKey]?.cancel()

        let workItem = DispatchWorkItem { [weak self] in
            guard let self = self else { return }
            self.lock.lock()
            defer { self.lock.unlock() }

            guard let latest = self.pendingPayloads.removeValue(forKey: eventKey) else {
                self.pendingWorkItems.removeValue(forKey: eventKey)
                self.pendingDispatchers.removeValue(forKey: eventKey)
                return
            }

            let dispatcherToCall = self.pendingDispatchers.removeValue(forKey: eventKey) ?? dispatcher
            let previous = self.lastEmittedPayloads[eventKey]
            let shouldEmit = (previous == nil || !NSDictionary(dictionary: previous!).isEqual(to: latest))

            if shouldEmit {
                self.lastEmittedPayloads[eventKey] = latest
                self.lastEmitTimes[eventKey] = Date().timeIntervalSince1970
                dispatcherToCall(eventKey, latest)
            }
            self.pendingWorkItems.removeValue(forKey: eventKey)
        }

        pendingWorkItems[eventKey] = workItem
        DispatchQueue.main.asyncAfter(deadline: .now() + delay, execute: workItem)
        return true
    }

    /**
     * Millisecond overload for cross-platform parity with Android and TS SDK.
     */
    @discardableResult
    public func emit(
        eventKey: String,
        payload: [String: Any],
        minIntervalMs: Double,
        dispatcher: @escaping (String, [String: Any]) -> Void
    ) -> Bool {
        return emit(
            eventKey: eventKey,
            payload: payload,
            minInterval: minIntervalMs / 1000.0,
            dispatcher: dispatcher
        )
    }

    /**
     * Millisecond overload (Int) for cross-platform parity.
     */
    @discardableResult
    public func emit(
        eventKey: String,
        payload: [String: Any],
        minIntervalMs: Int,
        dispatcher: @escaping (String, [String: Any]) -> Void
    ) -> Bool {
        return emit(
            eventKey: eventKey,
            payload: payload,
            minIntervalMs: Double(minIntervalMs),
            dispatcher: dispatcher
        )
    }

    /**
     * Returns the most recent successfully emitted payload for a given event key.
     */
    public func getLastEmitted(eventKey: String) -> [String: Any]? {
        lock.lock()
        defer { lock.unlock() }
        return lastEmittedPayloads[eventKey]
    }

    /**
     * Returns the pending trailing-edge payload waiting for timer fire, if any.
     */
    public func getPending(eventKey: String) -> [String: Any]? {
        lock.lock()
        defer { lock.unlock() }
        return pendingPayloads[eventKey]
    }

    /**
     * Immediately flushes any pending trailing-edge payload for the specified event key.
     *
     * @param eventKey Unique event key to flush.
     * @param dispatcher Optional override dispatcher. If omitted, uses the dispatcher passed during `emit`.
     * @return `true` if a pending payload was dispatched; `false` if nothing was pending.
     */
    @discardableResult
    public func flush(
        eventKey: String,
        dispatcher: ((String, [String: Any]) -> Void)? = nil
    ) -> Bool {
        lock.lock()
        defer { lock.unlock() }

        pendingWorkItems[eventKey]?.cancel()
        pendingWorkItems.removeValue(forKey: eventKey)

        guard let latest = pendingPayloads.removeValue(forKey: eventKey) else {
            pendingDispatchers.removeValue(forKey: eventKey)
            return false
        }

        let dispatcherToCall = dispatcher ?? pendingDispatchers.removeValue(forKey: eventKey)
        let previous = lastEmittedPayloads[eventKey]
        let shouldEmit = (previous == nil || !NSDictionary(dictionary: previous!).isEqual(to: latest))

        if shouldEmit {
            lastEmittedPayloads[eventKey] = latest
            lastEmitTimes[eventKey] = Date().timeIntervalSince1970
            dispatcherToCall?(eventKey, latest)
            return true
        }
        return false
    }

    /**
     * Immediately flushes all pending trailing-edge payloads across all active keys.
     *
     * @param dispatcher Optional override dispatcher. If omitted, uses the stored dispatcher per event key.
     * @return Number of event keys that were successfully flushed.
     */
    @discardableResult
    public func flushAll(
        dispatcher: ((String, [String: Any]) -> Void)? = nil
    ) -> Int {
        lock.lock()
        defer { lock.unlock() }

        var flushedCount = 0
        let keys = Array(pendingPayloads.keys)
        for key in keys {
            if flush(eventKey: key, dispatcher: dispatcher) {
                flushedCount += 1
            }
        }
        return flushedCount
    }

    /**
     * Cancels any pending trailing-edge timer and discards pending payload for a specific event key.
     */
    public func cancel(eventKey: String) {
        lock.lock()
        defer { lock.unlock() }

        pendingWorkItems[eventKey]?.cancel()
        pendingWorkItems.removeValue(forKey: eventKey)
        pendingPayloads.removeValue(forKey: eventKey)
        pendingDispatchers.removeValue(forKey: eventKey)
    }

    /**
     * Cancels all pending trailing-edge timers and discards all pending payloads.
     */
    public func cancelAll() {
        lock.lock()
        defer { lock.unlock() }

        pendingWorkItems.values.forEach { $0.cancel() }
        pendingWorkItems.removeAll()
        pendingPayloads.removeAll()
        pendingDispatchers.removeAll()
    }

    /**
     * Resets coalescer state: cancels all pending timers and clears all state caches.
     */
    public func reset() {
        lock.lock()
        defer { lock.unlock() }

        pendingWorkItems.values.forEach { $0.cancel() }
        pendingWorkItems.removeAll()
        pendingPayloads.removeAll()
        pendingDispatchers.removeAll()
        lastEmittedPayloads.removeAll()
        lastEmitTimes.removeAll()
    }
}
