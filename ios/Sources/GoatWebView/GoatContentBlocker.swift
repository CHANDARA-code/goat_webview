import Foundation
import WebKit

/**
 * Declarative Content Blocker & Subresource Origin Allowlist Enforcer (Task 10205 / Pillar 1).
 *
 * Enforces native-layer defense-in-depth against off-origin subresource loading by compiling
 * a `WKContentRuleList` from `security.allowedDomains` in `manifest.json`.
 */
public enum GoatContentBlocker {

    public static let standardAllowedSchemes = Set(["blob", "data", "about", "goat"])
    public static let defaultAllowedDomains = Set(["appassets.androidplatform.net", "assets"])

    private static let lock = NSLock()
    private static var activeControllers: [String: NSHashTable<WKUserContentController>] = [:]
    public private(set) static var compiledRuleLists: [String: WKContentRuleList] = [:]

    /**
     * Checks whether a compiled rule list is already cached in memory for an appId.
     */
    public static func hasCompiledRuleList(for appId: String) -> Bool {
        lock.lock()
        defer { lock.unlock() }
        let cleanId = appId.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
        return compiledRuleLists[cleanId] != nil
    }

    /**
     * Retrieves the cached compiled rule list for an appId if present.
     */
    public static func getCompiledRuleList(for appId: String) -> WKContentRuleList? {
        lock.lock()
        defer { lock.unlock() }
        let cleanId = appId.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
        return compiledRuleLists[cleanId]
    }

    /**
     * Extracts allowed domains from manifest JSON data.
     */
    public static func parseAllowedDomains(from manifestData: Data) -> [String] {
        guard let json = (try? JSONSerialization.jsonObject(with: manifestData)) as? [String: Any] else {
            return []
        }
        return parseAllowedDomains(from: json)
    }

    /**
     * Extracts allowed domains from a manifest dictionary.
     */
    public static func parseAllowedDomains(from manifestDict: [String: Any]) -> [String] {
        if let security = manifestDict["security"] as? [String: Any],
           let allowed = security["allowedDomains"] as? [String] {
            return allowed
        }
        if let allowed = manifestDict["allowedDomains"] as? [String] {
            return allowed
        }
        return []
    }

    /**
     * Normalizes domain strings (stripping scheme, path, whitespace, lowercase).
     */
    public static func normalizeDomain(_ raw: String) -> String? {
        var trimmed = raw.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.isEmpty { return nil }
        if trimmed.hasPrefix("https://") {
            trimmed = String(trimmed.dropFirst(8))
        } else if trimmed.hasPrefix("http://") {
            trimmed = String(trimmed.dropFirst(7))
        }
        if let slashIndex = trimmed.firstIndex(of: "/") {
            trimmed = String(trimmed[..<slashIndex])
        }
        return trimmed.isEmpty ? nil : trimmed
    }

    /**
     * Evaluates whether a given URL is allowed by the domain allowlist and sandboxed origin.
     */
    public static func isURLAllowed(
        _ url: URL,
        allowedDomains: [String] = [],
        appId: String = "default"
    ) -> Bool {
        let scheme = url.scheme?.lowercased() ?? ""
        if standardAllowedSchemes.contains(scheme) {
            return true
        }

        guard scheme == "http" || scheme == "https" else { return false }

        guard let host = url.host?.lowercased() else { return false }

        let cleanAppId = appId.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
        if host == cleanAppId || defaultAllowedDomains.contains(host) {
            return true
        }

        let normalizedAllowed = allowedDomains.compactMap { normalizeDomain($0) }
        if normalizedAllowed.contains(host) {
            return true
        }

        for pattern in normalizedAllowed {
            if pattern.hasPrefix("*.") {
                let suffix = String(pattern.dropFirst(2))
                if host == suffix || host.hasSuffix(".\(suffix)") {
                    return true
                }
            } else if pattern.hasPrefix(".") {
                let suffix = String(pattern.dropFirst(1))
                if host == suffix || host.hasSuffix(".\(suffix)") {
                    return true
                }
            }
        }

        return false
    }

