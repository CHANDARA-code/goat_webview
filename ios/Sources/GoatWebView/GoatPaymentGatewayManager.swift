import Foundation
import CryptoKit

/**
 * Core native payment gateway proxy manager and Payment Security Gate orchestrator
 * (Task 10206 / §5.1), iOS parity of `GoatPaymentGatewayManager.kt`. Owns the adapter registry,
 * the per-`intentId` lock map, the L1-L5 gate, and the local idempotency/pending-intent
 * bookkeeping.
 *
 * The only path from the untrusted web context to money is `requestPayment` — there is no
 * fast path, no bypass action, and no free-form field the web context can use to smuggle data.
 */
public final class GoatPaymentGatewayManager: @unchecked Sendable {
    public static let defaultWatchdogSeconds: TimeInterval = 45.0
    public static let builtInProviders: Set<String> = ["alipay", "stripe", "link", "paypay", "bakong_khqr"]
    private static let khqrProviderId = "bakong_khqr"

    private let appId: String
    private let proxyClient: any GoatPaymentServerProxyClient
    private let intentStore: any GoatPaymentIntentStoreApi
    private let abuseGuard: GoatAbuseGuard
    private let allowedOrigins: Set<String>
    private let allowedGatewayDomains: Set<String>
    private let allowedReturnDomains: Set<String>
    private let overlayPresenter: (any GoatPaymentProgressOverlayPresenter)?
    private let presenterHandleProvider: (@Sendable () -> (any Sendable)?)?
    private let watchdogSeconds: TimeInterval
    private let onAsyncTerminalOutcome: (@Sendable (GoatPaymentOutcome) -> Void)?
    private let khqrFastPollIntervalNs: UInt64
    private let khqrSlowPollIntervalNs: UInt64
    private let khqrFastPollWindowMs: Int64
    private let khqrMaxPollDurationMs: Int64

    private let lock = NSLock()
    private var adapters: [String: any GoatPaymentAdapter] = [:]
    private var lockedIntents: Set<String> = []
    private var lockAcquiredAt: [String: TimeInterval] = [:]
    private var pendingProviderByIntent: [String: String] = [:]

    public init(
        appId: String,
        proxyClient: any GoatPaymentServerProxyClient,
        intentStore: any GoatPaymentIntentStoreApi,
        abuseGuard: GoatAbuseGuard = GoatAbuseGuard.shared,
        allowedOrigins: Set<String> = [],
        allowedGatewayDomains: Set<String> = [],
        allowedReturnDomains: Set<String> = [],
        overlayPresenter: (any GoatPaymentProgressOverlayPresenter)? = nil,
        presenterHandleProvider: (@Sendable () -> (any Sendable)?)? = nil,
        watchdogSeconds: TimeInterval = defaultWatchdogSeconds,
        onAsyncTerminalOutcome: (@Sendable (GoatPaymentOutcome) -> Void)? = nil,
        khqrFastPollIntervalMs: Int64 = 1_000,
        khqrSlowPollIntervalMs: Int64 = 3_000,
        khqrFastPollWindowMs: Int64 = 15_000,
        khqrMaxPollDurationMs: Int64 = 3 * 60_000
    ) {
        self.appId = appId
        self.proxyClient = proxyClient
        self.intentStore = intentStore
        self.abuseGuard = abuseGuard
        self.allowedOrigins = allowedOrigins
        self.allowedGatewayDomains = allowedGatewayDomains
        self.allowedReturnDomains = allowedReturnDomains
        self.overlayPresenter = overlayPresenter
        self.presenterHandleProvider = presenterHandleProvider
        self.watchdogSeconds = watchdogSeconds
        self.onAsyncTerminalOutcome = onAsyncTerminalOutcome
        self.khqrFastPollIntervalNs = UInt64(khqrFastPollIntervalMs) * 1_000_000
        self.khqrSlowPollIntervalNs = UInt64(khqrSlowPollIntervalMs) * 1_000_000
        self.khqrFastPollWindowMs = khqrFastPollWindowMs
        self.khqrMaxPollDurationMs = khqrMaxPollDurationMs
    }

