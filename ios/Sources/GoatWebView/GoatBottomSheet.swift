#if os(iOS)
import Foundation
#if canImport(UIKit)
import UIKit
#endif
#if canImport(SwiftUI)
import SwiftUI
#endif

/**
 * Bottom Sheet State Value enumeration.
 */
public enum GoatSheetValue: String, CaseIterable, Codable, Sendable {
    case collapsed = "COLLAPSED"
    case half = "HALF"
    case expanded = "EXPANDED"
    case hidden = "HIDDEN"

    public static func fromSnapFraction(_ fraction: Double, snapPoints: [Double]) -> GoatSheetValue {
        if fraction <= 0.05 { return .hidden }
        let minSnap = snapPoints.first ?? 0.25
        let maxSnap = snapPoints.last ?? 0.9
        if fraction <= minSnap + 0.05 {
            return .collapsed
        } else if fraction >= maxSnap - 0.05 {
            return .expanded
        } else {
            return .half
        }
    }
}

/**
 * Configuration model for Bottom Sheet.
 */
public struct GoatBottomSheetConfig: Equatable, Codable, Sendable {
    public var snapPoints: [Double]
    public var initialSnap: Double
    public var isDismissible: Bool
    public var showDragHandle: Bool
    public var cornerRadius: Double

    public init(
        snapPoints: [Double] = [0.25, 0.5, 0.9],
        initialSnap: Double = 0.5,
        isDismissible: Bool = true,
        showDragHandle: Bool = true,
        cornerRadius: Double = 16.0
    ) {
        let sanitized = Self.sanitizeSnapPoints(snapPoints)
        self.snapPoints = sanitized
        self.initialSnap = min(max(initialSnap, sanitized.first ?? 0.25), sanitized.last ?? 0.9)
        self.isDismissible = isDismissible
        self.showDragHandle = showDragHandle
        self.cornerRadius = cornerRadius
    }

    public static func sanitizeSnapPoints(_ points: [Double]) -> [Double] {
        let valid = points
            .map { min(max($0, 0.1), 1.0) }
            .sorted()
        let unique = Array(NSOrderedSet(array: valid)).compactMap { $0 as? Double }
        return unique.isEmpty ? [0.25, 0.5, 0.9] : unique
    }
}

/**
 * State container for Bottom Sheet.
 */
public struct GoatBottomSheetState: Equatable, Codable, Sendable {
    public var snapPoints: [Double]
    public var currentSnap: Double
    public var isDismissible: Bool
    public var sheetValue: GoatSheetValue

    public init(
        snapPoints: [Double] = [0.25, 0.5, 0.9],
        currentSnap: Double = 0.5,
        isDismissible: Bool = true,
        sheetValue: GoatSheetValue = .half
    ) {
        let sanitized = GoatBottomSheetConfig.sanitizeSnapPoints(snapPoints)
        self.snapPoints = sanitized
        self.currentSnap = min(max(currentSnap, sanitized.first ?? 0.25), sanitized.last ?? 0.9)
        self.isDismissible = isDismissible
        self.sheetValue = sheetValue
    }

    /**
     * Calculates the next higher snap point.
     */
    public mutating func expand() -> Double {
        if let next = snapPoints.first(where: { $0 > currentSnap + 0.02 }) {
            currentSnap = next
        } else if let last = snapPoints.last {
            currentSnap = last
        }
        sheetValue = GoatSheetValue.fromSnapFraction(currentSnap, snapPoints: snapPoints)
        return currentSnap
    }

    /**
     * Calculates the next lower snap point or dismisses.
     */
    public mutating func collapse() -> (snap: Double, isDismissed: Bool) {
        if let prev = snapPoints.reversed().first(where: { $0 < currentSnap - 0.02 }) {
            currentSnap = prev
            sheetValue = GoatSheetValue.fromSnapFraction(currentSnap, snapPoints: snapPoints)
            return (currentSnap, false)
        } else {
            if isDismissible {
                currentSnap = 0.0
                sheetValue = .hidden
                return (0.0, true)
            } else {
                currentSnap = snapPoints.first ?? 0.25
                sheetValue = .collapsed
                return (currentSnap, false)
            }
        }
    }
}

#if canImport(UIKit) && os(iOS)
/**
 * UIKit Modal Bottom Sheet Controller.
 */
public class GoatBottomSheetController: UIViewController, UIGestureRecognizerDelegate {
    public var config: GoatBottomSheetConfig
    public private(set) var state: GoatBottomSheetState

