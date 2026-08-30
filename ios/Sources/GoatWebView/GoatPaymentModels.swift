import Foundation

/**
 * Terminal and non-terminal payment intent states (Task 10206 / §9 state machine).
 * `succeeded` is monotonically immutable once reached — see `GoatPaymentGatewayManager`.
 */
public enum GoatPaymentStatus: String, Sendable {
    case created = "CREATED"
    case claimed = "CLAIMED"
    case processing = "PROCESSING"
    case dismissed = "DISMISSED"
    case authorized = "AUTHORIZED"
    case succeeded = "SUCCEEDED"
    case failed = "FAILED"
    case cancelled = "CANCELLED"
    case expired = "EXPIRED"

    public var isTerminal: Bool {
        self == .succeeded || self == .failed || self == .cancelled || self == .expired
    }

    public static func fromWire(_ value: String?) -> GoatPaymentStatus? {
        guard let value else { return nil }
        return GoatPaymentStatus(rawValue: value.uppercased())
    }
}

/// Standard bridge error codes for the Payment Security Gate (Task 10206 / §8).
public enum GoatPaymentErrorCode {
    public static let gestureRequired = "GESTURE_REQUIRED"
    public static let originNotAllowed = "ORIGIN_NOT_ALLOWED"
    public static let gatewayNotAllowed = "GATEWAY_NOT_ALLOWED"
    public static let paymentIntentInvalid = "PAYMENT_INTENT_INVALID"
    public static let paymentIntentExpired = "PAYMENT_INTENT_EXPIRED"
    public static let paymentIntentMismatch = "PAYMENT_INTENT_MISMATCH"
    public static let providerNotRegistered = "PROVIDER_NOT_REGISTERED"
    public static let paymentInProgress = "PAYMENT_IN_PROGRESS"
    public static let paymentCancelled = "PAYMENT_CANCELLED"
    public static let paymentFailed = "PAYMENT_FAILED"
    public static let paymentTimeout = "PAYMENT_TIMEOUT"
}

/// Actionable, non-sensitive failure sub-codes (Task 10206 / §8).
public enum GoatPaymentSubCode {
    public static let cardDeclinedInsufficientFunds = "CARD_DECLINED_INSUFFICIENT_FUNDS"
    public static let cardExpired = "CARD_EXPIRED"
    public static let authenticationFailed = "AUTHENTICATION_FAILED"
    public static let networkTimeout = "NETWORK_TIMEOUT"
    public static let stuckPaymentWatchdogReleased = "STUCK_PAYMENT_WATCHDOG_RELEASED"
}

/**
 * Thrown by any layer of the Payment Security Gate; carries a safe `code`/`subCode` pair,
 * surfaced to JS via `localizedDescription` as `"CODE: reason [SUB_CODE]"` — matching the
 * existing `GESTURE_REQUIRED: ...` convention already used by `GoatScriptMessageHandler`.
 */
public struct GoatPaymentException: Error, LocalizedError, Equatable {
    public let code: String
    public let reason: String
    public let subCode: String?

    public init(code: String, reason: String, subCode: String? = nil) {
        self.code = code
        self.reason = reason
        self.subCode = subCode
    }

    public var errorDescription: String? {
        var message = "\(code): \(reason)"
        if let subCode {
            message += " [\(subCode)]"
        }
        return message
    }
}

/**
 * Untrusted, JS-originated payment request payload (Zone 0). `expiresAt` is deliberately absent
 * — it is only ever trusted from inside the decoded, signature-verified `GoatSignedIntentPayload`.
 * Every field except `ephemeralClientToken` arrives verbatim from the bridge;
 * `ephemeralClientToken` is injected natively after L3 tokenization and never touches JS.
 */
public struct GoatPaymentRequest: Sendable {
    public let provider: String
    public let orderId: String
    public let intentId: String
    public let amount: Int64
    public let currency: String
    public let nonce: String
    public let signedPayload: String
    public var ephemeralClientToken: String?

    public init(
        provider: String,
        orderId: String,
        intentId: String,
        amount: Int64,
        currency: String,
        nonce: String,
        signedPayload: String,
        ephemeralClientToken: String? = nil
    ) {
        self.provider = provider
        self.orderId = orderId
        self.intentId = intentId
        self.amount = amount
        self.currency = currency
        self.nonce = nonce
        self.signedPayload = signedPayload
        self.ephemeralClientToken = ephemeralClientToken
    }

    public func withToken(_ token: String) -> GoatPaymentRequest {
        var copy = self
        copy.ephemeralClientToken = token
        return copy
    }
}

