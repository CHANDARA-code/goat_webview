import XCTest
import Foundation
import CryptoKit
import zlib
@testable import GoatWebView

/**
 * Empirical Adversarial Stress Test Suite for iOS GoatDeltaPatcher (BSDIFF40 OTA Engine).
 * Validates resilience against malicious payloads, header corruptions, DoS attacks,
 * stream overruns, zlib/gzip malformations, and atomic staging cleanup guarantees.
 */
final class GoatDeltaPatcherAdversarialTests: XCTestCase {

    private var tempDirectory: URL!

    override func setUp() {
        super.setUp()
        let uniqueName = "goat_delta_adv_\(UUID().uuidString)"
        tempDirectory = URL(fileURLWithPath: NSTemporaryDirectory()).appendingPathComponent(uniqueName, isDirectory: true)
        try? FileManager.default.createDirectory(at: tempDirectory, withIntermediateDirectories: true, attributes: nil)
    }

    override func tearDown() {
        try? FileManager.default.removeItem(at: tempDirectory)
        super.tearDown()
    }

    private func sha256Hex(data: Data) -> String {
        return GoatDeltaPatcher.computeSha256(data: data)
    }

    private func gzipCompressData(_ data: Data) -> Data {
        guard !data.isEmpty else { return Data() }
        var stream = z_stream()
        guard deflateInit2_(&stream, Z_DEFAULT_COMPRESSION, Z_DEFLATED, 15 + 16, 8, Z_DEFAULT_STRATEGY, ZLIB_VERSION, Int32(MemoryLayout<z_stream>.size)) == Z_OK else {
            return Data()
        }
        defer { deflateEnd(&stream) }

        var compressed = Data(count: max(data.count + 64, 256))
        var status = Z_OK

        data.withUnsafeBytes { inBuf in
            guard let base = inBuf.bindMemory(to: Bytef.self).baseAddress else { return }
            stream.next_in = UnsafeMutablePointer<Bytef>(mutating: base)
            stream.avail_in = uInt(data.count)

            while status == Z_OK {
                if Int(stream.total_out) >= compressed.count { compressed.count *= 2 }
                compressed.withUnsafeMutableBytes { outBuf in
                    guard let outBase = outBuf.bindMemory(to: Bytef.self).baseAddress else { return }
                    let offset = Int(stream.total_out)
                    stream.next_out = outBase + offset
                    stream.avail_out = uInt(outBuf.count - offset)
                    status = deflate(&stream, Z_FINISH)
                }
            }
        }
        compressed.count = Int(stream.total_out)
        return compressed
    }

    private func createRawHeader(
        magic: String = "BSDIFF40",
        ctrlLen: Int64,
        diffLen: Int64,
        newSize: Int64
    ) -> Data {
        var data = Data(magic.utf8)
        var cLen = ctrlLen.bigEndian
        var dLen = diffLen.bigEndian
        var nSize = newSize.bigEndian
        data.append(Data(bytes: &cLen, count: 8))
        data.append(Data(bytes: &dLen, count: 8))
        data.append(Data(bytes: &nSize, count: 8))
        return data
    }

    // =========================================================================
    // 1. Corrupted Magic Headers
    // =========================================================================

    func testAdversarial1aInvalidMagicHeadersAreStrictlyRejected() throws {
        let oldBytes = "baseline data".data(using: .utf8)!
        let badMagics = ["BADMAGIC", "BSDIFF30", "GZDIFF40", "12345678", "\0\0\0\0\0\0\0\0"]

        for badMagic in badMagics {
            var patch = createRawHeader(magic: badMagic, ctrlLen: 10, diffLen: 10, newSize: 100)
            patch.append(Data(repeating: 0, count: 30))

            XCTAssertThrowsError(try GoatDeltaPatcher.applyPatchBytes(oldBytes: oldBytes, patchBytes: patch)) { error in
                guard case GoatDeltaPatcherError.invalidHeader(let msg) = error else {
                    XCTFail("Expected invalidHeader error for magic \(badMagic), got \(error)")
                    return
                }
                XCTAssertTrue(msg.contains("Invalid patch header magic"))
            }
        }
    }

