import XCTest
@testable import GoatWebView

final class GoatPrintControllerTests: XCTestCase {

    private actor FakeFailingAdapter: GoatPrintWebViewAdapter {
        func exportPdfData() async throws -> Data {
            throw GoatPrintError.webViewUnavailable
        }
    }

    private actor FakeEmptyAdapter: GoatPrintWebViewAdapter {
        func exportPdfData() async throws -> Data {
            Data()
        }
    }

    private actor FakeScriptedAdapter: GoatPrintWebViewAdapter {
        var exportCalls = 0
        private let scriptedData: Data

        init(scriptedData: Data) {
            self.scriptedData = scriptedData
        }

        func exportPdfData() async throws -> Data {
            exportCalls += 1
            return scriptedData
        }
    }

    func testExportPdfReturnsAdapterBytesOnSuccess() async throws {
        let adapter = FakeScriptedAdapter(scriptedData: Data("%PDF-1.7 fake".utf8))
        let controller = GoatPrintController()

        let data = try await controller.exportPdf(adapter: adapter)

        XCTAssertEqual(data, Data("%PDF-1.7 fake".utf8))
        let calls = await adapter.exportCalls
        XCTAssertEqual(calls, 1)
    }

    func testExportPdfPropagatesAdapterFailure() async throws {
        let adapter = FakeFailingAdapter()
        let controller = GoatPrintController()

        do {
            _ = try await controller.exportPdf(adapter: adapter)
            XCTFail("Expected an error")
        } catch {
            // expected
        }
    }

    func testExportPdfThrowsOnEmptyRenderInsteadOfReturningAZeroByteFile() async throws {
        let adapter = FakeEmptyAdapter()
        let controller = GoatPrintController()

        do {
            _ = try await controller.exportPdf(adapter: adapter)
            XCTFail("Expected renderFailed")
        } catch GoatPrintError.renderFailed {
            // expected
        }
    }
}
