import Foundation
#if canImport(UIKit)
import UIKit

/**
 * Native match-count overlay UI for Find-in-Page (Task 10184). A minimal, dependency-free
 * floating bar showing "activeIndex/matchCount" with previous/next/close controls, built
 * programmatically to match this codebase's dialog/overlay convention (no Storyboard/XIB).
 */
@MainActor
public final class GoatFindInPageOverlay {
    public var onNext: (() -> Void)?
    public var onPrevious: (() -> Void)?
    public var onClose: (() -> Void)?

    private weak var barView: UIView?
    private weak var countLabel: UILabel?

    public init() {}

    /// Shows (or updates, if already shown) the overlay bar attached to `parent`.
    public func show(in parent: UIView, matchCount: Int, activeMatchIndex: Int) {
        if barView == nil {
            let bar = buildBar()
            parent.addSubview(bar)
            NSLayoutConstraint.activate([
                bar.topAnchor.constraint(equalTo: parent.safeAreaLayoutGuide.topAnchor, constant: 8),
                bar.trailingAnchor.constraint(equalTo: parent.trailingAnchor, constant: -8)
            ])
            barView = bar
        }
        countLabel?.text = matchCount == 0 ? "0/0" : "\(activeMatchIndex)/\(matchCount)"
    }

    /// Removes the overlay from its parent, if attached.
    public func dismiss() {
        barView?.removeFromSuperview()
        barView = nil
        countLabel = nil
    }

    public func isShowing() -> Bool { barView != nil }

    private func buildBar() -> UIView {
        let bar = UIView()
        bar.translatesAutoresizingMaskIntoConstraints = false
        bar.backgroundColor = UIColor.black.withAlphaComponent(0.85)
        bar.layer.cornerRadius = 8
        bar.layer.masksToBounds = true

        let label = UILabel()
        label.textColor = .white
        label.text = "0/0"
        countLabel = label

        let prevButton = UIButton(type: .system)
        prevButton.setTitle("↑", for: .normal)
        prevButton.setTitleColor(.white, for: .normal)
        prevButton.addTarget(self, action: #selector(previousTapped), for: .touchUpInside)

        let nextButton = UIButton(type: .system)
        nextButton.setTitle("↓", for: .normal)
        nextButton.setTitleColor(.white, for: .normal)
        nextButton.addTarget(self, action: #selector(nextTapped), for: .touchUpInside)

        let closeButton = UIButton(type: .system)
        closeButton.setTitle("✕", for: .normal)
        closeButton.setTitleColor(.white, for: .normal)
        closeButton.addTarget(self, action: #selector(closeTapped), for: .touchUpInside)

        let stack = UIStackView(arrangedSubviews: [label, prevButton, nextButton, closeButton])
        stack.axis = .horizontal
        stack.spacing = 12
        stack.translatesAutoresizingMaskIntoConstraints = false
        stack.isLayoutMarginsRelativeArrangement = true
        stack.layoutMargins = UIEdgeInsets(top: 6, left: 12, bottom: 6, right: 12)

        bar.addSubview(stack)
        NSLayoutConstraint.activate([
            stack.topAnchor.constraint(equalTo: bar.topAnchor),
            stack.bottomAnchor.constraint(equalTo: bar.bottomAnchor),
            stack.leadingAnchor.constraint(equalTo: bar.leadingAnchor),
            stack.trailingAnchor.constraint(equalTo: bar.trailingAnchor)
        ])

        return bar
    }

    @objc private func nextTapped() { onNext?() }
    @objc private func previousTapped() { onPrevious?() }
    @objc private func closeTapped() { onClose?() }
}
#endif