    func testAdversarial1bEmptyAndTruncatedHeadersUnder32BytesAreRejected() throws {
        let oldBytes = "baseline data".data(using: .utf8)!
        let truncatedSizes = [0, 1, 7, 8, 15, 16, 24, 31]

        for size in truncatedSizes {
            let truncatedPatch = Data(repeating: 0x41, count: size)
            XCTAssertThrowsError(try GoatDeltaPatcher.applyPatchBytes(oldBytes: oldBytes, patchBytes: truncatedPatch)) { error in
                guard case GoatDeltaPatcherError.invalidHeader(let msg) = error else {
                    XCTFail("Expected invalidHeader error for size \(size), got \(error)")
                    return
                }
                XCTAssertTrue(msg.contains("size is less than 32 bytes header"))
            }
        }
    }

    // =========================================================================
    // 2. Out-of-bounds Stream Lengths
    // =========================================================================

    func testAdversarial2aCtrlBlockLenExceedingTotalFileSizeIsRejected() throws {
        let oldBytes = "baseline".data(using: .utf8)!
        var patch = createRawHeader(ctrlLen: 1000, diffLen: 10, newSize: 100)
        patch.append(Data(repeating: 0, count: 20))

        XCTAssertThrowsError(try GoatDeltaPatcher.applyPatchBytes(oldBytes: oldBytes, patchBytes: patch)) { error in
            guard case GoatDeltaPatcherError.corruptedPatch(let msg) = error else {
                XCTFail("Expected corruptedPatch for ctrlBlockLen exceeding file size, got \(error)")
                return
            }
            XCTAssertTrue(msg.contains("Truncated patch file"))
        }
    }

    func testAdversarial2bDiffBlockLenExceedingTotalFileSizeIsRejected() throws {
        let oldBytes = "baseline".data(using: .utf8)!
        var patch = createRawHeader(ctrlLen: 10, diffLen: 5000, newSize: 100)
        patch.append(Data(repeating: 0, count: 50))

        XCTAssertThrowsError(try GoatDeltaPatcher.applyPatchBytes(oldBytes: oldBytes, patchBytes: patch)) { error in
            guard case GoatDeltaPatcherError.corruptedPatch(let msg) = error else {
                XCTFail("Expected corruptedPatch for diffBlockLen exceeding file size, got \(error)")
                return
            }
            XCTAssertTrue(msg.contains("Truncated patch file"))
        }
    }

    func testAdversarial2cCombinedOffsetsExceedingPatchSizeIsRejected() throws {
        let oldBytes = "baseline".data(using: .utf8)!
        var patch = createRawHeader(ctrlLen: 50, diffLen: 50, newSize: 100)
        patch.append(Data(repeating: 0, count: 40)) // Needs 32 + 100 = 132

        XCTAssertThrowsError(try GoatDeltaPatcher.applyPatchBytes(oldBytes: oldBytes, patchBytes: patch)) { error in
            guard case GoatDeltaPatcherError.corruptedPatch(let msg) = error else {
                XCTFail("Expected corruptedPatch when required offset exceeds size, got \(error)")
                return
            }
            XCTAssertTrue(msg.contains("Truncated patch file"))
        }
    }

    // =========================================================================
    // 3. Anti-DOS Memory Bounds
    // =========================================================================

    func testAdversarial3aNewFileSizeExceeding50MBAntiDosLimitIsRejected() throws {
        let oldBytes = "baseline".data(using: .utf8)!
        let sizes: [Int64] = [
            Int64(GoatDeltaPatcher.maxAllowedBundleSize) + 1,
            100 * 1024 * 1024,
            1024 * 1024 * 1024
        ]

        for excessiveSize in sizes {
            var patch = createRawHeader(ctrlLen: 10, diffLen: 10, newSize: excessiveSize)
            patch.append(Data(repeating: 0, count: 30))

            XCTAssertThrowsError(try GoatDeltaPatcher.applyPatchBytes(oldBytes: oldBytes, patchBytes: patch)) { error in
                guard case GoatDeltaPatcherError.corruptedPatch(let msg) = error else {
                    XCTFail("Expected corruptedPatch for size \(excessiveSize), got \(error)")
                    return
                }
                XCTAssertTrue(msg.contains("exceeds maximum allowed bundle size"))
            }
        }
    }

    func testAdversarial3bNegativeHeaderDimensionsAreRejected() throws {
        let oldBytes = "baseline".data(using: .utf8)!
        let testCases: [(Int64, Int64, Int64)] = [
            (-1, 10, 100),
            (10, -1, 100),
            (10, 10, -1),
            (-500, -500, -500)
        ]

        for (ctrl, diff, newSize) in testCases {
            var patch = createRawHeader(ctrlLen: ctrl, diffLen: diff, newSize: newSize)
            patch.append(Data(repeating: 0, count: 30))

            XCTAssertThrowsError(try GoatDeltaPatcher.applyPatchBytes(oldBytes: oldBytes, patchBytes: patch)) { error in
                guard case GoatDeltaPatcherError.corruptedPatch(let msg) = error else {
                    XCTFail("Expected corruptedPatch for negative dims (\(ctrl), \(diff), \(newSize)), got \(error)")
                    return
                }
                XCTAssertTrue(msg.contains("Corrupted patch header dimensions") || msg.contains("exceeds maximum allowed bundle size"))
            }
        }
    }

