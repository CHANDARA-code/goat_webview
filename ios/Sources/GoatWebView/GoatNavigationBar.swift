import Foundation
#if canImport(UIKit)
import UIKit
#endif
#if canImport(SwiftUI)
import SwiftUI
#endif

/**
 * Navigation Bar Button Type enumeration.
 */
public enum GoatNavBarButtonType: String, CaseIterable, Codable, Sendable {
    case back = "BACK"
    case close = "CLOSE"
    case more = "MORE"
    case custom = "CUSTOM"

    public static func fromString(_ value: String?) -> GoatNavBarButtonType {
        guard let value = value?.trimmingCharacters(in: .whitespacesAndNewlines).uppercased() else {
            return .custom
        }
        return GoatNavBarButtonType(rawValue: value) ?? .custom
    }
}

/**
 * Observable State Model for Goat Navigation Bar.
 */
public final class GoatNavBarState: ObservableObject, @unchecked Sendable {
    @Published public var title: String
    @Published public var subtitle: String?
    @Published public var backgroundColorHex: String
    @Published public var textColorHex: String
    @Published public var isDark: Bool
    @Published public var leftButton: GoatNavBarButtonType?
    @Published public var rightButtons: [GoatNavBarButtonType]
    @Published public var isProgressVisible: Bool
    @Published public var progress: Double? // Normalized 0.0 ... 1.0 or nil for indeterminate

    public var onButtonClicked: ((GoatNavBarButtonType) -> Void)?

    public init(
        title: String = "",
        subtitle: String? = nil,
        backgroundColorHex: String = "#0F172A",
        textColorHex: String = "#F8FAFC",
        isDark: Bool = false,
        leftButton: GoatNavBarButtonType? = .back,
        rightButtons: [GoatNavBarButtonType] = [.more, .close],
        isProgressVisible: Bool = false,
        progress: Double? = nil
    ) {
        self.title = title
        self.subtitle = subtitle
        self.backgroundColorHex = backgroundColorHex
        self.textColorHex = textColorHex
        self.isDark = isDark
        self.leftButton = leftButton
        self.rightButtons = rightButtons
        self.isProgressVisible = isProgressVisible
        self.progress = progress
    }

    public func setProgress(visible: Bool, progress: Double? = nil) {
        self.isProgressVisible = visible
        self.progress = progress
    }

    public func setButtons(left: GoatNavBarButtonType?, right: [GoatNavBarButtonType]) {
        self.leftButton = left
        self.rightButtons = right
    }

    public func setTitle(_ title: String, subtitle: String? = nil) {
        self.title = title
        self.subtitle = subtitle
    }

    public func setColors(backgroundColorHex: String, textColorHex: String) {
        self.backgroundColorHex = backgroundColorHex
        self.textColorHex = textColorHex
    }
}

/**
 * Utility helper for hex color parsing supporting #RGB, #ARGB, #RRGGBB, #AARRGGBB.
 */
public enum GoatColorParser {
    public struct RGBA: Equatable, Sendable {
        public let r: Double
        public let g: Double
        public let b: Double
        public let a: Double

        public init(r: Double, g: Double, b: Double, a: Double = 1.0) {
            self.r = r
            self.g = g
            self.b = b
            self.a = a
        }
    }

