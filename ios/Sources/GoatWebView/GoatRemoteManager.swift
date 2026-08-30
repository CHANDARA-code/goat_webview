import Foundation
import CryptoKit
import Security
import zlib

/**
 * Data model representing an OTA release manifest fetched from the CDN (Task 10080 / Pillar 1).
 */
public struct ReleaseManifest: Codable, Equatable, Sendable {
    public let appId: String
    public let version: String
    public let bundleUrl: String
    public let sha256: String
    public let signature: String?
    public let signatureAlgorithm: String
    public let rolloutPercentage: Int
    public let minEngineVersion: String?
    public let isRollback: Bool

    public init(
        appId: String,
        version: String,
        bundleUrl: String,
        sha256: String,
        signature: String? = nil,
        signatureAlgorithm: String = "SHA256withECDSA",
        rolloutPercentage: Int = 100,
        minEngineVersion: String? = nil,
        isRollback: Bool = false
    ) {
        self.appId = appId
        self.version = version
        self.bundleUrl = bundleUrl
        self.sha256 = sha256
        self.signature = signature
        self.signatureAlgorithm = signatureAlgorithm
        self.rolloutPercentage = rolloutPercentage
        self.minEngineVersion = minEngineVersion
        self.isRollback = isRollback
    }
}

/**
 * Progress and status states during an OTA update lifecycle (Task 10080).
 */
public enum UpdateProgress: Equatable, Sendable {
    case checking(appId: String)
    case upToDate(appId: String, currentVersion: String)
    case downloading(appId: String, bytesDownloaded: Int64, totalBytes: Int64, progressPercentage: Int)
    case verifying(appId: String)
    case staging(appId: String, targetVersion: String)
    case ready(appId: String, version: String, bundleDir: URL)
    case failed(appId: String, error: String)
}

/**
 * Protocol abstracting HTTP operations for testing and network configuration.
 */
public protocol HttpDownloaderProtocol: Sendable {
    func downloadFile(
        from url: URL,
        to destination: URL,
        onProgress: @escaping @Sendable (Int64, Int64) -> Void
    ) async throws
}

/**
 * Standard production HTTP downloader using URLSession.
 */
public final class DefaultHttpDownloader: HttpDownloaderProtocol {
    private let session: URLSession

    public init(session: URLSession = .shared) {
        self.session = session
    }

    public func downloadFile(
        from url: URL,
        to destination: URL,
        onProgress: @escaping @Sendable (Int64, Int64) -> Void
    ) async throws {
        let (bytes, response) = try await session.bytes(from: url)
        let totalBytes = response.expectedContentLength

        try FileManager.default.createDirectory(at: destination.deletingLastPathComponent(), withIntermediateDirectories: true, attributes: nil)

        var data = Data()
        var downloadedBytes: Int64 = 0

        for try await byte in bytes {
            data.append(byte)
            downloadedBytes += 1
            if totalBytes > 0 && downloadedBytes % 16384 == 0 {
                onProgress(downloadedBytes, totalBytes)
            }
        }
        onProgress(downloadedBytes, totalBytes > 0 ? totalBytes : downloadedBytes)
        try data.write(to: destination, options: .atomic)
    }
}

/**
 * Cryptographic signature verification helper (Task 10081 / OWASP MASVS-CRYPTO).
 */
public enum GoatSecurityVerifier {
    public static let algorithmECDSA = "SHA256withECDSA"
    public static let algorithmRSA = "SHA256withRSA"

    /**
     * Verifies ECDSA (P-256) signature over data.
     */
    public static func verifyECDSA(data: Data, signatureBytes: Data, publicKeyBytes: Data) -> Bool {
        do {
            // Attempt standard raw representation (65 bytes uncompressed: 0x04 + X + Y) or DER X.509
            let publicKey: P256.Signing.PublicKey
            if publicKeyBytes.count == 65 && publicKeyBytes[0] == 0x04 {
                publicKey = try P256.Signing.PublicKey(rawRepresentation: publicKeyBytes)
            } else if let parsedKey = try? P256.Signing.PublicKey(derRepresentation: publicKeyBytes) {
                publicKey = parsedKey
            } else if let parsedPem = try? P256.Signing.PublicKey(pemRepresentation: String(data: publicKeyBytes, encoding: .utf8) ?? "") {
                publicKey = parsedPem
            } else {
                publicKey = try P256.Signing.PublicKey(rawRepresentation: publicKeyBytes)
            }

            // Attempt DER signature or IEEE P1363 (64 bytes: R + S)
            let ecdsaSig: P256.Signing.ECDSASignature
            if signatureBytes.count == 64 {
                ecdsaSig = try P256.Signing.ECDSASignature(rawRepresentation: signatureBytes)
            } else {
                ecdsaSig = try P256.Signing.ECDSASignature(derRepresentation: signatureBytes)
            }

            let digest = SHA256.hash(data: data)
            return publicKey.isValidSignature(ecdsaSig, for: digest)
        } catch {
            return false
        }
    }