    /// Registers a `GoatPaymentAdapter`. Strictly callable only by host application code during
    /// startup — mini-apps cannot reach this from JS.
    public func registerAdapter(_ adapter: any GoatPaymentAdapter, allowOverride: Bool = false) throws {
        guard !adapter.providerId.trimmingCharacters(in: .whitespaces).isEmpty else {
            throw GoatPaymentException(code: "INVALID_ADAPTER", reason: "providerId must not be blank")
        }
        lock.lock()
        defer { lock.unlock() }
        if !allowOverride, Self.builtInProviders.contains(adapter.providerId), adapters[adapter.providerId] != nil {
            throw GoatPaymentException(
                code: "INVALID_ADAPTER",
                reason: "Provider '\(adapter.providerId)' is already registered as built-in; pass allowOverride=true to replace it."
            )
        }
        adapters[adapter.providerId] = adapter
    }

    public func getRegisteredProviderIds() -> Set<String> {
        lock.lock()
        defer { lock.unlock() }
        return Set(adapters.keys)
    }

    /// Entry point for the `REQUEST_PAYMENT` bridge action.
    public func requestPayment(_ request: GoatPaymentRequest, callerOrigin: String?, gatewayDomain: String? = nil) async throws -> GoatPaymentOutcome {
        releaseOrphanedLocks()

        guard tryLock(request.intentId) else {
            throw GoatPaymentException(code: GoatPaymentErrorCode.paymentInProgress, reason: "Another bridge call for intentId '\(request.intentId)' is mid-flight.")
        }
        defer { unlock(request.intentId) }

        do {
            return try await withTimeout(seconds: watchdogSeconds) {
                try await self.executeGatedPayment(request, callerOrigin: callerOrigin, gatewayDomain: gatewayDomain)
            }
        } catch is GoatPaymentTimeoutError {
            throw GoatPaymentException(
                code: GoatPaymentErrorCode.paymentTimeout,
                reason: "Adapter exceeded \(watchdogSeconds)s in-flight watchdog.",
                subCode: GoatPaymentSubCode.stuckPaymentWatchdogReleased
            )
        }
    }

    /// Entry point for `QUERY_PAYMENT_STATUS`. Not gesture-gated — used by `onAppResume` too.
    public func queryPaymentStatus(_ intentId: String) async throws -> GoatPaymentOutcome {
        if let terminal = await intentStore.getTerminalOutcome(intentId) { return terminal }
        let outcome = try await proxyClient.queryIntent(intentId)
        if outcome.status.isTerminal {
            await intentStore.putTerminalOutcome(outcome)
            removePending(intentId)
        }
        return outcome
    }

    /// Entry point for `CANCEL_PAYMENT`. `SUCCEEDED` is immutable — the proxy enforces this server-side.
    public func cancelPayment(_ intentId: String) async throws -> GoatPaymentOutcome {
        if let terminal = await intentStore.getTerminalOutcome(intentId) { return terminal }

        if let providerId = pendingProvider(intentId), let adapter = registeredAdapter(providerId) {
            _ = try? await adapter.cancelPayment(intentId, ctx: buildContext())
        }

        let outcome = try await proxyClient.cancelIntent(intentId)
        if outcome.status.isTerminal {
            await intentStore.putTerminalOutcome(outcome)
            removePending(intentId)
        }
        return outcome
    }

    /// Flushes status queries for all backgrounded/pending intents. Call from host `onResume`.
    public func onAppResume() async {
        let snapshot = allPending()
        for (intentId, providerId) in snapshot {
            guard let adapter = registeredAdapter(providerId) else { continue }
            do {
                let status = try await adapter.queryStatus(intentId, ctx: buildContext())
                if status.isTerminal {
                    let confirmed = try await proxyClient.confirmIntent(intentId, outcome: GoatPaymentOutcome(status: status, intentId: intentId))
                    await intentStore.putTerminalOutcome(confirmed)
                    removePending(intentId)
                    onAsyncTerminalOutcome?(confirmed)
                }
            } catch {
                // Leave as pending; next resume or poll tick will retry.
            }
        }
    }

