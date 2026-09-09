package com.goat.webview.cache

import android.content.ComponentCallbacks2
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.ByteArrayInputStream
import java.io.File

class GoatAssetByteCacheTest {

    @get:Rule
    val tempFolder = TemporaryFolder()

    @Test
    fun testCacheAndGet() {
        val cache = GoatAssetByteCache(maxSizeBytes = 1024 * 1024)
        val data = "hello world".toByteArray()
        cache.cacheBytes("/assets/test.txt", data)

        val retrieved = cache.getCachedBytes("/assets/test.txt")
        assertNotNull(retrieved)
        assertArrayEquals(data, retrieved)

        assertNull(cache.getCachedBytes("/assets/nonexistent.txt"))
    }

    @Test
    fun testOpenStreamWithCachedData() {
        val cache = GoatAssetByteCache(maxSizeBytes = 1024 * 1024)
        val data = "streaming test bytes".toByteArray()
        cache.cacheBytes("/assets/stream.bin", data)

        val stream = cache.openStream("/assets/stream.bin")
        assertNotNull(stream)
        val readBytes = stream!!.readBytes()
        assertArrayEquals(data, readBytes)
    }

    @Test
    fun testOpenStreamWithRealFile() {
        val cache = GoatAssetByteCache(maxSizeBytes = 1024 * 1024)
        val file = tempFolder.newFile("asset_file.bin")
        val fileContent = "file content to cache".toByteArray()
        file.writeBytes(fileContent)

        val stream = cache.openStream(file)
        assertNotNull(stream)
        val readBytes = stream!!.readBytes()
        assertArrayEquals(fileContent, readBytes)

        val cachedAfter = cache.getCachedBytes(file.absolutePath)
        assertNotNull(cachedAfter)
        assertArrayEquals(fileContent, cachedAfter)
    }

    @Test
    fun testEvictAll() {
        val cache = GoatAssetByteCache(maxSizeBytes = 1024 * 1024)
        cache.cacheBytes("k1", "data1".toByteArray())
        cache.cacheBytes("k2", "data2".toByteArray())
        assertTrue(cache.size() > 0)

        cache.evictAll()
        assertEquals(0, cache.size())
        assertNull(cache.getCachedBytes("k1"))
        assertNull(cache.getCachedBytes("k2"))
    }

    @Test
    fun testTrimMemory() {
        val cache = GoatAssetByteCache(maxSizeBytes = 1000)
        cache.cacheBytes("k1", ByteArray(300))
        cache.cacheBytes("k2", ByteArray(300))
        assertTrue(cache.size() >= 600)

        cache.trimMemory(ComponentCallbacks2.TRIM_MEMORY_MODERATE)
        assertTrue(cache.size() <= 500)

        cache.trimMemory(ComponentCallbacks2.TRIM_MEMORY_RUNNING_LOW)
        assertEquals(0, cache.size())
    }

    @Test
    fun testLruEviction() {
        val cache = GoatAssetByteCache(maxSizeBytes = 500)
        cache.cacheBytes("item1", ByteArray(300))
        assertNotNull(cache.getCachedBytes("item1"))

        cache.cacheBytes("item2", ByteArray(300))
        assertNotNull(cache.getCachedBytes("item2"))
        assertNull(cache.getCachedBytes("item1"))
    }

    @Test
    fun testByteRangeSatisfiable() {
        val cache = GoatAssetByteCache(maxSizeBytes = 1024 * 1024)
        val raw = ByteArray(100) { it.toByte() }

        val res1 = cache.parseByteRange("bytes=0-49", 100) { ByteArrayInputStream(raw) }
        assertTrue(res1 is ByteRangeResult.Satisfiable)
        val s1 = res1 as ByteRangeResult.Satisfiable
        assertEquals(0L, s1.start)
        assertEquals(49L, s1.end)
        assertEquals(100L, s1.total)
        val stream1Bytes = s1.stream.readBytes()
        assertEquals(50, stream1Bytes.size)
        assertEquals(0.toByte(), stream1Bytes[0])
        assertEquals(49.toByte(), stream1Bytes[49])

        val res2 = cache.parseByteRange("bytes=50-", 100) { ByteArrayInputStream(raw) }
        assertTrue(res2 is ByteRangeResult.Satisfiable)
        val s2 = res2 as ByteRangeResult.Satisfiable
        assertEquals(50L, s2.start)
        assertEquals(99L, s2.end)
        val stream2Bytes = s2.stream.readBytes()
        assertEquals(50, stream2Bytes.size)
        assertEquals(50.toByte(), stream2Bytes[0])
        assertEquals(99.toByte(), stream2Bytes[49])

        val res3 = cache.parseByteRange("bytes=-20", 100) { ByteArrayInputStream(raw) }
        assertTrue(res3 is ByteRangeResult.Satisfiable)
        val s3 = res3 as ByteRangeResult.Satisfiable
        assertEquals(80L, s3.start)
        assertEquals(99L, s3.end)
        val stream3Bytes = s3.stream.readBytes()
        assertEquals(20, stream3Bytes.size)
        assertEquals(80.toByte(), stream3Bytes[0])
        assertEquals(99.toByte(), stream3Bytes[19])
    }

    @Test
    fun testByteRangeUnsatisfiable() {
        val cache = GoatAssetByteCache(maxSizeBytes = 1024 * 1024)
        val raw = ByteArray(100) { it.toByte() }

        val res1 = cache.parseByteRange("bytes=150-200", 100) { ByteArrayInputStream(raw) }
        assertTrue(res1 is ByteRangeResult.Unsatisfiable)

        val res2 = cache.parseByteRange("bytes=50-40", 100) { ByteArrayInputStream(raw) }
        assertTrue(res2 is ByteRangeResult.Unsatisfiable)

        val res3 = cache.parseByteRange("bytes=invalid", 100) { ByteArrayInputStream(raw) }
        assertTrue(res3 is ByteRangeResult.Unsatisfiable)
    }

    @Test
    fun testByteRangeFull() {
        val cache = GoatAssetByteCache(maxSizeBytes = 1024 * 1024)
        val raw = ByteArray(50) { it.toByte() }

        val resNull = cache.parseByteRange(null, 50) { ByteArrayInputStream(raw) }
        assertTrue(resNull is ByteRangeResult.Full)
        assertEquals(50L, (resNull as ByteRangeResult.Full).total)
        assertEquals(50, resNull.stream.readBytes().size)

        val resBlank = cache.parseByteRange("   ", 50) { ByteArrayInputStream(raw) }
        assertTrue(resBlank is ByteRangeResult.Full)
    }

    @Test
    fun testOversizedItemsNotCached() {
        val cache = GoatAssetByteCache(maxSizeBytes = 1000)
        cache.cacheBytes("oversized", ByteArray(2000))
        assertNull(cache.getCachedBytes("oversized"))
        assertEquals(0, cache.size())
    }
}
