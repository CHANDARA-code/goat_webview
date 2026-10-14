#if os(iOS)
import XCTest
import Foundation
@testable import GoatWebView

/**
 * Unit test suite for GoatSubpackageLoader (Task 10092 & Task 10190).
 */
final class GoatSubpackageLoaderTests: XCTestCase {

    private var tempDirectory: URL!
    private var subpackageLoader: GoatSubpackageLoader!

    override func setUp() {
        super.setUp()
        let uniqueName = "goat_subpkg_tests_\(UUID().uuidString)"
        tempDirectory = URL(fileURLWithPath: NSTemporaryDirectory()).appendingPathComponent(uniqueName, isDirectory: true)
        try? FileManager.default.createDirectory(at: tempDirectory, withIntermediateDirectories: true, attributes: nil)
        subpackageLoader = GoatSubpackageLoader(customBaseDir: tempDirectory)
    }

    override func tearDown() {
        try? FileManager.default.removeItem(at: tempDirectory)
        super.tearDown()
    }

    private func createTestZipData(entries: [String: String]) -> Data {
        var zip = Data()
        for (filename, content) in entries {
            let fileContent = content.data(using: .utf8)!
            let filenameData = filename.data(using: .utf8)!

            var sig = UInt32(0x04034b50).littleEndian
            var version = UInt16(20).littleEndian
            var flags = UInt16(0).littleEndian
            var method = UInt16(0).littleEndian
            var modTime = UInt16(0).littleEndian
            var modDate = UInt16(0).littleEndian
            var crc = UInt32(0).littleEndian
            var compSize = UInt32(fileContent.count).littleEndian
            var uncompSize = UInt32(fileContent.count).littleEndian
            var nameLen = UInt16(filenameData.count).littleEndian
            var extraLen = UInt16(0).littleEndian

            zip.append(Data(bytes: &sig, count: 4))
            zip.append(Data(bytes: &version, count: 2))
            zip.append(Data(bytes: &flags, count: 2))
            zip.append(Data(bytes: &method, count: 2))
            zip.append(Data(bytes: &modTime, count: 2))
            zip.append(Data(bytes: &modDate, count: 2))
            zip.append(Data(bytes: &crc, count: 4))
            zip.append(Data(bytes: &compSize, count: 4))
            zip.append(Data(bytes: &uncompSize, count: 4))
            zip.append(Data(bytes: &nameLen, count: 2))
            zip.append(Data(bytes: &extraLen, count: 2))
            zip.append(filenameData)
            zip.append(fileContent)
        }
        return zip
    }

    func testLoadSubpackageFailsWhenSubpackageDoesNotExistAndNoZipDataProvided() async throws {
        let result = await subpackageLoader.loadSubpackage(appId: "app_ecommerce", subpackageName: "missing_module")
        XCTAssertFalse(result.isSuccess, "Must not return success for non-existent subpackage without data")
        XCTAssertFalse(result.isCached)
        XCTAssertNotNil(result.errorMessage)
        XCTAssertTrue(result.errorMessage?.contains("SUBPACKAGE_NOT_FOUND") == true)
        XCTAssertFalse(subpackageLoader.isSubpackageCached(appId: "app_ecommerce", subpackageName: "missing_module"))
    }

    func testLoadSubpackageWithValidZipDataExtractsFilesAndMetadata() async throws {
        let zipData = createTestZipData(entries: [
            "index.js": "console.log('checkout loaded');",
            "styles.css": "body { background: #fafafa; }"
        ])

        let result = await subpackageLoader.loadSubpackage(appId: "app_ecommerce", subpackageName: "checkout", sourceZipData: zipData)
        XCTAssertTrue(result.isSuccess)
        XCTAssertEqual(result.subpackageName, "checkout")
        XCTAssertEqual(result.appId, "app_ecommerce")
        XCTAssertFalse(result.isCached, "First load from source ZIP must not be cached initially")
        XCTAssertGreaterThan(result.byteSize, 0)

        let targetDir = URL(fileURLWithPath: result.extractedPath)
        XCTAssertTrue(FileManager.default.fileExists(atPath: targetDir.path))
        XCTAssertTrue(FileManager.default.fileExists(atPath: targetDir.appendingPathComponent("index.js").path))
        XCTAssertTrue(FileManager.default.fileExists(atPath: targetDir.appendingPathComponent("styles.css").path))

        XCTAssertTrue(subpackageLoader.isSubpackageCached(appId: "app_ecommerce", subpackageName: "checkout"))

        let meta = subpackageLoader.getSubpackageMetadata(appId: "app_ecommerce", subpackageName: "checkout")
        XCTAssertNotNil(meta)
        XCTAssertEqual(meta?.subpackageName, "checkout")
        XCTAssertEqual(meta?.fileCount, 2)
        XCTAssertGreaterThan(meta?.byteSize ?? 0, 0)

        // Subsequent load of existing module succeeds with isCached = true
        let secondResult = await subpackageLoader.loadSubpackage(appId: "app_ecommerce", subpackageName: "checkout")
        XCTAssertTrue(secondResult.isSuccess)
        XCTAssertTrue(secondResult.isCached)
        XCTAssertEqual(result.byteSize, secondResult.byteSize)
    }

