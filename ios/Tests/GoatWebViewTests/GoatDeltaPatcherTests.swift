import XCTest
import Foundation
import CryptoKit
@testable import GoatWebView

/**
 * Comprehensive Unit Test Suite for GoatDeltaPatcher (Task 10080 & Task 10082).
 */
final class GoatDeltaPatcherTests: XCTestCase {

    private var tempDirectory: URL!

    override func setUp() {
        super.setUp()
        let uniqueName = "goat_delta_patcher_tests_\(UUID().uuidString)"
        tempDirectory = URL(fileURLWithPath: NSTemporaryDirectory()).appendingPathComponent(uniqueName, isDirectory: true)
        try? FileManager.default.createDirectory(at: tempDirectory, withIntermediateDirectories: true, attributes: nil)
    }

    override func tearDown() {
        try? FileManager.default.removeItem(at: tempDirectory)
        super.tearDown()
    }

    private func createTestZipData(filename: String, content: String) -> Data {
        let fileContent = content.data(using: .utf8)!
        let filenameData = filename.data(using: .utf8)!
        var zip = Data()
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
        return zip
    }

    private func sha256Hex(data: Data) -> String {
        return GoatDeltaPatcher.computeSha256(data: data)
    }

    func testBinaryDeltaPatchCreationAndReconstructionOnByteArrays() throws {
        let oldString = "<html><head><title>Goat App v1.0</title></head><body><h1>Hello World</h1><p>Static base content that is lengthy and common across revisions.</p></body></html>"
        let newString = "<html><head><title>Goat App v1.1</title></head><body><h1>Hello Goat World!</h1><p>Static base content that is lengthy and common across revisions.</p><p>New feature block added in patch.</p></body></html>"

        let oldBytes = oldString.data(using: .utf8)!
        let newBytes = newString.data(using: .utf8)!

        let patchBytes = GoatDeltaPatcher.createPatchBytes(oldBytes: oldBytes, newBytes: newBytes)
        XCTAssertGreaterThanOrEqual(patchBytes.count, 32, "Patch must have at least 32 bytes header")

        let magic = String(data: patchBytes.subdata(in: 0..<8), encoding: .ascii)
        XCTAssertEqual(magic, "BSDIFF40")

        let reconstructedBytes = try GoatDeltaPatcher.applyPatchBytes(oldBytes: oldBytes, patchBytes: patchBytes)
        XCTAssertEqual(reconstructedBytes, newBytes)
        XCTAssertEqual(String(data: reconstructedBytes, encoding: .utf8), newString)
    }

    func testDeltaPatchingOnRealZipArchivesWithFullSha256Match() async throws {
        let oldZipData = createTestZipData(filename: "index.html", content: "<html><body>v1.0.0 Bundle</body></html>")
        let newZipData = createTestZipData(filename: "index.html", content: "<html><body>v1.1.0 High-Performance Reconstructed Bundle</body></html>")

        let oldFile = tempDirectory.appendingPathComponent("base_bundle.zip")
        let newFile = tempDirectory.appendingPathComponent("target_bundle.zip")
        let patchFile = tempDirectory.appendingPathComponent("update.patch")
        let outputFile = tempDirectory.appendingPathComponent("reconstructed_bundle.zip")

        try oldZipData.write(to: oldFile)
        try newZipData.write(to: newFile)

        let patchSize = try await GoatDeltaPatcher.createPatch(oldBundle: oldFile, newBundle: newFile, patchFile: patchFile)
        XCTAssertGreaterThan(patchSize, 0)
        XCTAssertTrue(FileManager.default.fileExists(atPath: patchFile.path))

        let expectedSha256 = sha256Hex(data: newZipData)
        let success = try await GoatDeltaPatcher.applyPatch(
            oldBundle: oldFile,
            patchFile: patchFile,
            outputBundle: outputFile,
            expectedSha256: expectedSha256
        )

        XCTAssertTrue(success, "Delta patch application must succeed with correct SHA-256")
        XCTAssertTrue(FileManager.default.fileExists(atPath: outputFile.path))

        let reconstructedData = try Data(contentsOf: outputFile)
        XCTAssertEqual(sha256Hex(data: reconstructedData), expectedSha256)
    }

