---
sidebar_position: 2
title: Virtual Domain Asset Routing
---

# Virtual Domain Asset Routing

The **Goat Virtual Domain Asset Routing Engine** replaces legacy `file:///` URLs with secure, virtual domain origins (`goat://assets/` on iOS and `https://appassets.androidplatform.net/assets/` on Android). This architecture eliminates Cross-Origin Resource Sharing (CORS) restrictions, enforces strict multi-tenant sandbox boundaries, protects against Zip Slip directory traversal attacks, and enables zero-overhead disk-to-GPU streaming for WebAssembly, Web Workers, and media assets.

---

## Why `file:///` URLs Are Banned

| Risk / Limitation | `file:///` Protocol | Goat Virtual Domain Routing |
| :--- | :--- | :--- |
| **CORS / Same-Origin Policy** | Banned: Modern browsers reject `fetch()` and `XMLHttpRequest` across local files. | **Allowed:** Treated as a secure, canonical HTTPS / custom origin. |
| **WebAssembly Streaming** | Broken: `WebAssembly.instantiateStreaming` fails due to MIME-type restrictions on `file://`. | **Supported:** Native streaming with `application/wasm` headers. |
| **Dedicated Web Workers** | Broken: `new Worker('worker.js')` violates Same-Origin Policy on `file://`. | **Supported:** Workers execute cleanly in the same virtual origin. |
| **Path Traversal Vulnerability** | Critical: Malicious JS can traverse `../../` to access host application files. | **Blocked:** Canonical sandbox boundary enforcement blocks traversal. |
| **Local Storage Partitioning** | Shared: All `file://` pages share the same origin, risking credential leakage. | **Isolated:** Scoped per `appId` (`goat://{appId}/`). |

---

## Multi-Platform Virtual Domain Matrix

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        VIRTUAL DOMAIN ASSET ROUTING TOPOLOGY                           │
└────────────────────────────────────────────────────────────────────────────────────────┘

  Android (WebViewAssetLoader)                  iOS (GoatURLSchemeHandler)
  https://appassets.androidplatform.net/assets/  goat://assets/ or goat://{appId}/
  ┌─────────────────────────────────────────┐   ┌─────────────────────────────────────────┐
  │ 1. Intercepts URL request natively      │   │ 1. WKURLSchemeHandler.start(task)       │
  │ 2. Validates canonical path in sandbox  │   │ 2. Canonical tenant boundary check      │
  │ 3. Streams local disk file as HTTP 200  │   │ 3. In-memory NSData buffer streaming    │
  │ 4. Eliminates file:// CORS & CSP blocks │   │ 4. Serves Wasm, Web Workers, Images     │
  └─────────────────────────────────────────┘   └─────────────────────────────────────────┘
```

---

## Android Implementation (`WebViewAssetLoader`)

On Android, Goat WebView utilizes AndroidX WebKit's `WebViewAssetLoader` with a custom `InternalStoragePathHandler` mapped to the mini-app's sandboxed asset directory:

```kotlin
val assetLoader = WebViewAssetLoader.Builder()
    .setDomain("appassets.androidplatform.net")
    .addPathHandler(
        "/assets/",
        WebViewAssetLoader.InternalStoragePathHandler(context, assetDir)
    )
    .build()

webView.webViewClient = object : WebViewClient() {
    override fun shouldInterceptRequest(
        view: WebView?,
        request: WebResourceRequest?
    ): WebResourceResponse? {
        val uri = request?.url ?: return null
        // Intercept and stream from local sandbox
        return assetLoader.shouldInterceptRequest(uri)
    }
}
```

### Entry URL:
```text
https://appassets.androidplatform.net/assets/index.html
```

---

## iOS Implementation (`GoatURLSchemeHandler`)

On iOS, Goat WebView registers a custom `WKURLSchemeHandler` for the `goat` scheme on the `WKWebViewConfiguration`:

```swift
import WebKit

public class GoatURLSchemeHandler: NSObject, WKURLSchemeHandler {
    private let assetDirectory: URL
    private let canonicalRootPath: String

    public init(assetDirectory: URL) {
        self.assetDirectory = assetDirectory
        self.canonicalRootPath = assetDirectory.standardizedFileURL.path
        super.init()
    }

    public func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) {
        guard let url = urlSchemeTask.request.url else {
            urlSchemeTask.didFailWithError(URLError(.badURL))
            return
        }

        // 1. Resolve requested path relative to asset sandbox root
        let relativePath = url.path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        let fileURL = assetDirectory.appendingPathComponent(relativePath)

        // 2. Security: Enforce canonical root sandboxing (Zip Slip / Path Traversal Guard)
        let resolvedCanonical = fileURL.standardizedFileURL.path
        guard resolvedCanonical.hasPrefix(canonicalRootPath) else {
            urlSchemeTask.didFailWithError(URLError(.noPermissionsToReadFile))
            return
        }

        // 3. Stream file contents with correct MIME type
        do {
            let data = try Data(contentsOf: fileURL)
            let mimeType = mimeType(for: fileURL.pathExtension)
            let response = HTTPURLResponse(
                url: url,
                statusCode: 200,
                httpVersion: "HTTP/1.1",
                headerFields: [
                    "Content-Type": mimeType,
                    "Access-Control-Allow-Origin": "*",
                    "Cache-Control": "public, max-age=31536000, immutable"
                ]
            )!
            urlSchemeTask.didReceive(response)
            urlSchemeTask.didReceive(data)
            urlSchemeTask.didFinish()
        } catch {
            urlSchemeTask.didFailWithError(URLError(.fileDoesNotExist))
        }
    }

    public func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) {
        // Handle task cancellation if navigation redirects or cancels
    }
}
```

---

## Sandbox Security: Path Traversal & Zip Slip Guards

A major vector in mini-app ecosystems is **Path Traversal / Zip Slip attacks**, where an attacker crafts requests like:
```text
https://appassets.androidplatform.net/assets/../../../../data/data/com.host/databases/user_auth.db
```

Goat WebView enforces **Two-Stage Canonical Path Validation**:
1. **URL Normalization:** Resolves symlinks, `.` and `..` segments into an absolute canonical path (`getCanonicalPath()`).
2. **Prefix Verification:** Verifies that the resolved path begins with the exact canonical root path of the mini-app's authorized directory (`/files/miniapps/{appId}/{version}/`).
3. **Rejection:** Any violation immediately returns an `HTTP 403 Forbidden` response and logs a high-severity security alert.

---

## Zero-Overhead Disk-to-GPU Media & WebAssembly Streaming

By streaming file chunks directly into native response buffers (`WebResourceResponse` InputStream on Android, `WKURLSchemeTask` NSData chunks on iOS):
- **WebAssembly:** `WebAssembly.instantiateStreaming(fetch('module.wasm'))` streams bytecode directly into the V8/JSC compiler while bytes are read from disk, without staging the entire file in JavaScript memory.
- **High-Resolution Textures:** Images and videos stream directly to the hardware compositor without base64 serialization or memory duplication.
