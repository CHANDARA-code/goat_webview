import Foundation
import CryptoKit

/**
 * Release channels for staged mini-app deployments (Task 10125 / Pillar 1).
 */
public enum ReleaseChannel: String, Codable, CaseIterable, Comparable, Sendable {
    case production = "production"
    case beta = "beta"
    case canary = "canary"

    public var level: Int {
        switch self {
        case .production: return 0
        case .beta: return 1
        case .canary: return 2
        }
    }

    public static func from(tag: String?) -> ReleaseChannel {
        guard let tag = tag?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() else {
            return .production
        }
        return ReleaseChannel.allCases.first { $0.rawValue.lowercased() == tag } ?? .production
    }

    public static func < (lhs: ReleaseChannel, rhs: ReleaseChannel) -> Bool {
        return lhs.level < rhs.level
    }
}

/**
 * Enterprise Grayscale (1%-100%) Rollout, Channel, and Instant Rollback Manager for iOS (Task 10125).
 *
 * Responsibilities:
 * 1. Manages deployment tracks (Production, Beta, Canary).
 * 2. Deterministically hashes user IDs to evaluate percentage-based canary buckets (1% - 100%).
 * 3. Records historical version pointers and executes instant 1-click cloud rollback (<10ms).
 */
public final class GoatChannelManager: @unchecked Sendable {

    public static let prefsPrefixChannel = "goat_channel_"
    public static let prefsPrefixHistory = "goat_history_"
    public static let prefsPrefixActive = "goat_active_ver_"
    public static let prefsPrefixLastGood = "goat_last_good_ver_"

    private let userDefaults: UserDefaults
    private let lock = NSLock()

    public init(userDefaults: UserDefaults = .standard) {
        self.userDefaults = userDefaults
    }

    /**
     * Sets the active release track channel for a specific mini-app.
     */
    public func setChannel(_ channel: ReleaseChannel, for appId: String) {
        lock.lock()
        defer { lock.unlock() }
        let safeAppId = (try? GoatStorageManager.sanitizeIdentifier(appId)) ?? appId
        userDefaults.set(channel.rawValue, forKey: "\(Self.prefsPrefixChannel)\(safeAppId)")
    }

    /**
     * Gets the active release track channel for a specific mini-app. Defaults to `.production`.
     */
    public func getChannel(for appId: String) -> ReleaseChannel {
        lock.lock()
        defer { lock.unlock() }
        let safeAppId = (try? GoatStorageManager.sanitizeIdentifier(appId)) ?? appId
        let tag = userDefaults.string(forKey: "\(Self.prefsPrefixChannel)\(safeAppId)")
        return ReleaseChannel.from(tag: tag)
    }

    /**
     * Evaluates whether a given user is eligible for a percentage-based grayscale rollout.
     * Uses deterministic SHA-256 bucketing across `[0, 99]`.
     *
     * - Parameters:
     *   - manifest: The candidate release manifest.
     *   - userId: Unique user identifier (e.g. device GUID, user UUID).
     * - Returns: `true` if computed hash bucket falls within `[0, rolloutPercentage)`.
     */
    public func evaluateRollout(manifest: ReleaseManifest, userId: String) -> Bool {
        if manifest.rolloutPercentage >= 100 { return true }
        if manifest.rolloutPercentage <= 0 { return false }
        let cleanUserId = userId.trimmingCharacters(in: .whitespacesAndNewlines)
        if cleanUserId.isEmpty { return false }

        // Compute deterministic bucket using SHA-256 matching Android GoatChannelManager.kt
        let input = "\(cleanUserId):\(manifest.appId):\(manifest.version)"
        let digest = SHA256.hash(data: Data(input.utf8))
        let hashBytes = Array(digest)

        let rawVal = (Int32(hashBytes[0]) << 24) |
                     (Int32(hashBytes[1]) << 16) |
                     (Int32(hashBytes[2]) << 8)  |
                     Int32(hashBytes[3])

        let bucket = abs(Int(rawVal)) % 100
        return bucket < manifest.rolloutPercentage
    }