    /// Host-facing entry point for app2app payment return navigation (Task 10206 / §7 L5, A3) —
    /// call this from `application(_:continue:restorationHandler:)` (Universal Links) or
    /// `application(_:open:options:)`. Returns `nil` and does nothing if `url` is not an HTTPS
    /// Universal Link matching `allowedReturnDomains` — a legacy custom-scheme return is
    /// silently ignored rather than trusted.
    ///
    /// The return URL itself is never trusted for the payment outcome: a valid return only
    /// triggers an immediate re-check against the server proxy, exactly like `onAppResume`.
    public func handleReturnUrl(_ url: URL) async -> GoatPaymentOutcome? {
        guard GoatPaymentReturnLinkVerifier.isValidReturnUrl(url, allowedReturnDomains: allowedReturnDomains) else {
            return nil
        }
        guard let intentId = GoatPaymentReturnLinkVerifier.extractQueryParam(url, name: "intentId") else {
            return nil
        }

        if let terminal = await intentStore.getTerminalOutcome(intentId) { return terminal }

        do {
            let outcome = try await proxyClient.queryIntent(intentId)
            if outcome.status.isTerminal {
                await intentStore.putTerminalOutcome(outcome)
                removePending(intentId)
                onAsyncTerminalOutcome?(outcome)
            }
            return outcome
        } catch {
            return nil
        }
    }

    private func executeGatedPayment(_ request: GoatPaymentRequest, callerOrigin: String?, gatewayDomain: String?) async throws -> GoatPaymentOutcome {
        try await gateL1Gesture(request)
        try gateL5OriginAndGateway(callerOrigin: callerOrigin, gatewayDomain: gatewayDomain)
        try await gateL2SignatureAndIntegrity(request)

        if let terminal = await intentStore.getTerminalOutcome(request.intentId) { return terminal }

        let claim = try await proxyClient.claimIntent(request.intentId, tenantAppId: appId)
        if !claim.claimed {
            if let prior = claim.priorOutcome {
                if prior.status.isTerminal { await intentStore.putTerminalOutcome(prior) }
                return prior
            }
            throw GoatPaymentException(code: GoatPaymentErrorCode.paymentInProgress, reason: "Intent already claimed by another request.")
        }

        let clientToken = try await proxyClient.fetchClientToken(request.intentId)

        guard let adapter = registeredAdapter(request.provider) else {
            throw GoatPaymentException(code: GoatPaymentErrorCode.providerNotRegistered, reason: "No adapter registered for provider '\(request.provider)'.")
        }

        setPending(request.intentId, providerId: request.provider)

        let tokenizedRequest = request.withToken(clientToken)
        let adapterOutcome = try await adapter.processPayment(tokenizedRequest, ctx: buildContext())

        let confirmed = try await proxyClient.confirmIntent(request.intentId, outcome: adapterOutcome)
        if confirmed.status.isTerminal {
            await intentStore.putTerminalOutcome(confirmed)
            removePending(request.intentId)
        } else if request.provider == Self.khqrProviderId {
            scheduleKhqrBackgroundPolling(request.intentId)
        }
        return confirmed
    }

    /// Background 1s/3s poll of a pending KHQR intent, independent of any single bridge call's
    /// lock/watchdog window, for up to `khqrMaxPollDurationMs`.
    private func scheduleKhqrBackgroundPolling(_ intentId: String) {
        Task.detached { [weak self] in
            guard let self else { return }
            guard let adapter = self.registeredAdapter(Self.khqrProviderId) else { return }
            let startedAt = Date().timeIntervalSince1970 * 1000
            while (Date().timeIntervalSince1970 * 1000) - startedAt < Double(self.khqrMaxPollDurationMs) {
                let elapsed = (Date().timeIntervalSince1970 * 1000) - startedAt
                let intervalNs = elapsed < Double(self.khqrFastPollWindowMs) ? self.khqrFastPollIntervalNs : self.khqrSlowPollIntervalNs
                try? await Task.sleep(nanoseconds: intervalNs)
                do {
                    let status = try await adapter.queryStatus(intentId, ctx: self.buildContext())
                    if status.isTerminal {
                        let confirmed = try await self.proxyClient.confirmIntent(intentId, outcome: GoatPaymentOutcome(status: status, intentId: intentId))
                        await self.intentStore.putTerminalOutcome(confirmed)
                        self.removePending(intentId)
                        self.onAsyncTerminalOutcome?(confirmed)
                        return
                    }
                } catch {
                    // Transient network error — retry on the next tick.
                }
            }
        }
    }