    func testAdversarial3cBlockLengthsExceedingMaxAllowedAreRejected() throws {
        let oldBytes = "baseline".data(using: .utf8)!
        let excessiveLen = Int64(GoatDeltaPatcher.maxAllowedBundleSize) + 1

        var patchCtrl = createRawHeader(ctrlLen: excessiveLen, diffLen: 10, newSize: 100)
        patchCtrl.append(Data(repeating: 0, count: 20))
        XCTAssertThrowsError(try GoatDeltaPatcher.applyPatchBytes(oldBytes: oldBytes, patchBytes: patchCtrl)) { error in
            guard case GoatDeltaPatcherError.corruptedPatch(let msg) = error else {
                XCTFail("Expected corruptedPatch, got \(error)")
                return
            }
            XCTAssertTrue(msg.contains("Block lengths exceed maximum allowed bundle size"))
        }

        var patchDiff = createRawHeader(ctrlLen: 10, diffLen: excessiveLen, newSize: 100)
        patchDiff.append(Data(repeating: 0, count: 20))
        XCTAssertThrowsError(try GoatDeltaPatcher.applyPatchBytes(oldBytes: oldBytes, patchBytes: patchDiff)) { error in
            guard case GoatDeltaPatcherError.corruptedPatch(let msg) = error else {
                XCTFail("Expected corruptedPatch, got \(error)")
                return
            }
            XCTAssertTrue(msg.contains("Block lengths exceed maximum allowed bundle size"))
        }
    }

    // =========================================================================
    // 4. Corrupted GZIP Stream Payloads
    // =========================================================================

    func testAdversarial4aCorruptedNonGzipCtrlBlockThrowsCompressionError() throws {
        let oldBytes = "baseline".data(using: .utf8)!
        let garbageCtrl = Data(repeating: 0xFF, count: 30)
        let validGzipDiff = gzipCompressData(Data(repeating: 0, count: 10))
        let validGzipExtra = gzipCompressData(Data(repeating: 0, count: 10))

        var patch = createRawHeader(
            ctrlLen: Int64(garbageCtrl.count),
            diffLen: Int64(validGzipDiff.count),
            newSize: 100
        )
        patch.append(garbageCtrl)
        patch.append(validGzipDiff)
        patch.append(validGzipExtra)

        XCTAssertThrowsError(try GoatDeltaPatcher.applyPatchBytes(oldBytes: oldBytes, patchBytes: patch)) { error in
            guard case GoatDeltaPatcherError.compressionError = error else {
                XCTFail("Expected compressionError for corrupted ctrlBlock, got \(error)")
                return
            }
        }
    }

    func testAdversarial4bCorruptedNonGzipDiffBlockThrowsCompressionError() throws {
        let oldBytes = "baseline".data(using: .utf8)!
        var ctrlTuple = Data()
        var diffCount = Int32(10).bigEndian
        var extraCount = Int32(0).bigEndian
        var seek = Int32(0).bigEndian
        ctrlTuple.append(Data(bytes: &diffCount, count: 4))
        ctrlTuple.append(Data(bytes: &extraCount, count: 4))
        ctrlTuple.append(Data(bytes: &seek, count: 4))

        let validGzipCtrl = gzipCompressData(ctrlTuple)
        let garbageDiff = Data(repeating: 0xFE, count: 30)
        let validGzipExtra = gzipCompressData(Data(repeating: 0, count: 10))

        var patch = createRawHeader(
            ctrlLen: Int64(validGzipCtrl.count),
            diffLen: Int64(garbageDiff.count),
            newSize: 10
        )
        patch.append(validGzipCtrl)
        patch.append(garbageDiff)
        patch.append(validGzipExtra)

        XCTAssertThrowsError(try GoatDeltaPatcher.applyPatchBytes(oldBytes: oldBytes, patchBytes: patch)) { error in
            guard case GoatDeltaPatcherError.compressionError = error else {
                XCTFail("Expected compressionError for corrupted diffBlock, got \(error)")
                return
            }
        }
    }

