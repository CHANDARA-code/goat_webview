import XCTest
@testable import GoatWebView

/**
 * The fixtures here are byte-identical to the Android suites (`Keccak256Test`, `EvmDecoderTest`,
 * `TonBocParserTest`, `SolanaTxDecoderTest`). That is the point: the two decoders must agree, and
 * the parity gate only checks that action *names* dispatch on both platforms, never that the two
 * implementations reach the same verdict.
 */
final class GoatWeb3DecoderTests: XCTestCase {

    // MARK: - Keccak-256

    func testKeccakKnownAnswerVectors() {
        XCTAssertEqual(Keccak256.hex(""), "c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470")
        XCTAssertEqual(Keccak256.hex("abc"), "4e03657aea45a94fc7d47ba826c8d667c0d1e6e33a64a036ec44f58fa12d6c45")
        XCTAssertEqual(Keccak256.hex("hello"), "1c8aff950685c2ed4bc3174f3472287b56d9517b9c948127319a09a7a36deac8")
    }

    func testKeccakMultiBlockInput() {
        XCTAssertEqual(
            Keccak256.hex(String(repeating: "a", count: 200)),
            "96ea54061def936c4be90b518992fdc6f12f535068a256229aca54267b4d084d"
        )
    }

    func testDerivedSelectorsMatchThePublishedEthereumValues() {
        XCTAssertEqual(Keccak256.functionSelector("transfer(address,uint256)"), "0xa9059cbb")
        XCTAssertEqual(Keccak256.functionSelector("approve(address,uint256)"), "0x095ea7b3")
        XCTAssertEqual(Keccak256.functionSelector("transferFrom(address,address,uint256)"), "0x23b872dd")
        XCTAssertEqual(Keccak256.functionSelector("setApprovalForAll(address,bool)"), "0xa22cb465")
        XCTAssertEqual(Keccak256.functionSelector("safeTransferFrom(address,address,uint256)"), "0x42842e0e")
        XCTAssertEqual(
            Keccak256.functionSelector("permit(address,address,uint256,uint256,uint8,bytes32,bytes32)"),
            "0xd505accf"
        )
        XCTAssertEqual(Keccak256.functionSelector("increaseAllowance(address,uint256)"), "0x39509351")
    }

    // MARK: - EvmUInt256

    func testUInt256HandlesValuesBeyondUInt64() {
        XCTAssertEqual(
            EvmUInt256.max.description,
            "115792089237316195423570985008687907853269984665640564039457584007913129639935"
        )
        XCTAssertEqual(
            EvmUInt256.uint160Max.description,
            "1461501637330902918203684832716283019655932542975"
        )
        XCTAssertTrue(EvmUInt256.uint160Max < EvmUInt256.max)
        XCTAssertTrue(EvmUInt256(0).isZero)
        XCTAssertEqual(EvmUInt256(1_500_000).description, "1500000")
    }

    func testDecimalStringToUInt256RoundTrips() {
        let value = Eip712Parser.decimalToUInt256("1461501637330902918203684832716283019655932542975")
        XCTAssertEqual(value, EvmUInt256.uint160Max)
        XCTAssertNil(Eip712Parser.decimalToUInt256("not a number"))
    }

    // MARK: - EVM calldata (fixtures shared with Android)

    private enum Calldata {
        static let spender = "0x1111111111111111111111111111111111111111"
        static let recipient = "0x2222222222222222222222222222222222222222"

        static let approveUnlimited =
            "0x095ea7b30000000000000000000000001111111111111111111111111111111111111111ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
        static let approve100Usdc =
            "0x095ea7b300000000000000000000000011111111111111111111111111111111111111110000000000000000000000000000000000000000000000000000000005f5e100"
        static let transfer5Usdc =
            "0xa9059cbb000000000000000000000000222222222222222222222222222222222222222200000000000000000000000000000000000000000000000000000000004c4b40"
        static let setApprovalAll =
            "0xa22cb46500000000000000000000000011111111111111111111111111111111111111110000000000000000000000000000000000000000000000000000000000000001"
        static let revokeApprovalAll =
            "0xa22cb46500000000000000000000000011111111111111111111111111111111111111110000000000000000000000000000000000000000000000000000000000000000"
        static let permit2Unlimited =
            "0x87517c4500000000000000000000000033333333333333333333333333333333333333330000000000000000000000001111111111111111111111111111111111111111000000000000000000000000ffffffffffffffffffffffffffffffffffffffff00000000000000000000000000000000000000000000000000000000713fb300"
    }

