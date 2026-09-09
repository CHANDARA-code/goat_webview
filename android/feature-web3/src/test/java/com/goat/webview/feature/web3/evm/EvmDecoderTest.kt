package com.goat.webview.feature.web3.evm

import com.goat.webview.feature.web3.spi.WalletContext
import com.goat.webview.feature.web3.spi.WalletAccountInfo
import com.goat.webview.feature.web3.spi.Web3ErrorCode
import com.goat.webview.feature.web3.spi.Web3Exception
import android.content.Context
import android.content.ContextWrapper
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.math.BigInteger

/**
 * Calldata and EIP-712 fixtures are ABI-encoded from their parameters, not transcribed, so a
 * fixture cannot silently drift from what it claims to represent.
 */
class EvmDecoderTest {

    private companion object {
        const val SPENDER = "0x1111111111111111111111111111111111111111"
        const val RECIPIENT = "0x2222222222222222222222222222222222222222"

        const val APPROVE_UNLIMITED =
            "0x095ea7b30000000000000000000000001111111111111111111111111111111111111111ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
        const val APPROVE_100USDC =
            "0x095ea7b300000000000000000000000011111111111111111111111111111111111111110000000000000000000000000000000000000000000000000000000005f5e100"
        const val TRANSFER_5USDC =
            "0xa9059cbb000000000000000000000000222222222222222222222222222222222222222200000000000000000000000000000000000000000000000000000000004c4b40"
        const val SET_APPROVAL_ALL =
            "0xa22cb46500000000000000000000000011111111111111111111111111111111111111110000000000000000000000000000000000000000000000000000000000000001"
        const val REVOKE_APPROVAL_ALL =
            "0xa22cb46500000000000000000000000011111111111111111111111111111111111111110000000000000000000000000000000000000000000000000000000000000000"
        const val PERMIT2_UNLIMITED_CALL =
            "0x87517c4500000000000000000000000033333333333333333333333333333333333333330000000000000000000000001111111111111111111111111111111111111111000000000000000000000000ffffffffffffffffffffffffffffffffffffffff00000000000000000000000000000000000000000000000000000000713fb300"
        const val TRANSFER_FROM =
            "0x23b872dd00000000000000000000000022222222222222222222222222222222222222220000000000000000000000001111111111111111111111111111111111111111000000000000000000000000000000000000000000000000000000000000002a"
    }

    private class FakeTestContext : ContextWrapper(null) {
        override fun getApplicationContext(): Context = this
    }

    private class FakeSigner : GoatEvmSigner {
        override val walletName = "Host Wallet"
        var lastMessageType: String? = null
        override suspend fun account(chainId: String, ctx: WalletContext) =
            WalletAccountInfo("0xhost", "pub", chainId, walletName)
        override suspend fun signTransaction(txData: JsonObject, chainId: String, ctx: WalletContext) =
            buildJsonObject { put("signature", "0xsig"); put("txHash", "0xhash") }
        override suspend fun signMessage(message: String, messageType: String, ctx: WalletContext): JsonObject {
            lastMessageType = messageType
            return buildJsonObject { put("signature", "0xmsgsig"); put("address", "0xhost") }
        }
    }

    private fun ctx() = WalletContext("tenant", "https://appassets.androidplatform.net", FakeTestContext())

    // ---- Calldata decoding ----

    @Test
    fun testUnlimitedErc20ApprovalIsFlaggedCritical() {
        val decoded = EvmAbiDecoder.decode(APPROVE_UNLIMITED)!!
        assertEquals("approve", decoded.methodName)
        assertEquals(SPENDER, decoded.recipient)
        assertEquals(EvmAbiDecoder.UINT256_MAX, decoded.amountRaw)
        assertTrue(decoded.isApproval)
        assertTrue("2^256-1 must be flagged unlimited", decoded.isUnlimitedApproval)
        assertTrue(decoded.warnings.any { it.contains("Unlimited Approval") })
    }

    @Test
    fun testBoundedApprovalIsNotFlaggedUnlimited() {
        val decoded = EvmAbiDecoder.decode(APPROVE_100USDC)!!
        assertTrue(decoded.isApproval)
        assertFalse("100 USDC must not be flagged unlimited", decoded.isUnlimitedApproval)
        assertEquals(BigInteger.valueOf(100_000000L), decoded.amountRaw)
        assertTrue(decoded.warnings.isEmpty())
        assertEquals("100", EvmAbiDecoder.formatUnits(decoded.amountRaw, 6))
    }