    func testApplyPatchFailsOnCorruptedPatchHeader() throws {
        let oldBytes = "baseline data".data(using: .utf8)!

        // Truncated header (< 32 bytes)
        let shortHeader = "BSDIFF40_SHORT".data(using: .utf8)!
        XCTAssertThrowsError(try GoatDeltaPatcher.applyPatchBytes(oldBytes: oldBytes, patchBytes: shortHeader)) { error in
            guard case GoatDeltaPatcherError.invalidHeader = error else {
                XCTFail("Expected invalidHeader error, got \(error)")
                return
            }
        }

        // Invalid magic header
        var badMagicPatch = Data("BADMAGIC".utf8)
        badMagicPatch.append(Data(repeating: 0, count: 24)) // 32 bytes total
        XCTAssertThrowsError(try GoatDeltaPatcher.applyPatchBytes(oldBytes: oldBytes, patchBytes: badMagicPatch)) { error in
            guard case GoatDeltaPatcherError.invalidHeader = error else {
                XCTFail("Expected invalidHeader error, got \(error)")
                return
            }
        }
    }

    func testApplyPatchFailsOnCorruptedStream() throws {
        let oldBytes = "baseline data".data(using: .utf8)!
        let newBytes = "target data with new contents".data(using: .utf8)!

        var validPatch = GoatDeltaPatcher.createPatchBytes(oldBytes: oldBytes, newBytes: newBytes)

        // Corrupt the body stream after the 32-byte header
        if validPatch.count > 36 {
            validPatch[34] = 0xFF
            validPatch[35] = 0xFF
            validPatch[36] = 0xFF
        }

        XCTAssertThrowsError(try GoatDeltaPatcher.applyPatchBytes(oldBytes: oldBytes, patchBytes: validPatch))
    }

    func testApplyPatchFailsOnSha256MismatchAndCleansUpStaging() async throws {
        let oldZipData = createTestZipData(filename: "app.js", content: "console.log('v1');")
        let newZipData = createTestZipData(filename: "app.js", content: "console.log('v2');")

        let oldFile = tempDirectory.appendingPathComponent("old.zip")
        let newFile = tempDirectory.appendingPathComponent("new.zip")
        let patchFile = tempDirectory.appendingPathComponent("diff.patch")
        let outputFile = tempDirectory.appendingPathComponent("output.zip")

        try oldZipData.write(to: oldFile)
        try newZipData.write(to: newFile)
        _ = try await GoatDeltaPatcher.createPatch(oldBundle: oldFile, newBundle: newFile, patchFile: patchFile)

        let wrongSha256 = "0000000000000000000000000000000000000000000000000000000000000000"
        let success = try await GoatDeltaPatcher.applyPatch(
            oldBundle: oldFile,
            patchFile: patchFile,
            outputBundle: outputFile,
            expectedSha256: wrongSha256
        )

        XCTAssertFalse(success, "Must return false on SHA-256 mismatch")
        XCTAssertFalse(FileManager.default.fileExists(atPath: outputFile.path), "Output bundle must not exist after mismatch")

        // Confirm no staging tmp files remain
        let dirContents = (try? FileManager.default.contentsOfDirectory(atPath: tempDirectory.path)) ?? []
        let tmpFiles = dirContents.filter { $0.contains(".tmp_") }
        XCTAssertEqual(tmpFiles.count, 0, "All temporary staging files must be cleaned up")
    }

    func testAntiDosBoundsChecks() throws {
        let oldBytes = "baseline".data(using: .utf8)!

        // Create a patch header requesting newFileSize > 50MB (e.g. 100MB)
        var maliciousPatch = Data("BSDIFF40".utf8)
        var ctrlLen = Int64(10).bigEndian
        var diffLen = Int64(10).bigEndian
        var maliciousSize = Int64(100 * 1024 * 1024).bigEndian // 100MB

        maliciousPatch.append(Data(bytes: &ctrlLen, count: 8))
        maliciousPatch.append(Data(bytes: &diffLen, count: 8))
        maliciousPatch.append(Data(bytes: &maliciousSize, count: 8))
        maliciousPatch.append(Data(repeating: 0, count: 20))

        XCTAssertThrowsError(try GoatDeltaPatcher.applyPatchBytes(oldBytes: oldBytes, patchBytes: maliciousPatch)) { error in
            guard case GoatDeltaPatcherError.corruptedPatch(let msg) = error else {
                XCTFail("Expected corruptedPatch error for size exceeding limit, got \(error)")
                return
            }
            XCTAssertTrue(msg.contains("exceeds maximum allowed bundle size"))
        }
    }

    func testMissingSourceOrPatchFileReturnsFalse() async throws {
        let nonExistentOld = tempDirectory.appendingPathComponent("non_existent_old.zip")
        let nonExistentPatch = tempDirectory.appendingPathComponent("non_existent.patch")
        let output = tempDirectory.appendingPathComponent("out.zip")

        let result = try await GoatDeltaPatcher.applyPatch(
            oldBundle: nonExistentOld,
            patchFile: nonExistentPatch,
            outputBundle: output
        )
        XCTAssertFalse(result)
        XCTAssertFalse(FileManager.default.fileExists(atPath: output.path))
    }
}
