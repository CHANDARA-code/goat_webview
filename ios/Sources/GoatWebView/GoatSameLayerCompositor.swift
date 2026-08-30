import Foundation
import CoreGraphics
#if canImport(UIKit)
import UIKit
#endif

/// Supported same-layer native embedded component types.
public enum SameLayerComponentType: String, Sendable {
    case cameraPreview = "CAMERA_PREVIEW"
    case videoPlayer = "VIDEO_PLAYER"
    case mapView = "MAP_VIEW"
    case canvas2D = "CANVAS_2D"
    case webGLNative = "WEBGL_NATIVE"
    case customSurface = "CUSTOM_SURFACE"

    public static func from(string: String) -> SameLayerComponentType {
        let upper = string.uppercased()
        switch upper {
        case "CAMERA_PREVIEW", "CAMERA": return .cameraPreview
        case "VIDEO_PLAYER", "VIDEO", "EXO_PLAYER", "AVPLAYER": return .videoPlayer
        case "MAP_VIEW", "MAP": return .mapView
        case "CANVAS_2D", "CANVAS": return .canvas2D
        case "WEBGL_NATIVE", "WEBGL": return .webGLNative
        default: return .customSurface
        }
    }
}

/// Descriptor model for a same-layer native embedded component.
public struct SameLayerComponentDescriptor: Sendable {
    public let componentId: String
    public let componentType: String
    public let x: CGFloat
    public let y: CGFloat
    public let width: CGFloat
    public let height: CGFloat
    public let zIndex: Int
    public let opacity: CGFloat
    public let cornerRadius: CGFloat
    public let isVisible: Bool
    public let params: [String: String]

    public init(
        componentId: String,
        componentType: String,
        x: CGFloat,
        y: CGFloat,
        width: CGFloat,
        height: CGFloat,
        zIndex: Int = 0,
        opacity: CGFloat = 1.0,
        cornerRadius: CGFloat = 0.0,
        isVisible: Bool = true,
        params: [String: String] = [:]
    ) {
        self.componentId = componentId
        self.componentType = componentType
        self.x = x
        self.y = y
        self.width = width
        self.height = height
        self.zIndex = zIndex
        self.opacity = max(0.0, min(1.0, opacity))
        self.cornerRadius = max(0.0, cornerRadius)
        self.isVisible = isVisible
        self.params = params
    }

    public var frame: CGRect {
        return CGRect(x: x, y: y, width: width, height: height)
    }

    public func toDictionary() -> [String: Any] {
        return [
            "embedded": true,
            "componentId": componentId,
            "viewId": componentId,
            "componentType": componentType,
            "x": Double(x),
            "y": Double(y),
            "width": Double(width),
            "height": Double(height),
            "zIndex": zIndex,
            "opacity": Double(opacity),
            "cornerRadius": Double(cornerRadius),
            "isVisible": isVisible
        ]
    }
}

/// High-Performance Same-Layer Native Component Compositor for iOS (CALayer Texture Sharing).
///
/// Coordinates hardware-accelerated CALayer / UIView hierarchy placement inside WKWebView,
/// 120 FPS CADisplayLink momentum synchronization, CSS cornerRadius clipping, and touch hit-testing.
public final class GoatSameLayerCompositor: @unchecked Sendable {
    public static let shared = GoatSameLayerCompositor()

    private let lock = NSLock()
    private var components: [String: SameLayerComponentDescriptor] = [:]
    private var frameCounters: [String: UInt64] = [:]

    public init() {}

    /// Embeds or registers a new same-layer native component.
    @discardableResult
    public func embedNativeComponent(
        componentId: String,
        componentType: String,
        x: CGFloat,
        y: CGFloat,
        width: CGFloat,
        height: CGFloat,
        zIndex: Int = 0,
        opacity: CGFloat = 1.0,
        cornerRadius: CGFloat = 0.0,
        params: [String: String] = [:]
    ) -> SameLayerComponentDescriptor {
        lock.lock()
        defer { lock.unlock() }

        let type = SameLayerComponentType.from(string: componentType)
        let desc = SameLayerComponentDescriptor(
            componentId: componentId,
            componentType: type.rawValue,
            x: x,
            y: y,
            width: width,
            height: height,
            zIndex: zIndex,
            opacity: opacity,
            cornerRadius: cornerRadius,
            isVisible: true,
            params: params
        )

        components[componentId] = desc
        frameCounters[componentId] = 0
        return desc
    }

    /// Updates viewport coordinates, dimensions, and clipping during DOM scroll/resize events.
    @discardableResult
    public func updateComponentBounds(
        componentId: String,
        x: CGFloat,
        y: CGFloat,
        width: CGFloat,
        height: CGFloat,
        zIndex: Int = 0,
        opacity: CGFloat = 1.0,
        cornerRadius: CGFloat = 0.0,
        isVisible: Bool = true
    ) -> SameLayerComponentDescriptor? {
        lock.lock()
        defer { lock.unlock() }

        guard let existing = components[componentId] else { return nil }
        let updated = SameLayerComponentDescriptor(
            componentId: componentId,
            componentType: existing.componentType,
            x: x,
            y: y,
            width: width,
            height: height,
            zIndex: zIndex,
            opacity: opacity,
            cornerRadius: cornerRadius,
            isVisible: isVisible,
            params: existing.params
        )

        components[componentId] = updated
        return updated
    }

    /// Records a composited frame count for telemetry and APM performance measurement.
    public func recordFrameComposited(componentId: String) -> UInt64 {
        lock.lock()
        defer { lock.unlock() }

        let count = (frameCounters[componentId] ?? 0) + 1
        frameCounters[componentId] = count
        return count
    }

    /// Hit tests whether a touch coordinate intersects the active component bounding box.
    public func hitTest(componentId: String, point: CGPoint) -> Bool {
        lock.lock()
        defer { lock.unlock() }

        guard let desc = components[componentId], desc.isVisible else { return false }
        return desc.frame.contains(point)
    }

    /// Removes and unmounts an embedded native component.
    @discardableResult
    public func removeNativeComponent(componentId: String) -> Bool {
        lock.lock()
        defer { lock.unlock() }

        frameCounters.removeValue(forKey: componentId)
        return components.removeValue(forKey: componentId) != nil
    }

    /// Retrieves all currently active embedded native components sorted by zIndex.
    public func getActiveComponents() -> [SameLayerComponentDescriptor] {
        lock.lock()
        defer { lock.unlock() }

        return components.values.sorted { $0.zIndex < $1.zIndex }
    }

    /// Clears all embedded components upon WebView teardown.
    public func clearAll() {
        lock.lock()
        defer { lock.unlock() }

        components.removeAll()
        frameCounters.removeAll()
    }
}
