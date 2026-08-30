import Foundation

/**
 * Encapsulates an intercepted popup or new window creation request (Task 10183 / Pillar 1).
 *
 * Transmitted over bridge events (`ON_POPUP_REQUEST`) and host interception hooks.
 */
public struct GoatPopupRequest: Equatable, Codable, Sendable {
    public let url: URL
    public let target: String
    public let policy: GoatPopupRoutingPolicy
    public let isUserGesture: Bool
    public let isDialog: Bool
    public let windowFeatures: GoatWindowFeatures?

    public init(
        url: URL,
        target: String = "_blank",
        policy: GoatPopupRoutingPolicy = .auto,
        isUserGesture: Bool = true,
        isDialog: Bool = false,
        windowFeatures: GoatWindowFeatures? = nil
    ) {
        self.url = url
        self.target = target
        self.policy = policy
        self.isUserGesture = isUserGesture
        self.isDialog = isDialog
        self.windowFeatures = windowFeatures
    }

    /**
     * Serializes the request model to a dictionary suitable for `GoatEventCoalescer` and JSON IPC bridges.
     */
    public func toDictionary() -> [String: Any] {
        var dict: [String: Any] = [
            "url": url.absoluteString,
            "target": target,
            "policy": policy.rawValue,
            "isUserGesture": isUserGesture,
            "isDialog": isDialog
        ]
        if let wf = windowFeatures {
            dict["windowFeatures"] = wf.toDictionary()
        }
        return dict
    }

    /**
     * Parses a dictionary into a `GoatPopupRequest` instance.
     */
    public static func fromDictionary(_ dict: [String: Any]) -> GoatPopupRequest? {
        guard let urlString = dict["url"] as? String,
              let url = URL(string: urlString) else {
            return nil
        }

        let target = dict["target"] as? String ?? "_blank"
        let policyRaw = dict["policy"] as? String
        let policy = GoatPopupRoutingPolicy(from: policyRaw)
        let isUserGesture = dict["isUserGesture"] as? Bool ?? true
        let isDialog = dict["isDialog"] as? Bool ?? false
        let wfDict = dict["windowFeatures"] as? [String: Any]
        let windowFeatures = wfDict != nil ? GoatWindowFeatures.fromDictionary(wfDict) : nil

        return GoatPopupRequest(
            url: url,
            target: target,
            policy: policy,
            isUserGesture: isUserGesture,
            isDialog: isDialog,
            windowFeatures: windowFeatures
        )
    }
}
