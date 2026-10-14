#if os(iOS)
import SwiftUI
#if canImport(UIKit)
import UIKit
#endif

public final class GoatHostUiState: ObservableObject {
    @Published public var toastMessage: String?
    @Published public var modal: GoatHostModal?
    @Published public var actionSheet: GoatHostActionSheet?
    @Published public var isHostLoading: Bool = false

    var modalContinuation: CheckedContinuation<(Bool, Bool), Never>?
    var actionSheetContinuation: CheckedContinuation<Int, Never>?
}

public struct GoatHostModal: Identifiable {
    public let id = UUID()
    public let title: String
    public let content: String
    public let showCancel: Bool
    public let cancelText: String
    public let confirmText: String

    public init(title: String, content: String, showCancel: Bool, cancelText: String, confirmText: String) {
        self.title = title
        self.content = content
        self.showCancel = showCancel
        self.cancelText = cancelText
        self.confirmText = confirmText
    }
}

public struct GoatHostActionSheet: Identifiable {
    public let id = UUID()
    public let items: [String]

    public init(items: [String]) {
        self.items = items
    }
}

/**
 * Sandboxed Mini-App Host Container View for SwiftUI Showcase (Showcase R1 & R2).
 *
 * Embeds `GoatSwiftUIView` with:
 * 1. Dynamic native navigation bar coordination (`GoatNavBarState`)
 * 2. Virtual URL scheme loading (`goat://assets/{appId}/index.html#{route}` and `goat://{appId}/assets/index.html#{route}`)
 * 3. Bidirectional bridge message observability and telemetry forwarding
 * 4. Error recovery and reload actions
 */
public struct GoatShowcaseContainerView: View {

    public let tab: GoatShowcaseTab
    @ObservedObject public var navBarState: GoatNavBarState
    @ObservedObject public var telemetryManager: GoatTelemetryManager
    public var onHostTabSwitch: ((String) -> Void)?

    @StateObject private var hostUi = GoatHostUiState()
    @State private var isLoading: Bool = true
    @State private var loadError: String? = nil
    @State private var currentUrl: String = ""

    public init(
        tab: GoatShowcaseTab,
        navBarState: GoatNavBarState,
        telemetryManager: GoatTelemetryManager = .shared,
        onHostTabSwitch: ((String) -> Void)? = nil
    ) {
        self.tab = tab
        self.navBarState = navBarState
        self.telemetryManager = telemetryManager
        self.onHostTabSwitch = onHostTabSwitch
    }

