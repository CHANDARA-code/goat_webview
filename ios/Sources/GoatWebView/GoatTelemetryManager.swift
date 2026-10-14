#if os(iOS)
import Foundation
#if canImport(Combine)
import Combine
#endif
#if canImport(UIKit)
import UIKit
#endif
#if canImport(os)
import os
#endif

/**
 * Latency classification level for Native-Web IPC Bridge round trips (Showcase R3).
 */
public enum GoatLatencyLevel: String, Codable, Sendable {
    case warmPath = "WARM_PATH"   // < 5.0 ms
    case standard = "STANDARD"    // 5.0 - 15.0 ms
    case cold = "COLD"            // > 15.0 ms

    public var badgeTitle: String {
        switch self {
        case .warmPath: return "WARM (<5ms)"
        case .standard: return "STD (5-15ms)"
        case .cold:     return "COLD (>15ms)"
        }
    }

    public static func classify(durationMs: Double) -> GoatLatencyLevel {
        if durationMs < 5.0 {
            return .warmPath
        } else if durationMs <= 15.0 {
            return .standard
        } else {
            return .cold
        }
    }
}

/**
 * Real-time IPC Message Log Record (Showcase R3).
 */
public struct GoatIPCMessageLog: Identifiable, Sendable {
    public let id: String
    public let timestamp: Int64
    public let action: String
    public let status: String // "SUCCESS" or "ERROR"
    public let durationMs: Double
    public let isWarmPath: Bool
    public let requestPayload: [String: Any]
    public let responsePayload: [String: Any]?
    public let errorMessage: String?

    public var latencyLevel: GoatLatencyLevel {
        GoatLatencyLevel.classify(durationMs: durationMs)
    }

    public var timestampDate: Date {
        Date(timeIntervalSince1970: TimeInterval(timestamp) / 1000.0)
    }

    public init(
        id: String = UUID().uuidString,
        timestamp: Int64 = Int64(Date().timeIntervalSince1970 * 1000.0),
        action: String,
        status: String = "SUCCESS",
        durationMs: Double,
        requestPayload: [String: Any] = [:],
        responsePayload: [String: Any]? = nil,
        errorMessage: String? = nil
    ) {
        self.id = id
        self.timestamp = timestamp
        self.action = action
        self.status = status
        self.durationMs = durationMs
        self.isWarmPath = durationMs < 5.0
        self.requestPayload = requestPayload
        self.responsePayload = responsePayload
        self.errorMessage = errorMessage
    }

    public var dictionaryRepresentation: [String: Any] {
        var dict: [String: Any] = [
            "id": id,
            "timestamp": timestamp,
            "action": action,
            "status": status,
            "durationMs": durationMs,
            "isWarmPath": isWarmPath,
            "request": requestPayload
        ]
        if let resp = responsePayload {
            dict["response"] = resp
        }
        if let err = errorMessage {
            dict["error"] = err
        }
        return dict
    }

    public var formattedRequestJson: String {
        Self.formatJson(requestPayload)
    }

    public var formattedResponseJson: String {
        if let resp = responsePayload {
            return Self.formatJson(resp)
        } else if let err = errorMessage {
            return "{\"error\": \"\(err)\"}"
        }
        return "{}"
    }

    private static func formatJson(_ obj: Any) -> String {
        guard JSONSerialization.isValidJSONObject(obj),
              let data = try? JSONSerialization.data(withJSONObject: obj, options: [.prettyPrinted, .sortedKeys]),
              let str = String(data: data, encoding: .utf8) else {
            return "\(obj)"
        }
        return str
    }
}

public final class GoatFpsSampler: NSObject {
    private let lock = NSLock()
    private var displayLink: CADisplayLink?
    private var lastTimestamp: CFTimeInterval?
    private var frameIntervals: [Double] = []

    public var isSampling: Bool {
        lock.lock()
        defer { lock.unlock() }
        return displayLink != nil
    }

    private var isTestingEnvironment: Bool {
        NSClassFromString("XCTestCase") != nil ||
        ProcessInfo.processInfo.processName == "xctest" ||
        ProcessInfo.processInfo.environment["XCTestConfigurationFilePath"] != nil
    }

