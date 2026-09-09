import Foundation

public struct SolanaMalformedTransactionError: LocalizedError, Sendable {
    public let detail: String
    public init(_ detail: String) { self.detail = detail }
    public var errorDescription: String? { detail }
}

public struct SolanaInstructionSummary: Sendable {
    public let programId: String
    public let programName: String
    public let kind: String
    public let summary: String
    public let destination: String?
    public let amountRaw: UInt64?
    public let decimals: Int?
    public let isKnown: Bool
}

public struct DecodedSolanaTransaction: Sendable {
    public let version: String
    public let feePayer: String
    public let recentBlockhash: String
    public let accountKeys: [String]
    public let instructions: [SolanaInstructionSummary]
    public let addressTableLookups: Int
    public let requiresAddressLookupResolution: Bool
    public let warnings: [String]
}

/**
 * Deserialises a Solana wire transaction so its instructions can be described before signing.
 * Handles legacy and v0 (address lookup tables). Mirrors the Android `SolanaTxDecoder`.
 */
public enum SolanaTxDecoder {

    public static let systemProgram = "11111111111111111111111111111111"
    public static let tokenProgram = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
    public static let token2022Program = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"
    public static let associatedTokenProgram = "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
    public static let computeBudgetProgram = "ComputeBudget111111111111111111111111111111"

    private static let maxAccounts = 256
    private static let maxInstructions = 64

    private static let programNames: [String: String] = [
        systemProgram: "System Program",
        tokenProgram: "SPL Token",
        token2022Program: "SPL Token-2022",
        associatedTokenProgram: "Associated Token Account",
        computeBudgetProgram: "Compute Budget"
    ]

