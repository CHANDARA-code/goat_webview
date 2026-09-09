import Foundation
#if canImport(UIKit)
import UIKit
#endif

public class GoatAssetByteCache: @unchecked Sendable {

    public static let shared = GoatAssetByteCache()

    public let maxSizeBytes: Int
    public let maxItemSizeBytes: Int = 2 * 1024 * 1024

    private var cacheMap = [String: Data]()
    private var accessOrder = [String]()
    private var currentSize: Int = 0
    private let lock = NSLock()

    public init(maxSizeBytes: Int = GoatAssetByteCache.defaultMaxBytes()) {
        self.maxSizeBytes = maxSizeBytes
        #if canImport(UIKit)
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(onMemoryWarning),
            name: UIApplication.didReceiveMemoryWarningNotification,
            object: nil
        )
        #endif
    }

    deinit {
        NotificationCenter.default.removeObserver(self)
    }

    public var count: Int {
        lock.lock()
        defer { lock.unlock() }
        return cacheMap.count
    }

    public var totalCost: Int {
        lock.lock()
        defer { lock.unlock() }
        return currentSize
    }

    public func cachedData(for url: URL) -> Data? {
        return cachedData(for: url.absoluteString)
    }

    public func cachedData(for key: String) -> Data? {
        let normalized = normalizeKey(key)
        lock.lock()
        defer { lock.unlock() }
        guard let data = cacheMap[normalized] else {
            return nil
        }
        if let idx = accessOrder.firstIndex(of: normalized) {
            accessOrder.remove(at: idx)
            accessOrder.append(normalized)
        }
        return data
    }

    public func cache(data: Data, for url: URL) {
        cache(data: data, for: url.absoluteString)
    }

    public func cache(data: Data, for key: String) {
        if data.count > maxItemSizeBytes || data.count > maxSizeBytes {
            return
        }
        let normalized = normalizeKey(key)
        lock.lock()
        defer { lock.unlock() }
        if let existing = cacheMap[normalized] {
            currentSize -= existing.count
            if let idx = accessOrder.firstIndex(of: normalized) {
                accessOrder.remove(at: idx)
            }
        }
        cacheMap[normalized] = data
        accessOrder.append(normalized)
        currentSize += data.count
        trimToSize(maxSizeBytes)
    }

    public func openData(for fileURL: URL) -> Data? {
        let key = fileURL.path
        if let cached = cachedData(for: key) {
            return cached
        }
        guard let data = try? Data(contentsOf: fileURL, options: .alwaysMapped) else {
            return nil
        }
        if data.count <= maxItemSizeBytes {
            cache(data: data, for: key)
        }
        return data
    }

    public func evictAll() {
        lock.lock()
        defer { lock.unlock() }
        cacheMap.removeAll()
        accessOrder.removeAll()
        currentSize = 0
    }

    @objc public func onMemoryWarning() {
        evictAll()
    }

    private func trimToSize(_ targetSize: Int) {
        while currentSize > targetSize && !accessOrder.isEmpty {
            let oldest = accessOrder.removeFirst()
            if let removed = cacheMap.removeValue(forKey: oldest) {
                currentSize -= removed.count
            }
        }
    }

    private func normalizeKey(_ key: String) -> String {
        return key.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    }

    public static func defaultMaxBytes() -> Int {
        let physical = ProcessInfo.processInfo.physicalMemory
        let fifteenPercent = Int(physical / 100 * 15)
        return min(max(fifteenPercent, 4 * 1024 * 1024), 32 * 1024 * 1024)
    }
}

