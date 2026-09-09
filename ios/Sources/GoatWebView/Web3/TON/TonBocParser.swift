import Foundation

public struct BocMalformedError: LocalizedError, Sendable {
    public let detail: String
    public init(_ detail: String) { self.detail = detail }
    public var errorDescription: String? { detail }
}

public struct TonCell: Sendable, Equatable {
    public let data: [UInt8]
    public let bitLength: Int
    public let refs: [Int]
    public let isExotic: Bool
}

/**
 * Bit reader over a TON cell. Every read is bounds-checked before it happens: a slice is parsed
 * from an attacker-supplied payload, so an unchecked read is a crash — or a silent read past the
 * end that decodes into a plausible-looking destination address.
 */
public struct TonCellSlice {
    private let cell: TonCell
    public private(set) var bitOffset: Int = 0

    public init(_ cell: TonCell) { self.cell = cell }

    public var remainingBits: Int { cell.bitLength - bitOffset }

    private func check(_ bits: Int) throws {
        guard bits >= 0 else { throw BocMalformedError("Negative bit count requested") }
        guard bitOffset + bits <= cell.bitLength else {
            throw BocMalformedError("Slice underflow: requested \(bits) bits at offset \(bitOffset) of \(cell.bitLength)")
        }
    }

    public mutating func readBit() throws -> Int {
        try check(1)
        let byteIndex = bitOffset >> 3
        let shift = 7 - (bitOffset & 7)
        bitOffset += 1
        return Int((cell.data[byteIndex] >> UInt8(shift)) & 1)
    }

    /// Reads up to 64 bits. A full 64-bit field (TON's `query_id`) may exceed `Int64.max`; it is
    /// returned as a `UInt64` so nothing wraps.
    public mutating func readUInt(_ bits: Int) throws -> UInt64 {
        guard bits <= 64 else { throw BocMalformedError("readUInt supports at most 64 bits, got \(bits)") }
        try check(bits)
        var value: UInt64 = 0
        for _ in 0..<bits { value = (value << 1) | UInt64(try readBit()) }
        return value
    }

    public mutating func readBigUInt(_ bits: Int) throws -> EvmUInt256 {
        try check(bits)
        var bytes = [UInt8](repeating: 0, count: 32)
        for _ in 0..<bits {
            var carry = try readBit()
            for i in stride(from: 31, through: 0, by: -1) {
                let value = Int(bytes[i]) << 1 | carry
                bytes[i] = UInt8(value & 0xff)
                carry = value >> 8
            }
        }
        return EvmUInt256(bytes: bytes)
    }

    public mutating func skipBits(_ bits: Int) throws {
        try check(bits)
        bitOffset += bits
    }

    /// TL-B `VarUInteger 16`, the encoding TON uses for coin amounts (nanotons).
    public mutating func readCoins() throws -> EvmUInt256 {
        let lengthBytes = Int(try readUInt(4))
        if lengthBytes == 0 { return EvmUInt256(0) }
        guard lengthBytes <= 15 else {
            throw BocMalformedError("Coins length prefix \(lengthBytes) exceeds VarUInteger 16")
        }
        return try readBigUInt(lengthBytes * 8)
    }

    /**
     * TL-B `MsgAddress`. Returns the raw `workchain:hex` form, or nil for `addr_none`. Raw rather
     * than friendly base64 is deliberate: a friendly address carries flags that change its
     * meaning, and getting them wrong in a confirmation dialog shows the wrong destination.
     */
    public mutating func readAddress() throws -> String? {
        guard remainingBits >= 2 else { throw BocMalformedError("Truncated MsgAddress") }
        switch Int(try readUInt(2)) {
        case 0:
            return nil
        case 2:
            let hasAnycast = try readBit() == 1
            if hasAnycast {
                let depth = Int(try readUInt(5))
                guard (1...30).contains(depth) else { throw BocMalformedError("Invalid anycast depth \(depth)") }
                try skipBits(depth)
            }
            let workchain = Int(Int8(bitPattern: UInt8(try readUInt(8))))
            var hash = ""
            for _ in 0..<32 { hash += String(format: "%02x", UInt8(try readUInt(8))) }
            return "\(workchain):\(hash)"
        default:
            throw BocMalformedError("Unsupported MsgAddress variant")
        }
    }

    public mutating func readTextTail() throws -> String {
        var bytes = [UInt8]()
        while remainingBits >= 8 { bytes.append(UInt8(try readUInt(8))) }
        return String(decoding: bytes, as: UTF8.self)
    }
}

public struct DecodedBocPayload: Sendable {
    public let opcode: String
    public let kind: String
    public let summary: String
    public let destination: String?
    public let amountRaw: EvmUInt256?
    public let comment: String?
    public let queryId: UInt64?
    public let isKnown: Bool
    public let warnings: [String]
}

