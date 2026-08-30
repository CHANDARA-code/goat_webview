import Foundation
import zlib

/**
 * Metadata descriptor for a dynamically loaded subpackage module (Task 10092 & 10190).
 */
public struct SubpackageMetadata: Codable, Sendable, Equatable {
    public let subpackageName: String
    public let appId: String
    public let extractedPath: String
    public let byteSize: Int64
    public let fileCount: Int
    public let cachedAt: Int64

    public init(
        subpackageName: String,
        appId: String,
        extractedPath: String,
        byteSize: Int64,
        fileCount: Int,
        cachedAt: Int64
    ) {
        self.subpackageName = subpackageName
        self.appId = appId
        self.extractedPath = extractedPath
        self.byteSize = byteSize
        self.fileCount = fileCount
        self.cachedAt = cachedAt
    }
}

/**
 * Result model for subpackage dynamic loading.
 */
public struct SubpackageLoadResult: Codable, Sendable, Equatable {
    public let appId: String
    public let subpackageName: String
    public let isSuccess: Bool
    public let isCached: Bool
    public let extractedPath: String
    public let byteSize: Int64
    public let errorMessage: String?

    public init(
        appId: String,
        subpackageName: String,
        isSuccess: Bool,
        isCached: Bool,
        extractedPath: String,
        byteSize: Int64,
        errorMessage: String? = nil
    ) {
        self.appId = appId
        self.subpackageName = subpackageName
        self.isSuccess = isSuccess
        self.isCached = isCached
        self.extractedPath = extractedPath
        self.byteSize = byteSize
        self.errorMessage = errorMessage
    }
}

/**
 * Subpackage Dynamic Route On-Demand Loader for iOS (Task 10092 & Task 10190).
 *
 * Dynamically downloads, unpacks, and mounts subpackage modules (`subpackages/{name}/`)
 * into the isolated mini-app tenant asset directory on-demand. Strictly enforces Zip Slip
 * and directory traversal containment rules. Eliminates dummy chunk synthesis.
 */
public final class GoatSubpackageLoader: @unchecked Sendable {

    private static let illegalCharsRegex = try! NSRegularExpression(pattern: "[\\\\/:*?\"<>|\\x00-\\x1F]")

    private let customBaseDir: URL?
    private let fileManager: FileManager
    private let lock = NSLock()
    private var memoryRegistry: [String: Set<String>] = [:]
    private var metadataRegistry: [String: [String: SubpackageMetadata]] = [:]

    public init(customBaseDir: URL? = nil, fileManager: FileManager = .default) {
        self.customBaseDir = customBaseDir
        self.fileManager = fileManager
    }

    private func getBaseDirectory() -> URL {
        if let custom = customBaseDir {
            return custom
        }
        let paths = fileManager.urls(for: .documentDirectory, in: .userDomainMask)
        return paths.first ?? URL(fileURLWithPath: NSTemporaryDirectory())
    }

    /**
     * Validates path containment and returns the canonical target directory for a subpackage.
     * Throws `GoatStorageError.securityViolation` or `GoatStorageError.invalidIdentifier` if traversal attempt is detected.
     */
    public func resolveSubpackageDir(appId: String, subpackageName: String) throws -> URL {
        let trimmedAppId = appId.trimmingCharacters(in: .whitespacesAndNewlines)
        let trimmedSubpkg = subpackageName.trimmingCharacters(in: .whitespacesAndNewlines)

        if trimmedAppId.isEmpty || trimmedSubpkg.isEmpty {
            throw GoatStorageError.invalidIdentifier("App ID and subpackage name must not be blank")
        }

        // Detect directory traversal patterns or illegal characters in subpackage name
        if trimmedSubpkg.contains("..") ||
            trimmedSubpkg.contains("/") ||
            trimmedSubpkg.contains("\\") ||
            trimmedSubpkg.range(of: "%2e%2e", options: .caseInsensitive) != nil ||
            trimmedSubpkg.range(of: "%2f", options: .caseInsensitive) != nil ||
            trimmedSubpkg.range(of: "%5c", options: .caseInsensitive) != nil ||
            trimmedSubpkg.contains("\0") ||
            Self.containsIllegalCharacters(trimmedSubpkg) {
            throw GoatStorageError.securityViolation("Invalid subpackage name or path traversal attempt: '\(subpackageName)'")
        }

        // Detect directory traversal patterns or illegal characters in app ID
        if trimmedAppId.contains("..") ||
            trimmedAppId.contains("/") ||
            trimmedAppId.contains("\\") ||
            trimmedAppId.contains("\0") ||
            Self.containsIllegalCharacters(trimmedAppId) {
            throw GoatStorageError.securityViolation("Invalid app ID: '\(appId)'")
        }

        let baseDir = getBaseDirectory()
        let tenantBase = baseDir.appendingPathComponent("miniapps/\(trimmedAppId)/subpackages")
        let targetDir = tenantBase.appendingPathComponent(trimmedSubpkg)

        // Strict canonical path containment verification
        let targetCanonical = targetDir.standardizedFileURL.path
        let baseCanonical = tenantBase.standardizedFileURL.path
        if !targetCanonical.hasPrefix(baseCanonical + "/") && targetCanonical != baseCanonical {
            throw GoatStorageError.securityViolation("Path containment violation for subpackage: '\(subpackageName)'")
        }

        return targetDir
    }

