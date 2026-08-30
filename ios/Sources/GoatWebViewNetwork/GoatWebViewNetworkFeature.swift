@_exported import GoatWebView
import Foundation
#if canImport(Network)
import Network
#endif

public enum GoatWebViewNetworkFeature {

    public static let requiredFrameworks: [String] = ["Network"]

    public static var linkedFrameworks: [String] {
        var linked: [String] = []
        #if canImport(Network)
        linked.append("Network")
        #endif
        return linked
    }

    public static var isFullyLinked: Bool {
        Set(linkedFrameworks) == Set(requiredFrameworks)
    }
}