    func testAdversarial4cCorruptedNonGzipExtraBlockThrowsCompressionError() throws {
        let oldBytes = "baseline".data(using: .utf8)!
        var ctrlTuple = Data()
        var diffCount = Int32(0).bigEndian
        var extraCount = Int32(10).bigEndian
        var seek = Int32(0).bigEndian
        ctrlTuple.append(Data(bytes: &diffCount, count: 4))
        ctrlTuple.append(Data(bytes: &extraCount, count: 4))
        ctrlTuple.append(Data(bytes: &seek, count: 4))

        let validGzipCtrl = gzipCompressData(ctrlTuple)
        let validGzipDiff = gzipCompressData(Data())
        let garbageExtra = Data(repeating: 0xAA, count: 30)

        var patch = createRawHeader(
            ctrlLen: Int64(validGzipCtrl.count),
            diffLen: Int64(validGzipDiff.count),
            newSize: 10
        )
        patch.append(validGzipCtrl)
        patch.append(validGzipDiff)
        patch.append(garbageExtra)

        XCTAssertThrowsError(try GoatDeltaPatcher.applyPatchBytes(oldBytes: oldBytes, patchBytes: patch)) { error in
            guard case GoatDeltaPatcherError.compressionError = error else {
                XCTFail("Expected compressionError for corrupted extraBlock, got \(error)")
                return
            }
        }
    }

    // =========================================================================
    // 5. Incomplete / Overrun Control and Diff Streams
    // =========================================================================

    func testAdversarial5aDiffBytesCountExceedingNewFileSizeIsRejected() throws {
        let oldBytes = "baseline".data(using: .utf8)!
        var ctrlTuple = Data()
        var diffCount = Int32(500).bigEndian // Exceeds newSize = 100
        var extraCount = Int32(0).bigEndian
        var seek = Int32(0).bigEndian
        ctrlTuple.append(Data(bytes: &diffCount, count: 4))
        ctrlTuple.append(Data(bytes: &extraCount, count: 4))
        ctrlTuple.append(Data(bytes: &seek, count: 4))

        let gzipCtrl = gzipCompressData(ctrlTuple)
        let gzipDiff = gzipCompressData(Data(repeating: 0, count: 10))
        let gzipExtra = gzipCompressData(Data(repeating: 0, count: 10))

        var patch = createRawHeader(
            ctrlLen: Int64(gzipCtrl.count),
            diffLen: Int64(gzipDiff.count),
            newSize: 100
        )
        patch.append(gzipCtrl)
        patch.append(gzipDiff)
        patch.append(gzipExtra)

        XCTAssertThrowsError(try GoatDeltaPatcher.applyPatchBytes(oldBytes: oldBytes, patchBytes: patch)) { error in
            guard case GoatDeltaPatcherError.corruptedPatch(let msg) = error else {
                XCTFail("Expected corruptedPatch error, got \(error)")
                return
            }
            XCTAssertTrue(msg.contains("diff bytes exceed target file size"))
        }
    }

    func testAdversarial5bExtraBytesCountExceedingNewFileSizeIsRejected() throws {
        let oldBytes = "baseline".data(using: .utf8)!
        var ctrlTuple = Data()
        var diffCount = Int32(50).bigEndian
        var extraCount = Int32(200).bigEndian // 50 + 200 = 250 > newSize = 100
        var seek = Int32(0).bigEndian
        ctrlTuple.append(Data(bytes: &diffCount, count: 4))
        ctrlTuple.append(Data(bytes: &extraCount, count: 4))
        ctrlTuple.append(Data(bytes: &seek, count: 4))

        let gzipCtrl = gzipCompressData(ctrlTuple)
        let gzipDiff = gzipCompressData(Data(repeating: 0, count: 50))
        let gzipExtra = gzipCompressData(Data(repeating: 0, count: 200))

        var patch = createRawHeader(
            ctrlLen: Int64(gzipCtrl.count),
            diffLen: Int64(gzipDiff.count),
            newSize: 100
        )
        patch.append(gzipCtrl)
        patch.append(gzipDiff)
        patch.append(gzipExtra)

        XCTAssertThrowsError(try GoatDeltaPatcher.applyPatchBytes(oldBytes: oldBytes, patchBytes: patch)) { error in
            guard case GoatDeltaPatcherError.corruptedPatch(let msg) = error else {
                XCTFail("Expected corruptedPatch error, got \(error)")
                return
            }
            XCTAssertTrue(msg.contains("extra bytes exceed target file size"))
        }
    }

