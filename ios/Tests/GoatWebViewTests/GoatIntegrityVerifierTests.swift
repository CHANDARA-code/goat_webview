#if os(iOS)
import XCTest
@testable import GoatWebView

final class GoatIntegrityVerifierTests: XCTestCase {

    func testGenerateCspNonceProducesValidBase64AndUniqueValues() {
        var nonces = Set<String>()
        for _ in 0..<100 {
            let nonce = GoatIntegrityVerifier.shared.generateCspNonce(byteCount: 16)
            XCTAssertFalse(nonce.isEmpty)
            XCTAssertTrue(nonce.count >= 20)
            XCTAssertFalse(nonces.contains(nonce))
            nonces.insert(nonce)
        }
        XCTAssertEqual(nonces.count, 100)
    }

    func testInjectDynamicCspNonceInjectsDefaultMetaWhenNoneExists() {
        let nonce = "testNonce12345"
        let html = "<html><head><title>App</title></head><body><script src=\"bundle.js\"></script></body></html>"
        let injected = GoatIntegrityVerifier.shared.injectDynamicCspNonce(html: html, nonce: nonce)

        XCTAssertTrue(injected.contains("<meta http-equiv=\"Content-Security-Policy\""))
        XCTAssertTrue(injected.contains("'nonce-\(nonce)'"))
        XCTAssertTrue(injected.contains("'strict-dynamic'"))
        XCTAssertTrue(injected.contains("<script nonce=\"\(nonce)\" src=\"bundle.js\"></script>"))
    }

    func testInjectDynamicCspNonceUpdatesExistingCspMetaTag() {
        let nonce = "dynamicNonce999"
        let html = """
        <!DOCTYPE html>
        <html>
        <head>
            <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-eval'; style-src 'self';">
        </head>
        <body>
            <script type="module" src="/assets/app.js"></script>
        </body>
        </html>
        """

        let injected = GoatIntegrityVerifier.shared.injectDynamicCspNonce(html: html, nonce: nonce)
        XCTAssertTrue(injected.contains("script-src 'nonce-\(nonce)' 'strict-dynamic'"))
        XCTAssertTrue(injected.contains("<script nonce=\"\(nonce)\" type=\"module\" src=\"/assets/app.js\"></script>"))
    }

    func testInjectDynamicCspNonceReplacesExistingScriptNonce() {
        let oldNonce = "oldStaleNonce"
        let newNonce = "brandNewFreshNonce"
        let html = "<html><head></head><body><script nonce=\"\(oldNonce)\" src=\"app.js\"></script></body></html>"

        let injected = GoatIntegrityVerifier.shared.injectDynamicCspNonce(html: html, nonce: newNonce)
        XCTAssertFalse(injected.contains(oldNonce))
        XCTAssertTrue(injected.contains("<script nonce=\"\(newNonce)\" src=\"app.js\"></script>"))
    }

    func testComputeSriHashProducesStandardPrefixedOutputs() {
        let payload = Data("console.log('Test');\n".utf8)

        let sha256 = GoatIntegrityVerifier.shared.computeSriHash(data: payload, algorithm: .sha256)
        XCTAssertTrue(sha256.hasPrefix("sha256-"))

        let sha384 = GoatIntegrityVerifier.shared.computeSriHash(data: payload, algorithm: .sha384)
        XCTAssertTrue(sha384.hasPrefix("sha384-"))

        let sha512 = GoatIntegrityVerifier.shared.computeSriHash(data: payload, algorithm: .sha512)
        XCTAssertTrue(sha512.hasPrefix("sha512-"))

        XCTAssertNotEqual(sha256, sha384)
        XCTAssertNotEqual(sha384, sha512)
    }

    func testVerifySriHashPassesOnExactMatchAndFailsOnTampering() {
        let payload = Data("const secretKey = 9999;".utf8)
        let sri = GoatIntegrityVerifier.shared.computeSriHash(data: payload, algorithm: .sha384)

        XCTAssertTrue(GoatIntegrityVerifier.shared.verifySriHash(data: payload, expectedSha: sri))

        let tampered = Data("const secretKey = 9998;".utf8)
        XCTAssertFalse(GoatIntegrityVerifier.shared.verifySriHash(data: tampered, expectedSha: sri))
    }

    func testVerifySriHashRejectsMalformedHashStrings() {
        let payload = Data("hello".utf8)
        XCTAssertFalse(GoatIntegrityVerifier.shared.verifySriHash(data: payload, expectedSha: ""))
        XCTAssertFalse(GoatIntegrityVerifier.shared.verifySriHash(data: payload, expectedSha: "invalid"))
        XCTAssertFalse(GoatIntegrityVerifier.shared.verifySriHash(data: payload, expectedSha: "md5-1234"))
        XCTAssertFalse(GoatIntegrityVerifier.shared.verifySriHash(data: payload, expectedSha: "sha384-!!invalidBase64=="))
    }

    func testVerifySriHashWithFileURL() {
        let tempDir = FileManager.default.temporaryDirectory
        let tempFile = tempDir.appendingPathComponent("goat_sri_test_\(UUID().uuidString).js")

        do {
            let content = "function compute() { return 100; }\n"
            try content.write(to: tempFile, atomically: true, encoding: .utf8)

            let sri = try GoatIntegrityVerifier.shared.computeSriHash(fileURL: tempFile, algorithm: .sha384)
            XCTAssertTrue(sri.hasPrefix("sha384-"))
            XCTAssertTrue(GoatIntegrityVerifier.shared.verifySriHash(fileURL: tempFile, expectedSha: sri))

            let tampered = "function compute() { return 101; }\n"
            try tampered.write(to: tempFile, atomically: true, encoding: .utf8)
            XCTAssertFalse(GoatIntegrityVerifier.shared.verifySriHash(fileURL: tempFile, expectedSha: sri))
        } catch {
            XCTFail("Unexpected file I/O error: \(error)")
        }

        try? FileManager.default.removeItem(at: tempFile)
    }

    func testVerifySriManifest() {
        let chunk1 = Data("chunk1 content".utf8)
        let chunk2 = Data("chunk2 content".utf8)

        let sri1 = GoatIntegrityVerifier.shared.computeSriHash(data: chunk1, algorithm: .sha384)
        let sri2 = GoatIntegrityVerifier.shared.computeSriHash(data: chunk2, algorithm: .sha384)

        let manifest = [
            "chunk1.js": sri1,
            "chunk2.js": sri2,
            "missing.js": "sha384-nonExistentHash=="
        ]

        let results = GoatIntegrityVerifier.shared.verifySriManifest(manifest: manifest) { path in
            switch path {
            case "chunk1.js": return chunk1
            case "chunk2.js": return chunk2
            default: return nil
            }
        }

        XCTAssertEqual(results["chunk1.js"], true)
        XCTAssertEqual(results["chunk2.js"], true)
        XCTAssertEqual(results["missing.js"], false)
    }
}
#endif // os(iOS)
