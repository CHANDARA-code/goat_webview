import Foundation
import Security
import CryptoKit

public final class GoatSslPinningManager: @unchecked Sendable {
    public static let shared = GoatSslPinningManager()

    public typealias ServerTrustProvider = (String) async throws -> SecTrust
    private let serverTrustProvider: ServerTrustProvider?

    public init(serverTrustProvider: ServerTrustProvider? = nil) {
        self.serverTrustProvider = serverTrustProvider
    }

    public static func spkiSha256Base64(certificate: SecCertificate) -> String? {
        guard let data = spkiSha256Data(certificate: certificate) else { return nil }
        return data.base64EncodedString()
    }

    public static func spkiSha256Data(certificate: SecCertificate) -> Data? {
        guard let secKey = SecCertificateCopyKey(certificate),
              let keyData = SecKeyCopyExternalRepresentation(secKey, nil) as Data? else { return nil }
        let digest = SHA256.hash(data: keyData)
        return Data(digest)
    }

    public func matchesPin(certificate: SecCertificate, pin: String) -> Bool {
        guard let expected = Self.spkiSha256Data(certificate: certificate) else { return false }
        return Self.pinDigestMatches(pin: pin, spkiData: expected)
    }

    static func pinDigestMatches(pin: String, spkiData: Data) -> Bool {
        let trimmed = pin.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return false }

        if let prefixed = trimmed.range(of: "sha256/", options: .caseInsensitive).map({ String(trimmed[$0.upperBound...]) }) {
            guard let pinData = Data(base64Encoded: prefixed) else { return false }
            return pinData == spkiData
        }
        if let pinData = Data(base64Encoded: trimmed), pinData.count == 32 {
            return pinData == spkiData
        }
        if trimmed.count == 64 {
            var hexBytes = [UInt8]()
            var index = trimmed.startIndex
            while index < trimmed.endIndex {
                let nextIndex = trimmed.index(index, offsetBy: 2, limitedBy: trimmed.endIndex) ?? trimmed.endIndex
                guard let byte = UInt8(trimmed[index..<nextIndex], radix: 16) else { return false }
                hexBytes.append(byte)
                index = nextIndex
            }
            return Data(hexBytes) == spkiData
        }
        return false
    }

    public func evaluateTrustValidity(_ trust: SecTrust) -> Bool {
        var error: CFError?
        return SecTrustEvaluateWithError(trust, &error)
    }

    public static func leafCertificate(in trust: SecTrust) -> SecCertificate? {
        guard let chain = SecTrustCopyCertificateChain(trust) as? [SecCertificate] else { return nil }
        return chain.first
    }

    public func verifyPin(host: String, pinSha256: String) async -> [String: Any] {
        do {
            let trust = try await obtainServerTrust(host: host)
            let certificateValid = evaluateTrustValidity(trust)
            guard let leaf = Self.leafCertificate(in: trust) else {
                return [
                    "host": host,
                    "valid": false,
                    "isPinned": false,
                    "isCertificateValid": certificateValid,
                    "auditStatus": "NO_CERTIFICATE",
                    "spkiSha256": ""
                ]
            }
            let computedPin = Self.spkiSha256Base64(certificate: leaf) ?? ""
            let matched = computedPin.isEmpty ? false : Self.pinDigestMatches(pin: pinSha256, spkiData: Data(base64Encoded: computedPin) ?? Data())
            return [
                "host": host,
                "valid": matched,
                "isPinned": matched,
                "isCertificateValid": certificateValid,
                "auditStatus": matched ? (certificateValid ? "PINNED_VALID" : "PINNED_CHAIN_INVALID") : "PIN_MISMATCH",
                "spkiSha256": computedPin,
                "matchedPin": matched ? pinSha256 : ""
            ]
        } catch {
            return [
                "host": host,
                "valid": false,
                "isPinned": false,
                "isCertificateValid": false,
                "auditStatus": "TRUST_CAPTURE_FAILED",
                "spkiSha256": "",
                "error": error.localizedDescription
            ]
        }
    }

    public func auditNetworkCertificate(urlString: String) async -> [String: Any] {
        guard let url = URL(string: urlString), let host = url.host else {
            return [
                "trusted": false,
                "host": urlString,
                "auditStatus": "INVALID_URL",
                "subject": "",
                "sha256Pin": ""
            ]
        }
        do {
            let trust = try await obtainServerTrust(host: host)
            let valid = evaluateTrustValidity(trust)
            let leaf = Self.leafCertificate(in: trust)
            let subject = leaf.flatMap { SecCertificateCopySubjectSummary($0) as String? } ?? host
            let pin = leaf.flatMap { Self.spkiSha256Base64(certificate: $0) }
            return [
                "trusted": valid,
                "host": host,
                "subject": subject,
                "sha256Pin": pin.map { "sha256/\($0)" } ?? "",
                "isCertificateValid": valid,
                "auditStatus": valid ? "VALID" : "CHAIN_INVALID"
            ]
        } catch {
            return [
                "trusted": false,
                "host": host,
                "subject": "",
                "sha256Pin": "",
                "isCertificateValid": false,
                "auditStatus": "TRUST_CAPTURE_FAILED",
                "error": error.localizedDescription
            ]
        }
    }

    public func obtainServerTrust(host: String) async throws -> SecTrust {
        if let provider = serverTrustProvider {
            return try await provider(host)
        }
        guard let url = URL(string: "https://\(host)/") else {
            throw GoatBridgeError.invalidPayload("Invalid HTTPS host '\(host)'")
        }
        return try await GoatServerTrustCaptureSession.capture(url: url)
    }
}

private final class GoatServerTrustCaptureSession: NSObject, URLSessionTaskDelegate {
    private let lock = NSLock()
    private var continuation: CheckedContinuation<SecTrust, Error>?
    private var capturedTrust: SecTrust?
    private var session: URLSession?

    static func capture(url: URL) async throws -> SecTrust {
        let capture = GoatServerTrustCaptureSession()
        return try await withCheckedThrowingContinuation { continuation in
            capture.continuation = continuation
            let session = URLSession(configuration: .default, delegate: capture, delegateQueue: nil)
            capture.session = session
            let task = session.dataTask(with: url) { [weak capture] _, _, error in
                capture?.handleTaskCompletion(error: error)
            }
            task.resume()
        }
    }

    private func handleTaskCompletion(error: Error?) {
        lock.lock()
        guard let continuation = continuation else {
            lock.unlock()
            return
        }
        if let trust = capturedTrust {
            self.continuation = nil
            lock.unlock()
            session?.invalidateAndCancel()
            session = nil
            continuation.resume(returning: trust)
            return
        }
        self.continuation = nil
        lock.unlock()
        session?.invalidateAndCancel()
        session = nil
        continuation.resume(throwing: error ?? GoatBridgeError.notSupported("TRUST_NOT_CAPTURED: server did not present a TLS server-trust challenge"))
    }

    func urlSession(
        _ session: URLSession,
        task: URLSessionTask,
        didReceive challenge: URLAuthenticationChallenge,
        completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void
    ) {
        if challenge.protectionSpace.authenticationMethod == NSURLAuthenticationMethodServerTrust,
           let trust = challenge.protectionSpace.serverTrust {
            lock.lock()
            if continuation != nil {
                capturedTrust = trust
                lock.unlock()
                completionHandler(.performDefaultHandling, nil)
                return
            }
            lock.unlock()
        }
        completionHandler(.performDefaultHandling, nil)
    }
}
