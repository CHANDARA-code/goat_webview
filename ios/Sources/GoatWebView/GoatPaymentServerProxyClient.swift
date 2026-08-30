import Foundation

/**
 * Native-side client for the Zone 4 Goat Server Payment Proxy (Task 10206 / §5.4).
 * The default implementation never returns PSP secrets — only opaque, single-intent tokens.
 */
public protocol GoatPaymentServerProxyClient: Sendable {
    func fetchTenantPublicKey(_ tenantAppId: String) async -> GoatTenantPublicKey?
    func claimIntent(_ intentId: String, tenantAppId: String) async throws -> GoatClaimResult
    func fetchClientToken(_ intentId: String) async throws -> String
    func confirmIntent(_ intentId: String, outcome: GoatPaymentOutcome) async throws -> GoatPaymentOutcome
    func cancelIntent(_ intentId: String) async throws -> GoatPaymentOutcome
    func queryIntent(_ intentId: String) async throws -> GoatPaymentOutcome
}

/// Default HTTPS implementation of `GoatPaymentServerProxyClient` via `URLSession`.
public final class GoatDefaultPaymentServerProxyClient: GoatPaymentServerProxyClient, @unchecked Sendable {
    private let baseUrl: String
    private let session: URLSession
    private let timeout: TimeInterval

    public init(baseUrl: String, timeout: TimeInterval = 10.0, session: URLSession = .shared) {
        self.baseUrl = baseUrl
        self.timeout = timeout
        self.session = session
    }

    private func request(method: String, path: String, body: [String: Any]? = nil) async throws -> [String: Any] {
        guard let url = URL(string: "\(baseUrl)\(path)") else {
            throw GoatPaymentException(code: GoatPaymentErrorCode.paymentFailed, reason: "Malformed payment proxy URL.")
        }
        var req = URLRequest(url: url, timeoutInterval: timeout)
        req.httpMethod = method
        req.setValue("application/json", forHTTPHeaderField: "Accept")
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let body {
            req.httpBody = try JSONSerialization.data(withJSONObject: body)
        }

        let (data, response) = try await session.data(for: req)
        let httpResponse = response as? HTTPURLResponse
        let statusCode = httpResponse?.statusCode ?? 0
        let parsed = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] ?? [:]

        if !(200...299).contains(statusCode) {
            let message = (parsed["error"] as? String) ?? "Payment proxy request failed (\(statusCode))"
            throw GoatPaymentException(code: GoatPaymentErrorCode.paymentFailed, reason: message, subCode: GoatPaymentSubCode.networkTimeout)
        }
        return parsed
    }

    public func fetchTenantPublicKey(_ tenantAppId: String) async -> GoatTenantPublicKey? {
        guard let res = try? await request(method: "GET", path: "/tenant-keys/\(tenantAppId)"),
              let key = res["publicKeyBase64"] as? String else {
            return nil
        }
        let algo = (res["algorithm"] as? String) ?? "Ed25519"
        return GoatTenantPublicKey(keyBase64: key, algorithm: algo)
    }

    public func claimIntent(_ intentId: String, tenantAppId: String) async throws -> GoatClaimResult {
        let res = try await request(method: "POST", path: "/pay/intents/\(intentId)/claim", body: ["tenantAppId": tenantAppId])
        let claimed = (res["claimed"] as? Bool) ?? false
        if claimed { return GoatClaimResult(claimed: true) }
        guard let prior = res["priorOutcome"] as? [String: Any] else { return GoatClaimResult(claimed: false) }
        return GoatClaimResult(claimed: false, priorOutcome: Self.toOutcome(prior, fallbackIntentId: intentId))
    }

    public func fetchClientToken(_ intentId: String) async throws -> String {
        let res = try await request(method: "GET", path: "/pay/intents/\(intentId)/client-token")
        guard let token = res["clientToken"] as? String else {
            throw GoatPaymentException(code: GoatPaymentErrorCode.paymentFailed, reason: "Missing client token from proxy")
        }
        return token
    }

    public func confirmIntent(_ intentId: String, outcome: GoatPaymentOutcome) async throws -> GoatPaymentOutcome {
        var body: [String: Any] = ["status": outcome.status.rawValue]
        if let h = outcome.transactionHandle { body["transactionHandle"] = h }
        if let r = outcome.providerRef { body["providerRef"] = r }
        if let s = outcome.failureSubCode { body["failureSubCode"] = s }
        let res = try await request(method: "POST", path: "/pay/intents/\(intentId)/confirm", body: body)
        return Self.toOutcome(res, fallbackIntentId: intentId)
    }

    public func cancelIntent(_ intentId: String) async throws -> GoatPaymentOutcome {
        let res = try await request(method: "POST", path: "/pay/intents/\(intentId)/cancel")
        return Self.toOutcome(res, fallbackIntentId: intentId)
    }

    public func queryIntent(_ intentId: String) async throws -> GoatPaymentOutcome {
        let res = try await request(method: "GET", path: "/pay/intents/\(intentId)")
        return Self.toOutcome(res, fallbackIntentId: intentId)
    }

    private static func toOutcome(_ json: [String: Any], fallbackIntentId: String) -> GoatPaymentOutcome {
        let status = GoatPaymentStatus.fromWire(json["status"] as? String) ?? .failed
        return GoatPaymentOutcome(
            status: status,
            intentId: (json["intentId"] as? String) ?? fallbackIntentId,
            transactionHandle: json["transactionHandle"] as? String,
            providerRef: json["providerRef"] as? String,
            failureSubCode: json["failureSubCode"] as? String
        )
    }
}