/**
 * Bag of Cells deserialiser and payload opcode decoder.
 *
 * Traversal is an explicit heap stack, not recursion: a BOC arrives from the page, and a deeply
 * nested one would otherwise overflow the stack. Depth, cell count and every bit read are bounded,
 * and back-references are rejected outright — a canonical BOC only refers forward, so a
 * back-reference is either malformed or a deliberate cycle. Mirrors the Android `TonBocParser`.
 */
public struct TonBocParser: Sendable {

    public static let maxCellDepthDefault = 128
    public static let maxCellCountDefault = 1024
    private static let bocMagic: UInt32 = 0xb5ee9c72

    public static let opTextComment: UInt32 = 0x00000000
    public static let opJettonTransfer: UInt32 = 0x0f8a7ea5
    public static let opNftTransfer: UInt32 = 0x5fcc3d14

    private let maxCellDepth: Int
    private let maxCellCount: Int

    public init(maxCellDepth: Int = maxCellDepthDefault, maxCellCount: Int = maxCellCountDefault) {
        self.maxCellDepth = maxCellDepth
        self.maxCellCount = maxCellCount
    }

    public static func decodeBase64(_ value: String) throws -> [UInt8] {
        var s = value.trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: "-", with: "+")
            .replacingOccurrences(of: "_", with: "/")
        while s.count % 4 != 0 { s += "=" }
        guard let data = Data(base64Encoded: s) else { throw BocMalformedError("Payload is not valid Base64") }
        return [UInt8](data)
    }

    public func parseBase64(_ payload: String?) throws -> [TonCell] {
        guard let payload, !payload.trimmingCharacters(in: .whitespaces).isEmpty else {
            throw BocMalformedError("Empty BOC payload")
        }
        return try parse(try Self.decodeBase64(payload))
    }

    public func parse(_ raw: [UInt8]) throws -> [TonCell] {
        guard raw.count >= 5 else { throw BocMalformedError("BOC data too small (\(raw.count) bytes)") }

        var offset = 0
        func u8() throws -> Int {
            guard offset < raw.count else { throw BocMalformedError("BOC header truncated") }
            defer { offset += 1 }
            return Int(raw[offset])
        }
        func uint(_ byteCount: Int) throws -> Int {
            guard byteCount > 0, byteCount <= 4 else { throw BocMalformedError("Unsupported size width \(byteCount)") }
            var value = 0
            for _ in 0..<byteCount { value = (value << 8) | (try u8()) }
            return value
        }

        var magic: UInt32 = 0
        for _ in 0..<4 { magic = (magic << 8) | UInt32(try u8()) }
        guard magic == Self.bocMagic else { throw BocMalformedError("Unrecognised BOC magic") }

        let flags = try u8()
        let hasIndex = (flags & 0x80) != 0
        let hasCrc = (flags & 0x40) != 0
        let refSize = flags & 0x07
        guard (1...4).contains(refSize) else { throw BocMalformedError("Invalid BOC ref size \(refSize)") }

        let offsetSize = try u8()
        guard (1...8).contains(offsetSize) else { throw BocMalformedError("Invalid BOC offset size \(offsetSize)") }

        let cellCount = try uint(refSize)
        let rootCount = try uint(refSize)
        let absentCount = try uint(refSize)
        guard rootCount >= 1 else { throw BocMalformedError("BOC declares no roots") }
        guard cellCount <= maxCellCount else {
            throw BocMalformedError("MAX_CELL_COUNT (\(maxCellCount)) exceeded: BOC declares \(cellCount) cells")
        }
        guard rootCount + absentCount <= cellCount else {
            throw BocMalformedError("BOC declares more roots than cells")
        }
        guard offsetSize <= 4 else { throw BocMalformedError("Unsupported total-size width \(offsetSize)") }
        _ = try uint(offsetSize)

        var roots = [Int]()
        for _ in 0..<rootCount { roots.append(try uint(refSize)) }
        if hasIndex { for _ in 0..<cellCount { _ = try uint(offsetSize) } }

        var cells = [TonCell]()
        cells.reserveCapacity(cellCount)
        for _ in 0..<cellCount {
            let d1 = try u8()
            let d2 = try u8()
            let refCount = d1 & 0x07
            let isExotic = (d1 & 0x08) != 0
            let hasHashes = (d1 & 0x10) != 0
            guard refCount <= 4 else { throw BocMalformedError("Cell declares \(refCount) refs (max 4)") }

            if hasHashes {
                let level = (d1 >> 5) & 0x03
                let hashCount = level + 1
                for _ in 0..<(hashCount * 32 + hashCount * 2) { _ = try u8() }
            }

            let dataBytes = (d2 >> 1) + (d2 & 1)
            guard offset + dataBytes <= raw.count else { throw BocMalformedError("Cell data truncated") }
            let data = Array(raw[offset..<(offset + dataBytes)])
            offset += dataBytes

            // An odd d2 means the final byte is augmented: a 1 bit followed by zero padding.
            var bitLength: Int
            if (d2 & 1) == 0 {
                bitLength = d2 * 4
            } else {
                let last = Int(data.last ?? 0)
                var trailing = 0
                var mask = 1
                while trailing < 8 && (last & mask) == 0 { trailing += 1; mask <<= 1 }
                bitLength = (dataBytes * 8) - trailing - 1
            }
            guard bitLength >= 0, bitLength <= dataBytes * 8 else {
                throw BocMalformedError("Cell declares an impossible bit length")
            }

            var refs = [Int]()
            for _ in 0..<refCount {
                let index = try uint(refSize)
                guard index < cellCount else { throw BocMalformedError("Cell reference \(index) is out of range") }
                refs.append(index)
            }
            cells.append(TonCell(data: data, bitLength: bitLength, refs: refs, isExotic: isExotic))
        }

        if hasCrc && offset + 4 <= raw.count { offset += 4 }

        try validateAcyclicAndBounded(cells, roots)
        return cells
    }

    /// Iterative depth-first walk. Bounds depth and rejects any reference that does not point
    /// strictly forward, which makes a cycle unrepresentable rather than merely detected late.
    private func validateAcyclicAndBounded(_ cells: [TonCell], _ roots: [Int]) throws {
        var visited = Set<Int>()
        for root in roots {
            guard root < cells.count else { throw BocMalformedError("Root index \(root) is out of range") }
            var stack: [(Int, Int)] = [(root, 1)]
            while let (index, depth) = stack.popLast() {
                guard depth <= maxCellDepth else {
                    throw BocMalformedError("MAX_CELL_DEPTH (\(maxCellDepth)) exceeded")
                }
                if !visited.insert(index).inserted && depth > 1 { continue }
                for ref in cells[index].refs {
                    guard ref > index else {
                        throw BocMalformedError("Cyclic or backward cell reference detected (\(index) -> \(ref))")
                    }
                    stack.append((ref, depth + 1))
                }
            }
        }
    }

    /// Decodes the root cell's 32-bit opcode into something a confirmation dialog can show.
    public func decodePayload(_ payload: String?) throws -> DecodedBocPayload {
        let cells = try parseBase64(payload)
        guard let root = cells.first else { throw BocMalformedError("BOC contains no cells") }
        var slice = TonCellSlice(root)

        guard slice.remainingBits >= 32 else {
            return DecodedBocPayload(
                opcode: "0x", kind: "empty", summary: "Empty payload",
                destination: nil, amountRaw: nil, comment: nil, queryId: nil,
                isKnown: true, warnings: []
            )
        }

        let opcode = UInt32(try slice.readUInt(32))
        let opcodeHex = String(format: "0x%08x", opcode)

        switch opcode {
        case Self.opTextComment:
            let text = try slice.readTextTail()
            return DecodedBocPayload(
                opcode: opcodeHex, kind: "comment",
                summary: text.isEmpty ? "Text comment (empty)" : "Comment: \(text)",
                destination: nil, amountRaw: nil, comment: text, queryId: nil,
                isKnown: true, warnings: []
            )

        case Self.opJettonTransfer:
            let queryId = try slice.readUInt(64)
            let amount = try slice.readCoins()
            let destination = try slice.readAddress()
            return DecodedBocPayload(
                opcode: opcodeHex, kind: "jetton_transfer",
                summary: "Jetton transfer of \(amount) to \(destination ?? "an unspecified address")",
                destination: destination, amountRaw: amount, comment: nil, queryId: queryId,
                isKnown: true, warnings: []
            )

        case Self.opNftTransfer:
            let queryId = try slice.readUInt(64)
            let newOwner = try slice.readAddress()
            return DecodedBocPayload(
                opcode: opcodeHex, kind: "nft_transfer",
                summary: "NFT ownership transfer to \(newOwner ?? "an unspecified address")",
                destination: newOwner, amountRaw: nil, comment: nil, queryId: queryId,
                isKnown: true,
                warnings: ["This transfers ownership of an NFT out of your wallet."]
            )

        default:
            return DecodedBocPayload(
                opcode: opcodeHex, kind: "unknown",
                summary: "Unrecognised contract call (\(opcodeHex)). The payload could not be verified.",
                destination: nil, amountRaw: nil, comment: nil, queryId: nil,
                isKnown: false,
                warnings: ["UNVERIFIED PAYLOAD: this message's opcode is not a known standard operation."]
            )
        }
    }
}
