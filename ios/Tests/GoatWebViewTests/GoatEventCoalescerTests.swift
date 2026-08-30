import XCTest
import Foundation
@testable import GoatWebView

final class GoatEventCoalescerTests: XCTestCase {

    var coalescer: GoatEventCoalescer!

    override func setUp() {
        super.setUp()
        coalescer = GoatEventCoalescer(defaultMinInterval: 0.05)
    }

    override func tearDown() {
        coalescer.reset()
        coalescer = nil
        super.tearDown()
    }

    // MARK: - Test 1: Synthetic flood of 1,000 identical-payload calls
    func testSyntheticFloodDeduplication() {
        var dispatchCount = 0
        var lastReceivedPayload: [String: Any]?

        let payload: [String: Any] = [
            "event": "PAGE_SCROLL",
            "scrollY": 120,
            "viewportHeight": 844
        ]

        let firstResult = coalescer.emit(eventKey: "PAGE_SCROLL", payload: payload) { _, p in
            dispatchCount += 1
            lastReceivedPayload = p
        }

        XCTAssertTrue(firstResult, "First emission must be accepted")
        XCTAssertEqual(dispatchCount, 1, "First emission must trigger exactly 1 dispatch")

        // Flood 999 identical calls
        for _ in 1..<1000 {
            let result = coalescer.emit(eventKey: "PAGE_SCROLL", payload: payload) { _, p in
                dispatchCount += 1
                lastReceivedPayload = p
            }
            XCTAssertFalse(result, "Duplicate identical payload must be dropped")
        }

        XCTAssertEqual(dispatchCount, 1, "Total dispatches after 1,000 identical calls must be exactly 1")
        XCTAssertEqual(lastReceivedPayload?["scrollY"] as? Int, 120)
        XCTAssertEqual(coalescer.getLastEmitted(eventKey: "PAGE_SCROLL")?["scrollY"] as? Int, 120)
        XCTAssertNil(coalescer.getPending(eventKey: "PAGE_SCROLL"), "No pending payload should remain for identical flood")
    }

    // MARK: - Test 2: Rapidly changing payload bursts dispatch updates <= once per minInterval
    func testRapidlyChangingPayloadBurstDeliversLatestState() {
        let expectation = expectation(description: "Trailing edge dispatch")
        var dispatchedPayloads = [[String: Any]]()

        let eventKey = "BURST_TEST"
        let interval: TimeInterval = 0.05 // 50ms

        // Leading edge: emits immediately
        let firstPayload: [String: Any] = ["offset": 10]
        let firstRes = coalescer.emit(eventKey: eventKey, payload: firstPayload, minInterval: interval) { _, p in
            dispatchedPayloads.append(p)
        }
        XCTAssertTrue(firstRes)
        XCTAssertEqual(dispatchedPayloads.count, 1)
        XCTAssertEqual(dispatchedPayloads.first?["offset"] as? Int, 10)

        // Rapid burst: 19 distinct updates within the 50ms window
        for i in 2...20 {
            let payload: [String: Any] = ["offset": i * 10]
            coalescer.emit(eventKey: eventKey, payload: payload, minInterval: interval) { _, p in
                dispatchedPayloads.append(p)
                if (p["offset"] as? Int) == 200 {
                    expectation.fulfill()
                }
            }
        }

        // Before interval expires, intermediate updates should be buffered, not dispatched yet
        XCTAssertEqual(dispatchedPayloads.count, 1, "Burst events within interval must not dispatch synchronously")
        XCTAssertEqual(coalescer.getPending(eventKey: eventKey)?["offset"] as? Int, 200, "Pending buffer must hold latest sample")

        // Wait for trailing edge
        wait(for: [expectation], timeout: 1.0)

        XCTAssertEqual(dispatchedPayloads.count, 2, "Expected exactly 2 dispatches: leading edge and trailing edge")
        XCTAssertEqual(dispatchedPayloads.last?["offset"] as? Int, 200, "Trailing edge must deliver latest sample (200)")
        XCTAssertEqual(coalescer.getLastEmitted(eventKey: eventKey)?["offset"] as? Int, 200)
        XCTAssertNil(coalescer.getPending(eventKey: eventKey), "Pending payload must be cleared after trailing edge")
    }

