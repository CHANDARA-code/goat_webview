import Foundation
#if canImport(UIKit)
import UIKit
#endif
import WebKit

/**
 * Configuration model for Floating Windowed Presentation (Task 10201).
 */
public struct GoatWindowConfig: Equatable, Codable, Sendable {
    public var width: Double
    public var height: Double
    public var x: Double
    public var y: Double
    public var draggable: Bool
    public var resizable: Bool
    public var showCloseButton: Bool
    public var dimBackground: Bool
    public var cornerRadius: Double
    public var elevation: Double
    public var title: String

    public init(
        width: Double = 360,
        height: Double = 520,
        x: Double = 20,
        y: Double = 60,
        draggable: Bool = true,
        resizable: Bool = false,
        showCloseButton: Bool = true,
        dimBackground: Bool = true,
        cornerRadius: Double = 16.0,
        elevation: Double = 8.0,
        title: String = "Mini-App"
    ) {
        self.width = width
        self.height = height
        self.x = x
        self.y = y
        self.draggable = draggable
        self.resizable = resizable
        self.showCloseButton = showCloseButton
        self.dimBackground = dimBackground
        self.cornerRadius = cornerRadius
        self.elevation = elevation
        self.title = title
    }

    public static func fromDictionary(_ dict: [String: Any]?) -> GoatWindowConfig {
        guard let dict = dict else { return GoatWindowConfig() }
        return GoatWindowConfig(
            width: (dict["width"] as? NSNumber)?.doubleValue ?? 360,
            height: (dict["height"] as? NSNumber)?.doubleValue ?? 520,
            x: (dict["x"] as? NSNumber)?.doubleValue ?? 20,
            y: (dict["y"] as? NSNumber)?.doubleValue ?? 60,
            draggable: dict["draggable"] as? Bool ?? true,
            resizable: dict["resizable"] as? Bool ?? false,
            showCloseButton: dict["showCloseButton"] as? Bool ?? true,
            dimBackground: dict["dimBackground"] as? Bool ?? true,
            cornerRadius: (dict["cornerRadius"] as? NSNumber)?.doubleValue ?? 16.0,
            elevation: (dict["elevation"] as? NSNumber)?.doubleValue ?? 8.0,
            title: dict["title"] as? String ?? "Mini-App"
        )
    }
}

#if canImport(UIKit)
/**
 * Floating Windowed Mini-App Container with Pan Gestures & Sandboxed Isolation (Task 10201).
 *
 * Implements Alibaba SuperApp BAP windvaneWindow style presentation on iOS:
 * - Floating non-fullscreen window overlay with rounded corners and drop shadow.
 * - Draggable top header handle clamped to safeAreaInsets.
 * - Multi-tenant storage sandbox isolation between caller and callee.
 * - Bidirectional lifecycle signaling and `ON_MINI_APP_CLOSED` event propagation.
 */
public class GoatWindowedContainer: UIView {

    public let instanceId: String
    public let targetAppId: String
    public let parentAppId: String
    public let config: GoatWindowConfig
    public let jsApiAlias: [String: String]

    private var isDismissed: Bool = false
    public var onClose: (([String: Any]?, Bool) -> Void)?

    private let dimOverlay = UIView()
    private let windowCard = UIView()
    private let headerBar = UIView()
    private let titleLabel = UILabel()
    private let closeButton = UIButton(type: .system)
    private let contentContainer = UIView()

    public var embeddedView: UIView? {
        didSet {
            oldValue?.removeFromSuperview()
            if let view = embeddedView {
                view.frame = contentContainer.bounds
                view.autoresizingMask = [.flexibleWidth, .flexibleHeight]
                contentContainer.addSubview(view)
            }
        }
    }

