#if os(iOS)
import XCTest
import Foundation
@testable import GoatWebView

final class GoatPaymentAdaptersTests: XCTestCase {

    private func request(provider: String, token: String? = "ephemeral_token") -> GoatPaymentRequest {
        GoatPaymentRequest(
            provider: provider, orderId: "order_1", intentId: "pi_1", amount: 4999,
            currency: "USD", nonce: "nonce_1", signedPayload: "irrelevant.irrelevant",
            ephemeralClientToken: token
        )
    }

    // MARK: - Stripe

    func testStripeCompletedSheetResolvesSucceeded() async throws {
        let ctx = GoatPaymentContext(appId: "tenant-1", proxyClient: NoOpProxyClient())
        let adapter = GoatStripePaymentAdapter(launcher: FakeStripeLauncher(result: .completed))
        let outcome = try await adapter.processPayment(request(provider: "stripe"), ctx: ctx)
        XCTAssertEqual(outcome.status, .succeeded)
    }

    func testStripeCanceledSheetResolvesNonTerminalDismissed() async throws {
        let ctx = GoatPaymentContext(appId: "tenant-1", proxyClient: NoOpProxyClient())
        let adapter = GoatStripePaymentAdapter(launcher: FakeStripeLauncher(result: .canceled))
        let outcome = try await adapter.processPayment(request(provider: "stripe"), ctx: ctx)
        XCTAssertEqual(outcome.status, .dismissed)
    }

    func testStripeFailedSheetResolvesFailedWithSafeSubCode() async throws {
        let ctx = GoatPaymentContext(appId: "tenant-1", proxyClient: NoOpProxyClient())
        let adapter = GoatStripePaymentAdapter(launcher: FakeStripeLauncher(result: .failed))
        let outcome = try await adapter.processPayment(request(provider: "stripe"), ctx: ctx)
        XCTAssertEqual(outcome.status, .failed)
        XCTAssertEqual(outcome.failureSubCode, GoatPaymentSubCode.cardDeclinedInsufficientFunds)
    }

    func testStripeUnlinkedLauncherFailsLoudly() async {
        let ctx = GoatPaymentContext(appId: "tenant-1", proxyClient: NoOpProxyClient())
        let adapter = GoatStripePaymentAdapter()
        do {
            _ = try await adapter.processPayment(request(provider: "stripe"), ctx: ctx)
            XCTFail("Expected GoatPaymentException")
        } catch is GoatPaymentException {
            // expected
        } catch {
            XCTFail("Unexpected error \(error)")
        }
    }

    func testStripeLinkAdapterUsesDistinctProviderId() async throws {
        let ctx = GoatPaymentContext(appId: "tenant-1", proxyClient: NoOpProxyClient())
        let adapter = GoatStripeLinkPaymentAdapter(launcher: FakeStripeLauncher(result: .completed))
        XCTAssertEqual(adapter.providerId, "link")
        let outcome = try await adapter.processPayment(request(provider: "link"), ctx: ctx)
        XCTAssertEqual(outcome.status, .succeeded)
    }

    // MARK: - Alipay

    func testAlipayProvisionalSuccessNotTrustedUntilProxyConfirms() async throws {
        let proxy = FixedQueryProxyClient(result: GoatPaymentOutcome(status: .processing, intentId: "pi_1"))
        let ctx = GoatPaymentContext(appId: "tenant-1", proxyClient: proxy)
        let adapter = GoatAlipayPaymentAdapter(launcher: FakeAlipayLauncher(result: .success))
        let outcome = try await adapter.processPayment(request(provider: "alipay"), ctx: ctx)
        XCTAssertEqual(outcome.status, .processing)
    }

    func testAlipayAlreadyTerminalProxyStateWinsOverFailedDeepLink() async throws {
        let proxy = FixedQueryProxyClient(result: GoatPaymentOutcome(status: .succeeded, intentId: "pi_1", transactionHandle: "txh_1"))
        let ctx = GoatPaymentContext(appId: "tenant-1", proxyClient: proxy)
        let adapter = GoatAlipayPaymentAdapter(launcher: FakeAlipayLauncher(result: .failed))
        let outcome = try await adapter.processPayment(request(provider: "alipay"), ctx: ctx)
        XCTAssertEqual(outcome.status, .succeeded)
    }

    // MARK: - PayPay

    func testPayPayMissingTokenThrowsWithoutLaunching() async {
        let ctx = GoatPaymentContext(appId: "tenant-1", proxyClient: NoOpProxyClient())
        let adapter = GoatPayPayPaymentAdapter(launcher: FakePayPayLauncher(result: .success))
        do {
            _ = try await adapter.processPayment(request(provider: "paypay", token: nil), ctx: ctx)
            XCTFail("Expected GoatPaymentException")
        } catch is GoatPaymentException {
            // expected
        } catch {
            XCTFail("Unexpected error \(error)")
        }
    }