    func testUnlimitedErc20ApprovalIsFlaggedCritical() {
        let decoded = EvmAbiDecoder.decode(Calldata.approveUnlimited)!
        XCTAssertEqual(decoded.methodName, "approve")
        XCTAssertEqual(decoded.recipient, Calldata.spender)
        XCTAssertEqual(decoded.amountRaw, EvmUInt256.max)
        XCTAssertTrue(decoded.isUnlimitedApproval)
        XCTAssertTrue(decoded.warnings.contains { $0.contains("Unlimited Approval") })
    }

    func testBoundedApprovalIsNotFlaggedUnlimited() {
        let decoded = EvmAbiDecoder.decode(Calldata.approve100Usdc)!
        XCTAssertTrue(decoded.isApproval)
        XCTAssertFalse(decoded.isUnlimitedApproval)
        XCTAssertEqual(decoded.amountRaw?.description, "100000000")
        XCTAssertEqual(EvmAbiDecoder.formatUnits(decoded.amountRaw, decimals: 6), "100")
        XCTAssertTrue(decoded.warnings.isEmpty)
    }

    func testPlainTransferIsDecoded() {
        let decoded = EvmAbiDecoder.decode(Calldata.transfer5Usdc)!
        XCTAssertEqual(decoded.methodName, "transfer")
        XCTAssertEqual(decoded.recipient, Calldata.recipient)
        XCTAssertEqual(EvmAbiDecoder.formatUnits(decoded.amountRaw, decimals: 6), "5")
        XCTAssertFalse(decoded.isApproval)
    }

    func testSetApprovalForAllDistinguishesGrantFromRevoke() {
        let grant = EvmAbiDecoder.decode(Calldata.setApprovalAll)!
        XCTAssertTrue(grant.isSetApprovalForAll)
        XCTAssertTrue(grant.isUnlimitedApproval)
        XCTAssertTrue(grant.warnings.contains { $0.contains("Collection-Wide") })

        let revoke = EvmAbiDecoder.decode(Calldata.revokeApprovalAll)!
        XCTAssertTrue(revoke.isSetApprovalForAll)
        XCTAssertFalse(revoke.isUnlimitedApproval)
        XCTAssertTrue(revoke.warnings.isEmpty)
        XCTAssertTrue(revoke.description.contains("Revoke"))
    }

    func testPermit2ApproveUsesTheUint160Ceiling() {
        let decoded = EvmAbiDecoder.decode(Calldata.permit2Unlimited)!
        XCTAssertEqual(decoded.methodName, "permit2Approve")
        XCTAssertEqual(decoded.recipient, Calldata.spender)
        XCTAssertEqual(decoded.amountRaw, EvmUInt256.uint160Max)
        XCTAssertTrue(decoded.isUnlimitedApproval, "2^160-1 is unlimited for Permit2")
    }

    func testUnknownCalldataIsReportedUnverified() {
        let decoded = EvmAbiDecoder.decode("0xdeadbeef" + String(repeating: "00", count: 32))!
        XCTAssertFalse(decoded.isKnown)
        XCTAssertEqual(decoded.methodName, "unknown")
        XCTAssertTrue(decoded.warnings.contains { $0.contains("UNVERIFIED CONTRACT") })
    }

    func testMalformedCalldataIsHandled() {
        XCTAssertNil(EvmAbiDecoder.decode(nil))
        XCTAssertNil(EvmAbiDecoder.decode(""))
        XCTAssertNil(EvmAbiDecoder.decode("0x"))
        XCTAssertNil(EvmAbiDecoder.decode("0xzzzz"))
        let truncated = EvmAbiDecoder.decode("0x095ea7b3" + String(repeating: "00", count: 10))!
        XCTAssertEqual(truncated.methodName, "approve")
        XCTAssertNil(truncated.recipient)
    }