    /**
     * Generates a WebKit declarative Content Blocker JSON rules string.
     */
    public static func generateRuleListJSON(
        allowedDomains: [String] = [],
        appId: String = "default"
    ) -> String {
        var rules: [[String: Any]] = []

        // 1. Hard block all requests by default
        rules.append([
            "trigger": [
                "url-filter": ".*"
            ],
            "action": [
                "type": "block"
            ]
        ])

        // 2. Allow standard local/sandboxed schemes
        for scheme in standardAllowedSchemes {
            rules.append([
                "trigger": [
                    "url-filter": "^\(scheme):"
                ],
                "action": [
                    "type": "ignore-previous-rules"
                ]
            ])
        }

        // 3. Allow default virtual asset host
        rules.append([
            "trigger": [
                "url-filter": "^https?://([^/]+\\.)?appassets\\.androidplatform\\.net"
            ],
            "action": [
                "type": "ignore-previous-rules"
            ]
        ])

        // 4. Allow explicit domains and wildcard subdomains
        let normalizedAllowed = allowedDomains.compactMap { normalizeDomain($0) }
        for domain in normalizedAllowed where !domain.isEmpty {
            let escapedPattern: String
            if domain.hasPrefix("*.") {
                let base = String(domain.dropFirst(2)).replacingOccurrences(of: ".", with: "\\.")
                escapedPattern = "^https?://([^/]+\\.)?\(base)"
            } else if domain.hasPrefix(".") {
                let base = String(domain.dropFirst(1)).replacingOccurrences(of: ".", with: "\\.")
                escapedPattern = "^https?://([^/]+\\.)?\(base)"
            } else {
                let base = domain.replacingOccurrences(of: ".", with: "\\.")
                escapedPattern = "^https?://\(base)"
            }

            rules.append([
                "trigger": [
                    "url-filter": escapedPattern
                ],
                "action": [
                    "type": "ignore-previous-rules"
                ]
            ])
        }

        guard let data = try? JSONSerialization.data(withJSONObject: rules, options: [.prettyPrinted]),
              let jsonString = String(data: data, encoding: .utf8) else {
            return "[]"
        }
        return jsonString
    }

    /**
     * Compiles a WKContentRuleList asynchronously from domain allowlist.
     */
    public static func compileRuleList(
        identifier: String,
        allowedDomains: [String] = [],
        appId: String = "default",
        store: WKContentRuleListStore? = WKContentRuleListStore.default()
    ) async throws -> WKContentRuleList? {
        guard let store = store else { return nil }
        let jsonString = generateRuleListJSON(allowedDomains: allowedDomains, appId: appId)

        return try await withCheckedThrowingContinuation { continuation in
            store.compileContentRuleList(forIdentifier: identifier, encodedContentRuleList: jsonString) { ruleList, error in
                if let error = error {
                    continuation.resume(throwing: error)
                } else {
                    continuation.resume(returning: ruleList)
                }
            }
        }
    }

    /**
     * Registers a WKUserContentController for dynamic rule updates scoped to an appId.
     */
    public static func register(userContentController: WKUserContentController, for appId: String) {
        lock.lock()
        defer { lock.unlock() }
        let cleanId = appId.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
        if activeControllers[cleanId] == nil {
            activeControllers[cleanId] = NSHashTable<WKUserContentController>.weakObjects()
        }
        activeControllers[cleanId]?.add(userContentController)
        if let currentRuleList = compiledRuleLists[cleanId] {
            userContentController.add(currentRuleList)
        }
    }

    /**
     * Unregisters a WKUserContentController.
     */
    public static func unregister(userContentController: WKUserContentController, for appId: String) {
        lock.lock()
        defer { lock.unlock() }
        let cleanId = appId.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
        activeControllers[cleanId]?.remove(userContentController)
    }

    /**
     * Updates all active WKUserContentController instances for an appId with the new rule list.
     */
    public static func applyRuleList(_ ruleList: WKContentRuleList, for appId: String) {
        lock.lock()
        let cleanId = appId.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
        let previousRuleList = compiledRuleLists[cleanId]
        compiledRuleLists[cleanId] = ruleList
        let controllers = activeControllers[cleanId]?.allObjects ?? []
        lock.unlock()

        DispatchQueue.main.async {
            for controller in controllers {
                if let previous = previousRuleList {
                    controller.remove(previous)
                }
                controller.add(ruleList)
            }
        }
    }

    /**
     * Dynamically compiles and applies updated rules from new manifest data on OTA updates.
     */
    @discardableResult
    public static func recompileAndApply(
        appId: String,
        manifestData: Data,
        store: WKContentRuleListStore? = WKContentRuleListStore.default()
    ) async throws -> WKContentRuleList? {
        let allowed = parseAllowedDomains(from: manifestData)
        let identifier = "goat_content_rules_\(appId)"
        let ruleList = try await compileRuleList(
            identifier: identifier,
            allowedDomains: allowed,
            appId: appId,
            store: store
        )
        if let ruleList = ruleList {
            applyRuleList(ruleList, for: appId)
        }
        return ruleList
    }
}
