import SwiftUI

#if canImport(UIKit)
/// SwiftUI wrapper for `GoatView` — provides first-class SwiftUI embedding with
/// full bridge callback forwarding via the Coordinator pattern.
///
/// Usage:
/// ```swift
/// GoatSwiftUIView(appId: "my-app") { action, payload in
///     print("Bridge action:", action, payload)
/// }
/// ```
public struct GoatSwiftUIView: UIViewRepresentable {

    // MARK: - Configuration

    /// The mini-app tenant identifier (scopes storage, cookies, and the virtual `goat://` origin).
    public let appId: String
    /// SPA route appended as a URL fragment on initial load.
    public let initialRoute: String

    // MARK: - Callbacks

    /// Called on the main thread whenever the JS bridge fires an action that is NOT handled
    /// internally by `GoatScriptMessageHandler`. For observability only — native execution
    /// is still handled by `GoatView`'s core dispatcher.
    public var onBridgeMessage: ((_ action: String, _ payload: [String: Any]) -> Void)?
    /// Called on the main thread after each successful page navigation finishes.
    public var onPageLoaded: ((_ url: String) -> Void)?
    /// Called on the main thread when a navigation or WebContent-process error occurs.
    public var onError: ((_ description: String) -> Void)?


    public var onShowToast: ((_ title: String, _ icon: String, _ duration: Int, _ mask: Bool) -> Void)?
    public var onHideToast: (() -> Void)?
    public var onShowModal: ((_ title: String, _ content: String, _ showCancel: Bool, _ cancelText: String, _ confirmText: String) async -> (confirm: Bool, cancel: Bool))?
    public var onShowActionSheet: ((_ itemList: [String]) async -> Int)?
    public var onShowLoading: ((_ title: String, _ mask: Bool) -> Void)?
    public var onHideLoading: (() -> Void)?
    public var onMakePhoneCall: ((_ phoneNumber: String) -> Void)?
    public var onSendSms: ((_ phoneNumber: String, _ body: String) -> Void)?
    public var onScanCode: ((_ payload: [String: Any]) async -> [String: Any])?
    public var onChooseFiles: ((_ payload: [String: Any]) async -> [String: Any])?
    public var onSetNavBarTitle: ((_ title: String, _ subtitle: String?) -> Void)?
    public var onSetNavBarColor: ((_ backgroundColor: String, _ textColor: String, _ isDark: Bool) -> Void)?
    public var onSetNavBarButtons: ((_ left: String?, _ right: [String]) -> Void)?
    public var onSetNavBarProgress: ((_ visible: Bool, _ progress: Double?) -> Void)?
    public var onExpandBottomSheet: (() -> [String: Any])?
    public var onCollapseBottomSheet: (() -> [String: Any])?
    public var onSetSheetSnapPoints: ((_ snapPoints: [Double], _ initialSnap: Double?, _ isDismissible: Bool) -> [String: Any])?
    public var onTabSwitch: ((_ tabId: String) -> Void)?
    public var onTabClose: ((_ tabId: String) -> Void)?
    public var onTabCloseAll: (() -> Void)?
    public var onTabGetActive: (() -> [String: Any]?)?
    public var onTabList: (() -> [[String: Any]])?
    public var onUploadProgress: ((_ uploadId: String, _ bytesSent: Int64, _ totalBytes: Int64) -> Void)?

    // MARK: - Initialiser

