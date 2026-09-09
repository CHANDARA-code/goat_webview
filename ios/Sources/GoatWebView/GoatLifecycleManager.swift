import Foundation
import WebKit

@objc public enum GoatLifecycleState: Int, CustomStringConvertible {
    case uninitialized = 0
    case launching = 1
    case foregroundActive = 2
    case backgroundPaused = 3
    case terminated = 4

    public var description: String {
        switch self {
        case .uninitialized: return "UNINITIALIZED"
        case .launching: return "LAUNCHING"
        case .foregroundActive: return "FOREGROUND_ACTIVE"
        case .backgroundPaused: return "BACKGROUND_PAUSED"
        case .terminated: return "TERMINATED"
        }
    }
}

@objc public final class GoatLaunchOptions: NSObject {
    @objc public let entryRoute: String
    @objc public let queryParams: [String: String]
    @objc public let referrerInfo: [String: Any]
    @objc public let scene: Int
    @objc public let timestamp: Int64

    @objc public init(
        entryRoute: String = "/",
        queryParams: [String: String] = [:],
        referrerInfo: [String: Any] = [:],
        scene: Int = 1000,
        timestamp: Int64 = Int64(Date().timeIntervalSince1970 * 1000)
    ) {
        self.entryRoute = entryRoute
        self.queryParams = queryParams
        self.referrerInfo = referrerInfo
        self.scene = scene
        self.timestamp = timestamp
        super.init()
    }

    public func toDictionary() -> [String: Any] {
        return [
            "entryRoute": entryRoute,
            "queryParams": queryParams,
            "referrerInfo": referrerInfo,
            "scene": scene,
            "timestamp": timestamp
        ]
    }
}

@objc public protocol GoatLifecycleObserver: AnyObject {
    @objc optional func onStateChanged(from: GoatLifecycleState, to: GoatLifecycleState)
    @objc optional func onEventDispatched(event: String, payload: [String: Any])
}

@objc public final class GoatLifecycleManager: NSObject {
    private let lock = NSLock()
    private var _state: GoatLifecycleState = .uninitialized
    private var observers = NSHashTable<AnyObject>.weakObjects()
    private var eventObservers: [String: [([String: Any]) -> Void]] = [:]

    public var scriptEvaluator: ((String) -> Void)?

    @objc public var state: GoatLifecycleState {
        lock.lock()
        defer { lock.unlock() }
        return _state
    }

    @objc public private(set) var lastLaunchOptions: GoatLaunchOptions?

    @objc public override init() {
        super.init()
    }

    @objc @discardableResult
    public func startLaunch(options: GoatLaunchOptions = GoatLaunchOptions()) -> Bool {
        lock.lock()
        let current = _state
        if current != .uninitialized {
            lock.unlock()
            return false
        }
        lastLaunchOptions = options
        _state = .launching
        lock.unlock()
        notifyStateChanged(from: current, to: .launching)
        return true
    }

    @objc @discardableResult
    public func enterForeground(options: GoatLaunchOptions? = nil) -> Bool {
        lock.lock()
        let current = _state
        if current != .launching && current != .backgroundPaused {
            lock.unlock()
            return false
        }
        if let opts = options {
            lastLaunchOptions = opts
        }
        _state = .foregroundActive
        let activeOpts = lastLaunchOptions ?? GoatLaunchOptions()
        lock.unlock()
        notifyStateChanged(from: current, to: .foregroundActive)
        dispatchAppShow(options: activeOpts)
        return true
    }

    @objc @discardableResult
    public func enterBackground() -> Bool {
        lock.lock()
        let current = _state
        if current != .foregroundActive {
            lock.unlock()
            return false
        }
        _state = .backgroundPaused
        lock.unlock()
        notifyStateChanged(from: current, to: .backgroundPaused)
        dispatchAppHide()
        return true
    }

    @objc @discardableResult
    public func terminate() -> Bool {
        lock.lock()
        let current = _state
        if current == .terminated {
            lock.unlock()
            return false
        }
        _state = .terminated
        lock.unlock()
        notifyStateChanged(from: current, to: .terminated)
        return true
    }

