import Foundation

public struct DecodedCall: Sendable, Equatable {
    public let selector: String
    public let methodName: String
    public let signature: String
    public let description: String
    public let recipient: String?
    public let amountRaw: EvmUInt256?
    public let isApproval: Bool
    public let isUnlimitedApproval: Bool
    public let isSetApprovalForAll: Bool
    public let isKnown: Bool
    public let warnings: [String]

    public init(
        selector: String, methodName: String, signature: String, description: String,
        recipient: String? = nil, amountRaw: EvmUInt256? = nil,
        isApproval: Bool = false, isUnlimitedApproval: Bool = false,
        isSetApprovalForAll: Bool = false, isKnown: Bool = true, warnings: [String] = []
    ) {
        self.selector = selector
        self.methodName = methodName
        self.signature = signature
        self.description = description
        self.recipient = recipient
        self.amountRaw = amountRaw
        self.isApproval = isApproval
        self.isUnlimitedApproval = isUnlimitedApproval
        self.isSetApprovalForAll = isSetApprovalForAll
        self.isKnown = isKnown
        self.warnings = warnings
    }
}

/**
 * A 256-bit unsigned integer held as big-endian bytes.
 *
 * Swift has no arbitrary-precision integer in the standard library, and EVM amounts routinely
 * exceed `UInt64` — `2^256-1` is the exact value that marks an unlimited approval, so truncating
 * to 64 bits would make the single most important check impossible.
 */
public struct EvmUInt256: Sendable, Equatable, Comparable, CustomStringConvertible {
    public let bytes: [UInt8]   // exactly 32, big-endian

    public init(bytes: [UInt8]) {
        var padded = bytes
        if padded.count < 32 { padded = [UInt8](repeating: 0, count: 32 - padded.count) + padded }
        self.bytes = Array(padded.suffix(32))
    }

    public init(_ value: UInt64) {
        var b = [UInt8](repeating: 0, count: 32)
        for i in 0..<8 { b[31 - i] = UInt8((value >> (8 * UInt64(i))) & 0xff) }
        self.bytes = b
    }

    public init?(hex: String) {
        let clean = hex.hasPrefix("0x") || hex.hasPrefix("0X") ? String(hex.dropFirst(2)) : hex
        guard !clean.isEmpty, clean.count <= 64, clean.allSatisfy({ $0.isHexDigit }) else { return nil }
        let padded = String(repeating: "0", count: 64 - clean.count) + clean
        var out = [UInt8]()
        var index = padded.startIndex
        while index < padded.endIndex {
            let next = padded.index(index, offsetBy: 2)
            guard let byte = UInt8(padded[index..<next], radix: 16) else { return nil }
            out.append(byte)
            index = next
        }
        self.bytes = out
    }

    /// Decimal string. Repeated division by 10 over the byte array — exact at any magnitude.
    public var description: String {
        var digits = bytes
        var out = ""
        while digits.contains(where: { $0 != 0 }) {
            var remainder: UInt16 = 0
            var quotient = [UInt8]()
            for byte in digits {
                let acc = remainder << 8 | UInt16(byte)
                quotient.append(UInt8(acc / 10))
                remainder = acc % 10
            }
            out = String(remainder) + out
            digits = quotient
        }
        return out.isEmpty ? "0" : out
    }

    public var isZero: Bool { bytes.allSatisfy { $0 == 0 } }

    public static func < (lhs: EvmUInt256, rhs: EvmUInt256) -> Bool {
        for i in 0..<32 where lhs.bytes[i] != rhs.bytes[i] {
            return lhs.bytes[i] < rhs.bytes[i]
        }
        return false
    }

    public static let max = EvmUInt256(bytes: [UInt8](repeating: 0xff, count: 32))
    public static let uint160Max = EvmUInt256(
        bytes: [UInt8](repeating: 0, count: 12) + [UInt8](repeating: 0xff, count: 20)
    )
    /// 2^255 — anything at or above this is treated as effectively unlimited for display.
    public static let unlimitedThreshold = EvmUInt256(bytes: [0x80] + [UInt8](repeating: 0, count: 31))
}

