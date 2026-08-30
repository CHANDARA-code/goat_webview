import Foundation

/// Display data for the native L1 gesture-anchoring progress/confirmation overlay.
public struct GoatPaymentOverlayRequest: Sendable {
    public let provider: String
    public let amount: Int64
    public let currency: String
    public let merchantName: String?

    public init(provider: String, amount: Int64, currency: String, merchantName: String? = nil) {
        self.provider = provider
        self.amount = amount
        self.currency = currency
        self.merchantName = merchantName
    }
}

/**
 * L1 Native Progress/Confirmation Overlay presenter (Task 10206 / §7 L1).
 *
 * Displays order amount, currency, and merchant name with a loading indicator immediately upon
 * `REQUEST_PAYMENT`, insulating execution from 2-hop backend RTT timeouts. The user's explicit
 * confirmation tap on this *native* surface anchors a fresh 0ms gesture, so hosts that wire a
 * real presenter satisfy L1 even when the JS-side tap predates a >10s network round trip.
 *
 * Returning `false` (or throwing) is treated as an explicit user dismissal, not a gesture.
 */
public protocol GoatPaymentProgressOverlayPresenter: Sendable {
    func present(_ request: GoatPaymentOverlayRequest) async -> Bool
}
