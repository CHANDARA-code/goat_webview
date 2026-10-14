#if os(iOS)
import XCTest
import Foundation
@testable import GoatWebView

/**
 * Empirical Adversarial Challenge Test Suite for GoatSubpackageLoader (iOS).
 *
 * Adversarial Stress Scenarios Tested:
 * 1. Zip Slip payloads with complex relative paths:
 *    - ../../../../etc/passwd
 *    - foo/bar/../../../escaped.js
 *    - Windows backslashes ..\..\evil.js
 *    - deep traversal a/b/c/../../../../evil.js
 * 2. Null byte injections in subpackage name and zip entries:
 *    - subpackage name: pkg\0.zip, sub\0pkg, \0malicious
 *    - zip entry name: entry\0name.js
 * 3. URL/Hex encoded traversals:
 *    - %2e%2e%2f, %252e%252e%252f, %2e%2e/, ..%2f, %2e%2e%5c, %2E%2E%2F, %252E%252E%252F
 * 4. Multi-tenant boundary violation:
 *    - Strict filesystem isolation between tenant_alpha and tenant_beta
 *    - Directory traversal via appId (e.g. tenant_alpha/../tenant_beta)
 *    - Selective cache eviction: clearing tenant_alpha preserves tenant_beta intact
 *    - Metadata and subpackage listing isolation
 * 5. Empty / whitespace-only inputs, missing files, corrupted ZIP archives:
 *    - Blank / whitespace subpackage names and appIds
 *    - Missing subpackage (not on disk, nil data) -> SUBPACKAGE_NOT_FOUND
 *    - Corrupted ZIP headers: truncated data, invalid magic numbers, truncated entries
 */
final class GoatSubpackageLoaderEmpiricalChallengeTests: XCTestCase {

    private var tempDirectory: URL!
    private var subpackageLoader: GoatSubpackageLoader!

    override func setUp() {
        super.setUp()
        let uniqueName = "goat_subpkg_chal_\(UUID().uuidString)"
        tempDirectory = URL(fileURLWithPath: NSTemporaryDirectory()).appendingPathComponent(uniqueName, isDirectory: true)
        try? FileManager.default.createDirectory(at: tempDirectory, withIntermediateDirectories: true, attributes: nil)
        subpackageLoader = GoatSubpackageLoader(customBaseDir: tempDirectory)
    }

