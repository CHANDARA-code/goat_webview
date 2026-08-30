import Foundation
#if canImport(UIKit)
import UIKit
#endif

/**
 * Model representing a concurrent tab inside the bottom sheet overlay stack (Task 10194 / Pillar 1).
 */
public struct GoatTabHandle: Identifiable, Equatable, Codable, Sendable {
    public let id: String
    public let appId: String
    public let initialRoute: String
    public let title: String
    public var isBackgrounded: Bool
    public var memoryTrimmed: Bool
    public let createdAt: Date

    public init(
        id: String = UUID().uuidString,
        appId: String,
        initialRoute: String = "/",
        title: String = "Mini-App",
        isBackgrounded: Bool = false,
        memoryTrimmed: Bool = false,
        createdAt: Date = Date()
    ) {
        self.id = id
        self.appId = appId
        self.initialRoute = initialRoute
        self.title = title
        self.isBackgrounded = isBackgrounded
        self.memoryTrimmed = memoryTrimmed
        self.createdAt = createdAt
    }
}

#if canImport(UIKit) && !os(watchOS)
/**
 * Multi-Tab Bottom Sheet WebView Overlay Controller (Task 10194 / Pillar 1).
 *
 * Manages concurrent multi-tenant mini-app sessions in a tabbed bottom sheet container,
 * enforcing per-tenant data store sandboxing, instant tab switching, and automatic
 * RAM trimming (media suspension) on backgrounded tabs.
 */
public final class GoatBottomSheetTabsOverlayController: UIViewController {

    public var maxConcurrentTabs: Int = 5
    public private(set) var tabs: [GoatTabHandle] = []
    public private(set) var tabViews: [String: GoatView] = [:]
    public private(set) var activeTabId: String?

    public var onTabSwitched: ((GoatTabHandle) -> Void)?
    public var onTabClosed: ((String) -> Void)?

    private let containerView = UIView()

    public override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .clear

        containerView.translatesAutoresizingMaskIntoConstraints = false
        containerView.backgroundColor = .clear
        view.addSubview(containerView)

        NSLayoutConstraint.activate([
            containerView.topAnchor.constraint(equalTo: view.topAnchor),
            containerView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            containerView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            containerView.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])

        // Attach any views created prior to view loading
        for (tabId, gv) in tabViews {
            if gv.superview == nil {
                gv.translatesAutoresizingMaskIntoConstraints = false
                containerView.addSubview(gv)
                NSLayoutConstraint.activate([
                    gv.topAnchor.constraint(equalTo: containerView.topAnchor),
                    gv.leadingAnchor.constraint(equalTo: containerView.leadingAnchor),
                    gv.trailingAnchor.constraint(equalTo: containerView.trailingAnchor),
                    gv.bottomAnchor.constraint(equalTo: containerView.bottomAnchor)
                ])
                gv.isHidden = (tabId != activeTabId)
            }
        }
    }

    /**
     * Opens a new tab or brings existing tab forward.
     */
    @discardableResult
    public func openTab(
        appId: String,
        initialRoute: String = "/",
        title: String = "Mini-App",
        config: GoatBottomSheetConfig = GoatBottomSheetConfig()
    ) -> GoatTabHandle {
        // Enforce maximum concurrent tabs limit
        if tabs.count >= maxConcurrentTabs, let oldest = tabs.first {
            closeTab(tabId: oldest.id)
        }

        // Suspend previous active tab if any
        if let currentActiveId = activeTabId, let activeIndex = tabs.firstIndex(where: { $0.id == currentActiveId }) {
            tabs[activeIndex].isBackgrounded = true
            tabs[activeIndex].memoryTrimmed = true
            let oldView = tabViews[currentActiveId]
            oldView?.pause()
            oldView?.isHidden = true
        }

        var tabHandle = GoatTabHandle(
            id: UUID().uuidString,
            appId: appId,
            initialRoute: initialRoute,
            title: title,
            isBackgrounded: false,
            memoryTrimmed: false,
            createdAt: Date()
        )

        let goatView = GoatView(frame: view.bounds)
        goatView.initialize(appId: appId, initialRoute: initialRoute)

        if isViewLoaded {
            goatView.translatesAutoresizingMaskIntoConstraints = false
            containerView.addSubview(goatView)
            NSLayoutConstraint.activate([
                goatView.topAnchor.constraint(equalTo: containerView.topAnchor),
                goatView.leadingAnchor.constraint(equalTo: containerView.leadingAnchor),
                goatView.trailingAnchor.constraint(equalTo: containerView.trailingAnchor),
                goatView.bottomAnchor.constraint(equalTo: containerView.bottomAnchor)
            ])
        }

        tabs.append(tabHandle)
        tabViews[tabHandle.id] = goatView
        activeTabId = tabHandle.id

        goatView.isHidden = false
        goatView.resume()

        onTabSwitched?(tabHandle)
        return tabHandle
    }

    /**
     * Closes a tab, destroying its WebView resources and switching to the nearest remaining tab.
     */
    public func closeTab(tabId: String) {
        guard let index = tabs.firstIndex(where: { $0.id == tabId }) else { return }

        let gv = tabViews.removeValue(forKey: tabId)
        gv?.destroy()
        gv?.removeFromSuperview()

        tabs.remove(at: index)
        onTabClosed?(tabId)

        if activeTabId == tabId {
            if let nextTab = tabs.last {
                switchToTab(tabId: nextTab.id)
            } else {
                activeTabId = nil
            }
        }
    }

    /**
     * Switches the active foreground tab with zero reload.
     */
    public func switchToTab(tabId: String) {
        guard let targetIndex = tabs.firstIndex(where: { $0.id == tabId }) else { return }
        if activeTabId == tabId { return }

        // Suspend previous active tab
        if let currentActiveId = activeTabId, let activeIndex = tabs.firstIndex(where: { $0.id == currentActiveId }) {
            tabs[activeIndex].isBackgrounded = true
            tabs[activeIndex].memoryTrimmed = true
            let oldView = tabViews[currentActiveId]
            oldView?.pause()
            oldView?.isHidden = true
        }

        // Resume target tab
        tabs[targetIndex].isBackgrounded = false
        tabs[targetIndex].memoryTrimmed = false
        activeTabId = tabId

        let targetView = tabViews[tabId]
        targetView?.isHidden = false
        targetView?.resume()

        onTabSwitched?(tabs[targetIndex])
    }

    /**
     * Retrieves the currently active foreground tab handle.
     */
    public func getActiveTab() -> GoatTabHandle? {
        return tabs.first(where: { $0.id == activeTabId })
    }

    /**
     * Retrieves an immutable snapshot list of all open tabs.
     */
    public func getTabs() -> [GoatTabHandle] {
        return tabs
    }

    /**
     * Closes all active tabs and purges the stack.
     */
    public func closeAllTabs() {
        let allIds = tabs.map { $0.id }
        for id in allIds {
            closeTab(tabId: id)
        }
    }
}
#endif