    func testFormatUnitsMatchesAndroid() {
        XCTAssertEqual(EvmAbiDecoder.formatUnits(EvmUInt256(1_000_000), decimals: 6), "1")
        XCTAssertEqual(EvmAbiDecoder.formatUnits(EvmUInt256(1_500_000), decimals: 6), "1.5")
        XCTAssertEqual(EvmAbiDecoder.formatUnits(EvmUInt256(1), decimals: 6), "0.000001")
        XCTAssertEqual(EvmAbiDecoder.formatUnits(EvmUInt256.max, decimals: 18), "Unlimited")
        XCTAssertEqual(EvmAbiDecoder.formatUnits(nil, decimals: 18), "0")
    }

    // MARK: - EIP-712 / Permit2

    private func permitSingle(amount: String, expiration: Int64) -> String {
        """
        {"primaryType":"PermitSingle",
         "domain":{"name":"Permit2","chainId":"1","verifyingContract":"\(Eip712Parser.permit2Contract)"},
         "message":{"details":{"token":"\(Calldata.recipient)","amount":"\(amount)","expiration":"\(expiration)","nonce":"0"},
                    "spender":"\(Calldata.spender)","sigDeadline":"1900000000"}}
        """
    }

    func testUnlimitedPermit2SignatureIsFlaggedCritical() {
        let decoded = Eip712Parser.parse(
            permitSingle(amount: EvmUInt256.uint160Max.description, expiration: 1_900_000_000)
        )!
        XCTAssertEqual(decoded.primaryType, "PermitSingle")
        XCTAssertEqual(decoded.verifyingContract, Eip712Parser.permit2Contract)
        XCTAssertEqual(decoded.spender, Calldata.spender)
        XCTAssertTrue(decoded.isUnlimitedAllowance)
        XCTAssertTrue(decoded.isPermit)
        XCTAssertTrue(decoded.warnings.contains { $0.contains("Unlimited Allowance") })
        XCTAssertTrue(decoded.warnings.contains { $0.contains("off-chain signature") })
    }

    func testBoundedShortLivedPermit2IsNotFlagged() {
        let soon = Int64(Date().timeIntervalSince1970) + 3600
        let decoded = Eip712Parser.parse(permitSingle(amount: "1000000", expiration: soon))!
        XCTAssertFalse(decoded.isUnlimitedAllowance)
        XCTAssertFalse(decoded.isLongLivedApproval)
    }

    func testLongLivedApprovalIsFlaggedEvenWhenBounded() {
        let farFuture = Int64(Date().timeIntervalSince1970) + 400 * 24 * 3600
        let decoded = Eip712Parser.parse(permitSingle(amount: "1000000", expiration: farFuture))!
        XCTAssertFalse(decoded.isUnlimitedAllowance)
        XCTAssertTrue(decoded.isLongLivedApproval)
        XCTAssertTrue(decoded.warnings.contains { $0.contains("Long-Lived") })
    }

    func testPermitBatchIsRecognisedAndSummarised() {
        let json = """
        {"primaryType":"PermitBatch",
         "domain":{"name":"Permit2","chainId":"1","verifyingContract":"\(Eip712Parser.permit2Contract)"},
         "message":{"details":[{"token":"\(Calldata.recipient)","amount":"\(EvmUInt256.uint160Max.description)","expiration":"1900000000"},
                               {"token":"\(Calldata.spender)","amount":"1","expiration":"1900000000"}],
                    "spender":"\(Calldata.spender)"}}
        """
        let decoded = Eip712Parser.parse(json)!
        XCTAssertEqual(decoded.primaryType, "PermitBatch")
        XCTAssertTrue(decoded.isUnlimitedAllowance)
        XCTAssertTrue(decoded.summary.contains("2 token"))
    }

    func testUnknownTypedDataShapeIsWarnedAbout() {
        let decoded = Eip712Parser.parse(
            #"{"primaryType":"MyCustomOrder","domain":{"name":"Whatever"},"message":{"foo":"bar"}}"#
        )!
        XCTAssertFalse(decoded.isPermit)
        XCTAssertTrue(decoded.warnings.contains { $0.contains("Unverified typed data") })
    }

    func testMalformedTypedDataReturnsNil() {
        XCTAssertNil(Eip712Parser.parse(nil))
        XCTAssertNil(Eip712Parser.parse(""))
        XCTAssertNil(Eip712Parser.parse("not json"))
        XCTAssertNotNil(Eip712Parser.parse("{}"))
    }

    // MARK: - TON BOC (fixtures shared with Android)