    func testStrictPathTraversalAndZipSlipPreventionOnSubpackageNames() async throws {
        let badNames = [
            "   ",
            "../escape",
            "foo/../../bar",
            "/absolute_path",
            "sub\\backslash",
            "%2e%2e/encoded",
            "null\0byte",
            "pipe|char",
            "colon:test"
        ]

        for badName in badNames {
            let result = await subpackageLoader.loadSubpackage(appId: "app_security", subpackageName: badName)
            XCTAssertFalse(result.isSuccess, "Expected '\(badName)' to be rejected")
            XCTAssertNotNil(result.errorMessage)
            XCTAssertFalse(subpackageLoader.isSubpackageCached(appId: "app_security", subpackageName: badName))
        }
    }

    func testLoadSubpackageWithZipSlipExploitStreamIsRejectedSafely() async throws {
        let maliciousZipData = createTestZipData(entries: [
            "../../evil.js": "alert('hacked');"
        ])

        let result = await subpackageLoader.loadSubpackage(appId: "app_target", subpackageName: "exploitsub", sourceZipData: maliciousZipData)
        XCTAssertFalse(result.isSuccess)
        let errorMsg = result.errorMessage ?? ""
        XCTAssertTrue(errorMsg.contains("Zip Slip") || errorMsg.contains("containment"), "Error message should mention Zip Slip or containment: \(errorMsg)")
    }

    func testClearSubpackageCacheEvictsEntriesFromMemoryAndDeletesFromDisk() async throws {
        let zip1 = createTestZipData(entries: ["level1.json": "{ \"level\": 1 }"])
        let zip2 = createTestZipData(entries: ["level2.json": "{ \"level\": 2 }"])

        let res1 = await subpackageLoader.loadSubpackage(appId: "app_game", subpackageName: "level1", sourceZipData: zip1)
        let res2 = await subpackageLoader.loadSubpackage(appId: "app_game", subpackageName: "level2", sourceZipData: zip2)

        XCTAssertTrue(res1.isSuccess)
        XCTAssertTrue(res2.isSuccess)

        let dir1 = URL(fileURLWithPath: res1.extractedPath)
        let dir2 = URL(fileURLWithPath: res2.extractedPath)
        XCTAssertTrue(FileManager.default.fileExists(atPath: dir1.path))
        XCTAssertTrue(FileManager.default.fileExists(atPath: dir2.path))
        XCTAssertEqual(subpackageLoader.getSubpackages(appId: "app_game").count, 2)

        // Clear level1 only
        let clearedOne = await subpackageLoader.clearSubpackageCache(appId: "app_game", subpackageName: "level1")
        XCTAssertTrue(clearedOne)
        XCTAssertFalse(subpackageLoader.isSubpackageCached(appId: "app_game", subpackageName: "level1"))
        XCTAssertTrue(subpackageLoader.isSubpackageCached(appId: "app_game", subpackageName: "level2"))
        XCTAssertFalse(FileManager.default.fileExists(atPath: dir1.path))
        XCTAssertTrue(FileManager.default.fileExists(atPath: dir2.path))
        XCTAssertNil(subpackageLoader.getSubpackageMetadata(appId: "app_game", subpackageName: "level1"))

        // Clear all for app_game
        let clearedAll = await subpackageLoader.clearSubpackageCache(appId: "app_game")
        XCTAssertTrue(clearedAll)
        XCTAssertEqual(subpackageLoader.getSubpackages(appId: "app_game").count, 0)
        XCTAssertFalse(FileManager.default.fileExists(atPath: dir2.path))
    }

    func testMultiTenantSubpackageIsolation() async throws {
        let zipA = createTestZipData(entries: ["settings.json": "{\"theme\":\"dark\"}"])
        let zipB = createTestZipData(entries: ["settings.json": "{\"theme\":\"light\"}"])

        let resA = await subpackageLoader.loadSubpackage(appId: "tenant_a", subpackageName: "settings", sourceZipData: zipA)
        let resB = await subpackageLoader.loadSubpackage(appId: "tenant_b", subpackageName: "settings", sourceZipData: zipB)

        XCTAssertTrue(resA.isSuccess)
        XCTAssertTrue(resB.isSuccess)
        XCTAssertNotEqual(resA.extractedPath, resB.extractedPath)
        XCTAssertTrue(resA.extractedPath.contains("tenant_a"))
        XCTAssertTrue(resB.extractedPath.contains("tenant_b"))

        // Validate content difference
        let contentA = try String(contentsOf: URL(fileURLWithPath: resA.extractedPath).appendingPathComponent("settings.json"))
        let contentB = try String(contentsOf: URL(fileURLWithPath: resB.extractedPath).appendingPathComponent("settings.json"))
        XCTAssertTrue(contentA.contains("dark"))
        XCTAssertTrue(contentB.contains("light"))
    }
}
#endif // os(iOS)
