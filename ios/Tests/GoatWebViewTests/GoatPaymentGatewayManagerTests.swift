#if os(iOS)
import XCTest
import Foundation
import CryptoKit
@testable import GoatWebView

final class GoatPaymentGatewayManagerTests: XCTestCase {

    private let validOrigin = "goat://tenant-1"

    private var privateKey: Curve25519.Signing.PrivateKey!
    private var abuseGuard: GoatAbuseGuard!
    private var proxy: FakeProxyClient!
    private var store: FakeIntentStore!
    private var manager: GoatPaymentGatewayManager!

    override func setUp() async throws {
        try await super.setUp()
        privateKey = Curve25519.Signing.PrivateKey()
        abuseGuard = GoatAbuseGuard()
        abuseGuard.reset()
        proxy = FakeProxyClient()
        store = FakeIntentStore()
        proxy.tenantKeys["tenant-1"] = GoatTenantPublicKey(keyBase64: privateKey.publicKey.rawRepresentation.base64EncodedString(), algorithm: "Ed25519")
        manager = GoatPaymentGatewayManager(
            appId: "tenant-1", proxyClient: proxy, intentStore: store, abuseGuard: abuseGuard,
            allowedOrigins: [validOrigin]
        )
    }

    private func freshGesture() { abuseGuard.recordUserGesture() }

    private func signedRequest(
        intentId: String = "pi_1", orderId: String = "order_1", amount: Int64 = 4999,
        currency: String = "USD", provider: String = "stripe", nonce: String = "nonce_1",
        expiresAt: Int64 = Int64(Date().timeIntervalSince1970 * 1000) + 300_000,
        displayAmount: Int64? = nil
    ) -> GoatPaymentRequest {
        let signedPayload = GoatSignedIntentPayload(
            intentId: intentId, orderId: orderId, amount: amount, currency: currency,
            provider: provider, nonce: nonce, expiresAt: expiresAt
        ).encode { data in (try! privateKey.signature(for: data)) }

        return GoatPaymentRequest(
            provider: provider, orderId: orderId, intentId: intentId,
            amount: displayAmount ?? amount, currency: currency, nonce: nonce, signedPayload: signedPayload
        )
    }

    // MARK: - L1 Gesture gate

    func testRejectsStaleGestureWithoutOverlay() async {
        try? manager.registerAdapter(FakeAdapter(providerId: "stripe") { GoatPaymentOutcome(status: .succeeded, intentId: $0.intentId) })
        await assertPaymentError(GoatPaymentErrorCode.gestureRequired) {
            try await self.manager.requestPayment(self.signedRequest(), callerOrigin: self.validOrigin)
        }
    }

    func testOverlayConfirmationAnchorsFreshGestureAndAllowsThroughRequest() async throws {
        let overlay = RecordingOverlay(result: true)
        let overlayManager = GoatPaymentGatewayManager(
            appId: "tenant-1", proxyClient: proxy, intentStore: store, abuseGuard: abuseGuard,
            allowedOrigins: [validOrigin], overlayPresenter: overlay
        )
        try overlayManager.registerAdapter(FakeAdapter(providerId: "stripe") { GoatPaymentOutcome(status: .succeeded, intentId: $0.intentId) })

        let outcome = try await overlayManager.requestPayment(signedRequest(), callerOrigin: validOrigin)

        XCTAssertTrue(overlay.shown)
        XCTAssertEqual(outcome.status, .succeeded)
    }

    func testOverlayDeclineMapsToPaymentCancelled() async throws {
        let overlay = RecordingOverlay(result: false)
        let overlayManager = GoatPaymentGatewayManager(
            appId: "tenant-1", proxyClient: proxy, intentStore: store, abuseGuard: abuseGuard,
            allowedOrigins: [validOrigin], overlayPresenter: overlay
        )
        let adapter = FakeAdapter(providerId: "stripe") { GoatPaymentOutcome(status: .succeeded, intentId: $0.intentId) }
        try overlayManager.registerAdapter(adapter)

        await assertPaymentError(GoatPaymentErrorCode.paymentCancelled) {
            try await overlayManager.requestPayment(self.signedRequest(), callerOrigin: self.validOrigin)
        }
        XCTAssertEqual(adapter.processCalls, 0)
    }

