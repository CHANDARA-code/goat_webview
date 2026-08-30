import Foundation
import WebKit
#if canImport(UIKit)
import UIKit
#endif

public enum GoatPrintError: Error {
    case renderFailed
    case webViewUnavailable
}

/**
 * Thin seam over WKWebView's PDF export surface, abstracted so [GoatPrintController]'s export
 * orchestration is unit-testable without a real WebKit engine.
 */
public protocol GoatPrintWebViewAdapter: Sendable {
    func exportPdfData() async throws -> Data
}

@available(iOS 15.0, *)
public final class RealWKWebViewPrintAdapter: GoatPrintWebViewAdapter, @unchecked Sendable {
    private weak var webView: WKWebView?

    public init(webView: WKWebView) {
        self.webView = webView
    }

    public func exportPdfData() async throws -> Data {
        guard let webView else { throw GoatPrintError.webViewUnavailable }
        return try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Data, Error>) in
            Task { @MainActor in
                webView.createPDF(configuration: WKPDFConfiguration()) { result in
                    switch result {
                    case .success(let data):
                        continuation.resume(returning: data)
                    case .failure(let error):
                        continuation.resume(throwing: error)
                    }
                }
            }
        }
    }
}

/**
 * Native print-to-PDF & system print sheet controller (Task 10185). `EXPORT_PDF` drives a real
 * WKWebView PDF snapshot (`WKWebView.createPDF`, iOS 14+) — WebKit's own print pipeline, which
 * paginates and honors `@media print` CSS natively — into the tenant's sandboxed storage.
 * `SYSTEM_SHEET` presentation (`UIPrintInteractionController` + `WKWebView.viewPrintFormatter()`,
 * which drives the same underlying print pipeline) is presented separately by the host since it
 * requires a live view hierarchy that cannot be faked in a unit test.
 */
public final class GoatPrintController: Sendable {
    public init() {}

    /// Drives [adapter]'s PDF export, returning the raw bytes. Throws on any render failure.
    public func exportPdf(adapter: any GoatPrintWebViewAdapter) async throws -> Data {
        let data = try await adapter.exportPdfData()
        guard !data.isEmpty else { throw GoatPrintError.renderFailed }
        return data
    }
}
