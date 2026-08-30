@_exported import GoatWebView
import Foundation
#if canImport(CoreBluetooth)
import CoreBluetooth
#endif
#if canImport(CoreNFC)
import CoreNFC
#endif

public enum GoatWebViewBluetoothFeature {

    public static let requiredFrameworks: [String] = ["CoreBluetooth", "CoreNFC"]

    public static var linkedFrameworks: [String] {
        var linked: [String] = []
        #if canImport(CoreBluetooth)
        linked.append("CoreBluetooth")
        #endif
        #if canImport(CoreNFC)
        linked.append("CoreNFC")
        #endif
        return linked
    }

    public static var isFullyLinked: Bool {
        Set(linkedFrameworks) == Set(requiredFrameworks)
    }
}