    public init(
        appId: String = "default",
        initialRoute: String = "/",
        onBridgeMessage: ((_ action: String, _ payload: [String: Any]) -> Void)? = nil,
        onPageLoaded: ((_ url: String) -> Void)? = nil,
        onError: ((_ description: String) -> Void)? = nil,
        onShowToast: ((_ title: String, _ icon: String, _ duration: Int, _ mask: Bool) -> Void)? = nil,
        onHideToast: (() -> Void)? = nil,
        onShowModal: ((_ title: String, _ content: String, _ showCancel: Bool, _ cancelText: String, _ confirmText: String) async -> (confirm: Bool, cancel: Bool))? = nil,
        onShowActionSheet: ((_ itemList: [String]) async -> Int)? = nil,
        onShowLoading: ((_ title: String, _ mask: Bool) -> Void)? = nil,
        onHideLoading: (() -> Void)? = nil,
        onMakePhoneCall: ((_ phoneNumber: String) -> Void)? = nil,
        onSendSms: ((_ phoneNumber: String, _ body: String) -> Void)? = nil,
        onScanCode: ((_ payload: [String: Any]) async -> [String: Any])? = nil,
        onChooseFiles: ((_ payload: [String: Any]) async -> [String: Any])? = nil,
        onSetNavBarTitle: ((_ title: String, _ subtitle: String?) -> Void)? = nil,
        onSetNavBarColor: ((_ backgroundColor: String, _ textColor: String, _ isDark: Bool) -> Void)? = nil,
        onSetNavBarButtons: ((_ left: String?, _ right: [String]) -> Void)? = nil,
        onSetNavBarProgress: ((_ visible: Bool, _ progress: Double?) -> Void)? = nil,
        onExpandBottomSheet: (() -> [String: Any])? = nil,
        onCollapseBottomSheet: (() -> [String: Any])? = nil,
        onSetSheetSnapPoints: ((_ snapPoints: [Double], _ initialSnap: Double?, _ isDismissible: Bool) -> [String: Any])? = nil,
        onTabSwitch: ((_ tabId: String) -> Void)? = nil,
        onTabClose: ((_ tabId: String) -> Void)? = nil,
        onTabCloseAll: (() -> Void)? = nil,
        onTabGetActive: (() -> [String: Any]?)? = nil,
        onTabList: (() -> [[String: Any]])? = nil,
        onUploadProgress: ((_ uploadId: String, _ bytesSent: Int64, _ totalBytes: Int64) -> Void)? = nil
    ) {
        self.appId = appId
        self.initialRoute = initialRoute
        self.onBridgeMessage = onBridgeMessage
        self.onPageLoaded = onPageLoaded
        self.onError = onError
        self.onShowToast = onShowToast
        self.onHideToast = onHideToast
        self.onShowModal = onShowModal
        self.onShowActionSheet = onShowActionSheet
        self.onShowLoading = onShowLoading
        self.onHideLoading = onHideLoading
        self.onMakePhoneCall = onMakePhoneCall
        self.onSendSms = onSendSms
        self.onScanCode = onScanCode
        self.onChooseFiles = onChooseFiles
        self.onSetNavBarTitle = onSetNavBarTitle
        self.onSetNavBarColor = onSetNavBarColor
        self.onSetNavBarButtons = onSetNavBarButtons
        self.onSetNavBarProgress = onSetNavBarProgress
        self.onExpandBottomSheet = onExpandBottomSheet
        self.onCollapseBottomSheet = onCollapseBottomSheet
        self.onSetSheetSnapPoints = onSetSheetSnapPoints
        self.onTabSwitch = onTabSwitch
        self.onTabClose = onTabClose
        self.onTabCloseAll = onTabCloseAll
        self.onTabGetActive = onTabGetActive
        self.onTabList = onTabList
        self.onUploadProgress = onUploadProgress
    }

    // MARK: - UIViewRepresentable

    public func makeCoordinator() -> Coordinator {
        Coordinator(self)
    }

    public func makeUIView(context: Context) -> GoatView {
        let goatView = GoatView(frame: .zero)
        context.coordinator.configure(goatView)
        goatView.initialize(appId: appId, initialRoute: initialRoute)
        return goatView
    }

    public func updateUIView(_ goatView: GoatView, context: Context) {
        // Keep coordinator in sync with the latest SwiftUI parent snapshot so
        // callbacks always reference the current closures (e.g. after a @State update).
        context.coordinator.parent = self
    }

    public static func dismantleUIView(_ goatView: GoatView, coordinator: Coordinator) {
        goatView.destroy()
    }

    // MARK: - Coordinator

    public final class Coordinator: NSObject {
        var parent: GoatSwiftUIView

        init(_ parent: GoatSwiftUIView) {
            self.parent = parent
        }

