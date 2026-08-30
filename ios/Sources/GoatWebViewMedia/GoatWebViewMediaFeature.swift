@_exported import GoatWebView
import Foundation
#if canImport(AVFoundation)
import AVFoundation
#endif
#if canImport(MediaPlayer)
import MediaPlayer
#endif

public enum GoatWebViewMediaFeature {

    public static let requiredFrameworks: [String] = ["AVFoundation", "MediaPlayer"]

    public static var linkedFrameworks: [String] {
        var linked: [String] = []
        #if canImport(AVFoundation)
        linked.append("AVFoundation")
        #endif
        #if canImport(MediaPlayer)
        linked.append("MediaPlayer")
        #endif
        return linked
    }

    public static var isFullyLinked: Bool {
        Set(linkedFrameworks) == Set(requiredFrameworks)
    }
}
