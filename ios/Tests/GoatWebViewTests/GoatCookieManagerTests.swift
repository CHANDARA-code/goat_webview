import XCTest
import WebKit
@testable import GoatWebView

final class GoatCookieManagerTests: XCTestCase {

    func testCookieManagerDataStorePartitioning() {
        let manager = GoatCookieManager.shared
        let storeA = manager.dataStore(for: "tenant_alpha")
        let storeB = manager.dataStore(for: "tenant_beta")
        let storeA2 = manager.dataStore(for: "tenant_alpha")

        XCTAssertNotNil(storeA)
        XCTAssertNotNil(storeB)
        XCTAssertTrue(storeA === storeA2, "Same tenant should return cached data store instance")
    }

    func testSetAndGetCookies() async throws {
        let manager = GoatCookieManager.shared
        let url = "https://appassets.androidplatform.net/api/test"
        
        let success = try await manager.setCookie(
            appId: "cookie_test_app",
            url: url,
            name: "auth_session",
            value: "sess_token_12345",
            domain: "appassets.androidplatform.net",
            path: "/",
            isSecure: true,
            isHttpOnly: true,
            sameSite: "Strict"
        )
        XCTAssertTrue(success)

        let cookies = try await manager.getCookies(appId: "cookie_test_app", url: url)
        let authCookie = cookies.first(where: { ($0["name"] as? String) == "auth_session" })
        XCTAssertNotNil(authCookie)
        XCTAssertEqual(authCookie?["value"] as? String, "sess_token_12345")
        XCTAssertEqual(authCookie?["isSecure"] as? Bool, true)
        XCTAssertEqual(authCookie?["isHttpOnly"] as? Bool, true)
    }

    func testDeleteCookie() async throws {
        let manager = GoatCookieManager.shared
        let url = "https://example.com/login"
        
        _ = try await manager.setCookie(
            appId: "cookie_del_app",
            url: url,
            name: "temp_cookie",
            value: "to_be_deleted",
            domain: "example.com",
            path: "/"
        )

        let deleted = try await manager.deleteCookie(
            appId: "cookie_del_app",
            url: url,
            name: "temp_cookie",
            domain: "example.com",
            path: "/"
        )
        XCTAssertTrue(deleted)
    }

    func testClearTenantCookies() async throws {
        let manager = GoatCookieManager.shared
        let cleared = try await manager.clearTenantCookies(appId: "cookie_clear_app")
        XCTAssertTrue(cleared)
    }

    func testClearAllCookies() async throws {
        let manager = GoatCookieManager.shared
        let cleared = try await manager.clearAllCookies()
        XCTAssertTrue(cleared)
    }
}
