import Foundation

/**
 * L4 local idempotency store + Zone 4 tenant public-key cache contract, abstracted so
 * `GoatPaymentGatewayManager` can be unit-tested without Keychain access.
 */
public protocol GoatPaymentIntentStoreApi: Sendable {
    func getTerminalOutcome(_ intentId: String) async -> GoatPaymentOutcome?
    func putTerminalOutcome(_ outcome: GoatPaymentOutcome) async
    func getCachedTenantPublicKey(_ tenantAppId: String) async -> GoatTenantPublicKey?
    func cacheTenantPublicKey(_ tenantAppId: String, key: GoatTenantPublicKey) async
}

/**
 * L4 two-tier local idempotency store and Zone 4 tenant public-key cache (Task 10206 / §7 L4),
 * backed by `GoatSecureStorageManager`'s per-tenant Keychain partition.
 */
public final class GoatPaymentIntentStore: GoatPaymentIntentStoreApi, @unchecked Sendable {
    private let secureStorageManager: GoatSecureStorageManager
    private let appId: String
    private let lock = NSLock()
    private var memoryOutcomes: [String: GoatPaymentOutcome] = [:]

    public init(secureStorageManager: GoatSecureStorageManager, appId: String) {
        self.secureStorageManager = secureStorageManager
        self.appId = appId
    }

    private func outcomeKey(_ intentId: String) -> String { "payment_outcome_\(intentId)" }
    private func tenantKeyCacheKey(_ tenantAppId: String) -> String { "payment_tenant_key_\(tenantAppId)" }

    public func getTerminalOutcome(_ intentId: String) async -> GoatPaymentOutcome? {
        lock.lock()
        if let cached = memoryOutcomes[intentId] {
            lock.unlock()
            return cached
        }
        lock.unlock()

        guard let raw = try? await secureStorageManager.getSecureValue(appId: appId, key: outcomeKey(intentId)),
              let data = raw.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            return nil
        }
        guard let outcome = Self.decodeOutcome(json, fallbackIntentId: intentId) else { return nil }
        lock.lock()
        memoryOutcomes[intentId] = outcome
        lock.unlock()
        return outcome
    }

    public func putTerminalOutcome(_ outcome: GoatPaymentOutcome) async {
        guard outcome.status.isTerminal else { return }
        lock.lock()
        memoryOutcomes[outcome.intentId] = outcome
        lock.unlock()

        var json: [String: Any] = ["status": outcome.status.rawValue, "intentId": outcome.intentId]
        json["transactionHandle"] = outcome.transactionHandle
        json["providerRef"] = outcome.providerRef
        json["failureSubCode"] = outcome.failureSubCode
        guard let data = try? JSONSerialization.data(withJSONObject: json),
              let str = String(data: data, encoding: .utf8) else { return }
        _ = try? await secureStorageManager.setSecureValue(appId: appId, key: outcomeKey(outcome.intentId), value: str)
    }

    public func getCachedTenantPublicKey(_ tenantAppId: String) async -> GoatTenantPublicKey? {
        guard let raw = try? await secureStorageManager.getSecureValue(appId: appId, key: tenantKeyCacheKey(tenantAppId)),
              let data = raw.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let keyBase64 = json["keyBase64"] as? String else {
            return nil
        }
        let algo = (json["algorithm"] as? String) ?? "Ed25519"
        return GoatTenantPublicKey(keyBase64: keyBase64, algorithm: algo)
    }

    public func cacheTenantPublicKey(_ tenantAppId: String, key: GoatTenantPublicKey) async {
        let json: [String: Any] = ["keyBase64": key.keyBase64, "algorithm": key.algorithm]
        guard let data = try? JSONSerialization.data(withJSONObject: json),
              let str = String(data: data, encoding: .utf8) else { return }
        _ = try? await secureStorageManager.setSecureValue(appId: appId, key: tenantKeyCacheKey(tenantAppId), value: str)
    }

    private static func decodeOutcome(_ json: [String: Any], fallbackIntentId: String) -> GoatPaymentOutcome? {
        guard let status = GoatPaymentStatus.fromWire(json["status"] as? String) else { return nil }
        return GoatPaymentOutcome(
            status: status,
            intentId: (json["intentId"] as? String) ?? fallbackIntentId,
            transactionHandle: json["transactionHandle"] as? String,
            providerRef: json["providerRef"] as? String,
            failureSubCode: json["failureSubCode"] as? String
        )
    }
}