    private func gateL1Gesture(_ request: GoatPaymentRequest) async throws {
        if abuseGuard.isGestureFresh() { return }

        guard let overlay = overlayPresenter else {
            throw GoatPaymentException(code: GoatPaymentErrorCode.gestureRequired, reason: "Privileged action 'REQUEST_PAYMENT' requires a recent user gesture (< 10s).")
        }
        let confirmed = await overlay.present(GoatPaymentOverlayRequest(provider: request.provider, amount: request.amount, currency: request.currency))
        guard confirmed else {
            throw GoatPaymentException(code: GoatPaymentErrorCode.paymentCancelled, reason: "User declined the native payment confirmation overlay.")
        }
        abuseGuard.recordUserGesture()
    }

    private func gateL5OriginAndGateway(callerOrigin: String?, gatewayDomain: String?) throws {
        guard Self.isOriginAllowed(callerOrigin, allowlist: allowedOrigins) else {
            throw GoatPaymentException(code: GoatPaymentErrorCode.originNotAllowed, reason: "Caller frame origin '\(callerOrigin ?? "nil")' is not sandboxed.")
        }
        if let gatewayDomain, !allowedGatewayDomains.isEmpty {
            guard Self.isDomainAllowed(gatewayDomain, allowlist: allowedGatewayDomains) else {
                throw GoatPaymentException(code: GoatPaymentErrorCode.gatewayNotAllowed, reason: "Gateway domain '\(gatewayDomain)' is not in manifest.security.paymentGateways.")
            }
        }
    }

    private func gateL2SignatureAndIntegrity(_ request: GoatPaymentRequest) async throws {
        guard let (signed, sigBytes) = GoatSignedIntentPayload.decode(request.signedPayload) else {
            throw GoatPaymentException(code: GoatPaymentErrorCode.paymentIntentInvalid, reason: "Malformed signedPayload.")
        }

        var tenantKey = await intentStore.getCachedTenantPublicKey(appId)
        if tenantKey == nil {
            tenantKey = await proxyClient.fetchTenantPublicKey(appId)
            if let fetched = tenantKey {
                await intentStore.cacheTenantPublicKey(appId, key: fetched)
            }
        }
        guard let tenantKey else {
            throw GoatPaymentException(code: GoatPaymentErrorCode.paymentIntentInvalid, reason: "No tenant public key provisioned by Zone 4 directory.")
        }

        guard let keyBytes = Data(base64Encoded: tenantKey.keyBase64) else {
            throw GoatPaymentException(code: GoatPaymentErrorCode.paymentIntentInvalid, reason: "Malformed tenant public key.")
        }

        let valid: Bool
        if tenantKey.algorithm.caseInsensitiveCompare("Ed25519") == .orderedSame {
            valid = Self.verifyEd25519(data: signed.canonicalBytes(), signature: sigBytes, publicKeyBytes: keyBytes)
        } else {
            valid = GoatSecurityVerifier.verifyECDSA(data: signed.canonicalBytes(), signatureBytes: sigBytes, publicKeyBytes: keyBytes)
        }
        guard valid else {
            throw GoatPaymentException(code: GoatPaymentErrorCode.paymentIntentInvalid, reason: "Backend payload signature verification failed.")
        }

        let nowMs = Int64(Date().timeIntervalSince1970 * 1000)
        guard nowMs <= signed.expiresAt else {
            throw GoatPaymentException(code: GoatPaymentErrorCode.paymentIntentExpired, reason: "Payment intent expired at \(signed.expiresAt).")
        }

        guard signed.intentId == request.intentId,
              signed.orderId == request.orderId,
              signed.amount == request.amount,
              signed.currency == request.currency,
              signed.provider == request.provider else {
            throw GoatPaymentException(code: GoatPaymentErrorCode.paymentIntentMismatch, reason: "Request fields do not match the signed intent payload.")
        }
    }

