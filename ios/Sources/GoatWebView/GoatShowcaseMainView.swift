#if os(iOS)
import SwiftUI
#if canImport(UIKit)
import UIKit
#endif

/**
 * SuperApp Host Showcase Main View (Showcase Milestone 2).
 *
 * Standalone modern SwiftUI application hosting:
 * 1. Multi-tab launcher navigating between 4 domain mini-apps + diagnostics console
 * 2. Native navigation bar customization with dynamic titles, colors, and back actions
 * 3. Pre-configured enterprise native manager bindings
 * 4. Embedded floating Developer Debug HUD (R3) with real-time IPC message logging and hardware overrides
 */
public struct GoatShowcaseMainView: View {

    @State private var selectedTab: GoatShowcaseTab = .ecommerce
    @StateObject private var navBarState: GoatNavBarState
    @StateObject private var telemetryManager = GoatTelemetryManager.shared
    @StateObject private var overrideManager = GoatHardwareOverrideManager.shared
    @State private var showMoreMenu: Bool = false

    public init(initialTab: GoatShowcaseTab = .ecommerce) {
        _selectedTab = State(initialValue: initialTab)
        _navBarState = StateObject(wrappedValue: GoatNavBarState(
            title: initialTab.title,
            subtitle: initialTab.subtitle,
            backgroundColorHex: "#0F172A",
            textColorHex: "#F8FAFC",
            leftButton: .back,
            rightButtons: [.more, .close]
        ))
    }

    public var body: some View {
        ZStack {
            Color(red: 0.05, green: 0.07, blue: 0.12).edgesIgnoringSafeArea(.all)

            VStack(spacing: 0) {
                // Top Custom Native Navigation Bar
                GoatNavigationBarView(state: navBarState)
                    .zIndex(10)

                // TabView Mini-App Launcher
                TabView(selection: $selectedTab) {
                    // 1. E-Commerce & Payments
                    GoatShowcaseContainerView(
                        tab: .ecommerce,
                        navBarState: navBarState,
                        telemetryManager: telemetryManager,
                        onHostTabSwitch: { tabId in
                            handleHostTabSwitch(tabId)
                        }
                    )
                    .tabItem {
                        Image(systemName: GoatShowcaseTab.ecommerce.systemImage)
                        Text(GoatShowcaseTab.ecommerce.title)
                    }
                    .tag(GoatShowcaseTab.ecommerce)

                    // 2. IoT & Hardware Dashboard
                    GoatShowcaseContainerView(
                        tab: .iot,
                        navBarState: navBarState,
                        telemetryManager: telemetryManager,
                        onHostTabSwitch: { tabId in
                            handleHostTabSwitch(tabId)
                        }
                    )
                    .tabItem {
                        Image(systemName: GoatShowcaseTab.iot.systemImage)
                        Text(GoatShowcaseTab.iot.title)
                    }
                    .tag(GoatShowcaseTab.iot)

                    // 3. Field Service & Navigation
                    GoatShowcaseContainerView(
                        tab: .fieldservice,
                        navBarState: navBarState,
                        telemetryManager: telemetryManager,
                        onHostTabSwitch: { tabId in
                            handleHostTabSwitch(tabId)
                        }
                    )
                    .tabItem {
                        Image(systemName: GoatShowcaseTab.fieldservice.systemImage)
                        Text(GoatShowcaseTab.fieldservice.title)
                    }
                    .tag(GoatShowcaseTab.fieldservice)

                    // 4. Secure Biometric Vault
                    GoatShowcaseContainerView(
                        tab: .vault,
                        navBarState: navBarState,
                        telemetryManager: telemetryManager,
                        onHostTabSwitch: { tabId in
                            handleHostTabSwitch(tabId)
                        }
                    )
                    .tabItem {
                        Image(systemName: GoatShowcaseTab.vault.systemImage)
                        Text(GoatShowcaseTab.vault.title)
                    }
                    .tag(GoatShowcaseTab.vault)

                    // 5. Diagnostics & Developer Console
                    GoatShowcaseContainerView(
                        tab: .diagnostics,
                        navBarState: navBarState,
                        telemetryManager: telemetryManager,
                        onHostTabSwitch: { tabId in
                            handleHostTabSwitch(tabId)
                        }
                    )
                    .tabItem {
                        Image(systemName: GoatShowcaseTab.diagnostics.systemImage)
                        Text(GoatShowcaseTab.diagnostics.title)
                    }
                    .tag(GoatShowcaseTab.diagnostics)
                }
                .accentColor(Color(goatHex: selectedTab.themeColorHex))
                .onChange(of: selectedTab) { newTab in
                    handleTabChange(to: newTab)
                }
            }

            // Embedded Floating Developer Debug HUD (R3)
            GoatFloatingDebugHUD(
                telemetryManager: telemetryManager,
                overrideManager: overrideManager
            )
            .zIndex(100)
        }
        .onAppear {
            setupNavBarCallbacks()
        }
        .actionSheet(isPresented: $showMoreMenu) {
            ActionSheet(
                title: Text("Mini-App Options"),
                message: Text("Active Tenant: \(selectedTab.appId)"),
                buttons: [
                    .default(Text("Clear Cache & Data")) {
                        clearTenantStorage()
                    },
                    .default(Text("Haptic Feedback Test")) {
                        GoatHapticFeedback.shared.impact(style: .medium)
                    },
                    .cancel()
                ]
            )
        }
    }

    // MARK: - Navigation & Action Handlers

    private func handleTabChange(to tab: GoatShowcaseTab) {
        navBarState.title = tab.title
        navBarState.subtitle = tab.subtitle
        navBarState.backgroundColorHex = "#0F172A"
        navBarState.textColorHex = "#F8FAFC"
        navBarState.isProgressVisible = false
    }

    private func handleHostTabSwitch(_ tabId: String) {
        if let target = GoatShowcaseTab.allCases.first(where: { $0.appId == tabId }) {
            selectedTab = target
        }
    }

    private func setupNavBarCallbacks() {
        navBarState.onButtonClicked = { buttonType in
            switch buttonType {
            case .back:
                GoatHapticFeedback.shared.selection()
            case .close:
                GoatHapticFeedback.shared.impact(style: .light)
            case .more:
                showMoreMenu = true
            case .custom:
                break
            }
        }
    }

    private func clearTenantStorage() {
        Task {
            try? await GoatStorageManager().clear(appId: selectedTab.appId)
            GoatHapticFeedback.shared.notification(type: .success)
        }
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
