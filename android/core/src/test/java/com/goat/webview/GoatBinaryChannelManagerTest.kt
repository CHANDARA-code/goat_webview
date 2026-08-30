package com.goat.webview

import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class GoatBinaryChannelManagerTest {

    private lateinit var channelManager: GoatBinaryChannelManager

    @Before
    fun setUp() {
        channelManager = GoatBinaryChannelManager()
    }

    @Test
    fun testBinaryPortLifecycleAndTransmission() = runTest {
        val portId = "port_stream_01"
        assertFalse(channelManager.isPortActive(portId))

        // Create port
        val created = channelManager.createBinaryPort(portId)
        assertTrue(created)
        assertTrue(channelManager.isPortActive(portId))

        // Post binary packets
        val packet1 = byteArrayOf(0x01, 0x02, 0x03, 0x04)
        val meta1 = channelManager.postBinaryMessage(portId, packet1)
        assertEquals(4, meta1.byteSize)
        assertEquals(1L, meta1.sequenceNumber)

        val packet2 = byteArrayOf(0xAA.toByte(), 0xBB.toByte(), 0xCC.toByte())
        val meta2 = channelManager.postBinaryMessage(portId, packet2)
        assertEquals(3, meta2.byteSize)
        assertEquals(2L, meta2.sequenceNumber)

        assertEquals(7L, channelManager.getTotalBytesTransferred(portId))

        // Read packets
        val read1 = channelManager.readBinaryMessage(portId)
        assertNotNull(read1)
        assertArrayEquals(packet1, read1)

        val read2 = channelManager.readBinaryMessage(portId)
        assertNotNull(read2)
        assertArrayEquals(packet2, read2)

        val readEmpty = channelManager.readBinaryMessage(portId)
        assertNull(readEmpty)

        // Close port
        val closed = channelManager.closeBinaryPort(portId)
        assertTrue(closed)
        assertFalse(channelManager.isPortActive(portId))
    }
}
