package com.goat.webview.feature.web3.evm

import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * Known-answer tests. Without these the whole ABI decoder is built on an unverified hash: a
 * subtly wrong Keccak still produces 32 plausible bytes and every selector silently mismatches.
 */
class Keccak256Test {

    @Test
    fun testKnownAnswerVectors() {
        assertEquals(
            "c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470",
            Keccak256.hex("")
        )
        assertEquals(
            "4e03657aea45a94fc7d47ba826c8d667c0d1e6e33a64a036ec44f58fa12d6c45",
            Keccak256.hex("abc")
        )
        assertEquals(
            "1c8aff950685c2ed4bc3174f3472287b56d9517b9c948127319a09a7a36deac8",
            Keccak256.hex("hello")
        )
    }

    @Test
    fun testMultiBlockInputCrossesTheRateBoundary() {
        // 200 bytes forces a second sponge absorb (rate is 136 bytes).
        val long = "a".repeat(200)
        assertEquals(64, Keccak256.hex(long).length)
        assertEquals(
            "96ea54061def936c4be90b518992fdc6f12f535068a256229aca54267b4d084d",
            Keccak256.hex(long)
        )
    }

    @Test
    fun testDerivedSelectorsMatchThePublishedEthereumValues() {
        assertEquals("0xa9059cbb", Keccak256.functionSelector("transfer(address,uint256)"))
        assertEquals("0x095ea7b3", Keccak256.functionSelector("approve(address,uint256)"))
        assertEquals("0x23b872dd", Keccak256.functionSelector("transferFrom(address,address,uint256)"))
        assertEquals("0xa22cb465", Keccak256.functionSelector("setApprovalForAll(address,bool)"))
        assertEquals("0x42842e0e", Keccak256.functionSelector("safeTransferFrom(address,address,uint256)"))
        assertEquals(
            "0xd505accf",
            Keccak256.functionSelector("permit(address,address,uint256,uint256,uint8,bytes32,bytes32)")
        )
        assertEquals("0x39509351", Keccak256.functionSelector("increaseAllowance(address,uint256)"))
    }
}