    // MARK: - L2 Signature integrity, expiry, anti-TOCTOU

    func testRejectsTamperedSignature() async {
        freshGesture()
        var req = signedRequest()
        req = GoatPaymentRequest(provider: req.provider, orderId: req.orderId, intentId: req.intentId, amount: req.amount, currency: req.currency, nonce: req.nonce, signedPayload: "not-a-valid-signature")
        await assertPaymentError(GoatPaymentErrorCode.paymentIntentInvalid) {
            try await self.manager.requestPayment(req, callerOrigin: self.validOrigin)
        }
    }

    func testRejectsExpiredIntent() async {
        freshGesture()
        let expired = signedRequest(expiresAt: Int64(Date().timeIntervalSince1970 * 1000) - 1_000)
        await assertPaymentError(GoatPaymentErrorCode.paymentIntentExpired) {
            try await self.manager.requestPayment(expired, callerOrigin: self.validOrigin)
        }
    }

    func testRejectsAmountTamperingAfterSigning() async {
        freshGesture()
        let tampered = signedRequest(amount: 4999, displayAmount: 1)
        await assertPaymentError(GoatPaymentErrorCode.paymentIntentMismatch) {
            try await self.manager.requestPayment(tampered, callerOrigin: self.validOrigin)
        }
    }

    func testRejectsWhenNoTenantPublicKeyProvisioned() async {
        freshGesture()
        proxy.tenantKeys.removeValue(forKey: "tenant-1")
        await assertPaymentError(GoatPaymentErrorCode.paymentIntentInvalid) {
            try await self.manager.requestPayment(self.signedRequest(), callerOrigin: self.validOrigin)
        }
    }

    // MARK: - L5 Origin / gateway allowlist

    func testRejectsDisallowedCallerOrigin() async {
        freshGesture()
        await assertPaymentError(GoatPaymentErrorCode.originNotAllowed) {
            try await self.manager.requestPayment(self.signedRequest(), callerOrigin: "goat://evil-app")
        }
    }

    func testRejectsDisallowedGatewayDomain() async throws {
        freshGesture()
        let gatedManager = GoatPaymentGatewayManager(
            appId: "tenant-1", proxyClient: proxy, intentStore: store, abuseGuard: abuseGuard,
            allowedOrigins: [validOrigin], allowedGatewayDomains: ["checkout.stripe.com"]
        )
        try gatedManager.registerAdapter(FakeAdapter(providerId: "stripe") { GoatPaymentOutcome(status: .succeeded, intentId: $0.intentId) })

        await assertPaymentError(GoatPaymentErrorCode.gatewayNotAllowed) {
            try await gatedManager.requestPayment(self.signedRequest(), callerOrigin: self.validOrigin, gatewayDomain: "phishing.example.com")
        }
    }

    // MARK: - Adapter registry / routing

    func testRejectsUnregisteredProvider() async {
        freshGesture()
        await assertPaymentError(GoatPaymentErrorCode.providerNotRegistered) {
            try await self.manager.requestPayment(self.signedRequest(provider: "unknown_psp"), callerOrigin: self.validOrigin)
        }
    }

    func testRefusesToShadowBuiltInProviderWithoutAllowOverride() throws {
        try manager.registerAdapter(FakeAdapter(providerId: "stripe") { GoatPaymentOutcome(status: .succeeded, intentId: $0.intentId) })
        XCTAssertThrowsError(try manager.registerAdapter(FakeAdapter(providerId: "stripe") { GoatPaymentOutcome(status: .succeeded, intentId: $0.intentId) }))
    }

    // MARK: - L4 Idempotency, claim conflicts, locking