    @Test
    fun testPlainTransferIsDecodedWithRecipientAndAmount() {
        val decoded = EvmAbiDecoder.decode(TRANSFER_5USDC)!!
        assertEquals("transfer", decoded.methodName)
        assertEquals(RECIPIENT, decoded.recipient)
        assertEquals(BigInteger.valueOf(5_000000L), decoded.amountRaw)
        assertFalse(decoded.isApproval)
        assertEquals("5", EvmAbiDecoder.formatUnits(decoded.amountRaw, 6))
    }

    @Test
    fun testSetApprovalForAllDistinguishesGrantFromRevoke() {
        val grant = EvmAbiDecoder.decode(SET_APPROVAL_ALL)!!
        assertTrue(grant.isSetApprovalForAll)
        assertTrue("granting collection-wide access is a critical approval", grant.isUnlimitedApproval)
        assertTrue(grant.warnings.any { it.contains("Collection-Wide") })

        val revoke = EvmAbiDecoder.decode(REVOKE_APPROVAL_ALL)!!
        assertTrue(revoke.isSetApprovalForAll)
        assertFalse("revoking must never be flagged dangerous", revoke.isUnlimitedApproval)
        assertTrue(revoke.warnings.isEmpty())
        assertTrue(revoke.description.contains("Revoke"))
    }

    @Test
    fun testPermit2ApproveUsesTheUint160Ceiling() {
        val decoded = EvmAbiDecoder.decode(PERMIT2_UNLIMITED_CALL)!!
        assertEquals("permit2Approve", decoded.methodName)
        assertEquals(SPENDER, decoded.recipient)
        assertEquals(EvmAbiDecoder.UINT160_MAX, decoded.amountRaw)
        assertTrue(
            "2^160-1 is unlimited for Permit2 even though it is far below 2^256-1",
            decoded.isUnlimitedApproval
        )
    }

    @Test
    fun testTransferFromDecodesBothParties() {
        val decoded = EvmAbiDecoder.decode(TRANSFER_FROM)!!
        assertEquals("transferFrom", decoded.methodName)
        assertEquals(SPENDER, decoded.recipient)
        assertEquals(BigInteger.valueOf(42), decoded.amountRaw)
    }

    @Test
    fun testUnknownCalldataIsReportedAsUnverifiedNotGuessedAt() {
        val decoded = EvmAbiDecoder.decode("0xdeadbeef" + "00".repeat(32))!!
        assertFalse(decoded.isKnown)
        assertEquals("unknown", decoded.methodName)
        assertTrue(decoded.description.contains("could not be verified"))
        assertTrue(decoded.warnings.any { it.contains("UNVERIFIED CONTRACT") })
    }

    @Test
    fun testMalformedAndEmptyCalldataAreHandled() {
        assertNull(EvmAbiDecoder.decode(null))
        assertNull(EvmAbiDecoder.decode(""))
        assertNull(EvmAbiDecoder.decode("0x"))
        assertNull(EvmAbiDecoder.decode("0xzzzz"))
        // A known selector with truncated arguments must not throw.
        val truncated = EvmAbiDecoder.decode("0x095ea7b3" + "00".repeat(10))!!
        assertEquals("approve", truncated.methodName)
        assertNull(truncated.recipient)
    }

    @Test
    fun testFormatUnitsHandlesDecimalsAndUnlimited() {
        assertEquals("1", EvmAbiDecoder.formatUnits(BigInteger.valueOf(1_000000L), 6))
        assertEquals("1.5", EvmAbiDecoder.formatUnits(BigInteger.valueOf(1_500000L), 6))
        assertEquals("0.000001", EvmAbiDecoder.formatUnits(BigInteger.ONE, 6))
        assertEquals("Unlimited", EvmAbiDecoder.formatUnits(EvmAbiDecoder.UINT256_MAX, 18))
        assertEquals("0", EvmAbiDecoder.formatUnits(null, 18))
    }

    // ---- EIP-712 / Permit2 ----

    private fun permitSingle(amount: String, expiration: Long): String = """
        {"primaryType":"PermitSingle",
         "domain":{"name":"Permit2","chainId":"1","verifyingContract":"${Eip712Parser.PERMIT2_CONTRACT}"},
         "message":{"details":{"token":"$RECIPIENT","amount":"$amount","expiration":"$expiration","nonce":"0"},
                    "spender":"$SPENDER","sigDeadline":"1900000000"}}
    """.trimIndent()