    @objc public func dispatchAppShow(options: GoatLaunchOptions? = nil) {
        let opts = options ?? lastLaunchOptions ?? GoatLaunchOptions()
        let payload = opts.toDictionary()
        dispatchEvent(action: "ON_APP_SHOW", payload: payload)
        dispatchEvent(action: "onAppShow", payload: payload)
    }

    @objc public func dispatchAppHide() {
        let payload: [String: Any] = ["timestamp": Int64(Date().timeIntervalSince1970 * 1000)]
        dispatchEvent(action: "ON_APP_HIDE", payload: payload)
        dispatchEvent(action: "onAppHide", payload: payload)
    }

    @objc public func dispatchPageScroll(scrollTop: Int, scrollLeft: Int, scrollHeight: Int, scrollWidth: Int) {
        let payload: [String: Any] = [
            "scrollTop": scrollTop,
            "scrollLeft": scrollLeft,
            "scrollHeight": scrollHeight,
            "scrollWidth": scrollWidth
        ]
        dispatchEvent(action: "ON_PAGE_SCROLL", payload: payload)
        dispatchEvent(action: "onPageScroll", payload: payload)
    }

    @objc public func dispatchMemoryWarning(level: Int, memoryPressure: String = "warning") {
        let payload: [String: Any] = [
            "level": level,
            "memoryPressure": memoryPressure
        ]
        dispatchEvent(action: "ON_MEMORY_WARNING", payload: payload)
        dispatchEvent(action: "onMemoryWarning", payload: payload)
    }

    @objc public func dispatchWindowResize(width: Int, height: Int, windowWidth: Int, windowHeight: Int, orientation: String) {
        let payload: [String: Any] = [
            "width": width,
            "height": height,
            "windowWidth": windowWidth,
            "windowHeight": windowHeight,
            "orientation": orientation
        ]
        dispatchEvent(action: "ON_WINDOW_RESIZE", payload: payload)
        dispatchEvent(action: "onWindowResize", payload: payload)
    }

    public func dispatchEvent(action: String, payload: [String: Any]) {
        lock.lock()
        let handlers = eventObservers[action] ?? []
        let currentObservers = observers.allObjects
        lock.unlock()

        for handler in handlers {
            handler(payload)
        }

        for obs in currentObservers {
            if let lifecycleObs = obs as? GoatLifecycleObserver {
                lifecycleObs.onEventDispatched?(event: action, payload: payload)
            }
        }

        guard let evaluator = scriptEvaluator else { return }
        guard let jsonData = try? JSONSerialization.data(withJSONObject: payload),
              let jsonStr = String(data: jsonData, encoding: .utf8),
              let actionData = try? JSONSerialization.data(withJSONObject: [action]),
              let actionWrapped = String(data: actionData, encoding: .utf8) else {
            return
        }
        let actionEscaped = String(actionWrapped.dropFirst().dropLast())
        let script = """
        (function() {
            if (window.dispatchEvent) {
                window.dispatchEvent(new CustomEvent('native_call', {
                    detail: { action: \(actionEscaped), payload: \(jsonStr) }
                }));
            }
            if (window.GoatBridge && typeof window.GoatBridge.emit === 'function') {
                window.GoatBridge.emit(\(actionEscaped), \(jsonStr));
            }
        })();
        """
        evaluator(script)
    }

    @objc public func addObserver(_ observer: GoatLifecycleObserver) {
        lock.lock()
        defer { lock.unlock() }
        observers.add(observer)
    }

    @objc public func removeObserver(_ observer: GoatLifecycleObserver) {
        lock.lock()
        defer { lock.unlock() }
        observers.remove(observer)
    }

    public func addEventObserver(for event: String, handler: @escaping ([String: Any]) -> Void) {
        lock.lock()
        defer { lock.unlock() }
        var list = eventObservers[event] ?? []
        list.append(handler)
        eventObservers[event] = list
    }

    public func removeEventObservers(for event: String) {
        lock.lock()
        defer { lock.unlock() }
        eventObservers.removeValue(forKey: event)
    }

    private func notifyStateChanged(from: GoatLifecycleState, to: GoatLifecycleState) {
        lock.lock()
        let currentObservers = observers.allObjects
        lock.unlock()
        for obs in currentObservers {
            if let lifecycleObs = obs as? GoatLifecycleObserver {
                lifecycleObs.onStateChanged?(from: from, to: to)
            }
        }
    }
}