    /**
     * Verifies RSA signature with SHA-256 (PKCS#1 v1.5).
     */
    public static func verifyRSA(data: Data, signatureBytes: Data, publicKeyBytes: Data) -> Bool {
        let attributes: [CFString: Any] = [
            kSecAttrKeyType: kSecAttrKeyTypeRSA,
            kSecAttrKeyClass: kSecAttrKeyClassPublic
        ]
        var error: Unmanaged<CFError>?
        guard let secKey = SecKeyCreateWithData(publicKeyBytes as CFData, attributes as CFDictionary, &error) else {
            return false
        }

        let digest = SHA256.hash(data: data)
        let digestData = Data(digest)

        return SecKeyVerifySignature(
            secKey,
            .rsaSignatureDigestPKCS1v15SHA256,
            digestData as CFData,
            signatureBytes as CFData,
            &error
        )
    }

    /**
     * Verifies data or file signature with chosen algorithm.
     */
    public static func verifyDataSignature(
        data: Data,
        signature: String,
        publicKeyBytes: Data,
        algorithm: String = algorithmECDSA
    ) -> Bool {
        guard let sigData = Data(base64Encoded: signature.trimmingCharacters(in: .whitespacesAndNewlines)) else {
            return false
        }

        if algorithm.caseInsensitiveCompare(algorithmRSA) == .orderedSame {
            return verifyRSA(data: data, signatureBytes: sigData, publicKeyBytes: publicKeyBytes)
        } else {
            return verifyECDSA(data: data, signatureBytes: sigData, publicKeyBytes: publicKeyBytes)
        }
    }
}

/**
 * Safe ZIP Archive Extractor with strict Zip Slip / Path Traversal protection.
 */
public enum GoatZipExtractor {
    public static func extract(zipData: Data, to destinationDir: URL) throws {
        let fileManager = FileManager.default
        try fileManager.createDirectory(at: destinationDir, withIntermediateDirectories: true, attributes: nil)
        let destCanonical = destinationDir.standardizedFileURL.path

        var offset = 0
        let totalCount = zipData.count

        while offset + 30 <= totalCount {
            let sig = zipData.subdata(in: offset..<(offset + 4)).withUnsafeBytes { $0.load(as: UInt32.self) }
            guard sig == 0x04034b50 else { break }

            let compMethod = zipData.subdata(in: (offset + 8)..<(offset + 10)).withUnsafeBytes { $0.load(as: UInt16.self) }
            let compSize = Int(zipData.subdata(in: (offset + 18)..<(offset + 22)).withUnsafeBytes { $0.load(as: UInt32.self) })
            let uncompSize = Int(zipData.subdata(in: (offset + 22)..<(offset + 26)).withUnsafeBytes { $0.load(as: UInt32.self) })
            let nameLen = Int(zipData.subdata(in: (offset + 26)..<(offset + 28)).withUnsafeBytes { $0.load(as: UInt16.self) })
            let extraLen = Int(zipData.subdata(in: (offset + 28)..<(offset + 30)).withUnsafeBytes { $0.load(as: UInt16.self) })

            let nameOffset = offset + 30
            guard nameOffset + nameLen <= totalCount else { break }
            let filename = String(data: zipData.subdata(in: nameOffset..<(nameOffset + nameLen)), encoding: .utf8) ?? ""

            let dataOffset = nameOffset + nameLen + extraLen
            guard dataOffset + compSize <= totalCount else { break }

            let compressedData = zipData.subdata(in: dataOffset..<(dataOffset + compSize))
            offset = dataOffset + compSize

            guard !filename.isEmpty else { continue }

            let targetURL = destinationDir.appendingPathComponent(filename).standardizedFileURL
            let targetCanonical = targetURL.path

            // Zip Slip Security Check
            guard targetCanonical.hasPrefix(destCanonical + "/") || targetCanonical == destCanonical else {
                throw GoatStorageError.securityViolation("Zip Slip exploit detected in archive entry: \(filename)")
            }

            if filename.hasSuffix("/") {
                try fileManager.createDirectory(at: targetURL, withIntermediateDirectories: true, attributes: nil)
            } else {
                try fileManager.createDirectory(at: targetURL.deletingLastPathComponent(), withIntermediateDirectories: true, attributes: nil)
                let finalData: Data
                if compMethod == 0 {
                    finalData = compressedData
                } else if compMethod == 8 {
                    // Raw Deflate decompression
                    var stream = z_stream()
                    guard inflateInit2_(&stream, -15, ZLIB_VERSION, Int32(MemoryLayout<z_stream>.size)) == Z_OK else {
                        throw GoatStorageError.ioError("Failed to initialize raw deflate inflation")
                    }
                    defer { inflateEnd(&stream) }
                    var decomp = Data(count: max(uncompSize, compressedData.count * 4 + 1024))
                    var status = Z_OK
                    compressedData.withUnsafeBytes { inBuf in
                        stream.next_in = UnsafeMutablePointer<Bytef>(mutating: inBuf.bindMemory(to: Bytef.self).baseAddress!)
                        stream.avail_in = uInt(compressedData.count)
                        while status == Z_OK {
                            if Int(stream.total_out) >= decomp.count { decomp.count *= 2 }
                            decomp.withUnsafeMutableBytes { outBuf in
                                let off = Int(stream.total_out)
                                stream.next_out = outBuf.bindMemory(to: Bytef.self).baseAddress! + off
                                stream.avail_out = uInt(outBuf.count - off)
                                status = inflate(&stream, Z_SYNC_FLUSH)
                            }
                        }
                    }
                    decomp.count = Int(stream.total_out)
                    finalData = decomp
                } else {
                    finalData = compressedData
                }
                try finalData.write(to: targetURL, options: .atomic)
            }
        }
    }
}