    /**
     * Evaluates whether a release candidate matches or is accessible by the device's configured channel.
     * Higher privilege channels (e.g. CANARY) can access BETA and PRODUCTION releases.
     */
    public func evaluateChannelEligibility(targetChannel: ReleaseChannel, clientChannel: ReleaseChannel) -> Bool {
        return clientChannel.level >= targetChannel.level
    }

    /**
     * Records a newly activated bundle version in the local history trail.
     */
    public func recordVersionActivation(appId: String, newVersion: String) {
        lock.lock()
        defer { lock.unlock() }
        let safeAppId = (try? GoatStorageManager.sanitizeIdentifier(appId)) ?? appId
        let currentActive = userDefaults.string(forKey: "\(Self.prefsPrefixActive)\(safeAppId)")

        if let current = currentActive, current != newVersion {
            userDefaults.set(current, forKey: "\(Self.prefsPrefixLastGood)\(safeAppId)")
        }

        let historyStr = userDefaults.string(forKey: "\(Self.prefsPrefixHistory)\(safeAppId)") ?? ""
        var historyList = historyStr.split(separator: ",").map { String($0) }.filter { !$0.isEmpty }

        if !historyList.contains(newVersion) {
            historyList.insert(newVersion, at: 0)
            let trimmed = historyList.prefix(10).joined(separator: ",")
            userDefaults.set(trimmed, forKey: "\(Self.prefsPrefixHistory)\(safeAppId)")
            userDefaults.set(newVersion, forKey: "\(Self.prefsPrefixActive)\(safeAppId)")
        } else {
            userDefaults.set(newVersion, forKey: "\(Self.prefsPrefixActive)\(safeAppId)")
        }
    }

    /**
     * Returns the active version string for the given mini-app.
     */
    public func getActiveVersion(for appId: String) -> String? {
        lock.lock()
        defer { lock.unlock() }
        let safeAppId = (try? GoatStorageManager.sanitizeIdentifier(appId)) ?? appId
        return userDefaults.string(forKey: "\(Self.prefsPrefixActive)\(safeAppId)")
    }

    /**
     * Returns the last known good fallback version before the active version.
     */
    public func getLastKnownGoodVersion(for appId: String) -> String? {
        lock.lock()
        defer { lock.unlock() }
        let safeAppId = (try? GoatStorageManager.sanitizeIdentifier(appId)) ?? appId
        return userDefaults.string(forKey: "\(Self.prefsPrefixLastGood)\(safeAppId)")
    }

    /**
     * Returns the full version history trail for the given mini-app.
     */
    public func getVersionHistory(for appId: String) -> [String] {
        lock.lock()
        defer { lock.unlock() }
        let safeAppId = (try? GoatStorageManager.sanitizeIdentifier(appId)) ?? appId
        let historyStr = userDefaults.string(forKey: "\(Self.prefsPrefixHistory)\(safeAppId)") ?? ""
        return historyStr.split(separator: ",").map { String($0) }.filter { !$0.isEmpty }
    }

    /**
     * Executes an instant 1-click local rollback to the last known good bundle version (<10ms).
     *
     * - Parameter appId: Unique mini-app identifier.
     * - Returns: The rollback target version string if successfully rolled back, or `nil` if no previous version exists.
     */
    public func rollback(for appId: String) -> String? {
        lock.lock()
        defer { lock.unlock() }
        let safeAppId = (try? GoatStorageManager.sanitizeIdentifier(appId)) ?? appId

        let lastGood: String?
        if let savedGood = userDefaults.string(forKey: "\(Self.prefsPrefixLastGood)\(safeAppId)") {
            lastGood = savedGood
        } else {
            let historyStr = userDefaults.string(forKey: "\(Self.prefsPrefixHistory)\(safeAppId)") ?? ""
            let history = historyStr.split(separator: ",").map { String($0) }.filter { !$0.isEmpty }
            lastGood = history.count > 1 ? history[1] : nil
        }

        guard let targetVersion = lastGood else { return nil }

        userDefaults.set(targetVersion, forKey: "\(Self.prefsPrefixActive)\(safeAppId)")
        return targetVersion
    }
}