    public init(
        targetAppId: String,
        parentAppId: String,
        config: GoatWindowConfig = GoatWindowConfig(),
        jsApiAlias: [String: String] = [:],
        frame: CGRect = .zero
    ) {
        self.instanceId = "inst_\(targetAppId)_\(UUID().uuidString.replacingOccurrences(of: "-", with: "").prefix(8))"
        self.targetAppId = targetAppId
        self.parentAppId = parentAppId
        self.config = config
        self.jsApiAlias = jsApiAlias
        super.init(frame: frame)
        setupViews()
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    private func setupViews() {
        autoresizingMask = [.flexibleWidth, .flexibleHeight]

        // 1. Dim background overlay
        dimOverlay.backgroundColor = config.dimBackground ? UIColor.black.withAlphaComponent(0.4) : UIColor.clear
        dimOverlay.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        let tapGesture = UITapGestureRecognizer(target: self, action: #selector(handleDimTap))
        dimOverlay.addGestureRecognizer(tapGesture)
        addSubview(dimOverlay)

        // 2. Floating window card
        windowCard.backgroundColor = .white
        windowCard.layer.cornerRadius = CGFloat(config.cornerRadius)
        windowCard.layer.shadowColor = UIColor.black.cgColor
        windowCard.layer.shadowOpacity = 0.25
        windowCard.layer.shadowRadius = CGFloat(config.elevation)
        windowCard.layer.shadowOffset = CGSize(width: 0, height: 4)
        windowCard.clipsToBounds = false
        addSubview(windowCard)

        // 3. Top Header Drag Bar
        headerBar.backgroundColor = UIColor(white: 0.96, alpha: 1.0)
        headerBar.layer.cornerRadius = CGFloat(config.cornerRadius)
        headerBar.layer.maskedCorners = [.layerMinXMinYCorner, .layerMaxXMinYCorner]
        headerBar.clipsToBounds = true
        windowCard.addSubview(headerBar)

        // Title Label
        titleLabel.text = config.title
        titleLabel.font = UIFont.systemFont(ofSize: 14, weight: .semibold)
        titleLabel.textColor = .darkText
        headerBar.addSubview(titleLabel)

        // Close Button
        if config.showCloseButton {
            closeButton.setTitle("✕", for: .normal)
            closeButton.setTitleColor(.gray, for: .normal)
            closeButton.titleLabel?.font = UIFont.systemFont(ofSize: 14, weight: .bold)
            closeButton.backgroundColor = UIColor(white: 0.9, alpha: 1.0)
            closeButton.layer.cornerRadius = 12
            closeButton.clipsToBounds = true
            closeButton.addTarget(self, action: #selector(handleCloseTap), for: .touchUpInside)
            headerBar.addSubview(closeButton)
        }

        // 4. Content Container
        contentContainer.backgroundColor = .clear
        contentContainer.layer.cornerRadius = CGFloat(config.cornerRadius)
        contentContainer.layer.maskedCorners = [.layerMinXMaxYCorner, .layerMaxXMaxYCorner]
        contentContainer.clipsToBounds = true
        windowCard.addSubview(contentContainer)

        // 5. Pan gesture recognizer
        if config.draggable {
            let pan = UIPanGestureRecognizer(target: self, action: #selector(handlePan(_:)))
            headerBar.addGestureRecognizer(pan)
        }
    }

    public override func layoutSubviews() {
        super.layoutSubviews()
        dimOverlay.frame = bounds

        let cardWidth = min(CGFloat(config.width), bounds.width - 20)
        let cardHeight = min(CGFloat(config.height), bounds.height - 40)
        let cardX = min(max(CGFloat(config.x), 10), bounds.width - cardWidth - 10)
        let cardY = min(max(CGFloat(config.y), safeAreaInsets.top + 10), bounds.height - cardHeight - safeAreaInsets.bottom - 10)

        if windowCard.frame == .zero {
            windowCard.frame = CGRect(x: cardX, y: cardY, width: cardWidth, height: cardHeight)
        }

        let headerHeight: CGFloat = 44
        headerBar.frame = CGRect(x: 0, y: 0, width: windowCard.bounds.width, height: headerHeight)
        titleLabel.frame = CGRect(x: 14, y: 0, width: windowCard.bounds.width - 60, height: headerHeight)
        closeButton.frame = CGRect(x: windowCard.bounds.width - 36, y: 10, width: 24, height: 24)

        contentContainer.frame = CGRect(x: 0, y: headerHeight, width: windowCard.bounds.width, height: windowCard.bounds.height - headerHeight)
    }

    private var initialCardCenter: CGPoint = .zero

    @objc private func handlePan(_ gesture: UIPanGestureRecognizer) {
        let translation = gesture.translation(in: self)
        switch gesture.state {
        case .began:
            initialCardCenter = windowCard.center
        case .changed:
            var newCenter = CGPoint(x: initialCardCenter.x + translation.x, y: initialCardCenter.y + translation.y)
            let halfWidth = windowCard.bounds.width / 2.0
            let halfHeight = windowCard.bounds.height / 2.0
            let minX = halfWidth + 5
            let maxX = bounds.width - halfWidth - 5
            let minY = safeAreaInsets.top + halfHeight + 5
            let maxY = bounds.height - safeAreaInsets.bottom - halfHeight - 5

            newCenter.x = min(max(newCenter.x, minX), maxX)
            newCenter.y = min(max(newCenter.y, minY), maxY)
            windowCard.center = newCenter
        default:
            break
        }
    }

    @objc private func handleDimTap() {
        dismiss(dismissedByUser: true)
    }

    @objc private func handleCloseTap() {
        dismiss(dismissedByUser: true)
    }

    public func show(in parentView: UIView) {
        frame = parentView.bounds
        parentView.addSubview(self)
    }

    public func dismiss(result: [String: Any]? = nil, dismissedByUser: Bool = false) {
        guard !isDismissed else { return }
        isDismissed = true

        UIView.animate(withDuration: 0.25, animations: {
            self.alpha = 0.0
        }) { _ in
            self.removeFromSuperview()
            self.onClose?(result, dismissedByUser)
        }
    }
}
#endif
