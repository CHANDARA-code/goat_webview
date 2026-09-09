#if canImport(SwiftUI) && os(iOS)
import SwiftUI

/**
 * Slide-to-confirm control.
 *
 * All authorisation logic lives in `Web3ConfirmGate`, a plain class with its own unit tests; this
 * view only turns drag gestures into `onDrag`/`onRelease` calls. Keeping the decision out of the
 * view is what makes "a release below 100% cancels" testable without a UI test.
 */
@available(iOS 15.0, *)
public struct SlideToConfirmView: View {

    private let gate: Web3ConfirmGate
    private let enabled: Bool
    private let label: String
    private let onConfirmed: () -> Void

    @State private var progress: Double = 0

    public init(
        gate: Web3ConfirmGate,
        enabled: Bool = true,
        label: String = "Slide to confirm",
        onConfirmed: @escaping () -> Void
    ) {
        self.gate = gate
        self.enabled = enabled
        self.label = label
        self.onConfirmed = onConfirmed
    }

    public var body: some View {
        GeometryReader { geometry in
            let thumb: CGFloat = 56
            let track = max(geometry.size.width - thumb, 1)

            ZStack(alignment: .leading) {
                RoundedRectangle(cornerRadius: 32)
                    .fill(enabled ? Color.accentColor.opacity(0.15) : Color.gray.opacity(0.15))

                Text(enabled ? label : "Acknowledge the warning to continue")
                    .font(.callout)
                    .frame(maxWidth: .infinity)

                Circle()
                    .fill(enabled ? Color.accentColor : Color.gray)
                    .frame(width: thumb, height: thumb)
                    .offset(x: CGFloat(progress) * track)
                    .gesture(
                        DragGesture(minimumDistance: 1)
                            .onChanged { value in
                                guard enabled else { return }
                                let next = min(max(value.translation.width / track, 0), 1)
                                switch gate.onDrag(Double(next)) {
                                case .confirmed:
                                    progress = 1
                                    onConfirmed()
                                case .sliding:
                                    progress = gate.progress
                                default:
                                    progress = 0
                                }
                            }
                            .onEnded { _ in
                                guard enabled else { return }
                                if gate.outcome != .confirmed {
                                    gate.onRelease()
                                    progress = 0
                                }
                            }
                    )
            }
        }
        .frame(height: 64)
    }
}

/**
 * The native transaction confirmation sheet.
 *
 * Everything shown comes from `DecodedTransactionPreview`, which native produced by decoding the
 * actual payload — never from what the page claims about itself. That is the defence against
 * threat A2: a mini-app can render one amount in its DOM while submitting another.
 *
 * Present this inside the dedicated window `Web3ConfirmWindowGuard` configures, so an in-app view
 * cannot sit over the confirm control.
 */
@available(iOS 15.0, *)
public struct Web3ConfirmModal: View {

    private let preview: DecodedTransactionPreview
    private let gate: Web3ConfirmGate
    private let screenCaptureDetected: Bool
    private let onConfirm: () -> Void
    private let onCancel: () -> Void

    @State private var acknowledged = false

    public init(
        preview: DecodedTransactionPreview,
        gate: Web3ConfirmGate,
        screenCaptureDetected: Bool = false,
        onConfirm: @escaping () -> Void,
        onCancel: @escaping () -> Void
    ) {
        self.preview = preview
        self.gate = gate
        self.screenCaptureDetected = screenCaptureDetected
        self.onConfirm = onConfirm
        self.onCancel = onCancel
    }

    public var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                Text(preview.networkName)
                    .font(.caption)
                    .foregroundColor(.secondary)
                Text(preview.methodName)
                    .font(.title2.weight(.semibold))
                Text(preview.methodDescription)
                    .font(.subheadline)

                detailRow("Amount", preview.valueFormatted)
                detailRow("To", preview.recipient)
                if let domain = preview.recipientDomain { detailRow("Domain", domain) }
                detailRow("Network fee", preview.feeFormatted)

                if preview.isPermit2Unlimited {
                    threatCard(
                        "UNLIMITED APPROVAL",
                        "This lets the spender withdraw all current and future tokens of this type, without prompting you again."
                    )
                }

                if preview.isUnverifiedContract {
                    threatCard(
                        "UNVERIFIED CONTRACT",
                        "The contract interaction could not be verified. You are approving an unindexed bytecode operation. Proceed with extreme caution."
                    )
                }

                // iOS cannot blank a screen recording the way Android's FLAG_SECURE can, so the
                // honest control is to tell the user it is happening.
                if screenCaptureDetected {
                    threatCard(
                        "SCREEN IS BEING RECORDED",
                        "This device is mirroring or recording the screen. Anything shown here is visible to whatever is capturing it."
                    )
                }

                ForEach(preview.warnings, id: \.self) { warning in
                    Text(warning)
                        .font(.caption)
                        .foregroundColor(.red)
                }

                if preview.isUnverifiedContract {
                    Toggle(isOn: Binding(
                        get: { acknowledged },
                        set: { value in
                            acknowledged = value
                            gate.acknowledgeRisk(value)
                        }
                    )) {
                        Text("I understand this contract could not be verified.")
                            .font(.caption)
                    }
                }

                SlideToConfirmView(gate: gate, enabled: gate.isSliderUnlocked, onConfirmed: onConfirm)

                Button("Cancel", role: .cancel) {
                    gate.onCancel()
                    onCancel()
                }
                .frame(maxWidth: .infinity)
            }
            .padding(24)
        }
    }

    private func detailRow(_ label: String, _ value: String) -> some View {
        HStack {
            Text(label).font(.caption).foregroundColor(.secondary)
            Spacer()
            Text(value).font(.subheadline.weight(.medium))
        }
    }

    private func threatCard(_ title: String, _ body: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title).font(.caption.weight(.bold))
            Text(body).font(.caption2)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .background(Color.red.opacity(0.12))
        .cornerRadius(12)
    }
}
#endif