        func configure(_ goatView: GoatView) {
            // Forward bridge actions to the SwiftUI callback for observability.
            // The actual native execution is handled by GoatView's core dispatcher.
            goatView.onBridgeMessageNotification = { [weak self] action, payload in
                guard let self else { return }
                let snapshot = self.parent.onBridgeMessage
                DispatchQueue.main.async {
                    snapshot?(action, payload)
                }
            }

            goatView.onPageFinished = { [weak self] url in
                guard let self else { return }
                let snapshot = self.parent.onPageLoaded
                DispatchQueue.main.async {
                    snapshot?(url)
                }
            }

            goatView.onError = { [weak self] description in
                guard let self else { return }
                let snapshot = self.parent.onError
                DispatchQueue.main.async {
                    snapshot?(description)
                }
            }

            goatView.onShowToast = { [weak self] title, icon, duration, mask in
                guard let self else { return }
                let snapshot = self.parent.onShowToast
                DispatchQueue.main.async {
                    snapshot?(title, icon, duration, mask)
                }
            }
            goatView.onHideToast = { [weak self] in
                guard let self else { return }
                let snapshot = self.parent.onHideToast
                DispatchQueue.main.async {
                    snapshot?()
                }
            }
            goatView.onShowModal = { [weak self] title, content, showCancel, cancelText, confirmText in
                guard let self else { return (true, false) }
                let snapshot = await MainActor.run { self.parent.onShowModal }
                guard let snapshot else { return (true, false) }
                return await snapshot(title, content, showCancel, cancelText, confirmText)
            }
            goatView.onShowActionSheet = { [weak self] itemList in
                guard let self else { return 0 }
                let snapshot = await MainActor.run { self.parent.onShowActionSheet }
                guard let snapshot else { return 0 }
                return await snapshot(itemList)
            }
            goatView.onShowLoading = { [weak self] title, mask in
                guard let self else { return }
                let snapshot = self.parent.onShowLoading
                DispatchQueue.main.async {
                    snapshot?(title, mask)
                }
            }
            goatView.onHideLoading = { [weak self] in
                guard let self else { return }
                let snapshot = self.parent.onHideLoading
                DispatchQueue.main.async {
                    snapshot?()
                }
            }
            goatView.onMakePhoneCall = { [weak self] phoneNumber in
                guard let self else { return }
                let snapshot = self.parent.onMakePhoneCall
                DispatchQueue.main.async {
                    snapshot?(phoneNumber)
                }
            }
            goatView.onSendSms = { [weak self] phoneNumber, body in
                guard let self else { return }
                let snapshot = self.parent.onSendSms
                DispatchQueue.main.async {
                    snapshot?(phoneNumber, body)
                }
            }
            goatView.onScanCode = { [weak self] payload in
                guard let self else {
                    return await GoatScannerManager.shared.scanCode(payload: payload)
                }
                let snapshot = await MainActor.run { self.parent.onScanCode }
                guard let snapshot else {
                    return await GoatScannerManager.shared.scanCode(payload: payload)
                }
                return await snapshot(payload)
            }
            goatView.onChooseFiles = { [weak self] payload in
                guard let self else {
                    return ["tempFiles": [], "cancelled": true]
                }
                let snapshot = await MainActor.run { self.parent.onChooseFiles }
                guard let snapshot else {
                    return ["tempFiles": [], "cancelled": true]
                }
                return await snapshot(payload)
            }
            goatView.onSetNavBarTitle = { [weak self] title, subtitle in
                guard let self else { return }
                let snapshot = self.parent.onSetNavBarTitle
                DispatchQueue.main.async {
                    snapshot?(title, subtitle)
                }
            }
            goatView.onSetNavBarColor = { [weak self] bg, text, isDark in
                guard let self else { return }
                let snapshot = self.parent.onSetNavBarColor
                DispatchQueue.main.async {
                    snapshot?(bg, text, isDark)
                }
            }
            goatView.onSetNavBarButtons = { [weak self] left, right in
                guard let self else { return }
                let snapshot = self.parent.onSetNavBarButtons
                DispatchQueue.main.async {
                    snapshot?(left, right)
                }
            }
            goatView.onSetNavBarProgress = { [weak self] visible, progress in
                guard let self else { return }
                let snapshot = self.parent.onSetNavBarProgress
                DispatchQueue.main.async {
                    snapshot?(visible, progress)
                }
            }
            goatView.onExpandBottomSheet = { [weak self] in
                self?.parent.onExpandBottomSheet?() ?? ["success": true, "expanded": true]
            }
            goatView.onCollapseBottomSheet = { [weak self] in
                self?.parent.onCollapseBottomSheet?() ?? ["success": true, "collapsed": true]
            }
            goatView.onSetSheetSnapPoints = { [weak self] snapPoints, initialSnap, isDismissible in
                self?.parent.onSetSheetSnapPoints?(snapPoints, initialSnap, isDismissible) ?? ["success": true]
            }
            goatView.onTabSwitch = { [weak self] tabId in
                self?.parent.onTabSwitch?(tabId)
            }
            goatView.onTabClose = { [weak self] tabId in
                self?.parent.onTabClose?(tabId)
            }
            goatView.onTabCloseAll = { [weak self] in
                self?.parent.onTabCloseAll?()
            }
            goatView.onTabGetActive = { [weak self] in
                self?.parent.onTabGetActive?()
            }
            goatView.onTabList = { [weak self] in
                self?.parent.onTabList?() ?? []
            }
            goatView.onUploadProgress = { [weak self] uploadId, bytesSent, totalBytes in
                self?.parent.onUploadProgress?(uploadId, bytesSent, totalBytes)
            }
        }
    }
}
#endif
