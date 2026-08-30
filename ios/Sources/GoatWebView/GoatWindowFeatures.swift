import Foundation
import WebKit

/**
 * Model representing parsed window features from `window.open()` or `WKWindowFeatures` (Task 10183 / Pillar 1).
 *
 * Propagates geometry and presentation flags to the native `GoatWindowedContainer` modal presentation.
 */
public struct GoatWindowFeatures: Equatable, Codable, Sendable {
    public var width: Double?
    public var height: Double?
    public var x: Double?
    public var y: Double?
    public var menuBar: Bool?
    public var statusBar: Bool?
    public var toolbars: Bool?
    public var resizable: Bool?
    public var scrollbars: Bool?

    public init(
        width: Double? = nil,
        height: Double? = nil,
        x: Double? = nil,
        y: Double? = nil,
        menuBar: Bool? = nil,
        statusBar: Bool? = nil,
        toolbars: Bool? = nil,
        resizable: Bool? = nil,
        scrollbars: Bool? = nil
    ) {
        self.width = width
        self.height = height
        self.x = x
        self.y = y
        self.menuBar = menuBar
        self.statusBar = statusBar
        self.toolbars = toolbars
        self.resizable = resizable
        self.scrollbars = scrollbars
    }

    /**
     * Converts a WebKit `WKWindowFeatures` instance into `GoatWindowFeatures`.
     */
    public static func fromWKWindowFeatures(_ wf: WKWindowFeatures) -> GoatWindowFeatures {
        return GoatWindowFeatures(
            width: wf.width?.doubleValue,
            height: wf.height?.doubleValue,
            x: wf.x?.doubleValue,
            y: wf.y?.doubleValue,
            menuBar: wf.menuBarVisibility?.boolValue,
            statusBar: wf.statusBarVisibility?.boolValue,
            toolbars: wf.toolbarsVisibility?.boolValue,
            resizable: wf.allowsResizing?.boolValue,
            scrollbars: nil
        )
    }

    /**
     * Parses a JavaScript `windowFeatures` comma-separated string (e.g. `"width=400,height=600,resizable=yes"`).
     */
    public static func parse(featureString: String?) -> GoatWindowFeatures {
        guard let featureString = featureString, !featureString.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            return GoatWindowFeatures()
        }

        let pairs = featureString.split(separator: ",").map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
        var width: Double?
        var height: Double?
        var x: Double?
        var y: Double?
        var menuBar: Bool?
        var statusBar: Bool?
        var toolbars: Bool?
        var resizable: Bool?
        var scrollbars: Bool?

        for pair in pairs {
            let kv = pair.split(separator: "=", maxSplits: 1).map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            if kv.isEmpty { continue }
            let key = kv[0].lowercased()
            let value = kv.count > 1 ? kv[1].lowercased() : "yes"

            let isTruthy = (value == "yes" || value == "1" || value == "true")
            let isFalsy = (value == "no" || value == "0" || value == "false")

            switch key {
            case "width", "innerwidth":
                if let val = Double(value), val > 0 {
                    width = val
                }
            case "height", "innerheight":
                if let val = Double(value), val > 0 {
                    height = val
                }
            case "left", "screenx", "x":
                if let val = Double(value) {
                    x = val
                }
            case "top", "screeny", "y":
                if let val = Double(value) {
                    y = val
                }
            case "resizable":
                resizable = isTruthy ? true : (isFalsy ? false : nil)
            case "menubar":
                menuBar = isTruthy ? true : (isFalsy ? false : nil)
            case "status", "statusbar":
                statusBar = isTruthy ? true : (isFalsy ? false : nil)
            case "toolbar", "toolbars":
                toolbars = isTruthy ? true : (isFalsy ? false : nil)
            case "scrollbars":
                scrollbars = isTruthy ? true : (isFalsy ? false : nil)
            default:
                break
            }
        }

        return GoatWindowFeatures(
            width: width,
            height: height,
            x: x,
            y: y,
            menuBar: menuBar,
            statusBar: statusBar,
            toolbars: toolbars,
            resizable: resizable,
            scrollbars: scrollbars
        )
    }

    /**
     * Converts to `GoatWindowConfig` for `GoatWindowedContainer` modal presentation.
     */
    public func toWindowConfig(title: String = "Popup") -> GoatWindowConfig {
        let validWidth = (width != nil && width! > 0) ? width! : 360.0
        let validHeight = (height != nil && height! > 0) ? height! : 520.0
        let validX = x ?? 20.0
        let validY = y ?? 60.0

        return GoatWindowConfig(
            width: validWidth,
            height: validHeight,
            x: validX,
            y: validY,
            draggable: true,
            resizable: resizable ?? false,
            showCloseButton: true,
            dimBackground: true,
            cornerRadius: 16.0,
            elevation: 8.0,
            title: title
        )
    }

    /**
     * Converts `GoatWindowFeatures` into a dictionary for JSON event serialization.
     */
    public func toDictionary() -> [String: Any] {
        var dict: [String: Any] = [:]
        if let width = width { dict["width"] = width }
        if let height = height { dict["height"] = height }
        if let x = x { dict["x"] = x }
        if let y = y { dict["y"] = y }
        if let menuBar = menuBar { dict["menuBar"] = menuBar }
        if let statusBar = statusBar { dict["statusBar"] = statusBar }
        if let toolbars = toolbars { dict["toolbars"] = toolbars }
        if let resizable = resizable { dict["resizable"] = resizable }
        if let scrollbars = scrollbars { dict["scrollbars"] = scrollbars }
        return dict
    }

    /**
     * Parses a dictionary into `GoatWindowFeatures`.
     */
    public static func fromDictionary(_ dict: [String: Any]?) -> GoatWindowFeatures {
        guard let dict = dict else { return GoatWindowFeatures() }
        return GoatWindowFeatures(
            width: (dict["width"] as? NSNumber)?.doubleValue,
            height: (dict["height"] as? NSNumber)?.doubleValue,
            x: (dict["x"] as? NSNumber)?.doubleValue,
            y: (dict["y"] as? NSNumber)?.doubleValue,
            menuBar: dict["menuBar"] as? Bool,
            statusBar: dict["statusBar"] as? Bool,
            toolbars: dict["toolbars"] as? Bool,
            resizable: dict["resizable"] as? Bool,
            scrollbars: dict["scrollbars"] as? Bool
        )
    }
}
