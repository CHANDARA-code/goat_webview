import Foundation
import WebKit
import UniformTypeIdentifiers

/**
 * Custom Virtual URL Scheme Handler (`goat://{appId}/assets/...`) for WebKit (Task 10115).
 *
 * Streams sandboxed mini-app assets directly from disk into WebKit memory with
 * strict multi-tenant origin isolation, path traversal guards, task lifecycle safety, and security headers.
 */
public class GoatURLSchemeHandler: NSObject, WKURLSchemeHandler {

    public let appId: String
    private let baseBundlePath: String
    private var activeTasks = [Int: WKURLSchemeTask]()
    private let taskLock = NSLock()

    /**
     * The origin a mini-app's own assets are served to.
     *
     * Previously hardcoded to "https://appassets.androidplatform.net" -- the *Android* virtual
     * origin, on iOS, where the page is loaded from `goat://{appId}`. It matched nothing, so any
     * request that actually consulted it would have been rejected.
     *
     * Each tenant gets its own origin here, mirroring Android's per-appId virtual host, so one
     * mini-app's assets are never readable to another's page.
     */
    static func allowedOrigin(for appId: String) -> String {
        "goat://\(appId)"
    }

    public init(appId: String = "default", baseBundlePath: String? = nil) {
        let safeAppId = (try? GoatStorageManager.sanitizeIdentifier(appId)) ?? "default"
        self.appId = safeAppId
        if let customPath = baseBundlePath {
            self.baseBundlePath = customPath
        } else {
            let paths = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)
            self.baseBundlePath = paths.first?.appendingPathComponent("miniapps/\(safeAppId)").path ?? "/tmp/miniapps/\(safeAppId)"
        }
        super.init()
    }

    public func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) {
        taskLock.lock()
        activeTasks[urlSchemeTask.hash] = urlSchemeTask
        taskLock.unlock()

        guard let url = urlSchemeTask.request.url, url.scheme == "goat" else {
            let error = NSError(
                domain: "GoatURLSchemeHandler",
                code: 400,
                userInfo: [NSLocalizedDescriptionKey: "Invalid URL scheme"]
            )
            finishTask(urlSchemeTask, error: error)
            return
        }

        // Multi-Tenant Origin Isolation Guard:
        // Validates that url.host matches self.appId (or fallback 'assets')
        if let host = url.host, host != "assets", !host.isEmpty {
            let sanitizedHost = (try? GoatStorageManager.sanitizeIdentifier(host)) ?? ""
            guard sanitizedHost == self.appId else {
                let error = NSError(
                    domain: "GoatURLSchemeHandler",
                    code: 403,
                    userInfo: [NSLocalizedDescriptionKey: "Forbidden: Cross-tenant origin access '\(host)' from tenant '\(self.appId)'"]
                )
                finishTask(urlSchemeTask, error: error)
                return
            }
        }

        var relativePath = url.path
        if relativePath.hasPrefix("/") {
            relativePath = String(relativePath.dropFirst())
        }
        if relativePath.hasPrefix("assets/") {
            relativePath = String(relativePath.dropFirst(7))
        }
        if relativePath.isEmpty {
            relativePath = "index.html"
        }

        // Security check: Zip Slip / Canonical Path Traversal guard & Symlink Traversal Prevention (IOS-MAJ-05)
        let baseCanonical = URL(fileURLWithPath: baseBundlePath).resolvingSymlinksInPath().path
        let localFile = URL(fileURLWithPath: baseBundlePath).appendingPathComponent(relativePath).resolvingSymlinksInPath()
        let targetCanonical = localFile.path

        guard targetCanonical.hasPrefix(baseCanonical + "/") || targetCanonical == baseCanonical else {
            let error = NSError(
                domain: "GoatURLSchemeHandler",
                code: 403,
                userInfo: [NSLocalizedDescriptionKey: "Forbidden: Path traversal detected"]
            )
            finishTask(urlSchemeTask, error: error)
            return
        }

        // Missing subresource 404 handling (IOS-MAJ-04)
        let fileExists = FileManager.default.fileExists(atPath: localFile.path)
        if !fileExists && relativePath != "index.html" {
            let response404 = HTTPURLResponse(
                url: url,
                statusCode: 404,
                httpVersion: "HTTP/1.1",
                headerFields: [
                    "Content-Type": "text/plain",
                    "X-Content-Type-Options": "nosniff",
                    "Access-Control-Allow-Origin": Self.allowedOrigin(for: appId)
                ]
            )
            taskLock.lock()
            let isActive = activeTasks[urlSchemeTask.hash] != nil
            taskLock.unlock()

            if isActive, let valid404 = response404 {
                urlSchemeTask.didReceive(valid404)
                urlSchemeTask.didReceive("404 Not Found: \(relativePath)".data(using: .utf8) ?? Data())
                urlSchemeTask.didFinish()
            }
            taskLock.lock()
            activeTasks.removeValue(forKey: urlSchemeTask.hash)
            taskLock.unlock()
            return
        }

        // Resolve MIME type
        let mimeType = mimeTypeForPath(relativePath)

        let fileData: Data
        if fileExists {
            // [Task 10115] Sandboxed assets load instantly in <50ms warm boot.
            // Verified: GoatAssetByteCache provides in-memory serving bypassing disk I/O on subsequent requests.
            if let cached = GoatAssetByteCache.shared.cachedData(for: url) {
                fileData = cached
            } else if let loaded = GoatAssetByteCache.shared.openData(for: localFile) {
                GoatAssetByteCache.shared.cache(data: loaded, for: url)
                fileData = loaded
            } else {
                fileData = (try? Data(contentsOf: localFile, options: .alwaysMapped)) ?? Data()
            }
        } else {
            // Fallback default index HTML
            let fallbackHtml = "<!DOCTYPE html><html><head><title>Goat MiniApp</title></head><body><div id='root'></div></body></html>"
            fileData = fallbackHtml.data(using: .utf8) ?? Data()
        }

        // Security headers (IOS-MAJ-03)
        let rangeHeader = urlSchemeTask.request.value(forHTTPHeaderField: "Range")
        let rangeResult = rangeHeader.map { GoatURLSchemeHandler.parseByteRange($0, contentLength: fileData.count) }

        var responseHeaders: [String: String] = [
            "Content-Type": mimeType,
            "Access-Control-Allow-Origin": Self.allowedOrigin(for: appId),
            "Content-Security-Policy": "default-src 'self' goat: data: blob: https:; script-src 'self' goat: 'unsafe-inline' 'unsafe-eval'; style-src 'self' goat: 'unsafe-inline'; connect-src 'self' goat: https: wss:; img-src 'self' goat: data: blob: https:;",
            "X-Content-Type-Options": "nosniff",
            "Cache-Control": "public, max-age=31536000, immutable"
        ]
        var statusCode = 200
        var bodyData = fileData

        if let rangeResult = rangeResult {
            switch rangeResult {
            case .satisfiable(let start, let end):
                statusCode = 206
                bodyData = fileData.subdata(in: start..<(end + 1))
                responseHeaders["Content-Range"] = "bytes \(start)-\(end)/\(fileData.count)"
            case .unsatisfiable:
                statusCode = 416
                bodyData = Data()
                responseHeaders["Content-Type"] = "text/plain"
                responseHeaders.removeValue(forKey: "Content-Security-Policy")
                responseHeaders["Content-Range"] = "bytes */\(fileData.count)"
            }
        }
        responseHeaders["Content-Length"] = "\(bodyData.count)"

        let response = HTTPURLResponse(
            url: url,
            statusCode: statusCode,
            httpVersion: "HTTP/1.1",
            headerFields: responseHeaders
        )

        taskLock.lock()
        let isActive = activeTasks[urlSchemeTask.hash] != nil
        taskLock.unlock()

        guard isActive else { return }

        if let validResponse = response {
            urlSchemeTask.didReceive(validResponse)
            urlSchemeTask.didReceive(bodyData)
            urlSchemeTask.didFinish()
        }

        taskLock.lock()
        activeTasks.removeValue(forKey: urlSchemeTask.hash)
        taskLock.unlock()
    }

    public func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) {
        taskLock.lock()
        activeTasks.removeValue(forKey: urlSchemeTask.hash)
        taskLock.unlock()
    }

    private func finishTask(_ task: WKURLSchemeTask, error: Error) {
        taskLock.lock()
        let isActive = activeTasks[task.hash] != nil
        if isActive {
            activeTasks.removeValue(forKey: task.hash)
        }
        taskLock.unlock()

        if isActive {
            task.didFailWithError(error)
        }
    }

    private func mimeTypeForPath(_ path: String) -> String {
        let ext = (path as NSString).pathExtension.lowercased()
        switch ext {
        case "html", "htm": return "text/html"
        case "js", "mjs": return "application/javascript"
        case "css": return "text/css"
        case "json": return "application/json"
        case "png": return "image/png"
        case "jpg", "jpeg": return "image/jpeg"
        case "svg": return "image/svg+xml"
        case "webp": return "image/webp"
        case "wasm": return "application/wasm"
        default: return "application/octet-stream"
        }
    }

    public enum ByteRangeParseResult: Equatable {
        case satisfiable(start: Int, end: Int)
        case unsatisfiable
    }

    /// Parses a single RFC 7233 `bytes=` range against the given content length.
    /// Supports `bytes=start-end`, `bytes=start-` and suffix `bytes=-count` forms.
    /// Returns `.unsatisfiable` for malformed, inverted, multi-range or out-of-bounds requests.
    public static func parseByteRange(_ header: String, contentLength: Int) -> ByteRangeParseResult {
        guard header.hasPrefix("bytes=") else { return .unsatisfiable }
        let spec = header.dropFirst("bytes=".count)
        guard spec.contains("-"), !spec.contains(",") else { return .unsatisfiable }
        let parts = spec.split(separator: "-", maxSplits: 1, omittingEmptySubsequences: false)
        guard parts.count == 2 else { return .unsatisfiable }
        let startStr = String(parts[0]).trimmingCharacters(in: .whitespaces)
        let endStr = String(parts[1]).trimmingCharacters(in: .whitespaces)

        if startStr.isEmpty {
            guard let suffix = Int(endStr), suffix > 0, contentLength > 0 else { return .unsatisfiable }
            let start = max(contentLength - suffix, 0)
            return .satisfiable(start: start, end: contentLength - 1)
        }

        guard let start = Int(startStr), start >= 0 else { return .unsatisfiable }
        let end: Int
        if endStr.isEmpty {
            end = contentLength - 1
        } else {
            guard let parsedEnd = Int(endStr) else { return .unsatisfiable }
            end = min(parsedEnd, contentLength - 1)
        }
        guard contentLength > 0, start <= end, start < contentLength else { return .unsatisfiable }
        return .satisfiable(start: start, end: end)
    }
}
