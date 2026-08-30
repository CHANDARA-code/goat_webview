import Foundation

/**
 * App2App Deep-Link Protection (Task 10206 / §7 L5, threat A3).
 *
 * Alipay/PayPay app2app return navigation MUST arrive via a verified HTTPS Universal Link
 * (`https://domain.com/payment/return`) whose domain is explicitly allowlisted by the host — a
 * legacy unverified custom scheme (`goat://`, `alipays://`, or any non-HTTPS scheme claiming to
 * be a payment return) is never trusted, even if it otherwise looks well-formed. This mirrors
 * the OS-level guarantee that an `https://` Universal Link only reaches the app once iOS has
 * verified the domain's `apple-app-site-association` file — the allowlist check here is the
 * app-level half of that contract.
 */
public enum GoatPaymentReturnLinkVerifier {
    public static func extractQueryParam(_ url: URL, name: String) -> String? {
        URLComponents(url: url, resolvingAgainstBaseURL: false)?
            .queryItems?
            .first(where: { $0.name == name })?
            .value
    }

    public static func isValidReturnUrl(_ url: URL, allowedReturnDomains: Set<String>) -> Bool {
        guard !allowedReturnDomains.isEmpty else { return false }
        guard url.scheme?.lowercased() == "https" else { return false }
        guard let host = url.host?.lowercased(), !host.isEmpty else { return false }

        return allowedReturnDomains.contains { rawPattern in
            let pattern = rawPattern.lowercased().trimmingCharacters(in: .whitespaces)
            if pattern.hasPrefix("*.") {
                let suffix = String(pattern.dropFirst(2))
                return host == suffix || host.hasSuffix(".\(suffix)")
            }
            return host == pattern
        }
    }
}