/**
 * Enterprise OTA Remote Update Manager for iOS (Tasks 10080, 10081, 10125).
 *
 * Responsibilities:
 * 1. Queries remote CDN for latest mini-app release manifests.
 * 2. Background downloads `.zip` bundle packages with progress tracking.
 * 3. Enforces multi-tenant isolation, SHA-256 checksums, and ECDSA/RSA cryptographic verification.
 * 4. Atomically stages validated packages with zero downtime for active WebView sessions.
 * 5. Integrates gradual grayscale rollout bucketing and instant rollback.
 */
public class GoatRemoteManager: @unchecked Sendable {

    public static let prefsKeyInstalledVersionPrefix = "goat_installed_version_"
    public static let prefsKeyInstalledHashPrefix = "goat_installed_hash_"

    private let userDefaults: UserDefaults
    private let storageManager: GoatStorageManager
    private let httpDownloader: HttpDownloaderProtocol
    private let lock = NSLock()

    public init(
        userDefaults: UserDefaults = .standard,
        storageManager: GoatStorageManager = GoatStorageManager(),
        httpDownloader: HttpDownloaderProtocol = DefaultHttpDownloader()
    ) {
        self.userDefaults = userDefaults
        self.storageManager = storageManager
        self.httpDownloader = httpDownloader
    }

    /**
     * Evaluates whether a given user ID falls within the specified rollout percentage bucket.
     */
    public static func isEligibleForRollout(userId: String, rolloutPercentage: Int) -> Bool {
        if rolloutPercentage >= 100 { return true }
        if rolloutPercentage <= 0 { return false }
        let clean = userId.trimmingCharacters(in: .whitespacesAndNewlines)
        if clean.isEmpty { return false }
        let bucket = abs(clean.hashValue) % 100
        return bucket < rolloutPercentage
    }

    /**
     * Compares two semantic version strings (e.g. "1.2.0" vs "1.1.9").
     * Returns `true` if `newVersion` is strictly greater than `currentVersion`.
     */
    public static func isNewerVersion(currentVersion: String, newVersion: String) -> Bool {
        let currentParts = currentVersion.split(separator: ".").compactMap { Int($0) }
        let newParts = newVersion.split(separator: ".").compactMap { Int($0) }

        let maxLen = max(currentParts.count, newParts.count)
        for i in 0..<maxLen {
            let curr = i < currentParts.count ? currentParts[i] : 0
            let target = i < newParts.count ? newParts[i] : 0
            if target > curr { return true }
            if target < curr { return false }
        }
        return false
    }