    private enum Boc {
        static let textComment = "te6ccgEBAQEAFgAAKAAAAABUaGFua3MgZm9yIGx1bmNo"
        static let jettonTransfer =
            "te6ccgEBAQEANAAAYw+KfqUAAAAAAAAwOUWWgvAIAAACBAYICgwOEBIUFhgaHB4gIiQmKCosLjAyNDY4Ojw/"
        static let nftTransfer =
            "te6ccgEBAQEAMAAAW1/MPRQAAAAAAAAAB4AAACBAYICgwOEBIUFhgaHB4gIiQmKCosLjAyNDY4Ojw/A="
        static let unknownOpcode = "te6ccgEBAQEABgAACN6tvu8="
        static let cyclic = "te6ccgEBAgEABgABAAEBAAA="
        static let hugeCount = "te6ccgICE4gAAQAAAAIAAAAA"
        static let jettonTruncated = "te6ccgECAQEAAAYAAAgPin6l"
    }

    func testDecodesATextComment() throws {
        let decoded = try TonBocParser().decodePayload(Boc.textComment)
        XCTAssertEqual(decoded.opcode, "0x00000000")
        XCTAssertEqual(decoded.kind, "comment")
        XCTAssertEqual(decoded.comment, "Thanks for lunch")
    }

    func testDecodesATep74JettonTransfer() throws {
        let decoded = try TonBocParser().decodePayload(Boc.jettonTransfer)
        XCTAssertEqual(decoded.opcode, "0x0f8a7ea5")
        XCTAssertEqual(decoded.kind, "jetton_transfer")
        XCTAssertEqual(decoded.amountRaw?.description, "1500000000")
        XCTAssertEqual(decoded.queryId, 12345)
        XCTAssertTrue(decoded.destination?.hasPrefix("0:") ?? false)
        XCTAssertEqual(decoded.destination?.count, 66)
    }

    func testDecodesATep62NftTransfer() throws {
        let decoded = try TonBocParser().decodePayload(Boc.nftTransfer)
        XCTAssertEqual(decoded.opcode, "0x5fcc3d14")
        XCTAssertEqual(decoded.kind, "nft_transfer")
        XCTAssertEqual(decoded.queryId, 7)
        XCTAssertTrue(decoded.warnings.contains { $0.contains("ownership") })
    }

    func testUnknownTonOpcodeIsReportedUnverified() throws {
        let decoded = try TonBocParser().decodePayload(Boc.unknownOpcode)
        XCTAssertEqual(decoded.opcode, "0xdeadbeef")
        XCTAssertFalse(decoded.isKnown)
        XCTAssertTrue(decoded.warnings.contains { $0.contains("UNVERIFIED PAYLOAD") })
    }

    func testCyclicBocIsRejected() {
        XCTAssertThrowsError(try TonBocParser().parseBase64(Boc.cyclic)) { error in
            XCTAssertTrue((error as? BocMalformedError)?.detail.contains("Cyclic") ?? false)
        }
    }

    func testCellCountBeyondTheLimitIsRejected() {
        XCTAssertThrowsError(try TonBocParser().parseBase64(Boc.hugeCount)) { error in
            XCTAssertTrue((error as? BocMalformedError)?.detail.contains("MAX_CELL_COUNT") ?? false)
        }
    }

    func testTruncatedTonSliceUnderflowsCleanly() {
        XCTAssertThrowsError(try TonBocParser().decodePayload(Boc.jettonTruncated)) { error in
            XCTAssertTrue((error as? BocMalformedError)?.detail.contains("underflow") ?? false)
        }
    }

    func testGarbageBocInputIsRejected() {
        for bad in [nil, "", "not base64 @@@", "aGVsbG8=", "te6ccg"] as [String?] {
            XCTAssertThrowsError(try TonBocParser().decodePayload(bad), "input \(bad ?? "nil") should be rejected")
        }
    }

    func testTonSliceBoundsAreCheckedOnEveryRead() throws {
        var slice = TonCellSlice(TonCell(data: [0xFF], bitLength: 8, refs: [], isExotic: false))
        XCTAssertEqual(try slice.readUInt(8), 255)
        XCTAssertEqual(slice.remainingBits, 0)
        XCTAssertThrowsError(try slice.readBit())
        XCTAssertThrowsError(try slice.readUInt(64))
        XCTAssertThrowsError(try slice.skipBits(-1))
    }