    func testPayPayFailedReturnMapsToFailedWithAuthenticationSubCode() async throws {
        let proxy = FixedQueryProxyClient(result: GoatPaymentOutcome(status: .claimed, intentId: "pi_1"))
        let ctx = GoatPaymentContext(appId: "tenant-1", proxyClient: proxy)
        let adapter = GoatPayPayPaymentAdapter(launcher: FakePayPayLauncher(result: .failed))
        let outcome = try await adapter.processPayment(request(provider: "paypay"), ctx: ctx)
        XCTAssertEqual(outcome.status, .failed)
        XCTAssertEqual(outcome.failureSubCode, GoatPaymentSubCode.authenticationFailed)
    }

    // MARK: - Bakong KHQR

    func testBakongRendersQrAndReturnsImmediately() async throws {
        let presenter = RecordingKhqrPresenter()
        let ctx = GoatPaymentContext(appId: "tenant-1", proxyClient: NoOpProxyClient())
        let adapter = GoatBakongKhqrPaymentAdapter(presenter: presenter)
        let outcome = try await adapter.processPayment(request(provider: "bakong_khqr"), ctx: ctx)
        XCTAssertEqual(outcome.status, .processing)
        XCTAssertTrue(presenter.shown)
        XCTAssertFalse(presenter.dismissed)
    }

    func testBakongCancelDismissesQrAndDelegatesToProxy() async throws {
        let presenter = RecordingKhqrPresenter()
        let ctx = GoatPaymentContext(appId: "tenant-1", proxyClient: NoOpProxyClient())
        let adapter = GoatBakongKhqrPaymentAdapter(presenter: presenter)
        let status = try await adapter.cancelPayment("pi_1", ctx: ctx)
        XCTAssertTrue(presenter.dismissed)
        XCTAssertEqual(status, .cancelled)
    }
}

// MARK: - Fakes

private struct FakeStripeLauncher: StripeSheetLauncher {
    let result: StripeSheetResult
    func presentPaymentSheet(clientSecret: String, ctx: GoatPaymentContext) async throws -> StripeSheetResult { result }
}

private struct FakeAlipayLauncher: AlipayLauncher {
    let result: AlipayResult
    func launchPayTask(orderInfo: String, ctx: GoatPaymentContext) async throws -> AlipayResult { result }
}

private struct FakePayPayLauncher: PayPayLauncher {
    let result: PayPayResult
    func launchOpaPayment(merchantPaymentId: String, ctx: GoatPaymentContext) async throws -> PayPayResult { result }
}

private final class RecordingKhqrPresenter: KhqrPresenter, @unchecked Sendable {
    private(set) var shown = false
    private(set) var dismissed = false
    func showQr(_ qrString: String, ctx: GoatPaymentContext) async { shown = true }
    func dismissQr(ctx: GoatPaymentContext) async { dismissed = true }
}

private final class NoOpProxyClient: GoatPaymentServerProxyClient, @unchecked Sendable {
    func fetchTenantPublicKey(_ tenantAppId: String) async -> GoatTenantPublicKey? { nil }
    func claimIntent(_ intentId: String, tenantAppId: String) async throws -> GoatClaimResult { GoatClaimResult(claimed: true) }
    func fetchClientToken(_ intentId: String) async throws -> String { "unused" }
    func confirmIntent(_ intentId: String, outcome: GoatPaymentOutcome) async throws -> GoatPaymentOutcome { outcome }
    func cancelIntent(_ intentId: String) async throws -> GoatPaymentOutcome { GoatPaymentOutcome(status: .cancelled, intentId: intentId) }
    func queryIntent(_ intentId: String) async throws -> GoatPaymentOutcome { GoatPaymentOutcome(status: .processing, intentId: intentId) }
}

private final class FixedQueryProxyClient: GoatPaymentServerProxyClient, @unchecked Sendable {
    private let result: GoatPaymentOutcome
    init(result: GoatPaymentOutcome) { self.result = result }
    func fetchTenantPublicKey(_ tenantAppId: String) async -> GoatTenantPublicKey? { nil }
    func claimIntent(_ intentId: String, tenantAppId: String) async throws -> GoatClaimResult { GoatClaimResult(claimed: true) }
    func fetchClientToken(_ intentId: String) async throws -> String { "unused" }
    func confirmIntent(_ intentId: String, outcome: GoatPaymentOutcome) async throws -> GoatPaymentOutcome { outcome }
    func cancelIntent(_ intentId: String) async throws -> GoatPaymentOutcome { GoatPaymentOutcome(status: .cancelled, intentId: intentId) }
    func queryIntent(_ intentId: String) async throws -> GoatPaymentOutcome { result }
}
#endif // os(iOS)