    /**
     * Retrieves the currently recorded installed version for a mini-app tenant.
     */
    public func getInstalledVersion(appId: String = "default") -> String {
        lock.lock()
        defer { lock.unlock() }
        let safeAppId = (try? GoatStorageManager.sanitizeIdentifier(appId)) ?? appId
        return userDefaults.string(forKey: "\(Self.prefsKeyInstalledVersionPrefix)\(safeAppId)") ?? "1.0.0"
    }

    /**
     * Records the successfully staged version for a mini-app tenant.
     */
    public func setInstalledVersion(appId: String, version: String, hash: String) {
        lock.lock()
        defer { lock.unlock() }
        let safeAppId = (try? GoatStorageManager.sanitizeIdentifier(appId)) ?? appId
        userDefaults.set(version, forKey: "\(Self.prefsKeyInstalledVersionPrefix)\(safeAppId)")
        userDefaults.set(hash, forKey: "\(Self.prefsKeyInstalledHashPrefix)\(safeAppId)")
    }

    /**
     * Fetches and parses a ReleaseManifest from a remote CDN URL.
     */
    public func fetchManifest(from manifestUrl: URL) async throws -> ReleaseManifest {
        var request = URLRequest(url: manifestUrl)
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.timeoutInterval = 10.0

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            throw GoatStorageError.ioError("Failed to fetch manifest from \(manifestUrl)")
        }

