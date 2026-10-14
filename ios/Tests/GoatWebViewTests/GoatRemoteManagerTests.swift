#if os(iOS)
import XCTest
import Foundation
import CryptoKit
@testable import GoatWebView

final class GoatRemoteManagerTests: XCTestCase {

    private var tempDirectory: URL!
    private var testUserDefaults: UserDefaults!
    private var storageManager: GoatStorageManager!

    override func setUp() {
        super.setUp()
        let uniqueName = "goat_remote_tests_\(UUID().uuidString)"
        tempDirectory = URL(fileURLWithPath: NSTemporaryDirectory()).appendingPathComponent(uniqueName, isDirectory: true)
        try? FileManager.default.createDirectory(at: tempDirectory, withIntermediateDirectories: true, attributes: nil)

        testUserDefaults = UserDefaults(suiteName: uniqueName)!
        storageManager = GoatStorageManager(userDefaults: testUserDefaults, baseDocumentsURL: tempDirectory)
    }

    override func tearDown() {
        try? FileManager.default.removeItem(at: tempDirectory)
        testUserDefaults.removePersistentDomain(forName: tempDirectory.lastPathComponent)
        super.tearDown()
    }

    private func createTestZipData(filename: String = "index.html", content: String = "<html><body><h1>Goat OTA v2.0</h1></body></html>") -> Data {
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
        let digest = SHA256.hash(data: data)
        return digest.map { String(format: "%02x", $0) }.joined()
    }

    // MARK: - Semantic Versioning & Rollout

    func testSemanticVersionComparison() {
        XCTAssertTrue(GoatRemoteManager.isNewerVersion(currentVersion: "1.0.0", newVersion: "1.0.1"))
        XCTAssertTrue(GoatRemoteManager.isNewerVersion(currentVersion: "1.0.0", newVersion: "1.1.0"))
        XCTAssertTrue(GoatRemoteManager.isNewerVersion(currentVersion: "1.0.0", newVersion: "2.0.0"))
        XCTAssertTrue(GoatRemoteManager.isNewerVersion(currentVersion: "1.9.9", newVersion: "2.0.0"))
        XCTAssertFalse(GoatRemoteManager.isNewerVersion(currentVersion: "1.2.0", newVersion: "1.2.0"))
        XCTAssertFalse(GoatRemoteManager.isNewerVersion(currentVersion: "2.0.0", newVersion: "1.9.9"))
    }

    func testRolloutPercentageEligibility() {
        XCTAssertTrue(GoatRemoteManager.isEligibleForRollout(userId: "user_123", rolloutPercentage: 100))
        XCTAssertFalse(GoatRemoteManager.isEligibleForRollout(userId: "user_123", rolloutPercentage: 0))

        var enrolledCount = 0
        for i in 0..<1000 {
            if GoatRemoteManager.isEligibleForRollout(userId: "user_\(i)", rolloutPercentage: 30) {
                enrolledCount += 1
            }
        }
        XCTAssertTrue(enrolledCount >= 200 && enrolledCount <= 400, "Enrolled \(enrolledCount) users for 30% bucket")
    }

    // MARK: - Channel Manager