    func testSuccessfulPaymentIsClaimedTokenizedConfirmedAndCached() async throws {
        freshGesture()
        let adapter = FakeAdapter(providerId: "stripe") { GoatPaymentOutcome(status: .succeeded, intentId: $0.intentId, transactionHandle: "txh_1") }
        try manager.registerAdapter(adapter)

        let outcome = try await manager.requestPayment(signedRequest(), callerOrigin: validOrigin)

        XCTAssertEqual(outcome.status, .succeeded)
        XCTAssertEqual(proxy.claimCalls, 1)
        XCTAssertEqual(proxy.clientTokenCalls, 1)
        XCTAssertEqual(proxy.confirmCalls, 1)
        let terminal = await store.getTerminalOutcome("pi_1")
        XCTAssertNotNil(terminal)
        XCTAssertNotNil(adapter.lastRequest?.ephemeralClientToken)
    }

    func testRepeatedCallsForTerminalIntentDoNotRecharge() async throws {
        freshGesture()
        let adapter = FakeAdapter(providerId: "stripe") { GoatPaymentOutcome(status: .succeeded, intentId: $0.intentId) }
        try manager.registerAdapter(adapter)

        _ = try await manager.requestPayment(signedRequest(), callerOrigin: validOrigin)
        freshGesture()
        let second = try await manager.requestPayment(signedRequest(), callerOrigin: validOrigin)

        XCTAssertEqual(second.status, .succeeded)
        XCTAssertEqual(adapter.processCalls, 1)
    }

    func testServerClaimConflictReturnsPriorOutcomeWithoutInvokingAdapter() async throws {
        freshGesture()
        proxy.claimedSet.insert("pi_1")
        proxy.terminalOutcomes["pi_1"] = GoatPaymentOutcome(status: .succeeded, intentId: "pi_1", transactionHandle: "txh_prior")
        let adapter = FakeAdapter(providerId: "stripe") { GoatPaymentOutcome(status: .succeeded, intentId: $0.intentId) }
        try manager.registerAdapter(adapter)

        let outcome = try await manager.requestPayment(signedRequest(), callerOrigin: validOrigin)

        XCTAssertEqual(outcome.transactionHandle, "txh_prior")
        XCTAssertEqual(adapter.processCalls, 0)
    }

    func testConcurrentDuplicateRequestsRejectTheSecond() async throws {
        freshGesture()
        let adapter = FakeAdapter(providerId: "stripe") {
            try? await Task.sleep(nanoseconds: 200_000_000)
            return GoatPaymentOutcome(status: .succeeded, intentId: $0.intentId)
        }
        try manager.registerAdapter(adapter)
        let req = signedRequest()

        async let first = manager.requestPayment(req, callerOrigin: validOrigin)
        try? await Task.sleep(nanoseconds: 20_000_000)

        do {
            _ = try await manager.requestPayment(req, callerOrigin: validOrigin)
            XCTFail("Expected PAYMENT_IN_PROGRESS")
        } catch let e as GoatPaymentException {
            XCTAssertEqual(e.code, GoatPaymentErrorCode.paymentInProgress)
        }

        let firstResult = try await first
        XCTAssertEqual(firstResult.status, .succeeded)
    }

    func testWatchdogReleasesLockAfterInFlightTimeout() async throws {
        freshGesture()
        let shortWatchdogManager = GoatPaymentGatewayManager(
            appId: "tenant-1", proxyClient: proxy, intentStore: store, abuseGuard: abuseGuard,
            allowedOrigins: [validOrigin], watchdogSeconds: 0.05
        )
        try shortWatchdogManager.registerAdapter(FakeAdapter(providerId: "stripe") {
            // Uses `try` (not `try?`) so cooperative cancellation from the watchdog actually
            // aborts this call instead of silently completing in the background afterward.
            try await Task.sleep(nanoseconds: 5_000_000_000)
            return GoatPaymentOutcome(status: .succeeded, intentId: $0.intentId)
        })
        let req = signedRequest()

        await assertPaymentError(GoatPaymentErrorCode.paymentTimeout) {
            try await shortWatchdogManager.requestPayment(req, callerOrigin: self.validOrigin)
        }
        XCTAssertEqual(proxy.claimCalls, 1)

        freshGesture()
        _ = try? await shortWatchdogManager.requestPayment(req, callerOrigin: validOrigin)
        // The lock must have been released: a second attempt reaches executeGatedPayment again.
        XCTAssertEqual(proxy.claimCalls, 2)
    }