    public static func parseHex(_ hexString: String) throws -> RGBA {
        var trimmed = hexString.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.hasPrefix("#") {
            trimmed.removeFirst()
        }
        guard !trimmed.isEmpty else {
            throw GoatBridgeError.invalidPayload("Hex color string cannot be empty")
        }

        let validChars = CharacterSet(charactersIn: "0123456789abcdefABCDEF")
        guard trimmed.unicodeScalars.allSatisfy({ validChars.contains($0) }) else {
            throw GoatBridgeError.invalidPayload("INVALID_ARGUMENT: backgroundColor must be a valid hex string: \(hexString)")
        }

        var rgbValue: UInt64 = 0
        guard Scanner(string: trimmed).scanHexInt64(&rgbValue) else {
            throw GoatBridgeError.invalidPayload("INVALID_ARGUMENT: backgroundColor must be a valid hex string: \(hexString)")
        }

        switch trimmed.count {
        case 3:
            // #RGB -> #RRGGBB
            let r = Double((rgbValue & 0xF00) >> 8) / 15.0
            let g = Double((rgbValue & 0x0F0) >> 4) / 15.0
            let b = Double(rgbValue & 0x00F) / 15.0
            return RGBA(r: r, g: g, b: b, a: 1.0)
        case 4:
            // #ARGB -> #AARRGGBB
            let a = Double((rgbValue & 0xF000) >> 12) / 15.0
            let r = Double((rgbValue & 0x0F00) >> 8) / 15.0
            let g = Double((rgbValue & 0x00F0) >> 4) / 15.0
            let b = Double(rgbValue & 0x000F) / 15.0
            return RGBA(r: r, g: g, b: b, a: a)
        case 6:
            // #RRGGBB
            let r = Double((rgbValue & 0xFF0000) >> 16) / 255.0
            let g = Double((rgbValue & 0x00FF00) >> 8) / 255.0
            let b = Double(rgbValue & 0x0000FF) / 255.0
            return RGBA(r: r, g: g, b: b, a: 1.0)
        case 8:
            // #AARRGGBB
            let a = Double((rgbValue & 0xFF000000) >> 24) / 255.0
            let r = Double((rgbValue & 0x00FF0000) >> 16) / 255.0
            let g = Double((rgbValue & 0x0000FF00) >> 8) / 255.0
            let b = Double(rgbValue & 0x000000FF) / 255.0
            return RGBA(r: r, g: g, b: b, a: a)
        default:
            throw GoatBridgeError.invalidPayload("INVALID_ARGUMENT: backgroundColor must be a valid hex string: \(hexString)")
        }
    }
}

#if canImport(UIKit)
public extension UIColor {
    convenience init(goatHex: String, defaultColor: UIColor = .black) {
        if let rgba = try? GoatColorParser.parseHex(goatHex) {
            self.init(red: CGFloat(rgba.r), green: CGFloat(rgba.g), blue: CGFloat(rgba.b), alpha: CGFloat(rgba.a))
        } else {
            self.init(cgColor: defaultColor.cgColor)
        }
    }
}

/**
 * UIKit Navigation Bar Component for Goat Mini-Apps.
 */
public class GoatNavigationBar: UIView {
    public let state: GoatNavBarState

    private let titleLabel = UILabel()
    private let subtitleLabel = UILabel()
    private let leftButton = UIButton(type: .system)
    private let rightStackView = UIStackView()
    private let progressView = UIProgressView(progressViewStyle: .bar)

    public init(state: GoatNavBarState = GoatNavBarState()) {
        self.state = state
        super.init(frame: .zero)
        setupViews()
        applyState()
    }

    required init?(coder: NSCoder) {
        self.state = GoatNavBarState()
        super.init(coder: coder)
        setupViews()
        applyState()
    }