    private static func verifyEd25519(data: Data, signature: Data, publicKeyBytes: Data) -> Bool {
        guard let publicKey = try? Curve25519.Signing.PublicKey(rawRepresentation: publicKeyBytes) else { return false }
        return publicKey.isValidSignature(signature, for: data)
    }

    private static func isOriginAllowed(_ origin: String?, allowlist: Set<String>) -> Bool {
        guard let origin, !origin.trimmingCharacters(in: .whitespaces).isEmpty else { return false }
        let clean = origin.trimmingCharacters(in: .whitespaces).hasSuffix("/") ? String(origin.dropLast()) : origin
        return allowlist.contains(where: { $0.trimmingCharacters(in: .whitespaces) == clean })
    }

    private static func isDomainAllowed(_ domain: String, allowlist: Set<String>) -> Bool {
        let host = domain.lowercased()
        for pattern in allowlist.map({ $0.lowercased() }) {
            if pattern.hasPrefix("*.") {
                let suffix = String(pattern.dropFirst(2))
                if host == suffix || host.hasSuffix(".\(suffix)") { return true }
            } else if host == pattern {
                return true
            }
        }
        return false
    }

    private func tryLock(_ intentId: String) -> Bool {
        lock.lock()
        defer { lock.unlock() }
        if lockedIntents.contains(intentId) { return false }
        lockedIntents.insert(intentId)
        lockAcquiredAt[intentId] = Date().timeIntervalSince1970
        return true
    }

    private func unlock(_ intentId: String) {
        lock.lock()
        defer { lock.unlock() }
        lockedIntents.remove(intentId)
        lockAcquiredAt.removeValue(forKey: intentId)
    }

    private func releaseOrphanedLocks() {
        lock.lock()
        defer { lock.unlock() }
        let now = Date().timeIntervalSince1970
        for (intentId, acquiredAt) in lockAcquiredAt where now - acquiredAt > watchdogSeconds {
            lockedIntents.remove(intentId)
            lockAcquiredAt.removeValue(forKey: intentId)
        }
    }

    private func setPending(_ intentId: String, providerId: String) {
        lock.lock(); defer { lock.unlock() }
        pendingProviderByIntent[intentId] = providerId
    }

    private func removePending(_ intentId: String) {
        lock.lock(); defer { lock.unlock() }
        pendingProviderByIntent.removeValue(forKey: intentId)
    }

    private func pendingProvider(_ intentId: String) -> String? {
        lock.lock(); defer { lock.unlock() }
        return pendingProviderByIntent[intentId]
    }

    private func allPending() -> [(String, String)] {
        lock.lock(); defer { lock.unlock() }
        return pendingProviderByIntent.map { ($0.key, $0.value) }
    }

    private func registeredAdapter(_ providerId: String) -> (any GoatPaymentAdapter)? {
        lock.lock(); defer { lock.unlock() }
        return adapters[providerId]
    }

    private func buildContext() -> GoatPaymentContext {
        GoatPaymentContext(appId: appId, proxyClient: proxyClient, presenterHandle: presenterHandleProvider?())
    }
}

struct GoatPaymentTimeoutError: Error {}

private func withTimeout<T: Sendable>(seconds: TimeInterval, operation: @escaping @Sendable () async throws -> T) async throws -> T {
    try await withThrowingTaskGroup(of: T.self) { group in
        group.addTask { try await operation() }
        group.addTask {
            try await Task.sleep(nanoseconds: UInt64(seconds * 1_000_000_000))
            throw GoatPaymentTimeoutError()
        }
        // Signal cancellation to whichever task loses the race — including when the timeout
        // branch wins and `group.next()` itself throws, which would otherwise skip cancelAll().
        defer { group.cancelAll() }
        guard let result = try await group.next() else {
            throw GoatPaymentTimeoutError()
        }
        return result
    }
}