    public func start() {
        lock.lock()
        guard displayLink == nil, !isTestingEnvironment else {
            lock.unlock()
            return
        }
        let link = CADisplayLink(target: self, selector: #selector(tick(link:)))
        link.preferredFrameRateRange = CAFrameRateRange(minimum: 1, maximum: 120, preferred: 120)
        displayLink = link
        lastTimestamp = nil
        frameIntervals.removeAll()
        lock.unlock()
        link.add(to: .main, forMode: .common)
    }

    public func stop() {
        lock.lock()
        let link = displayLink
        displayLink = nil
        lock.unlock()
        link?.invalidate()
    }

    @objc private func tick(link: CADisplayLink) {
        lock.lock()
        if let last = lastTimestamp {
            let interval = link.timestamp - last
            frameIntervals.append(interval)
            if frameIntervals.count > 120 {
                frameIntervals.removeFirst(frameIntervals.count - 120)
            }
        }
        lastTimestamp = link.timestamp
        lock.unlock()
    }

    public func currentFps() -> Double {
        lock.lock()
        defer { lock.unlock() }
        guard !frameIntervals.isEmpty else { return 0.0 }
        let average = frameIntervals.reduce(0.0, +) / Double(frameIntervals.count)
        guard average > 0 else { return 0.0 }
        return 1.0 / average
    }
}

private struct GoatTraceRecord {
    let traceId: String
    let name: String
    let startTime: Date
}

/**
 * Benchmark summary statistics for batch IPC measurements.
 */
public struct GoatBenchmarkSummary: Sendable {
    public let totalCalls: Int
    public let warmPathCount: Int
    public let warmPathPercentage: Double
    public let avgDurationMs: Double
    public let minDurationMs: Double
    public let maxDurationMs: Double
    public let p95DurationMs: Double
}

/**
 * Real-time Telemetry & IPC Message Inspector Store (Showcase R3).
 *
 * Captures, indexes, and computes live performance telemetry for all native bridge communications.
 */
public final class GoatTelemetryManager: ObservableObject, @unchecked Sendable {
    public static let shared = GoatTelemetryManager()

    private let lock = NSLock()
    private let maxLogCapacity = 500
    private var traces: [String: GoatTraceRecord] = [:]
    public let fpsSampler = GoatFpsSampler()

    @Published public private(set) var logs: [GoatIPCMessageLog] = []
    @Published public private(set) var totalRequests: Int = 0
    @Published public private(set) var warmPathCount: Int = 0
    @Published public private(set) var errorCount: Int = 0
    @Published public private(set) var averageLatencyMs: Double = 0.0
    @Published public private(set) var latestLog: GoatIPCMessageLog?

    public var warmPathPercentage: Double {
        lock.lock()
        defer { lock.unlock() }
        guard totalRequests > 0 else { return 100.0 }
        return (Double(warmPathCount) / Double(totalRequests)) * 100.0
    }

    public init() {}

    /**
     * Records a completed bridge IPC message with duration and payload snapshot.
     */
    public func record(
        id: String = UUID().uuidString,
        action: String,
        requestPayload: [String: Any],
        responsePayload: [String: Any]? = nil,
        errorMessage: String? = nil,
        durationMs: Double
    ) {
        let isSuccess = errorMessage == nil
        let status = isSuccess ? "SUCCESS" : "ERROR"
        let log = GoatIPCMessageLog(
            id: id,
            timestamp: Int64(Date().timeIntervalSince1970 * 1000.0),
            action: action,
            status: status,
            durationMs: durationMs,
            requestPayload: requestPayload,
            responsePayload: responsePayload,
            errorMessage: errorMessage
        )

        lock.lock()
        totalRequests += 1
        if log.isWarmPath {
            warmPathCount += 1
        }
        if !isSuccess {
            errorCount += 1
        }
        let oldAvg = averageLatencyMs
        averageLatencyMs = oldAvg + (durationMs - oldAvg) / Double(totalRequests)

        if logs.count >= maxLogCapacity {
            logs.removeLast()
        }
        logs.insert(log, at: 0)
        latestLog = log
        lock.unlock()

        // Broadcast telemetry event over event coalescer if available
        GoatEventCoalescer.shared.emit(
            eventKey: "onBridgeTelemetry",
            payload: log.dictionaryRepresentation
        ) { _, _ in }
    }

    /**
     * Clears all collected telemetry logs and resets statistics.
     */
    public func clear() {
        lock.lock()
        logs.removeAll()
        totalRequests = 0
        warmPathCount = 0
        errorCount = 0
        averageLatencyMs = 0.0
        latestLog = nil
        lock.unlock()
    }

    /**
     * Exports all telemetry logs as formatted JSON string.
     */
    public func exportJsonString() -> String {
        lock.lock()
        let logsSnapshot = logs
        lock.unlock()

        let array = logsSnapshot.map { $0.dictionaryRepresentation }
        guard JSONSerialization.isValidJSONObject(array),
              let data = try? JSONSerialization.data(withJSONObject: array, options: [.prettyPrinted, .sortedKeys]),
              let json = String(data: data, encoding: .utf8) else {
            return "[]"
        }
        return json
    }

