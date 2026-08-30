@_exported import GoatWebView
import Foundation
#if canImport(Vision)
import Vision
#endif
#if canImport(AVFoundation)
import AVFoundation
#endif

public enum GoatWebViewScannerFeature {

    public static let requiredFrameworks: [String] = ["Vision", "AVFoundation"]

    public static var linkedFrameworks: [String] {
        var linked: [String] = []
        #if canImport(Vision)
        linked.append("Vision")
        #endif
        #if canImport(AVFoundation)
        linked.append("AVFoundation")
        #endif
        return linked
    }

    public static var isFullyLinked: Bool {
        Set(linkedFrameworks) == Set(requiredFrameworks)
    }
}
