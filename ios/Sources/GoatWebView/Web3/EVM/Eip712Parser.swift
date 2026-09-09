import Foundation

public struct DecodedTypedData: Sendable {
    public let primaryType: String
    public let domainName: String?
    public let verifyingContract: String?
    public let chainId: String?
    public let spender: String?
    public let amountRaw: EvmUInt256?
    public let expiry: Int64?
    public let isPermit: Bool
    public let isUnlimitedAllowance: Bool
    public let isLongLivedApproval: Bool
    public let isKnownPermitShape: Bool
    public let summary: String
    public let warnings: [String]
}

/**
 * Decodes `eth_signTypedData_v4` payloads before they reach the confirmation modal.
 *
 * This is the drainer path on-chain calldata decoding misses: a Permit2 `PermitSingle` is an
 * off-chain signature, costs no gas, produces no visible transaction, and grants unlimited
 * allowance until expiry. Mirrors the Android `Eip712Parser`.
 */
public enum Eip712Parser {

    /// Canonical Uniswap Permit2 deployment, identical on every chain it is deployed to.
    public static let permit2Contract = "0x000000000022d473030f116ddee9f6b43ac78ba3"

    private static let thirtyDaysSeconds: Int64 = 30 * 24 * 60 * 60
    private static let permitTypes: Set<String> = ["Permit", "PermitSingle", "PermitBatch", "PermitTransferFrom"]

    public static func parse(_ raw: String?, now: Int64 = Int64(Date().timeIntervalSince1970)) -> DecodedTypedData? {
        guard let raw, !raw.isEmpty, let data = raw.data(using: .utf8),
              let root = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            return nil
        }

        let primaryType = root["primaryType"] as? String ?? ""
        let domain = root["domain"] as? [String: Any]
        let message = root["message"] as? [String: Any]

        let verifyingContract = (domain?["verifyingContract"] as? String)?.lowercased()
        let domainName = domain?["name"] as? String
        let chainId = stringValue(domain?["chainId"])

        let isPermit2Contract = verifyingContract == permit2Contract
        let isKnownPermitShape = permitTypes.contains(primaryType)

        let details = message?["details"] as? [String: Any]
        let batch = message?["details"] as? [[String: Any]]

        let spender = (message?["spender"] as? String)
            ?? (details?["spender"] as? String)
            ?? (message?["to"] as? String)

        let amount = firstAmount(message: message, details: details, batch: batch)
        let expiry = intValue(details?["expiration"])
            ?? intValue(message?["expiration"])
            ?? intValue(message?["deadline"])
            ?? batch?.compactMap { intValue($0["expiration"]) }.first

        // Permit2 allowances are uint160; ERC-2612 permits are uint256. Compare against the right
        // ceiling or an unlimited Permit2 approval reads as merely "large".
        let ceiling = (isPermit2Contract || primaryType.hasPrefix("Permit"))
            ? EvmUInt256.uint160Max
            : EvmUInt256.max
        let isUnlimited = amount.map { $0 >= ceiling } ?? false
        let isLongLived = expiry.map { $0 > now + thirtyDaysSeconds } ?? false

        var warnings: [String] = []
        if isUnlimited {
            warnings.append("Unlimited Allowance: this signature lets \(spender ?? "the spender") withdraw all current and future tokens of this type without another prompt.")
        }
        if isLongLived {
            warnings.append("Long-Lived Approval: this permission lasts more than 30 days.")
        }
        if isPermit2Contract {
            warnings.append("Permit2: this is an off-chain signature, not a transaction. It takes effect immediately and costs no gas.")
        }
        if !isKnownPermitShape && !isPermit2Contract {
            warnings.append("Unverified typed data: this message shape is not a recognised permit. Read it carefully before signing.")
        }

        let summary: String
        if isPermit2Contract, let batch {
            summary = "Permit2 batch approval for \(batch.count) token(s)"
        } else if isPermit2Contract {
            summary = "Permit2 approval for \(spender ?? "an unnamed spender")"
        } else if isKnownPermitShape {
            summary = "\(primaryType) approval for \(spender ?? "an unnamed spender")"
        } else if !primaryType.isEmpty {
            summary = "Sign \(primaryType) message"
        } else {
            summary = "Sign typed data"
        }

        return DecodedTypedData(
            primaryType: primaryType,
            domainName: domainName,
            verifyingContract: verifyingContract,
            chainId: chainId,
            spender: spender,
            amountRaw: amount,
            expiry: expiry,
            isPermit: isKnownPermitShape || isPermit2Contract,
            isUnlimitedAllowance: isUnlimited,
            isLongLivedApproval: isLongLived,
            isKnownPermitShape: isKnownPermitShape,
            summary: summary,
            warnings: warnings
        )
    }

    private static func firstAmount(
        message: [String: Any]?, details: [String: Any]?, batch: [[String: Any]]?
    ) -> EvmUInt256? {
        if let v = bigValue(details?["amount"]) { return v }
        if let v = bigValue(message?["amount"]) { return v }
        if let v = bigValue(message?["value"]) { return v }
        if let batch {
            for entry in batch { if let v = bigValue(entry["amount"]) { return v } }
        }
        return nil
    }

    private static func stringValue(_ any: Any?) -> String? {
        if let s = any as? String, !s.isEmpty { return s }
        if let n = any as? NSNumber { return n.stringValue }
        return nil
    }

    private static func bigValue(_ any: Any?) -> EvmUInt256? {
        guard let raw = stringValue(any) else { return nil }
        if raw.hasPrefix("0x") || raw.hasPrefix("0X") { return EvmUInt256(hex: raw) }
        return decimalToUInt256(raw)
    }

    private static func intValue(_ any: Any?) -> Int64? {
        guard let raw = stringValue(any) else { return nil }
        if raw.hasPrefix("0x") || raw.hasPrefix("0X") { return Int64(raw.dropFirst(2), radix: 16) }
        return Int64(raw)
    }

    /// Decimal string to 32 big-endian bytes by repeated multiply-by-10, so values above
    /// `UInt64.max` (every unlimited allowance) survive intact.
    static func decimalToUInt256(_ decimal: String) -> EvmUInt256? {
        guard !decimal.isEmpty, decimal.allSatisfy({ $0.isNumber }) else { return nil }
        var bytes = [UInt8](repeating: 0, count: 32)
        for character in decimal {
            guard let digit = character.wholeNumberValue else { return nil }
            var carry = UInt16(digit)
            for i in stride(from: 31, through: 0, by: -1) {
                let value = UInt16(bytes[i]) * 10 + carry
                bytes[i] = UInt8(value & 0xff)
                carry = value >> 8
            }
            if carry != 0 { return EvmUInt256.max }
        }
        return EvmUInt256(bytes: bytes)
    }
}
