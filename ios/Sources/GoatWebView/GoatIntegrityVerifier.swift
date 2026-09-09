import Foundation
import CryptoKit
import Security

public enum SriAlgorithm: String, CaseIterable, Sendable {
    case sha256 = "SHA-256"
    case sha384 = "SHA-384"
    case sha512 = "SHA-512"

    public var prefix: String {
        switch self {
        case .sha256: return "sha256-"
        case .sha384: return "sha384-"
        case .sha512: return "sha512-"
        }
    }
}

public struct GoatIntegrityVerifier: Sendable {

    public static let shared = GoatIntegrityVerifier()

    public init() {}

    public func generateCspNonce(byteCount: Int = 16) -> String {
        var bytes = [UInt8](repeating: 0, count: byteCount)
        let status = SecRandomCopyBytes(kSecRandomDefault, byteCount, &bytes)
        if status != errSecSuccess {
            return UUID().uuidString.replacingOccurrences(of: "-", with: "")
        }
        return Data(bytes).base64EncodedString()
    }

    public func injectDynamicCspNonce(html: String, nonce: String) -> String {
        var result = html

        let scriptRegex = try? NSRegularExpression(pattern: "<script(\\s+[^>]*|)>", options: .caseInsensitive)
        if let scriptRegex = scriptRegex {
            let matches = scriptRegex.matches(in: result, options: [], range: NSRange(location: 0, length: (result as NSString).length))
            for match in matches.reversed() {
                let attrs = (result as NSString).substring(with: match.range(at: 1))
                let nonceAttrRegex = try? NSRegularExpression(pattern: "\\bnonce\\s*=\\s*[\"'][^\"']*[\"']", options: .caseInsensitive)
                let newTag: String
                if let nonceAttrRegex = nonceAttrRegex,
                   let firstMatch = nonceAttrRegex.firstMatch(in: attrs, options: [], range: NSRange(location: 0, length: (attrs as NSString).length)) {
                    let replacedAttrs = (attrs as NSString).replacingCharacters(in: firstMatch.range, with: "nonce=\"\(nonce)\"")
                    newTag = "<script\(replacedAttrs)>"
                } else {
                    newTag = "<script nonce=\"\(nonce)\"\(attrs)>"
                }
                result = (result as NSString).replacingCharacters(in: match.range, with: newTag)
            }
        }

        let metaCspRegex = try? NSRegularExpression(
            pattern: "<meta\\s+([^>]*http-equiv\\s*=\\s*[\"']Content-Security-Policy[\"'][^>]*)>",
            options: .caseInsensitive
        )
        if let metaCspRegex = metaCspRegex,
           let metaMatch = metaCspRegex.firstMatch(in: result, options: [], range: NSRange(location: 0, length: (result as NSString).length)) {
            let fullMeta = (result as NSString).substring(with: metaMatch.range)
            let contentRegex = try? NSRegularExpression(pattern: "content\\s*=\\s*([\"'])(.*?)\\1", options: .caseInsensitive)
            if let contentRegex = contentRegex,
               let contentMatch = contentRegex.firstMatch(in: fullMeta, options: [], range: NSRange(location: 0, length: (fullMeta as NSString).length)) {
                let quote = (fullMeta as NSString).substring(with: contentMatch.range(at: 1))
                let originalContent = (fullMeta as NSString).substring(with: contentMatch.range(at: 2))
                let updatedContent = injectNonceIntoCspDirective(csp: originalContent, nonce: nonce)
                let updatedMeta = (fullMeta as NSString).replacingCharacters(
                    in: contentMatch.range,
                    with: "content=\(quote)\(updatedContent)\(quote)"
                )
                result = (result as NSString).replacingCharacters(in: metaMatch.range, with: updatedMeta)
            }
        } else {
            let defaultCspMeta = "<meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'self'; script-src 'nonce-\(nonce)' 'strict-dynamic' 'self' https: 'unsafe-inline'; style-src 'self' 'unsafe-inline';\">"
            let headRegex = try? NSRegularExpression(pattern: "<head(\\s+[^>]*)?>", options: .caseInsensitive)
            if let headRegex = headRegex,
               let headMatch = headRegex.firstMatch(in: result, options: [], range: NSRange(location: 0, length: (result as NSString).length)) {
                let insertIdx = headMatch.range.location + headMatch.range.length
                result = (result as NSString).replacingCharacters(in: NSRange(location: insertIdx, length: 0), with: defaultCspMeta)
            } else {
                let htmlRegex = try? NSRegularExpression(pattern: "<html(\\s+[^>]*)?>", options: .caseInsensitive)
                if let htmlRegex = htmlRegex,
                   let htmlMatch = htmlRegex.firstMatch(in: result, options: [], range: NSRange(location: 0, length: (result as NSString).length)) {
                    let insertIdx = htmlMatch.range.location + htmlMatch.range.length
                    result = (result as NSString).replacingCharacters(in: NSRange(location: insertIdx, length: 0), with: defaultCspMeta)
                } else {
                    result = defaultCspMeta + result
                }
            }
        }

        return result
    }