    func testChannelManagerOperations() {
        let channelManager = GoatChannelManager(userDefaults: testUserDefaults)
        let appId = "com.goat.shop"

        XCTAssertEqual(channelManager.getChannel(for: appId), .production)

        channelManager.setChannel(.beta, for: appId)
        XCTAssertEqual(channelManager.getChannel(for: appId), .beta)

        channelManager.setChannel(.canary, for: appId)
        XCTAssertEqual(channelManager.getChannel(for: appId), .canary)

        // Eligibility hierarchy
        XCTAssertTrue(channelManager.evaluateChannelEligibility(targetChannel: .production, clientChannel: .production))
        XCTAssertFalse(channelManager.evaluateChannelEligibility(targetChannel: .beta, clientChannel: .production))
        XCTAssertTrue(channelManager.evaluateChannelEligibility(targetChannel: .production, clientChannel: .canary))
        XCTAssertTrue(channelManager.evaluateChannelEligibility(targetChannel: .beta, clientChannel: .canary))

        // Deterministic rollout bucketing
        let manifest50 = ReleaseManifest(
            appId: appId,
            version: "2.0.0",
            bundleUrl: "https://cdn.goat.io/bundle.zip",
            sha256: "hash123",
            rolloutPercentage: 50
        )
        let manifest100 = ReleaseManifest(
            appId: appId,
            version: "2.0.0",
            bundleUrl: "https://cdn.goat.io/bundle.zip",
            sha256: "hash123",
            rolloutPercentage: 100
        )
        let manifest0 = ReleaseManifest(
            appId: appId,
            version: "2.0.0",
            bundleUrl: "https://cdn.goat.io/bundle.zip",
            sha256: "hash123",
            rolloutPercentage: 0
        )

        XCTAssertTrue(channelManager.evaluateRollout(manifest: manifest100, userId: "user_alpha"))
        XCTAssertFalse(channelManager.evaluateRollout(manifest: manifest0, userId: "user_alpha"))

        // Version history & 1-click rollback
        channelManager.recordVersionActivation(appId: appId, newVersion: "1.0.0")
        XCTAssertEqual(channelManager.getActiveVersion(for: appId), "1.0.0")
        XCTAssertNil(channelManager.getLastKnownGoodVersion(for: appId))

        channelManager.recordVersionActivation(appId: appId, newVersion: "1.1.0")
        XCTAssertEqual(channelManager.getActiveVersion(for: appId), "1.1.0")
        XCTAssertEqual(channelManager.getLastKnownGoodVersion(for: appId), "1.0.0")

        channelManager.recordVersionActivation(appId: appId, newVersion: "1.2.0")
        XCTAssertEqual(channelManager.getActiveVersion(for: appId), "1.2.0")
        XCTAssertEqual(channelManager.getLastKnownGoodVersion(for: appId), "1.1.0")

        let history = channelManager.getVersionHistory(for: appId)
        XCTAssertEqual(history, ["1.2.0", "1.1.0", "1.0.0"])

        let rolledBack = channelManager.rollback(for: appId)
        XCTAssertEqual(rolledBack, "1.1.0")
        XCTAssertEqual(channelManager.getActiveVersion(for: appId), "1.1.0")
    }

    // MARK: - BSDIFF40 Delta Patcher

    func testBsdiff40DeltaPatcherByteLevel() throws {
        let oldBytes = "Hello World! Baseline v1.0.0 mini-app bundle data.".data(using: .utf8)!
        let newBytes = "Hello World! Upgraded v2.0.0 mini-app bundle with additional crypto extensions.".data(using: .utf8)!

        let patchBytes = GoatDeltaPatcher.createPatchBytes(oldBytes: oldBytes, newBytes: newBytes)
        XCTAssertTrue(patchBytes.count > 32)
        XCTAssertEqual(String(data: patchBytes.subdata(in: 0..<8), encoding: .ascii), "BSDIFF40")

        let reconstructed = try GoatDeltaPatcher.applyPatchBytes(oldBytes: oldBytes, patchBytes: patchBytes)
        XCTAssertEqual(reconstructed, newBytes)
        XCTAssertEqual(String(data: reconstructed, encoding: .utf8), String(data: newBytes, encoding: .utf8))
    }

    func testBsdiff40DeltaPatcherFileArchives() async throws {
        let oldZip = createTestZipData(filename: "index.html", content: "<html><body><h1>App v1</h1></body></html>")
        let newZip = createTestZipData(filename: "index.html", content: "<html><body><h1>App v2 with optimizations</h1></body></html>")
        let expectedSha256 = sha256Hex(data: newZip)

        let oldFile = tempDirectory.appendingPathComponent("base_miniapp.zip")
        let newFile = tempDirectory.appendingPathComponent("target_miniapp.zip")
        let patchFile = tempDirectory.appendingPathComponent("update.patch")
        let outputFile = tempDirectory.appendingPathComponent("patched_miniapp.zip")

        try oldZip.write(to: oldFile)
        try newZip.write(to: newFile)

        // 1. Generate patch
        let patchSize = try await GoatDeltaPatcher.createPatch(oldBundle: oldFile, newBundle: newFile, patchFile: patchFile)
        XCTAssertTrue(FileManager.default.fileExists(atPath: patchFile.path))
        XCTAssertEqual(Int64((try Data(contentsOf: patchFile)).count), patchSize)

        // 2. Apply patch
        let success = try await GoatDeltaPatcher.applyPatch(
            oldBundle: oldFile,
            patchFile: patchFile,
            outputBundle: outputFile,
            expectedSha256: expectedSha256
        )
        XCTAssertTrue(success)
        XCTAssertTrue(FileManager.default.fileExists(atPath: outputFile.path))

        let patchedData = try Data(contentsOf: outputFile)
        let actualSha256 = sha256Hex(data: patchedData)
        XCTAssertEqual(actualSha256, expectedSha256)
        XCTAssertEqual(patchedData, newZip)
    }