    public var body: some View {
        ZStack {
            // Dark Background
            Color(red: 0.05, green: 0.07, blue: 0.12).edgesIgnoringSafeArea(.all)

            VStack(spacing: 0) {
                // Embedded Sandboxed Goat WebView
                GoatSwiftUIView(
                    appId: tab.appId,
                    initialRoute: tab.initialRoute,
                    onBridgeMessage: { action, payload in
                        handleBridgeAction(action: action, payload: payload)
                    },
                    onPageLoaded: { url in
                        isLoading = false
                        loadError = nil
                        currentUrl = url
                        navBarState.isProgressVisible = false
                    },
                    onError: { errorDesc in
                        isLoading = false
                        loadError = errorDesc
                        navBarState.isProgressVisible = false
                    },
                    onShowToast: { title, icon, duration, mask in
                        showHostToast(title: title, duration: duration)
                    },
                    onHideToast: {
                        hostUi.toastMessage = nil
                    },
                    onShowModal: { title, content, showCancel, cancelText, confirmText in
                        await presentHostModal(
                            title: title,
                            content: content,
                            showCancel: showCancel,
                            cancelText: cancelText,
                            confirmText: confirmText
                        )
                    },
                    onShowActionSheet: { itemList in
                        await presentHostActionSheet(items: itemList)
                    },
                    onShowLoading: { title, mask in
                        hostUi.isHostLoading = true
                    },
                    onHideLoading: {
                        hostUi.isHostLoading = false
                    },
                    onMakePhoneCall: { phoneNumber in
                        openSystemUrl("tel:\(phoneNumber)")
                    },
                    onSendSms: { phoneNumber, body in
                        openSystemUrl("sms:\(phoneNumber)&body=\(body)")
                    },
                    onScanCode: { payload in
                        await GoatScannerManager.shared.scanCode(payload: payload)
                    },
                    onChooseFiles: { payload in
                        await GoatNativeUiPresenter.shared.chooseFiles(payload: payload)
                    },
                    onSetNavBarTitle: { title, subtitle in
                        navBarState.setTitle(title, subtitle: subtitle)
                    },
                    onSetNavBarColor: { bg, text, isDark in
                        navBarState.setColors(backgroundColorHex: bg, textColorHex: text)
                        navBarState.isDark = isDark
                    },
                    onSetNavBarButtons: { left, right in
                        navBarState.setButtons(
                            left: GoatNavBarButtonType.fromString(left),
                            right: right.map { GoatNavBarButtonType.fromString($0) }
                        )
                    },
                    onSetNavBarProgress: { visible, progress in
                        navBarState.setProgress(visible: visible, progress: progress)
                    },
                    onExpandBottomSheet: {
                        ["success": true, "expanded": true, "currentSnap": 0.9]
                    },
                    onCollapseBottomSheet: {
                        ["success": true, "collapsed": true, "currentSnap": 0.25, "isDismissed": false]
                    },
                    onSetSheetSnapPoints: { snapPoints, initialSnap, isDismissible in
                        ["success": true, "snapPoints": snapPoints, "initialSnap": initialSnap ?? 0.5, "isDismissible": isDismissible]
                    },
                    onTabSwitch: { tabId in
                        onHostTabSwitch?(tabId)
                    },
                    onTabClose: { _ in },
                    onTabCloseAll: {},
                    onTabGetActive: {
                        ["tabId": tab.appId, "appId": tab.appId, "initialRoute": tab.initialRoute, "title": tab.title]
                    },
                    onTabList: {
                        GoatShowcaseTab.allCases.map { showTab in
                            [
                                "tabId": showTab.appId,
                                "appId": showTab.appId,
                                "initialRoute": showTab.initialRoute,
                                "title": showTab.title,
                                "isBackgrounded": showTab.appId != tab.appId
                            ]
                        }
                    }
                )
                .edgesIgnoringSafeArea(.bottom)
            }

            // Loading Indicator
            if isLoading {
                VStack(spacing: 12) {
                    ProgressView()
                        .progressViewStyle(CircularProgressViewStyle(tint: Color(goatHex: tab.themeColorHex)))
                        .scaleEffect(1.2)
                    Text("Loading \(tab.title)...")
                        .font(.system(size: 13, weight: .medium))
                        .foregroundColor(.gray)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(Color(red: 0.05, green: 0.07, blue: 0.12).opacity(0.85))
            }

            // Error Overlay if loading failed
            if let error = loadError {
                VStack(spacing: 16) {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .font(.system(size: 40))
                        .foregroundColor(.orange)

                    Text("Mini-App Load Issue")
                        .font(.system(size: 16, weight: .bold))
                        .foregroundColor(.white)

                    Text(error)
                        .font(.system(size: 12))
                        .foregroundColor(.gray)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 24)

                    Button(action: reloadMiniApp) {
                        HStack(spacing: 6) {
                            Image(systemName: "arrow.clockwise")
                            Text("Retry")
                        }
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundColor(.white)
                        .padding(.horizontal, 16)
                        .padding(.vertical, 8)
                        .background(Color.blue)
                        .cornerRadius(8)
                    }
                }
                .padding(24)
                .background(Color(red: 0.09, green: 0.12, blue: 0.20))
                .cornerRadius(12)
                .shadow(radius: 10)
                .padding(.horizontal, 32)
            }

            if hostUi.isHostLoading {
                VStack(spacing: 10) {
                    ProgressView()
                        .progressViewStyle(CircularProgressViewStyle(tint: .white))
                    Text("Processing...")
                        .font(.system(size: 12, weight: .medium))
                        .foregroundColor(.white)
                }
                .padding(18)
                .background(Color.black.opacity(0.8))
                .cornerRadius(12)
            }

            if let toast = hostUi.toastMessage {
                VStack {
                    Spacer()
                    Text(toast)
                        .font(.system(size: 14, weight: .medium))
                        .foregroundColor(.white)
                        .padding(.horizontal, 18)
                        .padding(.vertical, 10)
                        .background(Color.black.opacity(0.8))
                        .cornerRadius(10)
                        .padding(.bottom, 48)
                }
                .transition(.opacity)
                .allowsHitTesting(false)
            }
        }
        .onAppear {
            configureInitialNavBar()
        }
        .alert(item: $hostUi.modal) { modal in
            var alert = Alert(
                title: Text(modal.title),
                message: Text(modal.content),
                primaryButton: .default(Text(modal.confirmText)) {
                    hostUi.modalContinuation?.resume(returning: (true, false))
                    hostUi.modalContinuation = nil
                },
                secondaryButton: .cancel(Text(modal.cancelText)) {
                    hostUi.modalContinuation?.resume(returning: (false, true))
                    hostUi.modalContinuation = nil
                }
            )
            if !modal.showCancel {
                alert = Alert(title: Text(modal.title), message: Text(modal.content), dismissButton: .default(Text(modal.confirmText)) {
                    hostUi.modalContinuation?.resume(returning: (true, false))
                    hostUi.modalContinuation = nil
                })
            }
            return alert
        }
        .actionSheet(item: $hostUi.actionSheet) { sheet in
            var buttons: [ActionSheet.Button] = sheet.items.enumerated().map { index, item in
                .default(Text(item)) {
                    hostUi.actionSheetContinuation?.resume(returning: index)
                    hostUi.actionSheetContinuation = nil
                }
            }
            buttons.append(.cancel {
                hostUi.actionSheetContinuation?.resume(returning: -1)
                hostUi.actionSheetContinuation = nil
            })
            return ActionSheet(title: Text("Select Action"), buttons: buttons)
        }
    }