    // MARK: - Test 3: Multi-key isolation operating simultaneously without interference
    func testMultiKeyIsolation() {
        let expA = expectation(description: "Key A trailing edge")
        let expB = expectation(description: "Key B trailing edge")

        var dispatchesA = [[String: Any]]()
        var dispatchesB = [[String: Any]]()

        let interval: TimeInterval = 0.05

        // Leading edges
        coalescer.emit(eventKey: "KEY_A", payload: ["val": "A_init"], minInterval: interval) { _, p in
            dispatchesA.append(p)
        }
        coalescer.emit(eventKey: "KEY_B", payload: ["val": "B_init"], minInterval: interval) { _, p in
            dispatchesB.append(p)
        }

        XCTAssertEqual(dispatchesA.count, 1)
        XCTAssertEqual(dispatchesB.count, 1)

        // Rapid updates for both keys
        coalescer.emit(eventKey: "KEY_A", payload: ["val": "A_mid"], minInterval: interval) { _, p in
            dispatchesA.append(p)
        }
        coalescer.emit(eventKey: "KEY_A", payload: ["val": "A_final"], minInterval: interval) { _, p in
            dispatchesA.append(p)
            if (p["val"] as? String) == "A_final" {
                expA.fulfill()
            }
        }

        coalescer.emit(eventKey: "KEY_B", payload: ["val": "B_final"], minInterval: interval) { _, p in
            dispatchesB.append(p)
            if (p["val"] as? String) == "B_final" {
                expB.fulfill()
            }
        }

        XCTAssertEqual(coalescer.getPending(eventKey: "KEY_A")?["val"] as? String, "A_final")
        XCTAssertEqual(coalescer.getPending(eventKey: "KEY_B")?["val"] as? String, "B_final")

        wait(for: [expA, expB], timeout: 1.0)

        XCTAssertEqual(dispatchesA.count, 2)
        XCTAssertEqual(dispatchesA.last?["val"] as? String, "A_final")

        XCTAssertEqual(dispatchesB.count, 2)
        XCTAssertEqual(dispatchesB.last?["val"] as? String, "B_final")
    }

    // MARK: - Test 4: Explicit flush(eventKey) and flushAll()
    func testExplicitFlushAndFlushAll() {
        var flushedDispatches = [String: [String: Any]]()

        let interval: TimeInterval = 0.5 // Long interval to guarantee pending state

        // Leading edge
        coalescer.emit(eventKey: "FLUSH_KEY_1", payload: ["step": 1], minInterval: interval) { k, p in
            flushedDispatches[k] = p
        }
        coalescer.emit(eventKey: "FLUSH_KEY_2", payload: ["step": 1], minInterval: interval) { k, p in
            flushedDispatches[k] = p
        }

        XCTAssertEqual(flushedDispatches.count, 2)

        // Queue throttled updates
        coalescer.emit(eventKey: "FLUSH_KEY_1", payload: ["step": 2], minInterval: interval) { k, p in
            flushedDispatches[k] = p
        }
        coalescer.emit(eventKey: "FLUSH_KEY_2", payload: ["step": 2], minInterval: interval) { k, p in
            flushedDispatches[k] = p
        }

        XCTAssertEqual(coalescer.getPending(eventKey: "FLUSH_KEY_1")?["step"] as? Int, 2)
        XCTAssertEqual(coalescer.getPending(eventKey: "FLUSH_KEY_2")?["step"] as? Int, 2)

        // Single flush
        let flushedSingle = coalescer.flush(eventKey: "FLUSH_KEY_1")
        XCTAssertTrue(flushedSingle)
        XCTAssertEqual(flushedDispatches["FLUSH_KEY_1"]?["step"] as? Int, 2)
        XCTAssertNil(coalescer.getPending(eventKey: "FLUSH_KEY_1"))
        XCTAssertNotNil(coalescer.getPending(eventKey: "FLUSH_KEY_2"))

        // Flush all
        let flushedCount = coalescer.flushAll()
        XCTAssertEqual(flushedCount, 1, "Only FLUSH_KEY_2 was pending")
        XCTAssertEqual(flushedDispatches["FLUSH_KEY_2"]?["step"] as? Int, 2)
        XCTAssertNil(coalescer.getPending(eventKey: "FLUSH_KEY_2"))

        // Flush on empty returns false / 0
        XCTAssertFalse(coalescer.flush(eventKey: "FLUSH_KEY_1"))
        XCTAssertEqual(coalescer.flushAll(), 0)
    }

    // MARK: - Test 5: cancel(eventKey) and cancelAll()
    func testCancelAndCancelAll() {
        var dispatches = [String: [String: Any]]()
        let interval: TimeInterval = 0.05

        // Leading edge
        coalescer.emit(eventKey: "CANCEL_A", payload: ["v": 1], minInterval: interval) { k, p in
            dispatches[k] = p
        }
        coalescer.emit(eventKey: "CANCEL_B", payload: ["v": 1], minInterval: interval) { k, p in
            dispatches[k] = p
        }

        // Buffer pending updates
        coalescer.emit(eventKey: "CANCEL_A", payload: ["v": 2], minInterval: interval) { k, p in
            dispatches[k] = p
        }
        coalescer.emit(eventKey: "CANCEL_B", payload: ["v": 2], minInterval: interval) { k, p in
            dispatches[k] = p
        }

        XCTAssertNotNil(coalescer.getPending(eventKey: "CANCEL_A"))
        XCTAssertNotNil(coalescer.getPending(eventKey: "CANCEL_B"))

        // Cancel A specifically
        coalescer.cancel(eventKey: "CANCEL_A")
        XCTAssertNil(coalescer.getPending(eventKey: "CANCEL_A"))
        XCTAssertNotNil(coalescer.getPending(eventKey: "CANCEL_B"))

        // Cancel All
        coalescer.cancelAll()
        XCTAssertNil(coalescer.getPending(eventKey: "CANCEL_B"))

        // Wait past timer duration to confirm no trailing-edge dispatch occurs for cancelled items
        let exp = expectation(description: "Wait after cancel")
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
            exp.fulfill()
        }
        wait(for: [exp], timeout: 0.5)

