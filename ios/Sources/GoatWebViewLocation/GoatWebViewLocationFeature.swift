@_exported import GoatWebView
import Foundation
#if canImport(CoreLocation)
import CoreLocation
#endif
#if canImport(MapKit)
import MapKit
#endif

public enum GoatWebViewLocationFeature {

    public static let requiredFrameworks: [String] = ["CoreLocation", "MapKit"]

    public static var linkedFrameworks: [String] {
        var linked: [String] = []
        #if canImport(CoreLocation)
        linked.append("CoreLocation")
        #endif
        #if canImport(MapKit)
        linked.append("MapKit")
        #endif
        return linked
    }

    public static var isFullyLinked: Bool {
        Set(linkedFrameworks) == Set(requiredFrameworks)
    }
}