    // MARK: - Navigation Bar Coordination

    private func configureInitialNavBar() {
        navBarState.title = tab.title
        navBarState.subtitle = tab.subtitle
        navBarState.backgroundColorHex = "#0F172A"
        navBarState.textColorHex = "#F8FAFC"
        navBarState.leftButton = .back
        navBarState.rightButtons = [.more, .close]
        navBarState.isProgressVisible = false
    }

    private func handleBridgeAction(action: String, payload: [String: Any]) {
        switch action {
        case "SET_NAV_BAR_TITLE":
            if let title = payload["title"] as? String {
                navBarState.title = title
            }
            if let subtitle = payload["subtitle"] as? String {
                navBarState.subtitle = subtitle
            }
        case "SET_NAV_BAR_COLOR":
            if let bg = payload["backgroundColor"] as? String {
                navBarState.backgroundColorHex = bg
            }
            if let text = payload["textColor"] as? String {
                navBarState.textColorHex = text
            }
        case "SET_NAV_BAR_PROGRESS":
            let visible = payload["visible"] as? Bool ?? true
            let prog = (payload["progress"] as? NSNumber)?.doubleValue
            navBarState.setProgress(visible: visible, progress: prog)
        default:
            break
        }
    }

    private func reloadMiniApp() {
        isLoading = true
        loadError = nil
        navBarState.isProgressVisible = true
    }

    private func showHostToast(title: String, duration: Int) {
        hostUi.toastMessage = title
        DispatchQueue.main.asyncAfter(deadline: .now() + .milliseconds(max(duration, 500))) { [weak hostUi] in
            hostUi?.toastMessage = nil
        }
    }

    private func presentHostModal(
        title: String,
        content: String,
        showCancel: Bool,
        cancelText: String,
        confirmText: String
    ) async -> (Bool, Bool) {
        await withCheckedContinuation { continuation in
            hostUi.modalContinuation = continuation
            hostUi.modal = GoatHostModal(
                title: title,
                content: content,
                showCancel: showCancel,
                cancelText: cancelText,
                confirmText: confirmText
            )
        }
    }

    private func presentHostActionSheet(items: [String]) async -> Int {
        await withCheckedContinuation { continuation in
            hostUi.actionSheetContinuation = continuation
            hostUi.actionSheet = GoatHostActionSheet(items: items)
        }
    }

    private func openSystemUrl(_ urlString: String) {
        guard let url = URL(string: urlString.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? urlString) else { return }
        #if canImport(UIKit)
        UIApplication.shared.open(url, options: [:], completionHandler: nil)
        #endif
    }
}

// MARK: - Color Hex Extension Helper

private extension Color {
    init(goatHex: String) {
        if let rgba = try? GoatColorParser.parseHex(goatHex) {
            self.init(red: rgba.r, green: rgba.g, blue: rgba.b, opacity: rgba.a)
        } else {
            self.init(.black)
        }
    }
}
#endif // os(iOS)