    func testBsdiff40CorruptedPatchRejection() async throws {
        let oldBytes = "Sample baseline".data(using: .utf8)!
        let badPatch = "CORRUPTED_HEADER_DATA_1234567890".data(using: .utf8)!

        XCTAssertThrowsError(try GoatDeltaPatcher.applyPatchBytes(oldBytes: oldBytes, patchBytes: badPatch)) { error in
            guard let patchError = error as? GoatDeltaPatcherError else {
                XCTFail("Expected GoatDeltaPatcherError")
                return
            }
            if case .invalidHeader(let msg) = patchError {
                XCTAssertTrue(msg.contains("Invalid patch header magic"))
            } else {
                XCTFail("Expected invalidHeader error case")
            }
        }

        // SHA-256 mismatch rejection
        let oldFile = tempDirectory.appendingPathComponent("old.bin")
        let newFile = tempDirectory.appendingPathComponent("new.bin")
        let patchFile = tempDirectory.appendingPathComponent("diff.patch")
        let outputFile = tempDirectory.appendingPathComponent("out.bin")

        try "v1".data(using: .utf8)!.write(to: oldFile)
        try "v2".data(using: .utf8)!.write(to: newFile)
        _ = try await GoatDeltaPatcher.createPatch(oldBundle: oldFile, newBundle: newFile, patchFile: patchFile)

        let mismatchHash = "0000000000000000000000000000000000000000000000000000000000000000"
        let result = try await GoatDeltaPatcher.applyPatch(
            oldBundle: oldFile,
            patchFile: patchFile,
            outputBundle: outputFile,
            expectedSha256: mismatchHash
        )
        XCTAssertFalse(result)
        XCTAssertFalse(FileManager.default.fileExists(atPath: outputFile.path))
    }

    // MARK: - Cryptographic Signature Verification

    func testCryptographicSignatureVerificationECDSA() throws {
        let privateKey = P256.Signing.PrivateKey()
        let publicKey = privateKey.publicKey
        let rawPubKey = publicKey.rawRepresentation

        let testPayload = "MiniApp Bundle Archive Binary Data".data(using: .utf8)!
        let signature = try privateKey.signature(for: SHA256.hash(data: testPayload))
        let sigBase64 = signature.rawRepresentation.base64EncodedString()

        // 1. Valid signature check
        let isValid = GoatSecurityVerifier.verifyDataSignature(
            data: testPayload,
            signature: sigBase64,
            publicKeyBytes: rawPubKey,
            algorithm: GoatSecurityVerifier.algorithmECDSA
        )
        XCTAssertTrue(isValid, "Valid ECDSA signature must verify successfully")

        // 2. Tampered payload check
        let tamperedPayload = "Tampered Payload Archive".data(using: .utf8)!
        let isTamperedValid = GoatSecurityVerifier.verifyDataSignature(
            data: tamperedPayload,
            signature: sigBase64,
            publicKeyBytes: rawPubKey,
            algorithm: GoatSecurityVerifier.algorithmECDSA
        )
        XCTAssertFalse(isTamperedValid, "Tampered payload signature must be rejected")
    }

    // MARK: - Full OTA Update Flow

    final class MockHttpDownloader: HttpDownloaderProtocol {
        let fileData: Data

        init(fileData: Data) {
            self.fileData = fileData
        }

        func downloadFile(
            from url: URL,
            to destination: URL,
            onProgress: @escaping @Sendable (Int64, Int64) -> Void
        ) async throws {
            try FileManager.default.createDirectory(at: destination.deletingLastPathComponent(), withIntermediateDirectories: true, attributes: nil)
            try fileData.write(to: destination, options: .atomic)
            onProgress(Int64(fileData.count), Int64(fileData.count))
        }
    }

    final class MockRemoteManager: GoatRemoteManager {
        let mockManifest: ReleaseManifest

        init(
            manifest: ReleaseManifest,
            userDefaults: UserDefaults,
            storageManager: GoatStorageManager,
            downloader: HttpDownloaderProtocol
        ) {
            self.mockManifest = manifest
            super.init(userDefaults: userDefaults, storageManager: storageManager, httpDownloader: downloader)
        }

        override func fetchManifest(from manifestUrl: URL) async throws -> ReleaseManifest {
            return mockManifest
        }
    }