    public static func decodeBase64(_ raw: String?) throws -> DecodedSolanaTransaction {
        guard let raw, !raw.trimmingCharacters(in: .whitespaces).isEmpty else {
            throw SolanaMalformedTransactionError("Empty transaction payload")
        }
        var s = raw.trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: "-", with: "+")
            .replacingOccurrences(of: "_", with: "/")
        while s.count % 4 != 0 { s += "=" }
        guard let data = Data(base64Encoded: s) else {
            throw SolanaMalformedTransactionError("Transaction payload is not valid Base64")
        }
        return try decode([UInt8](data))
    }

    public static func decode(_ bytes: [UInt8]) throws -> DecodedSolanaTransaction {
        var reader = ByteReader(bytes)

        let signatureCount = try reader.readCompactU16()
        guard signatureCount <= 32 else {
            throw SolanaMalformedTransactionError("Transaction declares \(signatureCount) signatures")
        }
        try reader.skip(signatureCount * 64)

        let versionByte = try reader.peek()
        let isVersioned = (versionByte & 0x80) != 0
        var version = "legacy"
        if isVersioned {
            let v = Int(try reader.readByte() & 0x7f)
            guard v == 0 else { throw SolanaMalformedTransactionError("Unsupported message version \(v)") }
            version = "v0"
        }

        _ = try reader.readByte()  // numRequiredSignatures
        _ = try reader.readByte()  // numReadonlySigned
        _ = try reader.readByte()  // numReadonlyUnsigned

        let accountCount = try reader.readCompactU16()
        guard accountCount > 0, accountCount <= maxAccounts else {
            throw SolanaMalformedTransactionError("Transaction declares \(accountCount) account keys")
        }
        var accountKeys = [String]()
        accountKeys.reserveCapacity(accountCount)
        for _ in 0..<accountCount { accountKeys.append(Base58.encode(try reader.readBytes(32))) }

        let recentBlockhash = Base58.encode(try reader.readBytes(32))

        let instructionCount = try reader.readCompactU16()
        guard instructionCount <= maxInstructions else {
            throw SolanaMalformedTransactionError("Transaction declares \(instructionCount) instructions")
        }

        var instructions = [SolanaInstructionSummary]()
        for _ in 0..<instructionCount {
            let programIndex = Int(try reader.readByte())
            let accountIndexCount = try reader.readCompactU16()
            var accountIndexes = [Int]()
            for _ in 0..<accountIndexCount { accountIndexes.append(Int(try reader.readByte())) }
            let dataLength = try reader.readCompactU16()
            let data = try reader.readBytes(dataLength)

            guard programIndex < accountKeys.count else {
                throw SolanaMalformedTransactionError("Instruction names account \(programIndex), which does not exist")
            }
            instructions.append(
                summarise(accountKeys[programIndex], accountIndexes, data, accountKeys)
            )
        }

        var lookups = 0
        if version == "v0", reader.hasRemaining {
            lookups = try reader.readCompactU16()
            for _ in 0..<lookups {
                _ = try reader.readBytes(32)
                let writable = try reader.readCompactU16(); try reader.skip(writable)
                let readonly = try reader.readCompactU16(); try reader.skip(readonly)
            }
        }

        var warnings = [String]()
        if lookups > 0 {
            warnings.append("This transaction uses address lookup tables; some accounts it touches are not listed in the message and cannot be shown here.")
        }
        if instructions.contains(where: { !$0.isKnown }) {
            warnings.append("UNVERIFIED PROGRAM: one or more instructions call a program this device cannot decode.")
        }

        return DecodedSolanaTransaction(
            version: version,
            feePayer: accountKeys[0],
            recentBlockhash: recentBlockhash,
            accountKeys: accountKeys,
            instructions: instructions,
            addressTableLookups: lookups,
            requiresAddressLookupResolution: lookups > 0,
            warnings: warnings
        )
    }

    private static func summarise(
        _ programId: String, _ accountIndexes: [Int], _ data: [UInt8], _ accountKeys: [String]
    ) -> SolanaInstructionSummary {
        let programName = programNames[programId] ?? "Unknown program"

        func account(_ position: Int) -> String? {
            guard position < accountIndexes.count else { return nil }
            let index = accountIndexes[position]
            return index < accountKeys.count ? accountKeys[index] : nil
        }

        if programId == systemProgram, data.count >= 12 {
            let instructionType = readUInt32LE(data, 0)
            if instructionType == 2 {
                let lamports = readUInt64LE(data, 4)
                let destination = account(1)
                return SolanaInstructionSummary(
                    programId: programId, programName: programName, kind: "sol_transfer",
                    summary: "Send \(formatUnits(lamports, decimals: 9)) SOL to \(destination ?? "an unlisted account")",
                    destination: destination, amountRaw: lamports, decimals: 9, isKnown: true
                )
            }
        }

        if programId == tokenProgram || programId == token2022Program, let first = data.first {
            switch first {
            case 3 where data.count >= 9:
                let amount = readUInt64LE(data, 1)
                let destination = account(1)
                return SolanaInstructionSummary(
                    programId: programId, programName: programName, kind: "spl_transfer",
                    summary: "Send \(amount) token base units to \(destination ?? "an unlisted account")",
                    destination: destination, amountRaw: amount, decimals: nil, isKnown: true
                )
            case 12 where data.count >= 10:
                let amount = readUInt64LE(data, 1)
                let decimals = Int(data[9])
                let destination = account(2)
                return SolanaInstructionSummary(
                    programId: programId, programName: programName, kind: "spl_transfer_checked",
                    summary: "Send \(formatUnits(amount, decimals: decimals)) tokens to \(destination ?? "an unlisted account")",
                    destination: destination, amountRaw: amount, decimals: decimals, isKnown: true
                )
            case 4:
                let delegate = account(1)
                return SolanaInstructionSummary(
                    programId: programId, programName: programName, kind: "spl_approve",
                    summary: "Allow \(delegate ?? "a delegate") to spend tokens from this account",
                    destination: delegate,
                    amountRaw: data.count >= 9 ? readUInt64LE(data, 1) : nil,
                    decimals: nil, isKnown: true
                )
            default:
                break
            }
        }

        if programId == computeBudgetProgram {
            return SolanaInstructionSummary(
                programId: programId, programName: programName, kind: "compute_budget",
                summary: "Set the compute budget", destination: nil, amountRaw: nil,
                decimals: nil, isKnown: true
            )
        }

        return SolanaInstructionSummary(
            programId: programId, programName: programName, kind: "unknown",
            summary: "Call to \(programId) could not be decoded. Proceed with extreme caution.",
            destination: nil, amountRaw: nil, decimals: nil, isKnown: false
        )
    }

    public static func formatUnits(_ amount: UInt64?, decimals: Int) -> String {
        guard let amount else { return "0" }
        if decimals <= 0 { return String(amount) }
        let digits = String(amount)
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

    private static func readUInt32LE(_ data: [UInt8], _ offset: Int) -> UInt32 {
        var value: UInt32 = 0
        for i in stride(from: 3, through: 0, by: -1) { value = (value << 8) | UInt32(data[offset + i]) }
        return value
    }

    private static func readUInt64LE(_ data: [UInt8], _ offset: Int) -> UInt64 {
        var value: UInt64 = 0
        for i in stride(from: 7, through: 0, by: -1) { value = (value << 8) | UInt64(data[offset + i]) }
        return value
    }

    /// Bounds-checked cursor. Every field a hostile payload controls is read through this.
    private struct ByteReader {
        private let data: [UInt8]
        private var offset = 0

        init(_ data: [UInt8]) { self.data = data }

        var hasRemaining: Bool { offset < data.count }

        func peek() throws -> UInt8 {
            guard offset < data.count else { throw SolanaMalformedTransactionError("Transaction truncated") }
            return data[offset]
        }

        mutating func readByte() throws -> UInt8 {
            guard offset < data.count else { throw SolanaMalformedTransactionError("Transaction truncated") }
            defer { offset += 1 }
            return data[offset]
        }

        mutating func readBytes(_ count: Int) throws -> [UInt8] {
            guard count >= 0, offset + count <= data.count else {
                throw SolanaMalformedTransactionError("Transaction truncated reading \(count) bytes")
            }
            defer { offset += count }
            return Array(data[offset..<(offset + count)])
        }

        mutating func skip(_ count: Int) throws {
            guard count >= 0, offset + count <= data.count else {
                throw SolanaMalformedTransactionError("Transaction truncated skipping \(count) bytes")
            }
            offset += count
        }

        /// Solana's compact-u16 (ShortVec): 7 bits per byte, at most 3 bytes.
        mutating func readCompactU16() throws -> Int {
            var value = 0
            var shift = 0
            while true {
                let byte = Int(try readByte())
                value |= (byte & 0x7f) << shift
                if (byte & 0x80) == 0 { break }
                shift += 7
                if shift > 14 { throw SolanaMalformedTransactionError("Malformed compact-u16 length") }
            }
            guard value >= 0, value <= 0xffff else {
                throw SolanaMalformedTransactionError("compact-u16 out of range")
            }
            return value
        }
    }
}

/// Base58 (Bitcoin alphabet), as Solana account keys need it.
public enum Base58 {
    private static let alphabet = Array("123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz")

    public static func encode(_ bytes: [UInt8]) -> String {
        guard !bytes.isEmpty else { return "" }
        var leadingZeros = 0
        while leadingZeros < bytes.count && bytes[leadingZeros] == 0 { leadingZeros += 1 }

        var digits = [UInt8]()
        for byte in bytes {
            var carry = Int(byte)
            for i in 0..<digits.count {
                carry += Int(digits[i]) << 8
                digits[i] = UInt8(carry % 58)
                carry /= 58
            }
            while carry > 0 {
                digits.append(UInt8(carry % 58))
                carry /= 58
            }
        }

        var out = String(repeating: String(alphabet[0]), count: leadingZeros)
        for digit in digits.reversed() { out.append(alphabet[Int(digit)]) }
        return out
    }
}