    public var onSnapChanged: ((Double, GoatSheetValue) -> Void)?
    public var onDismissed: (() -> Void)?

    private let contentView: UIView
    private let dragHandle = UIView()
    private var containerHeightConstraint: NSLayoutConstraint?

    public init(contentView: UIView, config: GoatBottomSheetConfig = GoatBottomSheetConfig()) {
        self.contentView = contentView
        self.config = config
        self.state = GoatBottomSheetState(
            snapPoints: config.snapPoints,
            currentSnap: config.initialSnap,
            isDismissible: config.isDismissible,
            sheetValue: GoatSheetValue.fromSnapFraction(config.initialSnap, snapPoints: config.snapPoints)
        )
        super.init(nibName: nil, bundle: nil)
        modalPresentationStyle = .overFullScreen
        modalTransitionStyle = .crossDissolve
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    public override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor.black.withAlphaComponent(0.4)

        let sheetView = UIView()
        sheetView.translatesAutoresizingMaskIntoConstraints = false
        sheetView.backgroundColor = UIColor(goatHex: "#0F172A", defaultColor: .black)
        sheetView.layer.cornerRadius = CGFloat(config.cornerRadius)
        sheetView.layer.maskedCorners = [.layerMinXMinYCorner, .layerMaxXMinYCorner]
        sheetView.clipsToBounds = true
        view.addSubview(sheetView)

        if config.showDragHandle {
            dragHandle.translatesAutoresizingMaskIntoConstraints = false
            dragHandle.backgroundColor = UIColor.white.withAlphaComponent(0.3)
            dragHandle.layer.cornerRadius = 2
            sheetView.addSubview(dragHandle)

            NSLayoutConstraint.activate([
                dragHandle.topAnchor.constraint(equalTo: sheetView.topAnchor, constant: 10),
                dragHandle.centerXAnchor.constraint(equalTo: sheetView.centerXAnchor),
                dragHandle.widthAnchor.constraint(equalToConstant: 36),
                dragHandle.heightAnchor.constraint(equalToConstant: 4)
            ])
        }

        contentView.translatesAutoresizingMaskIntoConstraints = false
        sheetView.addSubview(contentView)

        let heightConstraint = sheetView.heightAnchor.constraint(equalTo: view.heightAnchor, multiplier: CGFloat(state.currentSnap))
        self.containerHeightConstraint = heightConstraint

        NSLayoutConstraint.activate([
            sheetView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            sheetView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            sheetView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            heightConstraint,

            contentView.leadingAnchor.constraint(equalTo: sheetView.leadingAnchor),
            contentView.trailingAnchor.constraint(equalTo: sheetView.trailingAnchor),
            contentView.topAnchor.constraint(equalTo: config.showDragHandle ? dragHandle.bottomAnchor : sheetView.topAnchor, constant: 10),
            contentView.bottomAnchor.constraint(equalTo: sheetView.bottomAnchor)
        ])

        let panGesture = UIPanGestureRecognizer(target: self, action: #selector(handlePan(_:)))
        panGesture.delegate = self
        sheetView.addGestureRecognizer(panGesture)
    }

    public func setSnapPoints(_ points: [Double], initialSnap: Double? = nil, isDismissible: Bool = true) {
        let sanitized = GoatBottomSheetConfig.sanitizeSnapPoints(points)
        let initial = min(max(initialSnap ?? sanitized.first ?? 0.25, sanitized.first ?? 0.25), sanitized.last ?? 0.9)
        self.config = GoatBottomSheetConfig(snapPoints: sanitized, initialSnap: initial, isDismissible: isDismissible)
        self.state = GoatBottomSheetState(
            snapPoints: sanitized,
            currentSnap: initial,
            isDismissible: isDismissible,
            sheetValue: GoatSheetValue.fromSnapFraction(initial, snapPoints: sanitized)
        )
        updateSheetHeight(animated: true)
    }

    public func expand() -> Double {
        let next = state.expand()
        updateSheetHeight(animated: true)
        return next
    }

    public func collapse() -> (snap: Double, isDismissed: Bool) {
        let result = state.collapse()
        if result.isDismissed {
            dismiss(animated: true) { [weak self] in
                self?.onDismissed?()
            }
        } else {
            updateSheetHeight(animated: true)
        }
        return result
    }

    private func updateSheetHeight(animated: Bool) {
        guard let heightConstraint = containerHeightConstraint else { return }
        heightConstraint.isActive = false
        let newConstraint = heightConstraint.firstItem as! UIView
        let updated = newConstraint.heightAnchor.constraint(equalTo: view.heightAnchor, multiplier: CGFloat(state.currentSnap))
        updated.isActive = true
        self.containerHeightConstraint = updated

        if animated {
            UIView.animate(withDuration: 0.3, delay: 0, usingSpringWithDamping: 0.8, initialSpringVelocity: 0, options: .curveEaseInOut) {
                self.view.layoutIfNeeded()
            }
        } else {
            view.layoutIfNeeded()
        }
        onSnapChanged?(state.currentSnap, state.sheetValue)
    }

    @objc private func handlePan(_ gesture: UIPanGestureRecognizer) {
        let translation = gesture.translation(in: view)
        let viewHeight = view.bounds.height
        guard viewHeight > 0 else { return }

        switch gesture.state {
        case .changed:
            let deltaFraction = -Double(translation.y) / Double(viewHeight)
            let newSnap = min(max(state.currentSnap + deltaFraction, config.isDismissible ? 0.0 : state.snapPoints.first ?? 0.25), state.snapPoints.last ?? 0.9)
            state.currentSnap = newSnap
            updateSheetHeight(animated: false)
            gesture.setTranslation(.zero, in: view)
        case .ended, .cancelled:
            if config.isDismissible && state.currentSnap < (state.snapPoints.first ?? 0.25) * 0.7 {
                dismiss(animated: true) { [weak self] in
                    self?.onDismissed?()
                }
            } else {
                let closest = state.snapPoints.min(by: { abs($0 - state.currentSnap) < abs($1 - state.currentSnap) }) ?? 0.5
                state.currentSnap = closest
                state.sheetValue = GoatSheetValue.fromSnapFraction(closest, snapPoints: state.snapPoints)
                updateSheetHeight(animated: true)
            }
        default:
            break
        }
    }

    public func gestureRecognizer(_ gestureRecognizer: UIGestureRecognizer, shouldRecognizeSimultaneouslyWith otherGestureRecognizer: UIGestureRecognizer) -> Bool {
        return true
    }
}
#endif

#if canImport(SwiftUI)
/**
 * SwiftUI Bottom Sheet Container.
 */
public struct GoatBottomSheetView<Content: View>: View {
    public var config: GoatBottomSheetConfig
    @Binding public var currentSnap: Double
    @Binding public var isPresented: Bool
    public let content: Content