    func testSuccessfulOtaUpdateFlowWithAtomicStaging() async throws {
        let zipData = createTestZipData()
        let expectedHash = sha256Hex(data: zipData)

        let manifest = ReleaseManifest(
            appId: "tenant_test",
            version: "1.2.0",
            bundleUrl: "https://cdn.example.com/bundle.zip",
            sha256: expectedHash
        )

        let downloader = MockHttpDownloader(fileData: zipData)
        let remoteManager = MockRemoteManager(
            manifest: manifest,
            userDefaults: testUserDefaults,
            storageManager: storageManager,
            downloader: downloader
        )

        var events: [UpdateProgress] = []
        let stream = remoteManager.checkAndUpdate(
            appId: "tenant_test",
            manifestUrl: URL(string: "https://cdn.example.com/manifest.json")!
        )

        for await event in stream {
            events.append(event)
        }

        XCTAssertTrue(events.contains { if case .checking = $0 { return true } else { return false } })
        XCTAssertTrue(events.contains { if case .downloading = $0 { return true } else { return false } })
        XCTAssertTrue(events.contains { if case .verifying = $0 { return true } else { return false } })
        XCTAssertTrue(events.contains { if case .staging = $0 { return true } else { return false } })

        guard let readyEvent = events.last, case .ready(let appId, let version, let bundleDir) = readyEvent else {
            XCTFail("Expected final event to be .ready")
            return
        }

        XCTAssertEqual(appId, "tenant_test")
        XCTAssertEqual(version, "1.2.0")

        // Verify extracted target file
        let indexHtml = bundleDir.appendingPathComponent("index.html")
        XCTAssertTrue(FileManager.default.fileExists(atPath: indexHtml.path))
        let extractedText = try String(contentsOf: indexHtml, encoding: .utf8)
        XCTAssertEqual(extractedText, "<html><body><h1>Goat OTA v2.0</h1></body></html>")

        // Verify version updated in preferences
        XCTAssertEqual(remoteManager.getInstalledVersion(appId: "tenant_test"), "1.2.0")
    }

    func testOtaCheckSkipsWhenAlreadyUpToDate() async throws {
        let manifest = ReleaseManifest(
            appId: "tenant_test",
            version: "1.2.0",
            bundleUrl: "https://cdn.example.com/bundle.zip",
            sha256: "dummy"
        )

        let downloader = MockHttpDownloader(fileData: Data())
        let remoteManager = MockRemoteManager(
            manifest: manifest,
            userDefaults: testUserDefaults,
            storageManager: storageManager,
            downloader: downloader
        )
        remoteManager.setInstalledVersion(appId: "tenant_test", version: "1.2.0", hash: "dummy")

        var events: [UpdateProgress] = []
        let stream = remoteManager.checkAndUpdate(
            appId: "tenant_test",
            manifestUrl: URL(string: "https://cdn.example.com/manifest.json")!
        )

        for await event in stream {
            events.append(event)
        }

        XCTAssertEqual(events.count, 2)
        guard case .checking = events[0] else {
            XCTFail("Expected first event to be .checking")
            return
        }
        guard case .upToDate(let appId, let ver) = events[1] else {
            XCTFail("Expected second event to be .upToDate")
            return
        }
        XCTAssertEqual(appId, "tenant_test")
        XCTAssertEqual(ver, "1.2.0")
    }

    func testCorruptedBundleRejectedOnSha256Mismatch() async throws {
        let zipData = createTestZipData()
        let manifest = ReleaseManifest(
            appId: "tenant_test",
            version: "2.0.0",
            bundleUrl: "https://cdn.example.com/bundle.zip",
            sha256: "0000000000000000000000000000000000000000000000000000000000000000"
        )

        let downloader = MockHttpDownloader(fileData: zipData)
        let remoteManager = MockRemoteManager(
            manifest: manifest,
            userDefaults: testUserDefaults,
            storageManager: storageManager,
            downloader: downloader
        )

        var events: [UpdateProgress] = []
        let stream = remoteManager.checkAndUpdate(
            appId: "tenant_test",
            manifestUrl: URL(string: "https://cdn.example.com/manifest.json")!
        )

        for await event in stream {
            events.append(event)
        }

        guard let failedEvent = events.last, case .failed(_, let error) = failedEvent else {
            XCTFail("Expected final event to be .failed")
            return
        }

        XCTAssertTrue(error.contains("SHA-256 checksum mismatch"))
    }
}
#endif // os(iOS)