/**
 * The canonical, backend-signed fields for a payment intent (Task 10206 / §7 L2). Encoded on the
 * wire as `signedPayload = base64(canonical) + "." + base64(signature)` — lets native verify the
 * signature AND detect amount/currency/order tampering (anti-TOCTOU, A1) without an extra network
 * round trip.
 */
public struct GoatSignedIntentPayload: Sendable {
    public let intentId: String
    public let orderId: String
    public let amount: Int64
    public let currency: String
    public let provider: String
    public let nonce: String
    public let expiresAt: Int64

    public init(intentId: String, orderId: String, amount: Int64, currency: String, provider: String, nonce: String, expiresAt: Int64) {
        self.intentId = intentId
        self.orderId = orderId
        self.amount = amount
        self.currency = currency
        self.provider = provider
        self.nonce = nonce
        self.expiresAt = expiresAt
    }

    private func canonicalString() -> String {
        "\(intentId)|\(orderId)|\(amount)|\(currency)|\(provider)|\(nonce)|\(expiresAt)"
    }

    public func canonicalBytes() -> Data {
        Data(canonicalString().utf8)
    }

    public func encode(sign: (Data) -> Data) -> String {
        let canonicalB64 = canonicalBytes().base64EncodedString()
        let sigB64 = sign(canonicalBytes()).base64EncodedString()
        return "\(canonicalB64).\(sigB64)"
    }

    public static func decode(_ signedPayload: String) -> (GoatSignedIntentPayload, Data)? {
        let parts = signedPayload.split(separator: ".", maxSplits: 1, omittingEmptySubsequences: false)
        guard parts.count == 2,
              let canonicalData = Data(base64Encoded: String(parts[0])),
              let canonicalStr = String(data: canonicalData, encoding: .utf8),
              let sigData = Data(base64Encoded: String(parts[1])) else {
            return nil
        }
        let fields = canonicalStr.split(separator: "|", omittingEmptySubsequences: false).map(String.init)
        guard fields.count == 7,
              let amount = Int64(fields[2]),
              let expiresAt = Int64(fields[6]) else {
            return nil
        }
        let payload = GoatSignedIntentPayload(
            intentId: fields[0], orderId: fields[1], amount: amount, currency: fields[3],
            provider: fields[4], nonce: fields[5], expiresAt: expiresAt
        )
        return (payload, sigData)
    }
}

/// Outcome returned by a `GoatPaymentAdapter` after driving the provider's checkout surface.
public struct GoatPaymentOutcome: Sendable {
    public let status: GoatPaymentStatus
    public let intentId: String
    public let transactionHandle: String?
    public let providerRef: String?
    public let failureSubCode: String?

    public init(status: GoatPaymentStatus, intentId: String, transactionHandle: String? = nil, providerRef: String? = nil, failureSubCode: String? = nil) {
        self.status = status
        self.intentId = intentId
        self.transactionHandle = transactionHandle
        self.providerRef = providerRef
        self.failureSubCode = failureSubCode
    }
}

/// Zone 4 tenant public key directory entry, cached client-side via `GoatPaymentIntentStore`.
public struct GoatTenantPublicKey: Sendable {
    public let keyBase64: String
    public let algorithm: String

    public init(keyBase64: String, algorithm: String) {
        self.keyBase64 = keyBase64
        self.algorithm = algorithm
    }
}

/// Outcome of a `POST /pay/intents/:id/claim` call — either freshly claimed or already-terminal.
public struct GoatClaimResult: Sendable {
    public let claimed: Bool
    public let priorOutcome: GoatPaymentOutcome?

    public init(claimed: Bool, priorOutcome: GoatPaymentOutcome? = nil) {
        self.claimed = claimed
        self.priorOutcome = priorOutcome
    }
}

/**
 * Capability-scoped execution context handed to adapters. Deliberately does NOT expose
 * `GoatSecureStorageManager`, the tenant signing key, or an arbitrary view controller reference
 * beyond an opaque `presenterHandle` (Task 10206 / §5.2).
 */
public struct GoatPaymentContext: Sendable {
    public let appId: String
    public let proxyClient: any GoatPaymentServerProxyClient
    public let presenterHandle: (any Sendable)?

    public init(appId: String, proxyClient: any GoatPaymentServerProxyClient, presenterHandle: (any Sendable)? = nil) {
        self.appId = appId
        self.proxyClient = proxyClient
        self.presenterHandle = presenterHandle
    }
}