    // MARK: - Solana (fixtures shared with Android)

    private enum SolanaFixture {
        static let solTransfer =
            "AQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAEDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQECAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkBAgIAAQwCAAAAAC9oWQAAAAA="
        static let splTransferChecked =
            "AQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAEFAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUG3fbh12Whk9nL4UbO63msHLSF7V9bN5E6jPWFfv8AqQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJAQQEAQIDAAoMYBmFAQAAAAAG"
        static let v0WithLookup =
            "AQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAAQABAwEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJAQICAAEMAgAAAABlzR0AAAAAAQcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHAQMBBA=="
        static let unknownProgram =
            "AQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAECAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJAQEBAAKquw=="
        static let badProgramIndex =
            "AQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAEDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQECAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkBCQIAAQEA"
    }

    func testDecodesALegacySystemTransfer() throws {
        let decoded = try SolanaTxDecoder.decodeBase64(SolanaFixture.solTransfer)
        XCTAssertEqual(decoded.version, "legacy")
        XCTAssertEqual(decoded.instructions.count, 1)
        let instruction = decoded.instructions[0]
        XCTAssertEqual(instruction.kind, "sol_transfer")
        XCTAssertEqual(instruction.amountRaw, 1_500_000_000)
        XCTAssertTrue(instruction.summary.contains("1.5 SOL"))
        XCTAssertEqual(decoded.addressTableLookups, 0)
    }

    func testDecodesSplTransferCheckedWithCorrectDecimalScaling() throws {
        let decoded = try SolanaTxDecoder.decodeBase64(SolanaFixture.splTransferChecked)
        let instruction = decoded.instructions[0]
        XCTAssertEqual(instruction.kind, "spl_transfer_checked")
        XCTAssertEqual(instruction.programName, "SPL Token")
        XCTAssertEqual(instruction.amountRaw, 25_500_000)
        XCTAssertEqual(instruction.decimals, 6)
        XCTAssertTrue(instruction.summary.contains("25.5"))
    }

    func testDecodesAVersionedV0TransactionAndFlagsLookupTables() throws {
        let decoded = try SolanaTxDecoder.decodeBase64(SolanaFixture.v0WithLookup)
        XCTAssertEqual(decoded.version, "v0")
        XCTAssertEqual(decoded.addressTableLookups, 1)
        XCTAssertTrue(decoded.requiresAddressLookupResolution)
        XCTAssertTrue(decoded.warnings.contains { $0.contains("lookup tables") })
        XCTAssertEqual(decoded.instructions[0].amountRaw, 500_000_000)
    }

    func testUnknownSolanaProgramIsReportedUnverified() throws {
        let decoded = try SolanaTxDecoder.decodeBase64(SolanaFixture.unknownProgram)
        XCTAssertFalse(decoded.instructions[0].isKnown)
        XCTAssertTrue(decoded.warnings.contains { $0.contains("UNVERIFIED PROGRAM") })
    }

    func testInstructionNamingANonexistentAccountIsRejected() {
        XCTAssertThrowsError(try SolanaTxDecoder.decodeBase64(SolanaFixture.badProgramIndex))
    }

    func testGarbageSolanaInputIsRejected() {
        for bad in [nil, "", "@@@ not base64", "AAAA"] as [String?] {
            XCTAssertThrowsError(try SolanaTxDecoder.decodeBase64(bad), "input \(bad ?? "nil") should be rejected")
        }
    }

    func testBase58EncodesTheAllZeroSystemProgramId() {
        XCTAssertEqual(Base58.encode([UInt8](repeating: 0, count: 32)), SolanaTxDecoder.systemProgram)
    }

    func testSolanaFormatUnitsMatchesAndroid() {
        XCTAssertEqual(SolanaTxDecoder.formatUnits(1_500_000_000, decimals: 9), "1.5")
        XCTAssertEqual(SolanaTxDecoder.formatUnits(25_500_000, decimals: 6), "25.5")
        XCTAssertEqual(SolanaTxDecoder.formatUnits(1_000_000, decimals: 6), "1")
        XCTAssertEqual(SolanaTxDecoder.formatUnits(nil, decimals: 9), "0")
    }
}