    private func injectNonceIntoCspDirective(csp: String, nonce: String) -> String {
        let nonceDirective = "'nonce-\(nonce)' 'strict-dynamic'"
        let scriptSrcRegex = try? NSRegularExpression(pattern: "\\bscript-src\\b([^;]*)", options: .caseInsensitive)
        if let scriptSrcRegex = scriptSrcRegex,
           let match = scriptSrcRegex.firstMatch(in: csp, options: [], range: NSRange(location: 0, length: (csp as NSString).length)) {
            let existingDirectives = (csp as NSString).substring(with: match.range(at: 1)).trimmingCharacters(in: .whitespaces)
            let nonceCleanRegex = try? NSRegularExpression(pattern: "'nonce-[^']*'", options: .caseInsensitive)
            let dynamicCleanRegex = try? NSRegularExpression(pattern: "'strict-dynamic'", options: .caseInsensitive)
            var cleaned = existingDirectives
            if let nonceCleanRegex = nonceCleanRegex {
                cleaned = nonceCleanRegex.stringByReplacingMatches(in: cleaned, options: [], range: NSRange(location: 0, length: (cleaned as NSString).length), withTemplate: "")
            }
            if let dynamicCleanRegex = dynamicCleanRegex {
                cleaned = dynamicCleanRegex.stringByReplacingMatches(in: cleaned, options: [], range: NSRange(location: 0, length: (cleaned as NSString).length), withTemplate: "")
            }
            cleaned = cleaned.trimmingCharacters(in: .whitespaces)
            let replacement = cleaned.isEmpty ? "script-src \(nonceDirective)" : "script-src \(nonceDirective) \(cleaned)"
            return (csp as NSString).replacingCharacters(in: match.range, with: replacement)
        } else {
            let trimmed = csp.trimmingCharacters(in: .whitespaces)
            if trimmed.hasSuffix(";") {
                return "\(trimmed) script-src \(nonceDirective) 'self';"
            } else if !trimmed.isEmpty {
                return "\(trimmed); script-src \(nonceDirective) 'self';"
            } else {
                return "script-src \(nonceDirective) 'self';"
            }
        }
    }

    public func computeSriHash(data: Data, algorithm: SriAlgorithm = .sha384) -> String {
        let hashData: Data
        switch algorithm {
        case .sha256:
            hashData = Data(SHA256.hash(data: data))
        case .sha384:
            hashData = Data(SHA384.hash(data: data))
        case .sha512:
            hashData = Data(SHA512.hash(data: data))
        }
        return "\(algorithm.prefix)\(hashData.base64EncodedString())"
    }

    public func computeSriHash(fileURL: URL, algorithm: SriAlgorithm = .sha384) throws -> String {
        let data = try Data(contentsOf: fileURL)
        return computeSriHash(data: data, algorithm: algorithm)
    }

    public func verifySriHash(data: Data, expectedSha: String) -> Bool {
        guard let (algorithm, expectedData) = parseSriHash(expectedSha) else {
            return false
        }
        let computed: Data
        switch algorithm {
        case .sha256:
            computed = Data(SHA256.hash(data: data))
        case .sha384:
            computed = Data(SHA384.hash(data: data))
        case .sha512:
            computed = Data(SHA512.hash(data: data))
        }
        return constantTimeCompare(computed, expectedData)
    }

    public func verifySriHash(fileURL: URL, expectedSha: String) -> Bool {
        guard let data = try? Data(contentsOf: fileURL) else {
            return false
        }
        return verifySriHash(data: data, expectedSha: expectedSha)
    }

    public func verifySriManifest(manifest: [String: String], assetResolver: (String) -> Data?) -> [String: Bool] {
        var results: [String: Bool] = [:]
        for (path, expectedHash) in manifest {
            if let data = assetResolver(path) {
                results[path] = verifySriHash(data: data, expectedSha: expectedHash)
            } else {
                results[path] = false
            }
        }
        return results
    }

    private func parseSriHash(_ sri: String) -> (SriAlgorithm, Data)? {
        let trimmed = sri.trimmingCharacters(in: .whitespaces)
        guard let hyphenIndex = trimmed.firstIndex(of: "-") else { return nil }
        let prefix = String(trimmed[..<hyphenIndex]).lowercased()
        let algorithm: SriAlgorithm
        switch prefix {
        case "sha256": algorithm = .sha256
        case "sha384": algorithm = .sha384
        case "sha512": algorithm = .sha512
        default: return nil
        }
        let afterHyphen = trimmed[trimmed.index(after: hyphenIndex)...]
        guard let data = Data(base64Encoded: String(afterHyphen)) else {
            return nil
        }
        return (algorithm, data)
    }

    private func constantTimeCompare(_ a: Data, _ b: Data) -> Bool {
        guard a.count == b.count else { return false }
        var result: UInt8 = 0
        for i in 0..<a.count {
            result |= a[i] ^ b[i]
        }
        return result == 0
    }
}