    @Test
    fun testUnlimitedPermit2SignatureIsFlaggedCritical() {
        val decoded = Eip712Parser.parse(
            permitSingle(EvmAbiDecoder.UINT160_MAX.toString(), 1900000000L)
        )!!
        assertEquals("PermitSingle", decoded.primaryType)
        assertEquals(Eip712Parser.PERMIT2_CONTRACT, decoded.verifyingContract)
        assertEquals(SPENDER, decoded.spender)
        assertTrue("2^160-1 must trip the Permit2 unlimited check", decoded.isUnlimitedAllowance)
        assertTrue(decoded.isPermit)
        assertTrue(decoded.warnings.any { it.contains("Unlimited Allowance") })
        assertTrue(
            "the user must be told this is an off-chain signature, not a transaction",
            decoded.warnings.any { it.contains("off-chain signature") }
        )
    }

    @Test
    fun testBoundedShortLivedPermit2IsNotFlagged() {
        val soon = System.currentTimeMillis() / 1000 + 3600
        val decoded = Eip712Parser.parse(permitSingle("1000000", soon))!!
        assertFalse(decoded.isUnlimitedAllowance)
        assertFalse(decoded.isLongLivedApproval)
        assertFalse(decoded.warnings.any { it.contains("Unlimited") })
    }

    @Test
    fun testLongLivedApprovalIsFlaggedEvenWhenBounded() {
        val farFuture = System.currentTimeMillis() / 1000 + 400L * 24 * 3600
        val decoded = Eip712Parser.parse(permitSingle("1000000", farFuture))!!
        assertFalse(decoded.isUnlimitedAllowance)
        assertTrue(decoded.isLongLivedApproval)
        assertTrue(decoded.warnings.any { it.contains("Long-Lived") })
    }

    @Test
    fun testPermitBatchIsRecognisedAndSummarised() {
        val json = """
            {"primaryType":"PermitBatch",
             "domain":{"name":"Permit2","chainId":"1","verifyingContract":"${Eip712Parser.PERMIT2_CONTRACT}"},
             "message":{"details":[{"token":"$RECIPIENT","amount":"${EvmAbiDecoder.UINT160_MAX}","expiration":"1900000000"},
                                   {"token":"$SPENDER","amount":"1","expiration":"1900000000"}],
                        "spender":"$SPENDER"}}
        """.trimIndent()
        val decoded = Eip712Parser.parse(json)!!
        assertEquals("PermitBatch", decoded.primaryType)
        assertTrue(decoded.isUnlimitedAllowance)
        assertTrue(decoded.summary.contains("2 token"))
    }

    @Test
    fun testEip2612PermitUsesTheUint256Ceiling() {
        val json = """
            {"primaryType":"Permit",
             "domain":{"name":"USD Coin","chainId":"1","verifyingContract":"$RECIPIENT"},
             "message":{"owner":"0xhost","spender":"$SPENDER","value":"${EvmAbiDecoder.UINT256_MAX}","deadline":"1900000000"}}
        """.trimIndent()
        val decoded = Eip712Parser.parse(json)!!
        assertTrue(decoded.isPermit)
        assertTrue(decoded.isUnlimitedAllowance)
        assertEquals(SPENDER, decoded.spender)
    }

    @Test
    fun testUnknownTypedDataShapeIsWarnedAboutNotSilentlyTrusted() {
        val json = """{"primaryType":"MyCustomOrder","domain":{"name":"Whatever"},"message":{"foo":"bar"}}"""
        val decoded = Eip712Parser.parse(json)!!
        assertFalse(decoded.isPermit)
        assertFalse(decoded.isKnownPermitShape)
        assertTrue(decoded.warnings.any { it.contains("Unverified typed data") })
    }

    @Test
    fun testMalformedTypedDataReturnsNullRatherThanThrowing() {
        assertNull(Eip712Parser.parse(null))
        assertNull(Eip712Parser.parse(""))
        assertNull(Eip712Parser.parse("not json"))
        assertNotNull(Eip712Parser.parse("{}"))
    }