/**
 * Decodes EVM calldata so the native confirmation modal can show what a transaction actually does.
 * Mirrors the Android `EvmAbiDecoder` field for field.
 */
public enum EvmAbiDecoder {

    static let sigTransfer = "transfer(address,uint256)"
    static let sigApprove = "approve(address,uint256)"
    static let sigTransferFrom = "transferFrom(address,address,uint256)"
    static let sigIncreaseAllowance = "increaseAllowance(address,uint256)"
    static let sigSetApprovalForAll = "setApprovalForAll(address,bool)"
    static let sigSafeTransferFrom = "safeTransferFrom(address,address,uint256)"
    static let sigPermit2612 = "permit(address,address,uint256,uint256,uint8,bytes32,bytes32)"
    static let sigPermit2Approve = "approve(address,address,uint160,uint48)"

    /// Selectors are derived from signatures, never transcribed.
    private static let selectors: [String: String] = {
        let signatures = [
            sigTransfer, sigApprove, sigTransferFrom, sigIncreaseAllowance,
            sigSetApprovalForAll, sigSafeTransferFrom, sigPermit2612, sigPermit2Approve
        ]
        var map = [String: String]()
        for signature in signatures { map[Keccak256.functionSelector(signature)] = signature }
        return map
    }()

    public static func selectorOf(_ signature: String) -> String {
        Keccak256.functionSelector(signature)
    }

    public static func decode(_ calldata: String?) -> DecodedCall? {
        guard let hex = normalize(calldata), hex.count >= 8 else { return nil }
        let selector = "0x" + String(hex.prefix(8)).lowercased()
        let args = String(hex.dropFirst(8))

        guard let signature = selectors[selector] else {
            return DecodedCall(
                selector: selector, methodName: "unknown", signature: "",
                description: "The contract interaction could not be verified. You are approving an unindexed bytecode operation. Proceed with extreme caution.",
                isKnown: false,
                warnings: ["UNVERIFIED CONTRACT: calldata could not be decoded against any known interface."]
            )
        }

        switch signature {
        case sigTransfer:
            let to = address(args, 0)
            return DecodedCall(
                selector: selector, methodName: "transfer", signature: signature,
                description: "Send tokens to \(to ?? "an unknown address")",
                recipient: to, amountRaw: uint(args, 1)
            )

        case sigApprove, sigIncreaseAllowance:
            let spender = address(args, 0)
            let amount = uint(args, 1)
            let unlimited = amount.map { $0 >= EvmUInt256.unlimitedThreshold } ?? false
            let name = signature == sigApprove ? "approve" : "increaseAllowance"
            return DecodedCall(
                selector: selector, methodName: name, signature: signature,
                description: signature == sigApprove
                    ? "Allow \(spender ?? "a spender") to spend your tokens"
                    : "Increase \(spender ?? "a spender")'s spending allowance",
                recipient: spender, amountRaw: amount,
                isApproval: true, isUnlimitedApproval: unlimited,
                warnings: unlimited
                    ? ["Unlimited Approval: \(spender ?? "the spender") can withdraw all current and future tokens of this type."]
                    : []
            )

        case sigPermit2Approve:
            let spender = address(args, 1)
            let amount = uint(args, 2)
            let unlimited = amount.map { $0 >= EvmUInt256.uint160Max } ?? false
            return DecodedCall(
                selector: selector, methodName: "permit2Approve", signature: signature,
                description: "Permit2: allow \(spender ?? "a spender") to spend your tokens",
                recipient: spender, amountRaw: amount,
                isApproval: true, isUnlimitedApproval: unlimited,
                warnings: unlimited
                    ? ["Unlimited Permit2 Approval: \(spender ?? "the spender") can withdraw all current and future tokens of this type."]
                    : []
            )

        case sigTransferFrom, sigSafeTransferFrom:
            let from = address(args, 0)
            let to = address(args, 1)
            return DecodedCall(
                selector: selector,
                methodName: signature == sigTransferFrom ? "transferFrom" : "safeTransferFrom",
                signature: signature,
                description: "Move tokens from \(from ?? "?") to \(to ?? "?")",
                recipient: to, amountRaw: uint(args, 2)
            )

        case sigSetApprovalForAll:
            let op = address(args, 0)
            let approved = !(uint(args, 1)?.isZero ?? true)
            return DecodedCall(
                selector: selector, methodName: "setApprovalForAll", signature: signature,
                description: approved
                    ? "Grant \(op ?? "an operator") control of EVERY token in this collection"
                    : "Revoke \(op ?? "an operator")'s control of this collection",
                recipient: op,
                isApproval: approved, isUnlimitedApproval: approved, isSetApprovalForAll: true,
                warnings: approved
                    ? ["Collection-Wide Approval: \(op ?? "the operator") can transfer every NFT you own in this collection, now and in future."]
                    : []
            )

        case sigPermit2612:
            let owner = address(args, 0)
            let spender = address(args, 1)
            let amount = uint(args, 2)
            let unlimited = amount.map { $0 >= EvmUInt256.unlimitedThreshold } ?? false
            return DecodedCall(
                selector: selector, methodName: "permit", signature: signature,
                description: "EIP-2612 permit: \(owner ?? "?") allows \(spender ?? "?") to spend tokens",
                recipient: spender, amountRaw: amount,
                isApproval: true, isUnlimitedApproval: unlimited,
                warnings: unlimited
                    ? ["Unlimited Approval: \(spender ?? "the spender") can withdraw all current and future tokens of this type."]
                    : []
            )

        default:
            return nil
        }
    }