    // MARK: - Non-terminal states & resumability

    func testDismissedIsNonTerminalAndNotPersisted() async throws {
        freshGesture()
        try manager.registerAdapter(FakeAdapter(providerId: "stripe") { GoatPaymentOutcome(status: .dismissed, intentId: $0.intentId) })

        let outcome = try await manager.requestPayment(signedRequest(), callerOrigin: validOrigin)

        XCTAssertEqual(outcome.status, .dismissed)
        let terminal = await store.getTerminalOutcome("pi_1")
        XCTAssertNil(terminal)
    }

    func testOnAppResumeFlushesPendingIntentToTerminal() async throws {
        freshGesture()
        let box = OutcomeBox()
        let resumeManager = GoatPaymentGatewayManager(
            appId: "tenant-1", proxyClient: proxy, intentStore: store, abuseGuard: abuseGuard,
            allowedOrigins: [validOrigin], onAsyncTerminalOutcome: { box.set($0) }
        )
        let adapter = FakeAdapter(providerId: "bakong_khqr") { GoatPaymentOutcome(status: .dismissed, intentId: $0.intentId) }
        adapter.queryStatusResult = .succeeded
        try resumeManager.registerAdapter(adapter)

        let initial = try await resumeManager.requestPayment(signedRequest(provider: "bakong_khqr"), callerOrigin: validOrigin)
        XCTAssertEqual(initial.status, .dismissed)

        await resumeManager.onAppResume()

        XCTAssertEqual(box.get()?.status, .succeeded)
        let terminal = await store.getTerminalOutcome("pi_1")
        XCTAssertNotNil(terminal)
    }

    func testKhqrBackgroundPollerReachesTerminalWithoutHoldingLock() async throws {
        freshGesture()
        let box = OutcomeBox()
        let adapter = FakeAdapter(providerId: "bakong_khqr") { GoatPaymentOutcome(status: .processing, intentId: $0.intentId) }
        adapter.queryStatusResult = .processing
        let khqrManager = GoatPaymentGatewayManager(
            appId: "tenant-1", proxyClient: proxy, intentStore: store, abuseGuard: abuseGuard,
            allowedOrigins: [validOrigin], onAsyncTerminalOutcome: { box.set($0) },
            khqrFastPollIntervalMs: 50, khqrFastPollWindowMs: 15_000
        )
        try khqrManager.registerAdapter(adapter)

        let initial = try await khqrManager.requestPayment(signedRequest(provider: "bakong_khqr"), callerOrigin: validOrigin)
        XCTAssertEqual(initial.status, .processing)

        adapter.queryStatusResult = .succeeded
        try? await Task.sleep(nanoseconds: 300_000_000)

        XCTAssertEqual(box.get()?.status, .succeeded)
    }

    // MARK: - L5: App2App Universal Link return verification

    func testVerifiedHttpsReturnLinkReChecksProxyAndResolvesToTerminalOutcome() async throws {
        freshGesture()
        let returnManager = GoatPaymentGatewayManager(
            appId: "tenant-1", proxyClient: proxy, intentStore: store, abuseGuard: abuseGuard,
            allowedOrigins: [validOrigin], allowedReturnDomains: ["pay.tenant-1.com"]
        )
        try returnManager.registerAdapter(FakeAdapter(providerId: "alipay") { GoatPaymentOutcome(status: .processing, intentId: $0.intentId) })
        _ = try await returnManager.requestPayment(signedRequest(provider: "alipay"), callerOrigin: validOrigin)
        proxy.terminalOutcomes["pi_1"] = GoatPaymentOutcome(status: .succeeded, intentId: "pi_1", transactionHandle: "txh_return")

        let url = URL(string: "https://pay.tenant-1.com/payment/return?intentId=pi_1")!
        let outcome = await returnManager.handleReturnUrl(url)

        XCTAssertEqual(outcome?.status, .succeeded)
        XCTAssertEqual(outcome?.transactionHandle, "txh_return")
        let terminal = await store.getTerminalOutcome("pi_1")
        XCTAssertNotNil(terminal)
    }

