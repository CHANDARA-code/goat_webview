import Foundation

/**
 * Keccak-256 as Ethereum uses it.
 *
 * Not interchangeable with CryptoKit's SHA3 (which is NIST SHA-3, padding `0x06`, versus original
 * Keccak's `0x01`). Present so ABI function selectors are derived from their signatures rather
 * than transcribed as magic constants.
 */
public enum Keccak256 {

    private static let rateBytes = 136

    private static let roundConstants: [UInt64] = [
        0x0000000000000001, 0x0000000000008082, 0x800000000000808A, 0x8000000080008000,
        0x000000000000808B, 0x0000000080000001, 0x8000000080008081, 0x8000000000008009,
        0x000000000000008A, 0x0000000000000088, 0x0000000080008009, 0x000000008000000A,
        0x000000008000808B, 0x800000000000008B, 0x8000000000008089, 0x8000000000008003,
        0x8000000000008002, 0x8000000000000080, 0x000000000000800A, 0x800000008000000A,
        0x8000000080008081, 0x8000000000008080, 0x0000000080000001, 0x8000000080008008
    ]

    /// Rotation offsets indexed as `x + 5 * y`.
    private static let rotation: [UInt64] = [
        0, 1, 62, 28, 27,
        36, 44, 6, 55, 20,
        3, 10, 43, 25, 39,
        41, 45, 15, 21, 8,
        18, 2, 61, 56, 14
    ]

    public static func digest(_ input: Data) -> Data {
        var state = [UInt64](repeating: 0, count: 25)
        var padded = [UInt8](input)
        let padLength = rateBytes - (padded.count % rateBytes)
        padded.append(0x01)
        padded.append(contentsOf: [UInt8](repeating: 0, count: padLength - 1))
        padded[padded.count - 1] |= 0x80

        var offset = 0
        while offset < padded.count {
            for i in 0..<(rateBytes / 8) {
                var lane: UInt64 = 0
                for j in stride(from: 7, through: 0, by: -1) {
                    lane = (lane << 8) | UInt64(padded[offset + i * 8 + j])
                }
                state[i] ^= lane
            }
            keccakF(&state)
            offset += rateBytes
        }

        var out = Data()
        for i in 0..<4 {
            let lane = state[i]
            for j in 0..<8 { out.append(UInt8((lane >> (8 * UInt64(j))) & 0xff)) }
        }
        return out
    }

    public static func digest(_ input: String) -> Data { digest(Data(input.utf8)) }

    public static func hex(_ input: String) -> String {
        digest(input).map { String(format: "%02x", $0) }.joined()
    }

    /// First 4 bytes of keccak256(signature), lowercase hex with a `0x` prefix.
    public static func functionSelector(_ signature: String) -> String {
        "0x" + digest(signature).prefix(4).map { String(format: "%02x", $0) }.joined()
    }

    private static func keccakF(_ state: inout [UInt64]) {
        var c = [UInt64](repeating: 0, count: 5)
        var d = [UInt64](repeating: 0, count: 5)
        var b = [UInt64](repeating: 0, count: 25)

        for round in 0..<24 {
            for x in 0..<5 {
                c[x] = state[x] ^ state[x + 5] ^ state[x + 10] ^ state[x + 15] ^ state[x + 20]
            }
            for x in 0..<5 {
                d[x] = c[(x + 4) % 5] ^ rotl(c[(x + 1) % 5], 1)
            }
            for y in 0..<5 {
                for x in 0..<5 { state[x + 5 * y] ^= d[x] }
            }
            for y in 0..<5 {
                for x in 0..<5 {
                    b[y + 5 * ((2 * x + 3 * y) % 5)] = rotl(state[x + 5 * y], rotation[x + 5 * y])
                }
            }
            for y in 0..<5 {
                for x in 0..<5 {
                    state[x + 5 * y] = b[x + 5 * y] ^ (~b[(x + 1) % 5 + 5 * y] & b[(x + 2) % 5 + 5 * y])
                }
            }
            state[0] ^= roundConstants[round]
        }
    }

    private static func rotl(_ value: UInt64, _ shift: UInt64) -> UInt64 {
        shift == 0 ? value : (value << shift) | (value >> (64 - shift))
    }
}