    /**
     * Calculates benchmark metrics across all logged or provided samples.
     */
    public func computeBenchmarkSummary(from sampleLogs: [GoatIPCMessageLog]? = nil) -> GoatBenchmarkSummary {
        lock.lock()
        let currentLogs = sampleLogs ?? logs
        lock.unlock()

        guard !currentLogs.isEmpty else {
            return GoatBenchmarkSummary(
                totalCalls: 0,
                warmPathCount: 0,
                warmPathPercentage: 100.0,
                avgDurationMs: 0.0,
                minDurationMs: 0.0,
                maxDurationMs: 0.0,
                p95DurationMs: 0.0
            )
        }

        let count = currentLogs.count
        let durations = currentLogs.map { $0.durationMs }.sorted()
        let warmCount = currentLogs.filter { $0.isWarmPath }.count
        let warmPct = (Double(warmCount) / Double(count)) * 100.0
        let totalDuration = durations.reduce(0.0, +)
        let avg = totalDuration / Double(count)
        let minVal = durations.first ?? 0.0
        let maxVal = durations.last ?? 0.0

        let p95Index = min(Int(Double(count) * 0.95), count - 1)
        let p95 = durations[p95Index]

        return GoatBenchmarkSummary(
            totalCalls: count,
            warmPathCount: warmCount,
            warmPathPercentage: warmPct,
            avgDurationMs: avg,
            minDurationMs: minVal,
            maxDurationMs: maxVal,
            p95DurationMs: p95
        )
    }

    public func currentMemoryMetrics() -> [String: Any] {
        var info = task_vm_info_data_t()
        var count = mach_msg_type_number_t(MemoryLayout<task_vm_info_data_t>.size / MemoryLayout<integer_t>.size)
        let kernResult = withUnsafeMutablePointer(to: &info) { infoPtr in
            infoPtr.withMemoryRebound(to: integer_t.self, capacity: Int(count)) { intPtr in
                task_info(mach_task_self_, task_flavor_t(TASK_VM_INFO), intPtr, &count)
            }
        }
        let usedBytes = kernResult == KERN_SUCCESS ? UInt64(info.phys_footprint) : 0
        let totalBytes = ProcessInfo.processInfo.physicalMemory
        #if canImport(os)
        let availableBytes = os_proc_available_memory()
        #else
        let availableBytes = totalBytes > usedBytes ? totalBytes - usedBytes : 0
        #endif
        return [
            "usedMemoryBytes": usedBytes,
            "totalMemoryBytes": totalBytes,
            "availableMemoryBytes": availableBytes,
            "memoryMb": Double(usedBytes) / (1024.0 * 1024.0),
            "totalMemoryMb": Double(totalBytes) / (1024.0 * 1024.0)
        ]
    }

    public func apmMetrics() -> [String: Any] {
        if !fpsSampler.isSampling {
            fpsSampler.start()
        }
        let memory = currentMemoryMetrics()
        let summary = computeBenchmarkSummary()
        return [
            "fps": fpsSampler.currentFps(),
            "memoryMb": memory["memoryMb"] ?? 0.0,
            "bridgeLatencyAvgMs": averageLatencyMs,
            "totalRequests": totalRequests,
            "errorCount": errorCount,
            "warmPathPercentage": warmPathPercentage,
            "p95DurationMs": summary.p95DurationMs
        ]
    }

    public func startTrace(name: String) -> [String: Any] {
        let traceId = "trace_\(UUID().uuidString.prefix(8))"
        let record = GoatTraceRecord(traceId: traceId, name: name, startTime: Date())
        lock.lock()
        traces[traceId] = record
        lock.unlock()
        return [
            "traceId": traceId,
            "name": name,
            "started": true,
            "timestamp": Int(record.startTime.timeIntervalSince1970 * 1000)
        ]
    }

    public func stopTrace(traceId: String) -> [String: Any] {
        lock.lock()
        guard let record = traces.removeValue(forKey: traceId) else {
            lock.unlock()
            return ["stopped": false, "traceId": traceId, "error": "TRACE_NOT_FOUND"]
        }
        lock.unlock()
        let durationMs = Date().timeIntervalSince(record.startTime) * 1000.0
        return [
            "stopped": true,
            "traceId": traceId,
            "name": record.name,
            "durationMs": durationMs
        ]
    }

    public func listTraces() -> [[String: Any]] {
        lock.lock()
        let snapshot = Array(traces.values)
        lock.unlock()
        return snapshot.map { record in
            [
                "traceId": record.traceId,
                "name": record.name,
                "startTime": Int(record.startTime.timeIntervalSince1970 * 1000)
            ]
        }
    }
}
#endif // os(iOS)