    func testUnverifiedCustomSchemeReturnLinkIsIgnoredAndNeverReachesProxy() async throws {
        let returnManager = GoatPaymentGatewayManager(
            appId: "tenant-1", proxyClient: proxy, intentStore: store, abuseGuard: abuseGuard,
            allowedOrigins: [validOrigin], allowedReturnDomains: ["pay.tenant-1.com"]
        )
        proxy.terminalOutcomes["pi_forged"] = GoatPaymentOutcome(status: .succeeded, intentId: "pi_forged")

        let url = URL(string: "goat://pay.tenant-1.com/payment/return?intentId=pi_forged")!
        let outcome = await returnManager.handleReturnUrl(url)

        XCTAssertNil(outcome)
        XCTAssertEqual(proxy.queryCalls, 0)
    }

    func testReturnLinkOnNonAllowlistedDomainIsRejected() async throws {
        let returnManager = GoatPaymentGatewayManager(
            appId: "tenant-1", proxyClient: proxy, intentStore: store, abuseGuard: abuseGuard,
            allowedOrigins: [validOrigin], allowedReturnDomains: ["pay.tenant-1.com"]
        )
        let url = URL(string: "https://evil.example.com/return?intentId=pi_1")!
        let outcome = await returnManager.handleReturnUrl(url)
        XCTAssertNil(outcome)
        XCTAssertEqual(proxy.queryCalls, 0)
    }

    func testReturnLinkWithNoAllowedReturnDomainsConfiguredRejectsEverything() async throws {
        let url = URL(string: "https://pay.tenant-1.com/payment/return?intentId=pi_1")!
        let outcome = await manager.handleReturnUrl(url)
        XCTAssertNil(outcome)
    }

    // MARK: - Monotonic state engine (proxy-enforced)

    func testSucceededIntentCannotBeDowngradedByClientCancel() async throws {
        freshGesture()
        try manager.registerAdapter(FakeAdapter(providerId: "stripe") { GoatPaymentOutcome(status: .succeeded, intentId: $0.intentId) })
        _ = try await manager.requestPayment(signedRequest(), callerOrigin: validOrigin)

        let cancelled = try await manager.cancelPayment("pi_1")

        XCTAssertEqual(cancelled.status, .succeeded)
    }

    // MARK: - Helpers

    private func assertPaymentError(_ expectedCode: String, _ block: @escaping () async throws -> GoatPaymentOutcome) async {
        do {
            _ = try await block()
            XCTFail("Expected GoatPaymentException with code \(expectedCode)")
        } catch let e as GoatPaymentException {
            XCTAssertEqual(e.code, expectedCode)
        } catch {
            XCTFail("Expected GoatPaymentException, got \(error)")
        }
    }
}

// MARK: - Fakes

private final class OutcomeBox: @unchecked Sendable {
    private let lock = NSLock()
    private var value: GoatPaymentOutcome?
    func set(_ v: GoatPaymentOutcome) { lock.lock(); value = v; lock.unlock() }
    func get() -> GoatPaymentOutcome? { lock.lock(); defer { lock.unlock() }; return value }
}

private final class RecordingOverlay: GoatPaymentProgressOverlayPresenter, @unchecked Sendable {
    private let result: Bool
    private(set) var shown = false
    init(result: Bool) { self.result = result }
    func present(_ request: GoatPaymentOverlayRequest) async -> Bool {
        shown = true
        return result
    }
}

private final class FakeIntentStore: GoatPaymentIntentStoreApi, @unchecked Sendable {
    private let lock = NSLock()
    private var terminal: [String: GoatPaymentOutcome] = [:]
    private var tenantKeys: [String: GoatTenantPublicKey] = [:]

    func getTerminalOutcome(_ intentId: String) async -> GoatPaymentOutcome? {
        lock.lock(); defer { lock.unlock() }
        return terminal[intentId]
    }
    func putTerminalOutcome(_ outcome: GoatPaymentOutcome) async {
        guard outcome.status.isTerminal else { return }
        lock.lock(); terminal[outcome.intentId] = outcome; lock.unlock()
    }
    func getCachedTenantPublicKey(_ tenantAppId: String) async -> GoatTenantPublicKey? {
        lock.lock(); defer { lock.unlock() }
        return tenantKeys[tenantAppId]
    }
    func cacheTenantPublicKey(_ tenantAppId: String, key: GoatTenantPublicKey) async {
        lock.lock(); tenantKeys[tenantAppId] = key; lock.unlock()
    }
}