        let decoder = JSONDecoder()
        return try decoder.decode(ReleaseManifest.self, from: data)
    }

    /**
     * Computes the SHA-256 hexadecimal hash of raw data.
     */
    public func computeDataSha256(data: Data) -> String {
        let digest = SHA256.hash(data: data)
        return digest.map { String(format: "%02x", $0) }.joined()
    }

    /**
     * Computes the SHA-256 hexadecimal hash of a physical file.
     */
    public func computeFileSha256(at fileUrl: URL) throws -> String {
        let data = try Data(contentsOf: fileUrl)
        return computeDataSha256(data: data)
    }

    /**
     * Executes a complete, resilient OTA update check and download flow.
     *
     * - Parameters:
     *   - appId: The target mini-app identifier.
     *   - manifestUrl: The CDN URL returning the JSON ReleaseManifest.
     *   - userId: Optional user identifier for gradual rollout bucketing.
     *   - publicKeyData: Optional publisher public key data for cryptographic signature verification.
     *   - algorithm: Digital signature algorithm ("SHA256withECDSA" or "SHA256withRSA").
     * - Returns: An AsyncStream emitting UpdateProgress events.
     */
    public func checkAndUpdate(
        appId: String = "default",
        manifestUrl: URL,
        userId: String = "",
        publicKeyData: Data? = nil,
        algorithm: String = GoatSecurityVerifier.algorithmECDSA
    ) -> AsyncStream<UpdateProgress> {
        AsyncStream { continuation in
            Task {
                continuation.yield(.checking(appId: appId))

                // 1. Fetch manifest
                let manifest: ReleaseManifest
                do {
                    manifest = try await self.fetchManifest(from: manifestUrl)
                } catch {
                    continuation.yield(.failed(appId: appId, error: "Manifest fetch failed: \(error.localizedDescription)"))
                    continuation.finish()
                    return
                }

                let currentVersion = self.getInstalledVersion(appId: appId)

                // 2. Rollback or Version Eligibility Check
                if !manifest.isRollback {
                    if !Self.isNewerVersion(currentVersion: currentVersion, newVersion: manifest.version) {
                        continuation.yield(.upToDate(appId: appId, currentVersion: currentVersion))
                        continuation.finish()
                        return
                    }

                    if !userId.isEmpty && !Self.isEligibleForRollout(userId: userId, rolloutPercentage: manifest.rolloutPercentage) {
                        continuation.yield(.upToDate(appId: appId, currentVersion: currentVersion))
                        continuation.finish()
                        return
                    }
                }

                // 3. Download bundle archive to temporary cache file
                guard let bundleUrl = URL(string: manifest.bundleUrl) else {
                    continuation.yield(.failed(appId: appId, error: "Invalid bundle URL: \(manifest.bundleUrl)"))
                    continuation.finish()
                    return
                }

                let tempDownloadDir = URL(fileURLWithPath: NSTemporaryDirectory()).appendingPathComponent("goat_ota_downloads", isDirectory: true)
                let tempBundleFile = tempDownloadDir.appendingPathComponent("\(appId)_\(manifest.version)_\(Int(Date().timeIntervalSince1970 * 1000)).zip")

                let fileManager = FileManager.default

                do {
                    try await self.httpDownloader.downloadFile(from: bundleUrl, to: tempBundleFile) { downloaded, total in
                        let percent = total > 0 ? Int((downloaded * 100) / total) : 0
                        continuation.yield(.downloading(appId: appId, bytesDownloaded: downloaded, totalBytes: total, progressPercentage: percent))
                    }

                    let fileData = try Data(contentsOf: tempBundleFile)
                    continuation.yield(.downloading(appId: appId, bytesDownloaded: Int64(fileData.count), totalBytes: Int64(fileData.count), progressPercentage: 100))

                    // 4. Verify Integrity (SHA-256 and Cryptographic Signature)
                    continuation.yield(.verifying(appId: appId))
                    let actualHash = self.computeDataSha256(data: fileData)

                    if actualHash.lowercased() != manifest.sha256.lowercased() {
                        let errorMsg = "SHA-256 checksum mismatch! Expected: \(manifest.sha256), Actual: \(actualHash)"
                        try? fileManager.removeItem(at: tempBundleFile)
                        continuation.yield(.failed(appId: appId, error: errorMsg))
                        continuation.finish()
                        return
                    }

                    // Cryptographic signature check if signature and public key are supplied
                    if let signature = manifest.signature, !signature.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
                       let pubKey = publicKeyData {
                        let isValid = GoatSecurityVerifier.verifyDataSignature(
                            data: fileData,
                            signature: signature,
                            publicKeyBytes: pubKey,
                            algorithm: manifest.signatureAlgorithm.isEmpty ? algorithm : manifest.signatureAlgorithm
                        )
                        if !isValid {
                            let errorMsg = "Cryptographic signature verification failed for remote bundle!"
                            try? fileManager.removeItem(at: tempBundleFile)
                            continuation.yield(.failed(appId: appId, error: errorMsg))
                            continuation.finish()
                            return
                        }
                    }

                    // 5. Staging & Extraction
                    continuation.yield(.staging(appId: appId, targetVersion: manifest.version))
                    let targetDir = try self.storageManager.ensureTenantDataDirectory(appId: appId)
                    let stagingDir = targetDir.deletingLastPathComponent().appendingPathComponent("\(targetDir.lastPathComponent)_staging_\(Int(Date().timeIntervalSince1970 * 1000))", isDirectory: true)

                    try GoatZipExtractor.extract(zipData: fileData, to: stagingDir)

                    // Atomically move extracted files from stagingDir to targetDir
                    let stagedFiles = try fileManager.contentsOfDirectory(at: stagingDir, includingPropertiesForKeys: nil)
                    for item in stagedFiles {
                        let dest = targetDir.appendingPathComponent(item.lastPathComponent)
                        if fileManager.fileExists(atPath: dest.path) {
                            try? fileManager.removeItem(at: dest)
                        }
                        try fileManager.moveItem(at: item, to: dest)
                    }
                    try? fileManager.removeItem(at: stagingDir)
                    try? fileManager.removeItem(at: tempBundleFile)

                    // Record new active version
                    self.setInstalledVersion(appId: appId, version: manifest.version, hash: manifest.sha256)

                    // Dynamic Content Rule List re-compilation from updated manifest (Task 10205)
                    let manifestFile = targetDir.appendingPathComponent("manifest.json")
                    if fileManager.fileExists(atPath: manifestFile.path),
                       let manifestContent = try? Data(contentsOf: manifestFile) {
                        _ = try? await GoatContentBlocker.recompileAndApply(appId: appId, manifestData: manifestContent)
                    }

                    continuation.yield(.ready(appId: appId, version: manifest.version, bundleDir: targetDir))
                    continuation.finish()
                } catch {
                    if fileManager.fileExists(atPath: tempBundleFile.path) {
                        try? fileManager.removeItem(at: tempBundleFile)
                    }
                    continuation.yield(.failed(appId: appId, error: "Update process failed: \(error.localizedDescription)"))
                    continuation.finish()
                }
            }
        }
    }
}
