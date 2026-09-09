import Foundation

public enum PassErrorCode: String, Sendable {
    case passProviderUnavailable = "PASS_PROVIDER_UNAVAILABLE"
    case passAlreadyAdded = "PASS_ALREADY_ADDED"
    case passNotFound = "PASS_NOT_FOUND"
    case passInvalid = "PASS_INVALID"
    case userCancelled = "USER_CANCELLED"
    case invalidParameters = "INVALID_PARAMETERS"
    case internalError = "INTERNAL_ERROR"
}

public struct PassError: LocalizedError, Sendable {
    public let code: PassErrorCode
    public let detail: String

    public init(_ code: PassErrorCode, _ detail: String) {
        self.code = code
        self.detail = detail
    }

    public var errorDescription: String? { "\(code.rawValue): \(detail)" }
}

public enum PassProvider: String, Sendable, CaseIterable {
    case googleWallet = "GOOGLE_WALLET"
    case appleWallet = "APPLE_WALLET"
    case generic = "GENERIC"

    public static func fromWireName(_ raw: String?) -> PassProvider? {
        switch raw?.trimmingCharacters(in: .whitespaces).uppercased() {
        case "GOOGLE_WALLET", "GOOGLE": return .googleWallet
        case "APPLE_WALLET", "APPLE", "PASSKIT": return .appleWallet
        case "GENERIC": return .generic
        default: return nil
        }
    }
}

/// Where a pass is, from the caller's point of view. Mirrors the Android `PassState`.
public enum PassState: String, Sendable {
    case added = "ADDED"
    case notAdded = "NOT_ADDED"
    /// The provider exists but cannot answer — never collapse this into `notAdded`.
    case unknown = "UNKNOWN"
    case unsupported = "UNSUPPORTED"
}

public struct PassBarcode: Sendable, Equatable {
    public static let supportedFormats: Set<String> = ["QR", "PDF417", "AZTEC", "CODE128"]

    public let format: String
    public let message: String
    public let altText: String?
    public let encoding: String

    public init(format: String, message: String, altText: String? = nil, encoding: String = "iso-8859-1") {
        self.format = format
        self.message = message
        self.altText = altText
        self.encoding = encoding
    }
}

public struct PassMetadata: Sendable, Equatable {
    public let passTypeIdentifier: String
    public let serialNumber: String
    public let provider: PassProvider
    public let description: String?
    public let organizationName: String?
    public let barcode: PassBarcode?
    public let savedAtEpochMs: Int64

    public init(
        passTypeIdentifier: String,
        serialNumber: String,
        provider: PassProvider,
        description: String? = nil,
        organizationName: String? = nil,
        barcode: PassBarcode? = nil,
        savedAtEpochMs: Int64 = 0
    ) {
        self.passTypeIdentifier = passTypeIdentifier
        self.serialNumber = serialNumber
        self.provider = provider
        self.description = description
        self.organizationName = organizationName
        self.barcode = barcode
        self.savedAtEpochMs = savedAtEpochMs
    }

    /// Stable identity, as both PassKit and Google Wallet define it.
    public var passId: String { "\(passTypeIdentifier):\(serialNumber)" }
}

public struct PassSaveResult: Sendable {
    public let state: PassState
    public let passId: String?
    public let provider: PassProvider
    public let alreadyAdded: Bool

    public init(state: PassState, passId: String?, provider: PassProvider, alreadyAdded: Bool = false) {
        self.state = state
        self.passId = passId
        self.provider = provider
        self.alreadyAdded = alreadyAdded
    }
}

/// A wallet that can hold passes, behind a protocol. Mirrors the Android `GoatPassAdapter`.
public protocol GoatPassAdapter: AnyObject, Sendable {
    var provider: PassProvider { get }
    func isAvailable() async -> Bool
    func savePass(payload: String, metadata: PassMetadata?) async throws -> PassSaveResult
    func getPassState(passId: String) async -> PassState
    func openPass(passId: String) async -> Bool
}
