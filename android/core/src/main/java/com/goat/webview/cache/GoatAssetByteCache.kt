package com.goat.webview.cache

import android.content.ComponentCallbacks2
import android.content.Context
import android.content.res.Configuration
import java.io.ByteArrayInputStream
import java.io.File
import java.io.FileInputStream
import java.io.InputStream
import java.nio.ByteBuffer
import java.nio.channels.FileChannel
import java.util.LinkedHashMap

sealed class ByteRangeResult {
    data class Satisfiable(val start: Long, val end: Long, val total: Long, val stream: InputStream) : ByteRangeResult()
    data class Unsatisfiable(val total: Long) : ByteRangeResult()
    data class Full(val stream: InputStream, val total: Long) : ByteRangeResult()
}

class GoatAssetByteCache(
    context: Context? = null,
    val maxSizeBytes: Int = calculateDefaultMaxBytes()
) {

    private val maxItemSizeBytes = 2 * 1024 * 1024
    private val lock = Any()
    private var currentSize: Int = 0

    private val lruMap = LinkedHashMap<String, ByteArray>(16, 0.75f, true)

    private var callbacks: ComponentCallbacks2? = null

    init {
        context?.applicationContext?.let { appContext ->
            val cb = object : ComponentCallbacks2 {
                override fun onTrimMemory(level: Int) {
                    trimMemory(level)
                }

                override fun onConfigurationChanged(newConfig: Configuration) {}

                @Deprecated("Deprecated in Java")
                override fun onLowMemory() {
                    evictAll()
                }
            }
            callbacks = cb
            appContext.registerComponentCallbacks(cb)
        }
    }

    fun size(): Int = synchronized(lock) { currentSize }

    fun getCachedBytes(uri: String): ByteArray? {
        val normalized = normalizeKey(uri)
        synchronized(lock) {
            return lruMap[normalized]
        }
    }

    fun cacheBytes(uri: String, bytes: ByteArray) {
        if (bytes.size > maxItemSizeBytes || bytes.size > maxSizeBytes) {
            return
        }
        val normalized = normalizeKey(uri)
        synchronized(lock) {
            val old = lruMap.put(normalized, bytes)
            if (old != null) {
                currentSize -= old.size
            }
            currentSize += bytes.size
            trimToSize(maxSizeBytes)
        }
    }

    fun openStream(uri: String): InputStream? {
        val cached = getCachedBytes(uri)
        if (cached != null) {
            return ByteArrayInputStream(cached)
        }
        val file = File(uri)
        if (file.exists() && file.isFile) {
            return openStream(file)
        }
        return null
    }

    fun openStream(file: File): InputStream? {
        if (!file.exists() || !file.isFile) {
            return null
        }
        val key = file.absolutePath
        val cached = getCachedBytes(key)
        if (cached != null) {
            return ByteArrayInputStream(cached)
        }
        val fileLength = file.length()
        if (fileLength in 1..maxItemSizeBytes) {
            val bytes = file.readBytes()
            cacheBytes(key, bytes)
            return ByteArrayInputStream(bytes)
        }
        if (fileLength > maxItemSizeBytes) {
            val fis = FileInputStream(file)
            val channel = fis.channel
            val buffer: ByteBuffer = channel.map(FileChannel.MapMode.READ_ONLY, 0, fileLength)
            return ByteBufferBackedInputStream(buffer, fis)
        }
        return FileInputStream(file)
    }

    fun parseByteRange(rangeHeader: String?, totalLength: Long, dataStreamProvider: () -> InputStream?): ByteRangeResult {
        if (rangeHeader.isNullOrBlank() || !rangeHeader.startsWith("bytes=")) {
            val stream = dataStreamProvider() ?: return ByteRangeResult.Unsatisfiable(totalLength)
            return ByteRangeResult.Full(stream, totalLength)
        }

        val rangePart = rangeHeader.removePrefix("bytes=").trim()
        if (rangePart.contains(",")) {
            val stream = dataStreamProvider() ?: return ByteRangeResult.Unsatisfiable(totalLength)
            return ByteRangeResult.Full(stream, totalLength)
        }

        val dashIdx = rangePart.indexOf('-')
        if (dashIdx == -1) {
            return ByteRangeResult.Unsatisfiable(totalLength)
        }

        val startStr = rangePart.substring(0, dashIdx).trim()
        val endStr = rangePart.substring(dashIdx + 1).trim()

        val start: Long
        val end: Long

        try {
            if (startStr.isEmpty()) {
                if (endStr.isEmpty()) {
                    return ByteRangeResult.Unsatisfiable(totalLength)
                }
                val suffix = endStr.toLong()
                if (suffix <= 0) {
                    return ByteRangeResult.Unsatisfiable(totalLength)
                }
                start = (totalLength - suffix).coerceAtLeast(0L)
                end = totalLength - 1
            } else {
                start = startStr.toLong()
                end = if (endStr.isEmpty()) {
                    totalLength - 1
                } else {
                    endStr.toLong()
                }
            }
        } catch (_: NumberFormatException) {
            return ByteRangeResult.Unsatisfiable(totalLength)
        }

        if (start < 0 || start > end || start >= totalLength) {
            return ByteRangeResult.Unsatisfiable(totalLength)
        }

        val clampedEnd = end.coerceAtMost(totalLength - 1)
        val stream = dataStreamProvider() ?: return ByteRangeResult.Unsatisfiable(totalLength)
        val rangeStream = SlicedInputStream(stream, start, clampedEnd - start + 1)
        return ByteRangeResult.Satisfiable(start, clampedEnd, totalLength, rangeStream)
    }

    fun evictAll() {
        synchronized(lock) {
            lruMap.clear()
            currentSize = 0
        }
    }

    fun trimMemory(level: Int) {
        if (level >= ComponentCallbacks2.TRIM_MEMORY_RUNNING_LOW || level >= ComponentCallbacks2.TRIM_MEMORY_COMPLETE) {
            evictAll()
        } else if (level >= ComponentCallbacks2.TRIM_MEMORY_MODERATE) {
            synchronized(lock) {
                trimToSize(maxSizeBytes / 2)
            }
        }
    }

    private fun trimToSize(targetSize: Int) {
        val iterator = lruMap.entries.iterator()
        while (iterator.hasNext() && currentSize > targetSize) {
            val entry = iterator.next()
            currentSize -= entry.value.size
            iterator.remove()
        }
    }

    private fun normalizeKey(key: String): String {
        return key.trim().lowercase()
    }

    private class ByteBufferBackedInputStream(
        private val buffer: ByteBuffer,
        private val originalStream: FileInputStream
    ) : InputStream() {

        override fun read(): Int {
            if (!buffer.hasRemaining()) {
                return -1
            }
            return buffer.get().toInt() and 0xFF
        }

        override fun read(bytes: ByteArray, offset: Int, length: Int): Int {
            if (!buffer.hasRemaining()) {
                return -1
            }
            val toRead = length.coerceAtMost(buffer.remaining())
            buffer.get(bytes, offset, toRead)
            return toRead
        }

        override fun available(): Int {
            return buffer.remaining()
        }

        override fun close() {
            originalStream.close()
        }
    }

    private class SlicedInputStream(
        private val source: InputStream,
        private val startOffset: Long,
        private val targetLength: Long
    ) : InputStream() {

        private var skipped = false
        private var bytesRead: Long = 0

        private fun ensureSkipped() {
            if (!skipped) {
                var remaining = startOffset
                while (remaining > 0) {
                    val s = source.skip(remaining)
                    if (s <= 0) {
                        if (source.read() == -1) break
                        remaining--
                    } else {
                        remaining -= s
                    }
                }
                skipped = true
            }
        }

        override fun read(): Int {
            ensureSkipped()
            if (bytesRead >= targetLength) {
                return -1
            }
            val byte = source.read()
            if (byte != -1) {
                bytesRead++
            }
            return byte
        }

        override fun read(b: ByteArray, off: Int, len: Int): Int {
            ensureSkipped()
            if (bytesRead >= targetLength) {
                return -1
            }
            val maxToRead = (targetLength - bytesRead).coerceAtMost(len.toLong()).toInt()
            val result = source.read(b, off, maxToRead)
            if (result > 0) {
                bytesRead += result
            }
            return result
        }

        override fun available(): Int {
            ensureSkipped()
            val remaining = (targetLength - bytesRead).coerceAtLeast(0L)
            return source.available().toLong().coerceAtMost(remaining).toInt()
        }

        override fun close() {
            source.close()
        }
    }

    companion object {
        @Volatile
        private var instance: GoatAssetByteCache? = null

        fun getInstance(context: Context): GoatAssetByteCache {
            return instance ?: synchronized(this) {
                instance ?: GoatAssetByteCache(context.applicationContext).also { instance = it }
            }
        }

        fun calculateDefaultMaxBytes(): Int {
            val maxMem = Runtime.getRuntime().maxMemory()
            val fifteenPercent = (maxMem * 0.15).toInt()
            return fifteenPercent.coerceIn(4 * 1024 * 1024, 32 * 1024 * 1024)
        }
    }
}

