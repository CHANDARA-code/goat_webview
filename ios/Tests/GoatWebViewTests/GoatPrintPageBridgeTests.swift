#if os(iOS)
import XCTest
@testable import GoatWebView

/**
 * Bridge wiring tests for Task 10185 (nativePrintAndPdfExportController): PRINT_PAGE for both
 * `SYSTEM_SHEET` and `EXPORT_PDF` modes.
 */
final class GoatPrintPageBridgeTests: XCTestCase {

    func testPrintPageWithNoHostCallbackThrowsInsteadOfSilentlySucceeding() async throws {
        let handler = GoatScriptMessageHandler(appId: "test_print")
        do {
            _ = try await handler.dispatchDirect(action: "PRINT_PAGE", payload: ["jobName": "Invoice-1042", "mode": "SYSTEM_SHEET"])
            XCTFail("Expected an error")
        } catch {
            // expected
        }
    }

    func testPrintPageWithoutJobNameThrowsInvalidPayload() async throws {
        let handler = GoatScriptMessageHandler(appId: "test_print")
        handler.onPrintPage = { _, _ in ["shown": true] }
        do {
            _ = try await handler.dispatchDirect(action: "PRINT_PAGE", payload: ["mode": "SYSTEM_SHEET"])
            XCTFail("Expected an error")
        } catch {
            // expected
        }
    }

    func testPrintPageDelegatesJobNameAndModeToHostCallbackAndReturnsItsResult() async throws {
        let handler = GoatScriptMessageHandler(appId: "test_print")
        var receivedJobName: String?
        var receivedMode: String?
        handler.onPrintPage = { jobName, mode in
            receivedJobName = jobName
            receivedMode = mode
            return ["pdfUri": "goat://fs/exports/invoice-1042.pdf"]
        }

        let result = try await handler.dispatchDirect(action: "PRINT_PAGE", payload: ["jobName": "Invoice-1042", "mode": "EXPORT_PDF"])

        XCTAssertEqual(receivedJobName, "Invoice-1042")
        XCTAssertEqual(receivedMode, "EXPORT_PDF")
        XCTAssertEqual(result["pdfUri"] as? String, "goat://fs/exports/invoice-1042.pdf")
    }

    func testPrintPageDefaultsModeToSystemSheetWhenOmitted() async throws {
        let handler = GoatScriptMessageHandler(appId: "test_print")
        var receivedMode: String?
        handler.onPrintPage = { _, mode in
            receivedMode = mode
            return ["shown": true]
        }

        _ = try await handler.dispatchDirect(action: "PRINT_PAGE", payload: ["jobName": "Invoice-1042"])

        XCTAssertEqual(receivedMode, "SYSTEM_SHEET")
    }

    func testPrintPageIsInSupportedActions() {
        XCTAssertTrue(GoatScriptMessageHandler.supportedActions.contains("PRINT_PAGE"))
    }
}
#endif // os(iOS)
