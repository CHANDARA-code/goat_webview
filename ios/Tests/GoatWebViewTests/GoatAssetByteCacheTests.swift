#if os(iOS)
import XCTest
#if canImport(UIKit)
#if canImport(UIKit)
import UIKit
#endif
#endif
@testable import GoatWebView

final class GoatAssetByteCacheTests: XCTestCase {

    func testCacheAndRetrieve() {
        let cache = GoatAssetByteCache(maxSizeBytes: 1024 * 1024)
        let sampleData = "hello ios asset cache".data(using: .utf8)!
        let sampleURL = URL(string: "goat://test-app/assets/style.css")!

        cache.cache(data: sampleData, for: sampleURL)
        let retrieved = cache.cachedData(for: sampleURL)

        XCTAssertNotNil(retrieved)
        XCTAssertEqual(retrieved, sampleData)

        XCTAssertNil(cache.cachedData(for: "nonexistent"))
    }

    func testEvictAll() {
        let cache = GoatAssetByteCache(maxSizeBytes: 1024 * 1024)
        let data1 = "first".data(using: .utf8)!
        let data2 = "second".data(using: .utf8)!

        cache.cache(data: data1, for: "k1")
        cache.cache(data: data2, for: "k2")
        XCTAssertEqual(cache.count, 2)
        XCTAssertTrue(cache.totalCost > 0)

        cache.evictAll()
        XCTAssertEqual(cache.count, 0)
        XCTAssertEqual(cache.totalCost, 0)
        XCTAssertNil(cache.cachedData(for: "k1"))
        XCTAssertNil(cache.cachedData(for: "k2"))
    }

    func testLruEviction() {
        let cache = GoatAssetByteCache(maxSizeBytes: 500)
        let item1 = Data(repeating: 0xAA, count: 300)
        let item2 = Data(repeating: 0xBB, count: 300)

        cache.cache(data: item1, for: "item1")
        XCTAssertNotNil(cache.cachedData(for: "item1"))

        cache.cache(data: item2, for: "item2")
        XCTAssertNotNil(cache.cachedData(for: "item2"))
        XCTAssertNil(cache.cachedData(for: "item1"))
        XCTAssertEqual(cache.count, 1)
        XCTAssertEqual(cache.totalCost, 300)
    }

    func testOpenDataWithTemporaryFile() throws {
        let cache = GoatAssetByteCache(maxSizeBytes: 1024 * 1024)
        let tempDir = FileManager.default.temporaryDirectory
        let fileURL = tempDir.appendingPathComponent("asset_test_\(UUID().uuidString).bin")
        let testContent = "mmap test data".data(using: .utf8)!
        try testContent.write(to: fileURL)

        defer {
            try? FileManager.default.removeItem(at: fileURL)
        }

        let loaded = cache.openData(for: fileURL)
        XCTAssertNotNil(loaded)
        XCTAssertEqual(loaded, testContent)

        let cached = cache.cachedData(for: fileURL.path)
        XCTAssertNotNil(cached)
        XCTAssertEqual(cached, testContent)
    }

    func testMemoryWarningEviction() {
        let cache = GoatAssetByteCache(maxSizeBytes: 1024 * 1024)
        let data = "warning test".data(using: .utf8)!
        cache.cache(data: data, for: "warning_key")
        XCTAssertEqual(cache.count, 1)

        #if canImport(UIKit)
        NotificationCenter.default.post(name: UIApplication.didReceiveMemoryWarningNotification, object: nil)
        XCTAssertEqual(cache.count, 0)
        XCTAssertNil(cache.cachedData(for: "warning_key"))
        #else
        cache.onMemoryWarning()
        XCTAssertEqual(cache.count, 0)
        #endif
    }
}
#endif // os(iOS)