        XCTAssertEqual(dispatches["CANCEL_A"]?["v"] as? Int, 1, "Cancelled payload v:2 must not have dispatched")
        XCTAssertEqual(dispatches["CANCEL_B"]?["v"] as? Int, 1, "Cancelled payload v:2 must not have dispatched")
    }

    // MARK: - Test 6: Multi-threaded concurrent emissions stress test
    func testConcurrentEmissionsStressTest() {
        let coalescer = GoatEventCoalescer(defaultMinInterval: 0.02)
        let totalThreads = 10
        let iterationsPerThread = 50

        let group = DispatchGroup()
        let queue = DispatchQueue(label: "test.concurrent.coalescer", attributes: .concurrent)

        for threadIndex in 0..<totalThreads {
            group.enter()
            queue.async {
                for i in 0..<iterationsPerThread {
                    let key = "CONCURRENT_KEY_\(i % 5)"
                    let payload: [String: Any] = [
                        "thread": threadIndex,
                        "iteration": i,
                        "timestamp": Date().timeIntervalSince1970
                    ]
                    coalescer.emit(eventKey: key, payload: payload, minInterval: 0.02) { _, _ in
                        // Re-entrant inquiry to verify lock safety
                        _ = coalescer.getLastEmitted(eventKey: key)
                    }
                }
                group.leave()
            }
        }

        let result = group.wait(timeout: .now() + 5.0)
        XCTAssertEqual(result, .success, "Concurrent emissions must finish without deadlock")

        // Flush all remaining items and verify clean state
        _ = coalescer.flushAll()
        for i in 0..<5 {
            let key = "CONCURRENT_KEY_\(i)"
            XCTAssertNotNil(coalescer.getLastEmitted(eventKey: key))
            XCTAssertNil(coalescer.getPending(eventKey: key))
        }
    }

    // MARK: - Test 7: Nested payload deep equality verification
    func testNestedPayloadDeepEquality() {
        var dispatches = 0

        let nested1: [String: Any] = [
            "user": [
                "id": "usr_99",
                "profile": [
                    "roles": ["admin", "developer"],
                    "verified": true,
                    "score": 42.5
                ]
            ],
            "seq": 1
        ]

        let nestedDuplicate: [String: Any] = [
            "user": [
                "id": "usr_99",
                "profile": [
                    "roles": ["admin", "developer"],
                    "verified": true,
                    "score": 42.5
                ]
            ],
            "seq": 1
        ]

        let nestedModified: [String: Any] = [
            "user": [
                "id": "usr_99",
                "profile": [
                    "roles": ["admin"], // Modified array
                    "verified": true,
                    "score": 42.5
                ]
            ],
            "seq": 1
        ]

        // First emission accepted
        let res1 = coalescer.emit(eventKey: "NESTED", payload: nested1) { _, _ in
            dispatches += 1
        }
        XCTAssertTrue(res1)
        XCTAssertEqual(dispatches, 1)

        // Duplicate rejected
        let res2 = coalescer.emit(eventKey: "NESTED", payload: nestedDuplicate) { _, _ in
            dispatches += 1
        }
        XCTAssertFalse(res2)
        XCTAssertEqual(dispatches, 1)

        // Modified nested field accepted
        let res3 = coalescer.emit(eventKey: "NESTED", payload: nestedModified) { _, _ in
            dispatches += 1
        }
        XCTAssertTrue(res3)
    }

    // MARK: - Test 8: Millisecond overload parity verification
    func testMillisecondOverloadParity() {
        let expectation = expectation(description: "Millisecond trailing edge")
        var dispatches = [[String: Any]]()

        // Double overload
        let res1 = coalescer.emit(eventKey: "MS_KEY", payload: ["val": 1], minIntervalMs: 50.0) { _, p in
            dispatches.append(p)
        }
        XCTAssertTrue(res1)
        XCTAssertEqual(dispatches.count, 1)

        // Int overload
        let res2 = coalescer.emit(eventKey: "MS_KEY", payload: ["val": 2], minIntervalMs: 50) { _, p in
            dispatches.append(p)
            expectation.fulfill()
        }
        XCTAssertTrue(res2)
        XCTAssertEqual(dispatches.count, 1)

        wait(for: [expectation], timeout: 1.0)
        XCTAssertEqual(dispatches.count, 2)
        XCTAssertEqual(dispatches.last?["val"] as? Int, 2)
    }
}
