package com.goat.webview

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class GoatSharedMemoryChannelTest {

    private lateinit var memoryChannel: GoatSharedMemoryChannel

    @Before
    fun setUp() {
        memoryChannel = GoatSharedMemoryChannel(defaultCapacityBytes = 4096)
    }

    @Test
    fun testBufferAllocationAndWriteReadCycle() {
        val bufferId = memoryChannel.createBuffer("video_frame")
        assertNotNull(bufferId)
        assertEquals(1, memoryChannel.getActiveBufferCount())

        val sampleData = "GoatDirectBufferBytes".toByteArray(Charsets.UTF_8)
        val writeSuccess = memoryChannel.writeData(bufferId, sampleData)
        assertTrue(writeSuccess)

        val readData = memoryChannel.readData(bufferId)
        assertNotNull(readData)
        assertArrayEquals(sampleData, readData)

        val released = memoryChannel.releaseBuffer(bufferId)
        assertTrue(released)
        assertEquals(0, memoryChannel.getActiveBufferCount())
    }
}
