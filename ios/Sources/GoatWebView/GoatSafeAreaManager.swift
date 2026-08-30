import Foundation
import WebKit
#if canImport(UIKit)
import UIKit
#endif

/**
 * Safe-Area Insets Model for iOS Mini-Apps.
 */
public struct GoatSafeAreaInsets: Equatable, Codable, Sendable {
    public var top: Int
    public var bottom: Int
    public var left: Int
    public var right: Int
    public var keyboardHeight: Int

    public var totalBottom: Int {
        return bottom + keyboardHeight
    }

    public init(top: Int = 0, bottom: Int = 0, left: Int = 0, right: Int = 0, keyboardHeight: Int = 0) {
        self.top = top
        self.bottom = bottom
        self.left = left
        self.right = right
        self.keyboardHeight = keyboardHeight
    }
}

/**
 * Safe-Area & Viewport Insets Synchronizer (Milestone 2 / Task 10068 & R2 Insets Subsystem).
 *
 * Tracks window safe-area insets (notch/island, home indicator bar, soft keyboard),
 * and generates CSS injection scripts setting `--safe-area-inset-*`, `--keyboard-inset-bottom`,
 * and `--goat-*` variables on document.documentElement.
 */
public final class GoatSafeAreaManager: @unchecked Sendable {
    public static let shared = GoatSafeAreaManager()

    private var currentInsets: GoatSafeAreaInsets
    private let lock = NSLock()

    public init(initialInsets: GoatSafeAreaInsets = GoatSafeAreaInsets()) {
        self.currentInsets = initialInsets
    }

    /**
     * Updates safe-area insets state.
     */
    @discardableResult
    public func updateSafeArea(top: Int, bottom: Int, left: Int, right: Int, keyboardHeight: Int? = nil) -> GoatSafeAreaInsets {
        lock.lock()
        defer { lock.unlock() }
        let next = GoatSafeAreaInsets(
            top: top,
            bottom: bottom,
            left: left,
            right: right,
            keyboardHeight: keyboardHeight ?? currentInsets.keyboardHeight
        )
        self.currentInsets = next
        return next
    }

    /**
     * Updates software keyboard (IME) height.
     */
    @discardableResult
    public func updateKeyboardHeight(_ height: Int) -> GoatSafeAreaInsets {
        lock.lock()
        defer { lock.unlock() }
        currentInsets.keyboardHeight = height
        return currentInsets
    }

    /**
     * Returns the current insets state.
     */
    public func getInsets() -> GoatSafeAreaInsets {
        lock.lock()
        defer { lock.unlock() }
        return currentInsets
    }

    /**
     * Formats current insets as bridge JSON object.
     */
    public func toJsonObject() -> [String: Any] {
        let insets = getInsets()
        return [
            "top": insets.top,
            "bottom": insets.bottom,
            "left": insets.left,
            "right": insets.right,
            "keyboardHeight": insets.keyboardHeight,
            "totalBottom": insets.totalBottom
        ]
    }

    /**
     * Generates CSS custom properties injection script.
     */
    public func generateCssInjectionScript(insets: GoatSafeAreaInsets? = nil) -> String {
        let ins = insets ?? getInsets()
        return """
        (function() {
            var root = document.documentElement;
            if (!root) return;
            root.style.setProperty('--safe-area-inset-top', '\(ins.top)px');
            root.style.setProperty('--safe-area-inset-bottom', '\(ins.bottom)px');
            root.style.setProperty('--safe-area-inset-left', '\(ins.left)px');
            root.style.setProperty('--safe-area-inset-right', '\(ins.right)px');
            root.style.setProperty('--keyboard-inset-bottom', '\(ins.keyboardHeight)px');
            root.style.setProperty('--goat-safe-area-top', '\(ins.top)px');
            root.style.setProperty('--goat-safe-area-bottom', '\(ins.bottom)px');
            root.style.setProperty('--goat-safe-area-left', '\(ins.left)px');
            root.style.setProperty('--goat-safe-area-right', '\(ins.right)px');
            root.style.setProperty('--goat-keyboard-height', '\(ins.keyboardHeight)px');
        })();
        """
    }

    /**
     * Injects safe-area and keyboard variables into a target WKWebView.
     */
    public func injectCssVariables(into webView: WKWebView, insets: GoatSafeAreaInsets? = nil, completion: ((Any?, Error?) -> Void)? = nil) {
        let script = generateCssInjectionScript(insets: insets)
        DispatchQueue.main.async {
            webView.evaluateJavaScript(script) { result, error in
                completion?(result, error)
            }
        }
    }
}

/**
 * Keyboard Inset Observer for iOS.
 */
public final class GoatKeyboardManager: @unchecked Sendable {
    public static let shared = GoatKeyboardManager()

    public struct KeyboardState: Equatable, Codable, Sendable {
        public var isVisible: Bool
        public var heightPx: Int
        public var durationMs: Int

        public init(isVisible: Bool = false, heightPx: Int = 0, durationMs: Int = 250) {
            self.isVisible = isVisible
            self.heightPx = heightPx
            self.durationMs = durationMs
        }
    }

    private var currentState = KeyboardState()
    private let lock = NSLock()
    public var onKeyboardInsetsChanged: ((KeyboardState) -> Void)?

    public init() {
        #if canImport(UIKit) && os(iOS)
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(keyboardWillShow(_:)),
            name: UIResponder.keyboardWillShowNotification,
            object: nil
        )
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(keyboardWillHide(_:)),
            name: UIResponder.keyboardWillHideNotification,
            object: nil
        )
        #endif
    }

    deinit {
        NotificationCenter.default.removeObserver(self)
    }

    #if canImport(UIKit) && os(iOS)
    @objc private func keyboardWillShow(_ notification: Notification) {
        guard let userInfo = notification.userInfo,
              let keyboardFrame = (userInfo[UIResponder.keyboardFrameEndUserInfoKey] as? NSValue)?.cgRectValue else {
            return
        }
        let duration = (userInfo[UIResponder.keyboardAnimationDurationUserInfoKey] as? NSNumber)?.doubleValue ?? 0.25
        let durationMs = Int(duration * 1000)
        let height = Int(keyboardFrame.height)

        updateState(isVisible: true, heightPx: height, durationMs: durationMs)
    }

    @objc private func keyboardWillHide(_ notification: Notification) {
        let duration = (notification.userInfo?[UIResponder.keyboardAnimationDurationUserInfoKey] as? NSNumber)?.doubleValue ?? 0.25
        let durationMs = Int(duration * 1000)

        updateState(isVisible: false, heightPx: 0, durationMs: durationMs)
    }
    #endif

    public func updateState(isVisible: Bool, heightPx: Int, durationMs: Int = 250) {
        lock.lock()
        currentState = KeyboardState(isVisible: isVisible, heightPx: heightPx, durationMs: durationMs)
        GoatSafeAreaManager.shared.updateKeyboardHeight(heightPx)
        let state = currentState
        lock.unlock()

        onKeyboardInsetsChanged?(state)
    }

    public func getCurrentInsets() -> KeyboardState {
        lock.lock()
        defer { lock.unlock() }
        return currentState
    }

    public func reset() {
        lock.lock()
        currentState = KeyboardState()
        GoatSafeAreaManager.shared.updateKeyboardHeight(0)
        lock.unlock()
    }
}