    private func setupViews() {
        translatesAutoresizingMaskIntoConstraints = false
        heightAnchor.constraint(equalToConstant: 56).isActive = true

        // Left button
        leftButton.translatesAutoresizingMaskIntoConstraints = false
        leftButton.titleLabel?.font = .systemFont(ofSize: 18, weight: .bold)
        leftButton.addTarget(self, action: #selector(handleLeftButtonTap), for: .touchUpInside)
        addSubview(leftButton)

        // Title and Subtitle in vertical stack
        let titleStack = UIStackView(arrangedSubviews: [titleLabel, subtitleLabel])
        titleStack.translatesAutoresizingMaskIntoConstraints = false
        titleStack.axis = .vertical
        titleStack.alignment = .leading
        titleStack.distribution = .fillProportionally

        titleLabel.font = .systemFont(ofSize: 16, weight: .semibold)
        subtitleLabel.font = .systemFont(ofSize: 12, weight: .regular)

        addSubview(titleStack)

        // Right buttons stack
        rightStackView.translatesAutoresizingMaskIntoConstraints = false
        rightStackView.axis = .horizontal
        rightStackView.spacing = 8
        rightStackView.alignment = .center
        addSubview(rightStackView)

        // Progress bar pinned to bottom
        progressView.translatesAutoresizingMaskIntoConstraints = false
        progressView.progressTintColor = UIColor(red: 0.22, green: 0.74, blue: 0.97, alpha: 1.0)
        progressView.trackTintColor = .clear
        addSubview(progressView)

        NSLayoutConstraint.activate([
            leftButton.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 12),
            leftButton.centerYAnchor.constraint(equalTo: centerYAnchor),
            leftButton.widthAnchor.constraint(equalToConstant: 40),
            leftButton.heightAnchor.constraint(equalToConstant: 40),

            titleStack.leadingAnchor.constraint(equalTo: leftButton.trailingAnchor, constant: 8),
            titleStack.trailingAnchor.constraint(equalTo: rightStackView.leadingAnchor, constant: -8),
            titleStack.centerYAnchor.constraint(equalTo: centerYAnchor),

            rightStackView.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -12),
            rightStackView.centerYAnchor.constraint(equalTo: centerYAnchor),

            progressView.leadingAnchor.constraint(equalTo: leadingAnchor),
            progressView.trailingAnchor.constraint(equalTo: trailingAnchor),
            progressView.bottomAnchor.constraint(equalTo: bottomAnchor),
            progressView.heightAnchor.constraint(equalToConstant: 2.5)
        ])
    }

    public func updateState(_ newState: GoatNavBarState) {
        self.state.title = newState.title
        self.state.subtitle = newState.subtitle
        self.state.backgroundColorHex = newState.backgroundColorHex
        self.state.textColorHex = newState.textColorHex
        self.state.isDark = newState.isDark
        self.state.leftButton = newState.leftButton
        self.state.rightButtons = newState.rightButtons
        self.state.isProgressVisible = newState.isProgressVisible
        self.state.progress = newState.progress
        applyState()
    }

    public func setTitle(_ title: String, subtitle: String? = nil) {
        state.title = title
        state.subtitle = subtitle
        applyState()
    }

    public func setColors(backgroundColorHex: String, textColorHex: String, isDark: Bool = false) {
        state.backgroundColorHex = backgroundColorHex
        state.textColorHex = textColorHex
        state.isDark = isDark
        applyState()
    }

    public func setButtons(left: GoatNavBarButtonType?, right: [GoatNavBarButtonType]) {
        state.leftButton = left
        state.rightButtons = right
        applyState()
    }

    public func setProgress(visible: Bool, progress: Double? = nil) {
        state.isProgressVisible = visible
        state.progress = progress
        applyState()
    }

    public func applyState() {
        backgroundColor = UIColor(goatHex: state.backgroundColorHex, defaultColor: .black)
        let textColor = UIColor(goatHex: state.textColorHex, defaultColor: .white)

        titleLabel.text = state.title
        titleLabel.textColor = textColor

        if let subtitle = state.subtitle, !subtitle.isEmpty {
            subtitleLabel.text = subtitle
            subtitleLabel.textColor = textColor.withAlphaComponent(0.7)
            subtitleLabel.isHidden = false
        } else {
            subtitleLabel.isHidden = true
        }

        if let leftBtn = state.leftButton {
            leftButton.isHidden = false
            leftButton.setTitle(buttonSymbol(for: leftBtn), for: .normal)
            leftButton.setTitleColor(textColor, for: .normal)
        } else {
            leftButton.isHidden = true
        }

        // Rebuild right buttons
        rightStackView.arrangedSubviews.forEach { $0.removeFromSuperview() }
        for btnType in state.rightButtons {
            let btn = UIButton(type: .system)
            btn.titleLabel?.font = .systemFont(ofSize: 18, weight: .bold)
            btn.setTitle(buttonSymbol(for: btnType), for: .normal)
            btn.setTitleColor(textColor, for: .normal)
            btn.widthAnchor.constraint(equalToConstant: 36).isActive = true
            btn.heightAnchor.constraint(equalToConstant: 36).isActive = true
            btn.addAction(UIAction { [weak self] _ in
                self?.state.onButtonClicked?(btnType)
            }, for: .touchUpInside)
            rightStackView.addArrangedSubview(btn)
        }

        progressView.isHidden = !state.isProgressVisible
        if let prog = state.progress {
            progressView.setProgress(Float(max(0.0, min(1.0, prog))), animated: true)
        }
    }

    @objc private func handleLeftButtonTap() {
        if let left = state.leftButton {
            state.onButtonClicked?(left)
        }
    }

    private func buttonSymbol(for type: GoatNavBarButtonType) -> String {
        switch type {
        case .back: return "←"
        case .close: return "✕"
        case .more: return "⋮"
        case .custom: return "•"
        }
    }
}
#endif