    // =========================================================================
    // 6. SHA-256 Verification & Atomic Staging Cleanup
    // =========================================================================

    func testAdversarial6aSha256MismatchDeletesTempStagingFileAndCleansOutput() async throws {
        let oldBytes = "Base bundle contents 12345".data(using: .utf8)!
        let newBytes = "Upgraded bundle contents 67890".data(using: .utf8)!

        let oldFile = tempDirectory.appendingPathComponent("base.bin")
        let newFile = tempDirectory.appendingPathComponent("target.bin")
        let patchFile = tempDirectory.appendingPathComponent("ota.patch")
        let outputFile = tempDirectory.appendingPathComponent("reconstructed.bin")

        try oldBytes.write(to: oldFile)
        try newBytes.write(to: newFile)

        _ = try await GoatDeltaPatcher.createPatch(oldBundle: oldFile, newBundle: newFile, patchFile: patchFile)

        let wrongSha = "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
        let result = try await GoatDeltaPatcher.applyPatch(
            oldBundle: oldFile,
            patchFile: patchFile,
            outputBundle: outputFile,
            expectedSha256: wrongSha
        )

        XCTAssertFalse(result, "applyPatch must return false on checksum mismatch")
        XCTAssertFalse(FileManager.default.fileExists(atPath: outputFile.path), "Output bundle must not exist on failure")

        let dirContents = (try? FileManager.default.contentsOfDirectory(atPath: tempDirectory.path)) ?? []
        let tmpFiles = dirContents.filter { $0.contains(".tmp_") }
        XCTAssertEqual(tmpFiles.count, 0, "Zero temporary staging files must remain after failure")
    }

    func testAdversarial6bSha256CaseInsensitivityVerification() async throws {
        let oldBytes = "Base file".data(using: .utf8)!
        let newBytes = "Updated file with higher security".data(using: .utf8)!

        let oldFile = tempDirectory.appendingPathComponent("old.bin")
        let newFile = tempDirectory.appendingPathComponent("new.bin")
        let patchFile = tempDirectory.appendingPathComponent("patch.bin")
        let outputFile = tempDirectory.appendingPathComponent("out.bin")

        try oldBytes.write(to: oldFile)
        try newBytes.write(to: newFile)

        _ = try await GoatDeltaPatcher.createPatch(oldBundle: oldFile, newBundle: newFile, patchFile: patchFile)

        let upperCaseSha = sha256Hex(data: newBytes).uppercased()
        let result = try await GoatDeltaPatcher.applyPatch(
            oldBundle: oldFile,
            patchFile: patchFile,
            outputBundle: outputFile,
            expectedSha256: upperCaseSha
        )

        XCTAssertTrue(result, "applyPatch should succeed with uppercase SHA-256 hash")
        XCTAssertTrue(FileManager.default.fileExists(atPath: outputFile.path))

        let reconstructed = try Data(contentsOf: outputFile)
        XCTAssertEqual(sha256Hex(data: reconstructed), upperCaseSha.lowercased())

        let dirContents = (try? FileManager.default.contentsOfDirectory(atPath: tempDirectory.path)) ?? []
        let tmpFiles = dirContents.filter { $0.contains(".tmp_") }
        XCTAssertEqual(tmpFiles.count, 0, "Zero temporary staging files must remain after success")
    }

    func testAdversarial6cCorruptedPatchCleansUpStagingFileAtomically() async throws {
        let oldFile = tempDirectory.appendingPathComponent("base.bin")
        let badPatchFile = tempDirectory.appendingPathComponent("corrupted.patch")
        let outputFile = tempDirectory.appendingPathComponent("out.bin")

        try "base".data(using: .utf8)!.write(to: oldFile)
        try "CORRUPTED_GARBAGE_HEADER_DATA_12345678".data(using: .utf8)!.write(to: badPatchFile)

        let result = try await GoatDeltaPatcher.applyPatch(
            oldBundle: oldFile,
            patchFile: badPatchFile,
            outputBundle: outputFile
        )

        XCTAssertFalse(result, "applyPatch must return false on corrupted patch")
        XCTAssertFalse(FileManager.default.fileExists(atPath: outputFile.path))

        let dirContents = (try? FileManager.default.contentsOfDirectory(atPath: tempDirectory.path)) ?? []
        let tmpFiles = dirContents.filter { $0.contains(".tmp_") }
        XCTAssertEqual(tmpFiles.count, 0, "All temporary files must be cleaned up on exception")
    }
}