    private static func containsIllegalCharacters(_ string: String) -> Bool {
        let range = NSRange(location: 0, length: string.utf16.count)
        return illegalCharsRegex.firstMatch(in: string, options: [], range: range) != nil
    }

    /**
     * Extracts a ZIP archive buffer into the destination directory with strict entry-by-entry Zip Slip verification.
     */
    public func extractSubpackageZip(zipData: Data, destDir: URL) throws -> (byteSize: Int64, fileCount: Int) {
        if fileManager.fileExists(atPath: destDir.path) {
            try fileManager.removeItem(at: destDir)
        }
        try fileManager.createDirectory(at: destDir, withIntermediateDirectories: true, attributes: nil)

        let destCanonical = destDir.standardizedFileURL.path
        var totalBytes: Int64 = 0
        var fileCount = 0

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

            let targetURL = destDir.appendingPathComponent(filename).standardizedFileURL
            let targetCanonical = targetURL.path

            // Zip Slip Security Check
            guard targetCanonical.hasPrefix(destCanonical + "/") || targetCanonical == destCanonical else {
                throw GoatStorageError.securityViolation("Zip Slip exploit detected in entry: \(filename)")
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
                totalBytes += Int64(finalData.count)
                fileCount += 1
            }
        }

        return (byteSize: totalBytes, fileCount: fileCount)
    }

    /**
     * Loads or verifies a dynamic subpackage route module.
     * Extracts provided ZIP data if present or verifies existing pre-extracted subpackage files on disk.
     * Returns isSuccess = false if subpackage does not exist and no ZIP data is provided.
     */
    public func loadSubpackage(
        appId: String,
        subpackageName: String,
        sourceZipData: Data? = nil
    ) async -> SubpackageLoadResult {
        let targetDir: URL
        do {
            targetDir = try resolveSubpackageDir(appId: appId, subpackageName: subpackageName)
        } catch {
            return SubpackageLoadResult(
                appId: appId,
                subpackageName: subpackageName,
                isSuccess: false,
                isCached: false,
                extractedPath: "",
                byteSize: 0,
                errorMessage: error.localizedDescription
            )
        }

        let cleanName = subpackageName.trimmingCharacters(in: .whitespacesAndNewlines)
        let dirHasFiles = hasExtractedFiles(at: targetDir)

        lock.lock()
        let appSubpackages = memoryRegistry[appId] ?? Set<String>()
        let wasCached = appSubpackages.contains(cleanName) && dirHasFiles
        lock.unlock()

        do {
            var extractedSize: Int64 = 0
            var fileCount = 0

            if let zipData = sourceZipData {
                let stats = try extractSubpackageZip(zipData: zipData, destDir: targetDir)
                extractedSize = stats.byteSize
                fileCount = stats.fileCount
            } else if dirHasFiles {
                let stats = calculateDirectoryStats(at: targetDir)
                extractedSize = stats.byteSize
                fileCount = stats.fileCount
            } else {
                return SubpackageLoadResult(
                    appId: appId,
                    subpackageName: cleanName,
                    isSuccess: false,
                    isCached: false,
                    extractedPath: "",
                    byteSize: 0,
                    errorMessage: "SUBPACKAGE_NOT_FOUND: Subpackage '\(cleanName)' does not exist on disk and no zip stream was provided"
                )
            }

            lock.lock()
            var currentSubs = memoryRegistry[appId] ?? Set<String>()
            currentSubs.insert(cleanName)
            memoryRegistry[appId] = currentSubs

            var currentMeta = metadataRegistry[appId] ?? [:]
            currentMeta[cleanName] = SubpackageMetadata(
                subpackageName: cleanName,
                appId: appId,
                extractedPath: targetDir.path,
                byteSize: extractedSize,
                fileCount: fileCount,
                cachedAt: Int64(Date().timeIntervalSince1970 * 1000)
            )
            metadataRegistry[appId] = currentMeta
            lock.unlock()

            return SubpackageLoadResult(
                appId: appId,
                subpackageName: cleanName,
                isSuccess: true,
                isCached: wasCached,
                extractedPath: targetDir.path,
                byteSize: extractedSize
            )
        } catch {
            return SubpackageLoadResult(
                appId: appId,
                subpackageName: cleanName,
                isSuccess: false,
                isCached: false,
                extractedPath: "",
                byteSize: 0,
                errorMessage: "Failed extracting subpackage: \(error.localizedDescription)"
            )
        }
    }

    /**
     * Checks if a subpackage is already mounted and cached on disk and in memory.
     */
    public func isSubpackageCached(appId: String, subpackageName: String) -> Bool {
        guard let targetDir = try? resolveSubpackageDir(appId: appId, subpackageName: subpackageName) else {
            return false
        }
        let cleanName = subpackageName.trimmingCharacters(in: .whitespacesAndNewlines)
        lock.lock()
        defer { lock.unlock() }

        let inMem = memoryRegistry[appId]?.contains(cleanName) == true
        let onDisk = hasExtractedFiles(at: targetDir)
        return inMem && onDisk
    }

    /**
     * Returns all currently cached subpackage names for an application.
     */
    public func getSubpackages(appId: String) -> [String] {
        lock.lock()
        defer { lock.unlock() }
        return Array(memoryRegistry[appId] ?? [])
    }

    /**
     * Returns detailed metadata descriptor for a cached subpackage.
     */
    public func getSubpackageMetadata(appId: String, subpackageName: String) -> SubpackageMetadata? {
        let cleanName = subpackageName.trimmingCharacters(in: .whitespacesAndNewlines)
        lock.lock()
        defer { lock.unlock() }
        return metadataRegistry[appId]?[cleanName]
    }

    /**
     * Clears subpackage cache entries from memory and physically purges from disk.
     */
    @discardableResult
    public func clearSubpackageCache(appId: String, subpackageName: String? = nil) async -> Bool {
        let trimmedAppId = appId.trimmingCharacters(in: .whitespacesAndNewlines)
        if let sub = subpackageName {
            let cleanName = sub.trimmingCharacters(in: .whitespacesAndNewlines)
            lock.lock()
            memoryRegistry[trimmedAppId]?.remove(cleanName)
            metadataRegistry[trimmedAppId]?.removeValue(forKey: cleanName)
            lock.unlock()

            if let targetDir = try? resolveSubpackageDir(appId: trimmedAppId, subpackageName: cleanName) {
                if fileManager.fileExists(atPath: targetDir.path) {
                    try? fileManager.removeItem(at: targetDir)
                }
            }
        } else {
            lock.lock()
            memoryRegistry.removeValue(forKey: trimmedAppId)
            metadataRegistry.removeValue(forKey: trimmedAppId)
            lock.unlock()

            let baseDir = getBaseDirectory()
            let tenantSubpkgDir = baseDir.appendingPathComponent("miniapps/\(trimmedAppId)/subpackages")
            if fileManager.fileExists(atPath: tenantSubpkgDir.path) {
                try? fileManager.removeItem(at: tenantSubpkgDir)
            }
        }
        return true
    }

    // MARK: - Private Helpers

    private func hasExtractedFiles(at url: URL) -> Bool {
        guard fileManager.fileExists(atPath: url.path) else { return false }
        let items = (try? fileManager.contentsOfDirectory(atPath: url.path)) ?? []
        return !items.isEmpty
    }

    private func calculateDirectoryStats(at url: URL) -> (byteSize: Int64, fileCount: Int) {
        guard let enumerator = fileManager.enumerator(at: url, includingPropertiesForKeys: [.fileSizeKey, .isRegularFileKey]) else {
            return (0, 0)
        }
        var totalSize: Int64 = 0
        var count = 0
        for case let fileURL as URL in enumerator {
            guard let resourceValues = try? fileURL.resourceValues(forKeys: [.fileSizeKey, .isRegularFileKey]),
                  resourceValues.isRegularFile == true else {
                continue
            }
            totalSize += Int64(resourceValues.fileSize ?? 0)
            count += 1
        }
        return (totalSize, count)
    }
}