#if canImport(SwiftUI)
/**
 * SwiftUI Navigation Bar Component for Goat Mini-Apps.
 */
public struct GoatNavigationBarView: View {
    @ObservedObject public var state: GoatNavBarState

    public init(state: GoatNavBarState) {
        self.state = state
    }

    public var body: some View {
        let bgColor = (try? GoatColorParser.parseHex(state.backgroundColorHex)).map {
            Color(red: $0.r, green: $0.g, blue: $0.b, opacity: $0.a)
        } ?? Color.black

        let textColor = (try? GoatColorParser.parseHex(state.textColorHex)).map {
            Color(red: $0.r, green: $0.g, blue: $0.b, opacity: $0.a)
        } ?? Color.white

        VStack(spacing: 0) {
            HStack(spacing: 8) {
                if let left = state.leftButton {
                    Button(action: { state.onButtonClicked?(left) }) {
                        Text(buttonSymbol(for: left))
                            .font(.system(size: 18, weight: .bold))
                            .foregroundColor(textColor)
                            .frame(width: 40, height: 40)
                    }
                } else {
                    Spacer().frame(width: 40)
                }

                VStack(alignment: .leading, spacing: 2) {
                    Text(state.title)
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundColor(textColor)
                        .lineLimit(1)

                    if let subtitle = state.subtitle, !subtitle.isEmpty {
                        Text(subtitle)
                            .font(.system(size: 12))
                            .foregroundColor(textColor.opacity(0.7))
                            .lineLimit(1)
                    }
                }

                Spacer()

                HStack(spacing: 4) {
                    ForEach(state.rightButtons, id: \.self) { btn in
                        Button(action: { state.onButtonClicked?(btn) }) {
                            Text(buttonSymbol(for: btn))
                                .font(.system(size: 18, weight: .bold))
                                .foregroundColor(textColor)
                                .frame(width: 36, height: 36)
                        }
                    }
                }
            }
            .padding(.horizontal, 8)
            .frame(height: 56)

            if state.isProgressVisible {
                if let progress = state.progress {
                    ProgressView(value: progress, total: 1.0)
                        .progressViewStyle(LinearProgressViewStyle(tint: Color(red: 0.22, green: 0.74, blue: 0.97)))
                        .frame(height: 2.5)
                } else {
                    ProgressView()
                        .progressViewStyle(LinearProgressViewStyle(tint: Color(red: 0.22, green: 0.74, blue: 0.97)))
                        .frame(height: 2.5)
                }
            }
        }
        .background(bgColor)
    }

    private func buttonSymbol(for type: GoatNavBarButtonType) -> String {
        switch type {
        case .back: return "←"
        case .close: return "✕"
        case .more: return "⋮"
        case .custom: return "•"
        }
    }
}
#endif