    public init(
        config: GoatBottomSheetConfig = GoatBottomSheetConfig(),
        currentSnap: Binding<Double>,
        isPresented: Binding<Bool>,
        @ViewBuilder content: () -> Content
    ) {
        self.config = config
        self._currentSnap = currentSnap
        self._isPresented = isPresented
        self.content = content()
    }

    public var body: some View {
        GeometryReader { geometry in
            ZStack(alignment: .bottom) {
                if isPresented {
                    Color.black.opacity(0.4)
                        .ignoresSafeArea()
                        .onTapGesture {
                            if config.isDismissible {
                                isPresented = false
                            }
                        }

                    VStack(spacing: 0) {
                        if config.showDragHandle {
                            RoundedRectangle(cornerRadius: 2)
                                .fill(Color.white.opacity(0.3))
                                .frame(width: 36, height: 4)
                                .padding(.vertical, 10)
                        }

                        content
                    }
                    .frame(height: geometry.size.height * CGFloat(currentSnap))
                    .frame(maxWidth: .infinity)
                    .background(Color(red: 0.06, green: 0.09, blue: 0.16))
                    .cornerRadius(CGFloat(config.cornerRadius), corners: [.topLeft, .topRight])
                    .transition(.move(edge: .bottom))
                }
            }
        }
    }
}

#if canImport(UIKit)
internal extension View {
    func cornerRadius(_ radius: CGFloat, corners: UIRectCorner) -> some View {
        clipShape(RoundedCornerShape(radius: radius, corners: corners))
    }
}

internal struct RoundedCornerShape: Shape {
    var radius: CGFloat = .infinity
    var corners: UIRectCorner = .allCorners

    func path(in rect: CGRect) -> Path {
        let path = UIBezierPath(
            roundedRect: rect,
            byRoundingCorners: corners,
            cornerRadii: CGSize(width: radius, height: radius)
        )
        return Path(path.cgPath)
    }
}
#endif
#endif
#endif // os(iOS)
