@_exported import GoatWebView
import Foundation
#if canImport(LocalAuthentication)
import LocalAuthentication
#endif
#if canImport(Security)
import Security
#endif

public enum GoatWebViewBiometricsFeature {

    public static let requiredFrameworks: [String] = ["LocalAuthentication", "Security"]

    public static var linkedFrameworks: [String] {
        var linked: [String] = []
        #if canImport(LocalAuthentication)
        linked.append("LocalAuthentication")
        #endif
        #if canImport(Security)
        linked.append("Security")
        #endif
        return linked
    }

    public static var isFullyLinked: Bool {
        Set(linkedFrameworks) == Set(requiredFrameworks)
    }
}
