import Foundation
#if canImport(UIKit)
import UIKit
#endif

/**
 * Native external-link trust-boundary warning interstitial for iOS (Task 10192 / Pillar 1).
 *
 * Before a mini-app-triggered navigation leaves the sandboxed origin for an arbitrary external
 * HTTPS domain, presents a native interstitial warning surfacing the destination domain
 * and requiring explicit user confirmation before proceeding (Telegram UX pattern).
 */
public final class GoatExternalLinkWarningDialog {

    private static let lock = NSLock()
    // Per-session opt-out storage: appId -> Set of trusted hosts
    private static var sessionOptOutDomains: [String: Set<String>] = [:]

    /**
     * Resolves the authority / host component of a URL to prevent spoofing via userinfo or path tricks.
     */
    public static func resolveDestinationHost(url: URL) -> String {
        return url.host?.lowercased() ?? "Unknown Host"
    }

    /**
     * Resolves destination host from a string URL safely.
     */
    public static func resolveDestinationHost(urlString: String) -> String {
        guard let url = URL(string: urlString) else { return "Unknown Host" }
        return resolveDestinationHost(url: url)
    }

    /**
     * Checks if user has opted out of warnings for this domain during the current tenant session.
     */
    public static func isDomainOptedOut(appId: String, host: String) -> Bool {
        lock.lock()
        defer { lock.unlock() }
        let trusted = sessionOptOutDomains[appId] ?? []
        return trusted.contains(host.lowercased())
    }

    /**
     * Remembers opt-out for domain in current tenant session.
     */
    public static func optOutDomainForSession(appId: String, host: String) {
        lock.lock()
        defer { lock.unlock() }
        var set = sessionOptOutDomains[appId] ?? Set<String>()
        set.insert(host.lowercased())
        sessionOptOutDomains[appId] = set
    }

    /**
     * Clears all session opt-outs for a tenant (e.g. when mini-app unmounts).
     */
    public static func clearSessionOptOuts(appId: String) {
        lock.lock()
        defer { lock.unlock() }
        sessionOptOutDomains.removeValue(forKey: appId)
    }

    /**
     * Clears all session opt-outs across all tenants.
     */
    public static func clearAllSessionOptOuts() {
        lock.lock()
        defer { lock.unlock() }
        sessionOptOutDomains.removeAll()
    }

    #if canImport(UIKit) && !os(watchOS)
    /**
     * Shows the external link warning dialog or immediately confirms if domain is already opted out.
     */
    @MainActor
    public static func show(
        from presenter: UIViewController?,
        appId: String,
        url: URL,
        onWarningShown: ((String) -> Void)? = nil,
        onConfirm: @escaping () -> Void,
        onCancel: @escaping () -> Void
    ) {
        let host = resolveDestinationHost(url: url)

        if isDomainOptedOut(appId: appId, host: host) {
            onConfirm()
            return
        }

        onWarningShown?(host)

        guard let presenter = presenter else {
            // In headless/background execution, fallback to confirmation
            onConfirm()
            return
        }

        let alert = UIAlertController(
            title: "External Website Warning",
            message: "You are about to leave the Mini-App and visit an external website:\n\nHost: \(host)\n\nDo you want to continue in your browser?",
            preferredStyle: .alert
        )

        let continueAction = UIAlertAction(title: "Continue", style: .default) { _ in
            onConfirm()
        }

        let cancelAction = UIAlertAction(title: "Cancel", style: .cancel) { _ in
            onCancel()
        }

        alert.addAction(continueAction)
        alert.addAction(cancelAction)

        presenter.present(alert, animated: true, completion: nil)
    }

    /**
     * Directly opens the destination URL in system browser (Safari).
     */
    @MainActor
    public static func openInSystemBrowser(url: URL) {
        UIApplication.shared.open(url, options: [:], completionHandler: nil)
    }
    #else
    public static func openInSystemBrowser(url: URL) {
        // No-op for headless or non-UIKit platforms
    }
    #endif
}