private final class FakeProxyClient: GoatPaymentServerProxyClient, @unchecked Sendable {
    private let lock = NSLock()
    var tenantKeys: [String: GoatTenantPublicKey] = [:]
    var claimedSet: Set<String> = []
    var terminalOutcomes: [String: GoatPaymentOutcome] = [:]
    var claimCalls = 0
    var clientTokenCalls = 0
    var confirmCalls = 0
    var queryCalls = 0

    func fetchTenantPublicKey(_ tenantAppId: String) async -> GoatTenantPublicKey? {
        lock.lock(); defer { lock.unlock() }
        return tenantKeys[tenantAppId]
    }

    func claimIntent(_ intentId: String, tenantAppId: String) async throws -> GoatClaimResult {
        lock.lock(); defer { lock.unlock() }
        claimCalls += 1
        if claimedSet.contains(intentId) {
            return GoatClaimResult(claimed: false, priorOutcome: terminalOutcomes[intentId])
        }
        claimedSet.insert(intentId)
        return GoatClaimResult(claimed: true)
    }

    func fetchClientToken(_ intentId: String) async throws -> String {
        lock.lock(); clientTokenCalls += 1; lock.unlock()
        return "ephemeral_token_\(intentId)"
    }

    func confirmIntent(_ intentId: String, outcome: GoatPaymentOutcome) async throws -> GoatPaymentOutcome {
        lock.lock(); defer { lock.unlock() }
        confirmCalls += 1
        let existing = terminalOutcomes[intentId]
        let finalOutcome = (existing?.status == .succeeded) ? existing! : outcome
        if finalOutcome.status.isTerminal { terminalOutcomes[intentId] = finalOutcome }
        return finalOutcome
    }

    func cancelIntent(_ intentId: String) async throws -> GoatPaymentOutcome {
        lock.lock(); defer { lock.unlock() }
        if let existing = terminalOutcomes[intentId], existing.status == .succeeded { return existing }
        let cancelled = GoatPaymentOutcome(status: .cancelled, intentId: intentId)
        terminalOutcomes[intentId] = cancelled
        return cancelled
    }

    func queryIntent(_ intentId: String) async throws -> GoatPaymentOutcome {
        lock.lock(); defer { lock.unlock() }
        queryCalls += 1
        return terminalOutcomes[intentId] ?? GoatPaymentOutcome(status: .created, intentId: intentId)
    }
}

private final class FakeAdapter: GoatPaymentAdapter, @unchecked Sendable {
    let providerId: String
    private let onProcess: (GoatPaymentRequest) async throws -> GoatPaymentOutcome
    private let lock = NSLock()
    private var _processCalls = 0
    private var _lastRequest: GoatPaymentRequest?
    var queryStatusResult: GoatPaymentStatus?

    var processCalls: Int { lock.lock(); defer { lock.unlock() }; return _processCalls }
    var lastRequest: GoatPaymentRequest? { lock.lock(); defer { lock.unlock() }; return _lastRequest }

    init(providerId: String, onProcess: @escaping (GoatPaymentRequest) async throws -> GoatPaymentOutcome) {
        self.providerId = providerId
        self.onProcess = onProcess
    }

    func processPayment(_ request: GoatPaymentRequest, ctx: GoatPaymentContext) async throws -> GoatPaymentOutcome {
        lock.lock(); _processCalls += 1; _lastRequest = request; lock.unlock()
        return try await onProcess(request)
    }

    func queryStatus(_ intentId: String, ctx: GoatPaymentContext) async throws -> GoatPaymentStatus {
        queryStatusResult ?? .processing
    }

    func cancelPayment(_ intentId: String, ctx: GoatPaymentContext) async throws -> GoatPaymentStatus {
        .cancelled
    }
}
#endif // os(iOS)