    @Test
    fun testHexEncodedAmountsAreParsed() {
        val json = """
            {"primaryType":"PermitSingle",
             "domain":{"verifyingContract":"${Eip712Parser.PERMIT2_CONTRACT}"},
             "message":{"details":{"amount":"0xffffffffffffffffffffffffffffffffffffffff"},"spender":"$SPENDER"}}
        """.trimIndent()
        val decoded = Eip712Parser.parse(json)!!
        assertEquals(EvmAbiDecoder.UINT160_MAX, decoded.amountRaw)
        assertTrue(decoded.isUnlimitedAllowance)
    }

    // ---- Adapter ----

    @Test
    fun testAdapterPreviewSurfacesTheUnlimitedApproval() = runTest {
        val adapter = GoatEvmWalletAdapter(FakeSigner())
        val preview = adapter.decodeTransaction(buildJsonObject {
            put("to", RECIPIENT)
            put("data", APPROVE_UNLIMITED)
            put("chainId", "1")
        }, ctx()).getOrThrow()

        assertEquals("Ethereum", preview.networkName)
        assertEquals("approve", preview.methodName)
        assertEquals(SPENDER, preview.recipient)
        assertTrue(preview.isDangerousApproval)
        assertTrue(preview.isPermit2Unlimited)
        assertFalse(preview.isUnverifiedContract)
        assertTrue(preview.warnings.any { it.contains("Unlimited Approval") })
    }

    @Test
    fun testAdapterPreviewFlagsUnverifiedContract() = runTest {
        val adapter = GoatEvmWalletAdapter(FakeSigner())
        val preview = adapter.decodeTransaction(buildJsonObject {
            put("to", RECIPIENT)
            put("data", "0xdeadbeef")
            put("chainId", "137")
        }, ctx()).getOrThrow()

        assertEquals("Polygon", preview.networkName)
        assertTrue(preview.isUnverifiedContract)
        assertTrue(preview.warnings.any { it.contains("Unverified Contract") })
    }

    @Test
    fun testAdapterUsesTokenMetadataForHumanReadableAmounts() = runTest {
        val adapter = GoatEvmWalletAdapter(
            FakeSigner(),
            tokenMetadata = { GoatEvmWalletAdapter.TokenMetadata("USDC", 6) }
        )
        val preview = adapter.decodeTransaction(buildJsonObject {
            put("to", RECIPIENT)
            put("data", TRANSFER_5USDC)
        }, ctx()).getOrThrow()
        assertEquals("5 USDC", preview.valueFormatted)
    }

    @Test
    fun testAdapterRejectsTransactionWithoutRecipient() = runTest {
        val adapter = GoatEvmWalletAdapter(FakeSigner())
        val res = adapter.decodeTransaction(buildJsonObject { put("data", TRANSFER_5USDC) }, ctx())
        assertTrue(res.isFailure)
        assertEquals(Web3ErrorCode.INVALID_PARAMETERS, (res.exceptionOrNull() as Web3Exception).code)
    }

    @Test
    fun testSignMessageAnnotatesTypedDataWithTheDecodedVerdict() = runTest {
        val signer = FakeSigner()
        val adapter = GoatEvmWalletAdapter(signer)
        val res = adapter.signMessage(
            permitSingle(EvmAbiDecoder.UINT160_MAX.toString(), 1900000000L),
            "eth_signTypedData_v4",
            ctx()
        ).getOrThrow()

        assertEquals("eth_signTypedData_v4", signer.lastMessageType)
        assertEquals("0xmsgsig", res["signature"]?.jsonPrimitive?.content)
        assertEquals("true", res["isUnlimitedAllowance"]?.jsonPrimitive?.content)
        assertEquals("true", res["isPermit"]?.jsonPrimitive?.content)
    }

    @Test
    fun testPersonalSignIsNotAnnotatedAsAPermit() = runTest {
        val adapter = GoatEvmWalletAdapter(FakeSigner())
        val res = adapter.signMessage("Sign in to Example", "personal_sign", ctx()).getOrThrow()
        assertNull(res["isUnlimitedAllowance"])
    }

    @Test
    fun testSwitchChainRejectsUnsupportedChain() = runTest {
        val adapter = GoatEvmWalletAdapter(FakeSigner())
        assertTrue(adapter.switchChain("eip155:137", null, ctx()).getOrThrow())
        val res = adapter.switchChain("99999", null, ctx())
        assertTrue(res.isFailure)
        assertEquals(Web3ErrorCode.CHAIN_UNSUPPORTED, (res.exceptionOrNull() as Web3Exception).code)
    }
}