    public static func formatUnits(_ amount: EvmUInt256?, decimals: Int) -> String {
        guard let amount else { return "0" }
        if amount >= EvmUInt256.unlimitedThreshold { return "Unlimited" }
        let digits = amount.description
        if decimals <= 0 { return digits }
        if digits.count <= decimals {
            let fraction = String(repeating: "0", count: decimals - digits.count) + digits
            let trimmed = trimTrailingZeros(fraction)
            return trimmed.isEmpty ? "0" : "0." + trimmed
        }
        let whole = String(digits.prefix(digits.count - decimals))
        let fraction = trimTrailingZeros(String(digits.suffix(decimals)))
        return fraction.isEmpty ? whole : whole + "." + fraction
    }

    private static func trimTrailingZeros(_ value: String) -> String {
        var s = value
        while s.hasSuffix("0") { s.removeLast() }
        return s
    }

    private static func normalize(_ calldata: String?) -> String? {
        guard var trimmed = calldata?.trimmingCharacters(in: .whitespacesAndNewlines) else { return nil }
        if trimmed.hasPrefix("0x") || trimmed.hasPrefix("0X") { trimmed = String(trimmed.dropFirst(2)) }
        guard !trimmed.isEmpty, trimmed.allSatisfy({ $0.isHexDigit }) else { return nil }
        return trimmed
    }

    private static func word(_ args: String, _ index: Int) -> String? {
        let start = index * 64
        guard args.count >= start + 64 else { return nil }
        let from = args.index(args.startIndex, offsetBy: start)
        let to = args.index(from, offsetBy: 64)
        return String(args[from..<to])
    }

    private static func address(_ args: String, _ index: Int) -> String? {
        guard let w = word(args, index) else { return nil }
        return "0x" + String(w.suffix(40)).lowercased()
    }

    private static func uint(_ args: String, _ index: Int) -> EvmUInt256? {
        guard let w = word(args, index) else { return nil }
        return EvmUInt256(hex: w)
    }
}
