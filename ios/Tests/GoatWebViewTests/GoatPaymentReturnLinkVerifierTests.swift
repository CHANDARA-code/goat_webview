import XCTest
@testable import GoatWebView

final class GoatPaymentReturnLinkVerifierTests: XCTestCase {

    private let allowed: Set<String> = ["pay.tenant-1.com", "*.checkout.example.com"]

    func testAcceptsHttpsUrlOnExactlyAllowlistedDomain() {
        let url = URL(string: "https://pay.tenant-1.com/payment/return?intentId=pi_1")!
        XCTAssertTrue(GoatPaymentReturnLinkVerifier.isValidReturnUrl(url, allowedReturnDomains: allowed))
    }

    func testAcceptsHttpsUrlOnWildcardAllowlistedSubdomain() {
        let url = URL(string: "https://alipay.checkout.example.com/return?intentId=pi_1")!
        XCTAssertTrue(GoatPaymentReturnLinkVerifier.isValidReturnUrl(url, allowedReturnDomains: allowed))
    }

    func testRejectsLegacyUnverifiedCustomSchemeEvenOnAllowlistedHost() {
        let url = URL(string: "goat://pay.tenant-1.com/payment/return?intentId=pi_1")!
        XCTAssertFalse(GoatPaymentReturnLinkVerifier.isValidReturnUrl(url, allowedReturnDomains: allowed))
    }

    func testRejectsRawPspAppScheme() {
        let url = URL(string: "alipays://payment/return?intentId=pi_1")!
        XCTAssertFalse(GoatPaymentReturnLinkVerifier.isValidReturnUrl(url, allowedReturnDomains: allowed))
    }

    func testRejectsHttpsUrlOnNonAllowlistedDomain() {
        let url = URL(string: "https://evil.example.com/payment/return?intentId=pi_1")!
        XCTAssertFalse(GoatPaymentReturnLinkVerifier.isValidReturnUrl(url, allowedReturnDomains: allowed))
    }

    func testRejectsSuffixSubstringDomainThatIsNotGenuineSubdomain() {
        let url = URL(string: "https://evilcheckout.example.com/return?intentId=pi_1")!
        XCTAssertFalse(GoatPaymentReturnLinkVerifier.isValidReturnUrl(url, allowedReturnDomains: allowed))
    }

    func testRejectsEverythingWhenNoReturnDomainsConfigured() {
        let url = URL(string: "https://pay.tenant-1.com/payment/return?intentId=pi_1")!
        XCTAssertFalse(GoatPaymentReturnLinkVerifier.isValidReturnUrl(url, allowedReturnDomains: []))
    }

    func testExtractQueryParamReadsIntentId() {
        let url = URL(string: "https://pay.tenant-1.com/payment/return?intentId=pi_42&foo=bar")!
        XCTAssertEqual(GoatPaymentReturnLinkVerifier.extractQueryParam(url, name: "intentId"), "pi_42")
    }

    func testExtractQueryParamReturnsNilWhenMissing() {
        let url = URL(string: "https://pay.tenant-1.com/payment/return")!
        XCTAssertNil(GoatPaymentReturnLinkVerifier.extractQueryParam(url, name: "intentId"))
    }
}