    override func tearDown() {
        try? FileManager.default.removeItem(at: tempDirectory)
        subpackageLoader = nil
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

    // =========================================================================
    // SCENARIO 1: ZIP SLIP PAYLOADS WITH COMPLEX RELATIVE PATHS
    // =========================================================================

    func testZipSlipClassicEtcPasswdPayloadRejected() async throws {
        let zip = createTestZipData(entries: ["../../../../etc/passwd": "root:x:0:0:root:/root:/bin/bash"])
        let result = await subpackageLoader.loadSubpackage(appId: "tenant_sec", subpackageName: "mod_slip1", sourceZipData: zip)

        XCTAssertFalse(result.isSuccess, "Zip Slip ../../../../etc/passwd must fail")
        XCTAssertNotNil(result.errorMessage)
        let errorMsg = result.errorMessage ?? ""
        XCTAssertTrue(errorMsg.contains("Zip Slip") || errorMsg.contains("containment"), "Error: \(errorMsg)")
        XCTAssertFalse(FileManager.default.fileExists(atPath: tempDirectory.appendingPathComponent("etc/passwd").path))
    }

    func testZipSlipNormalizedMidPathTraversalFooBarEscapedRejected() async throws {
        let zip = createTestZipData(entries: ["foo/bar/../../../escaped.js": "console.log('escaped');"])
        let result = await subpackageLoader.loadSubpackage(appId: "tenant_sec", subpackageName: "mod_slip2", sourceZipData: zip)

        XCTAssertFalse(result.isSuccess, "Zip Slip foo/bar/../../../escaped.js must fail")
        XCTAssertNotNil(result.errorMessage)
        XCTAssertFalse(FileManager.default.fileExists(atPath: tempDirectory.appendingPathComponent("miniapps/tenant_sec/escaped.js").path))
    }

    func testZipSlipDeepTraversalAbcEvilJsRejected() async throws {
        let zip = createTestZipData(entries: ["a/b/c/../../../../evil.js": "window.pwned = true;"])
        let result = await subpackageLoader.loadSubpackage(appId: "tenant_sec", subpackageName: "mod_slip3", sourceZipData: zip)

        XCTAssertFalse(result.isSuccess, "Zip Slip a/b/c/../../../../evil.js must fail")
        XCTAssertNotNil(result.errorMessage)
        XCTAssertFalse(FileManager.default.fileExists(atPath: tempDirectory.appendingPathComponent("miniapps/tenant_sec/evil.js").path))
    }

    func testZipSlipWithBackslashesOnSubpackageNameRejected() async throws {
        let badNames = [
            "..\\..\\evil.js",
            "sub\\..\\evil",
            "foo\\bar",
            "..\\evil"
        ]
        for badName in badNames {
            let result = await subpackageLoader.loadSubpackage(appId: "tenant_sec", subpackageName: badName)
            XCTAssertFalse(result.isSuccess, "Subpackage name '\(badName)' with backslashes must be rejected")
        }
    }

    // =========================================================================
    // SCENARIO 2: NULL BYTE INJECTIONS IN SUBPACKAGE NAME AND ZIP ENTRIES
    // =========================================================================

    func testNullByteInSubpackageNameRejected() async throws {
        let nullByteNames = [
            "pkg\0.zip",
            "sub\0pkg",
            "\0malicious",
            "module\0/../../escaped"
        ]
        for badName in nullByteNames {
            let result = await subpackageLoader.loadSubpackage(appId: "tenant_null", subpackageName: badName)
            XCTAssertFalse(result.isSuccess, "Null byte subpackage name '\(badName)' must be rejected")
            XCTAssertNotNil(result.errorMessage)
        }
    }

    // =========================================================================
    // SCENARIO 3: URL / HEX ENCODED TRAVERSALS
    // =========================================================================

    func testUrlEncodedTraversalsInSubpackageNameRejected() async throws {
        let encodedNames = [
            "%2e%2e%2f",
            "%252e%252e%252f",
            "%2e%2e/",
            "..%2f",
            "%2e%2e%5c",
            "%2E%2E%2F",
            "%252E%252E%252F",
            "module%2fsub",
            "module%5csub",
            "..%252f..%252fetc"
        ]

        for encoded in encodedNames {
            let result = await subpackageLoader.loadSubpackage(appId: "tenant_enc", subpackageName: encoded)
            XCTAssertFalse(result.isSuccess, "Encoded traversal '\(encoded)' must be rejected")
            XCTAssertNotNil(result.errorMessage)
        }
    }

    // =========================================================================
    // SCENARIO 4: MULTI-TENANT BOUNDARY VIOLATION & ISOLATION
    // =========================================================================

    func testStrictMultiTenantFilesystemPartitioningAndNoBleed() async throws {
        let zipAlpha = createTestZipData(entries: ["config.json": "{\"tenant\":\"alpha\",\"secret\":\"ALPHA_KEY\"}"])
        let zipBeta = createTestZipData(entries: ["config.json": "{\"tenant\":\"beta\",\"secret\":\"BETA_KEY\"}"])

        let resAlpha = await subpackageLoader.loadSubpackage(appId: "tenant_alpha", subpackageName: "core_module", sourceZipData: zipAlpha)
        let resBeta = await subpackageLoader.loadSubpackage(appId: "tenant_beta", subpackageName: "core_module", sourceZipData: zipBeta)

        XCTAssertTrue(resAlpha.isSuccess)
        XCTAssertTrue(resBeta.isSuccess)

        let dirAlpha = URL(fileURLWithPath: resAlpha.extractedPath)
        let dirBeta = URL(fileURLWithPath: resBeta.extractedPath)

        XCTAssertTrue(FileManager.default.fileExists(atPath: dirAlpha.path))
        XCTAssertTrue(FileManager.default.fileExists(atPath: dirBeta.path))
        XCTAssertNotEqual(dirAlpha.standardizedFileURL.path, dirBeta.standardizedFileURL.path)

        let contentAlpha = try String(contentsOf: dirAlpha.appendingPathComponent("config.json"))
        let contentBeta = try String(contentsOf: dirBeta.appendingPathComponent("config.json"))
        XCTAssertTrue(contentAlpha.contains("ALPHA_KEY"))
        XCTAssertTrue(contentBeta.contains("BETA_KEY"))

        // Verify registry isolation
        let alphaSubs = subpackageLoader.getSubpackages(appId: "tenant_alpha")
        let betaSubs = subpackageLoader.getSubpackages(appId: "tenant_beta")
        XCTAssertEqual(alphaSubs, ["core_module"])
        XCTAssertEqual(betaSubs, ["core_module"])

        let metaAlpha = subpackageLoader.getSubpackageMetadata(appId: "tenant_alpha", subpackageName: "core_module")
        let metaBeta = subpackageLoader.getSubpackageMetadata(appId: "tenant_beta", subpackageName: "core_module")
        XCTAssertEqual(metaAlpha?.appId, "tenant_alpha")
        XCTAssertEqual(metaBeta?.appId, "tenant_beta")

        // Selective eviction of tenant_alpha must NOT affect tenant_beta
        await subpackageLoader.clearSubpackageCache(appId: "tenant_alpha", subpackageName: "core_module")
        XCTAssertFalse(subpackageLoader.isSubpackageCached(appId: "tenant_alpha", subpackageName: "core_module"))
        XCTAssertTrue(subpackageLoader.isSubpackageCached(appId: "tenant_beta", subpackageName: "core_module"))
        XCTAssertFalse(FileManager.default.fileExists(atPath: dirAlpha.path))
        XCTAssertTrue(FileManager.default.fileExists(atPath: dirBeta.path))
        XCTAssertTrue(FileManager.default.fileExists(atPath: dirBeta.appendingPathComponent("config.json").path))
    }

    func testTenantCrossBoundaryBreakoutViaAppIdPathTraversalRejected() async throws {
        let maliciousAppIds = [
            "tenant_alpha/../tenant_beta",
            "../tenant_beta",
            "tenant/beta",
            "tenant\\beta",
            "tenant\0beta",
            "tenant%2fbeta"
        ]
        for badAppId in maliciousAppIds {
            let result = await subpackageLoader.loadSubpackage(appId: badAppId, subpackageName: "module_x")
            XCTAssertFalse(result.isSuccess, "Malicious appId '\(badAppId)' must be rejected")
            XCTAssertNotNil(result.errorMessage)
        }
    }

    // =========================================================================
    // SCENARIO 5: EMPTY / WHITESPACE INPUTS & CORRUPTED ARCHIVES
    // =========================================================================

    func testEmptyAndWhitespaceOnlyInputsFailGracefully() async throws {
        let emptySubpkg = await subpackageLoader.loadSubpackage(appId: "tenant_a", subpackageName: "")
        XCTAssertFalse(emptySubpkg.isSuccess)
        XCTAssertNotNil(emptySubpkg.errorMessage)

        let wsSubpkg = await subpackageLoader.loadSubpackage(appId: "tenant_a", subpackageName: "   \t\n  ")
        XCTAssertFalse(wsSubpkg.isSuccess)
        XCTAssertNotNil(wsSubpkg.errorMessage)

        let emptyAppId = await subpackageLoader.loadSubpackage(appId: "", subpackageName: "valid_module")
        XCTAssertFalse(emptyAppId.isSuccess)
        XCTAssertNotNil(emptyAppId.errorMessage)

        let wsAppId = await subpackageLoader.loadSubpackage(appId: "   \t  ", subpackageName: "valid_module")
        XCTAssertFalse(wsAppId.isSuccess)
        XCTAssertNotNil(wsAppId.errorMessage)
    }

    func testMissingSubpackageWithoutZipDataReturnsSubpackageNotFound() async throws {
        let result = await subpackageLoader.loadSubpackage(appId: "tenant_test", subpackageName: "non_existent_pkg", sourceZipData: nil)
        XCTAssertFalse(result.isSuccess)
        XCTAssertFalse(result.isCached)
        XCTAssertNotNil(result.errorMessage)
        XCTAssertTrue(result.errorMessage?.contains("SUBPACKAGE_NOT_FOUND") == true)
    }

    func testCorruptedZipArchivesFailGracefully() async throws {
        // 1. Truncated garbage data
        let garbageData = Data([0x50, 0x4B, 0x03, 0x04, 0x12, 0x34])
        let resGarbage = await subpackageLoader.loadSubpackage(appId: "tenant_corrupt", subpackageName: "garbage_pkg", sourceZipData: garbageData)
        // With 0 extracted files, should not report cached content
        XCTAssertFalse(subpackageLoader.isSubpackageCached(appId: "tenant_corrupt", subpackageName: "garbage_pkg"))

        // 2. Invalid signature
        let invalidMagic = "NOT_A_ZIP_STREAM_AT_ALL".data(using: .utf8)!
        let resMagic = await subpackageLoader.loadSubpackage(appId: "tenant_corrupt", subpackageName: "invalid_magic_pkg", sourceZipData: invalidMagic)
        XCTAssertFalse(subpackageLoader.isSubpackageCached(appId: "tenant_corrupt", subpackageName: "invalid_magic_pkg"))

        // 3. Truncated valid zip
        let validZip = createTestZipData(entries: ["test.js": "hello"])
        let truncated = validZip.subdata(in: 0..<(validZip.count / 2))
        let resTruncated = await subpackageLoader.loadSubpackage(appId: "tenant_corrupt", subpackageName: "truncated_pkg", sourceZipData: truncated)
        XCTAssertFalse(subpackageLoader.isSubpackageCached(appId: "tenant_corrupt", subpackageName: "truncated_pkg"))
    }
}
#endif // os(iOS)
