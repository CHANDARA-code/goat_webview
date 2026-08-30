package com.goat.webview

import android.content.Context
import android.content.SharedPreferences
import android.util.Base64
import kotlinx.coroutines.flow.toList
import kotlinx.coroutines.test.runTest
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import android.content.ContextWrapper
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.FileOutputStream
import java.security.KeyPairGenerator
import java.security.MessageDigest
import java.util.concurrent.ConcurrentHashMap
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream

class GoatRemoteManagerTest {

    private lateinit var fakeContext: FakeTestContext
    private lateinit var tempDir: File
    private lateinit var filesDir: File
    private lateinit var cacheDir: File

    private class FakeSharedPreferences : SharedPreferences {
        val data = ConcurrentHashMap<String, Any>()

        override fun getAll(): MutableMap<String, *> = HashMap(data)
        override fun getString(key: String?, defValue: String?): String? = (data[key] as? String) ?: defValue
        override fun getStringSet(key: String?, defValues: MutableSet<String>?): MutableSet<String>? = null
        override fun getInt(key: String?, defValue: Int): Int = (data[key] as? Int) ?: defValue
        override fun getLong(key: String?, defValue: Long): Long = (data[key] as? Long) ?: defValue
        override fun getFloat(key: String?, defValue: Float): Float = (data[key] as? Float) ?: defValue
        override fun getBoolean(key: String?, defValue: Boolean): Boolean = (data[key] as? Boolean) ?: defValue
        override fun contains(key: String?): Boolean = data.containsKey(key)
        override fun edit(): SharedPreferences.Editor = FakeEditor(this)
        override fun registerOnSharedPreferenceChangeListener(listener: SharedPreferences.OnSharedPreferenceChangeListener?) {}
        override fun unregisterOnSharedPreferenceChangeListener(listener: SharedPreferences.OnSharedPreferenceChangeListener?) {}

        class FakeEditor(private val prefs: FakeSharedPreferences) : SharedPreferences.Editor {
            private val temp = HashMap<String, Any?>()
            private var clearAll = false

            override fun putString(key: String?, value: String?): SharedPreferences.Editor {
                if (key != null) {
                    if (value != null) temp[key] = value else temp[key] = null
                }
                return this
            }

            override fun putStringSet(key: String?, values: MutableSet<String>?): SharedPreferences.Editor = this
            override fun putInt(key: String?, value: Int): SharedPreferences.Editor {
                if (key != null) temp[key] = value
                return this
            }
            override fun putLong(key: String?, value: Long): SharedPreferences.Editor {
                if (key != null) temp[key] = value
                return this
            }
            override fun putFloat(key: String?, value: Float): SharedPreferences.Editor {
                if (key != null) temp[key] = value
                return this
            }
            override fun putBoolean(key: String?, value: Boolean): SharedPreferences.Editor {
                if (key != null) temp[key] = value
                return this
            }
            override fun remove(key: String?): SharedPreferences.Editor {
                if (key != null) temp[key] = null
                return this
            }
            override fun clear(): SharedPreferences.Editor {
                clearAll = true
                return this
            }
            override fun commit(): Boolean {
                apply()
                return true
            }
            override fun apply() {
                if (clearAll) {
                    prefs.data.clear()
                }
                for ((k, v) in temp) {
                    if (v == null) {
                        prefs.data.remove(k)
                    } else {
                        prefs.data[k] = v
                    }
                }
            }
        }
    }

    private class FakeTestContext(
        private val baseFilesDir: File,
        private val baseCacheDir: File
    ) : ContextWrapper(null) {
        val prefsMap = ConcurrentHashMap<String, FakeSharedPreferences>()

        override fun getFilesDir(): File = baseFilesDir
        override fun getCacheDir(): File = baseCacheDir

        override fun getSharedPreferences(name: String?, mode: Int): SharedPreferences {
            val safeName = name ?: "default"
            return prefsMap.computeIfAbsent(safeName) { FakeSharedPreferences() }
        }

        override fun getApplicationContext(): Context = this
    }

    @Before
    fun setUp() {
        tempDir = File(System.getProperty("java.io.tmpdir"), "goat_remote_test_${System.currentTimeMillis()}").apply { mkdirs() }
        filesDir = File(tempDir, "files").apply { mkdirs() }
        cacheDir = File(tempDir, "cache").apply { mkdirs() }

        fakeContext = FakeTestContext(filesDir, cacheDir)
    }

    @After
    fun tearDown() {
        tempDir.deleteRecursively()
    }

    private fun createTestZip(): ByteArray {
        val bos = ByteArrayOutputStream()
        ZipOutputStream(bos).use { zos ->
            zos.putNextEntry(ZipEntry("index.html"))
            zos.write("<html><body><h1>Goat OTA v2.0</h1></body></html>".toByteArray())
            zos.closeEntry()
        }
        return bos.toByteArray()
    }

    private fun sha256Hex(bytes: ByteArray): String {
        val digest = MessageDigest.getInstance("SHA-256")
        return digest.digest(bytes).joinToString("") { "%02x".format(it) }
    }

    @Test
    fun `test semantic version comparison`() {
        assertTrue(GoatRemoteManager.isNewerVersion("1.0.0", "1.0.1"))
        assertTrue(GoatRemoteManager.isNewerVersion("1.0.0", "1.1.0"))
        assertTrue(GoatRemoteManager.isNewerVersion("1.0.0", "2.0.0"))
        assertTrue(GoatRemoteManager.isNewerVersion("1.9.9", "2.0.0"))
        assertFalse(GoatRemoteManager.isNewerVersion("1.2.0", "1.2.0"))
        assertFalse(GoatRemoteManager.isNewerVersion("2.0.0", "1.9.9"))
    }

    @Test
    fun `test rollout percentage eligibility`() {
        assertTrue(GoatRemoteManager.isEligibleForRollout("user_123", 100))
        assertFalse(GoatRemoteManager.isEligibleForRollout("user_123", 0))

        var enrolledCount = 0
        for (i in 0 until 1000) {
            if (GoatRemoteManager.isEligibleForRollout("user_$i", 30)) {
                enrolledCount++
            }
        }
        // Expected around ~300 (+/- 50 for uniform hash distribution)
        assertTrue("Enrolled $enrolledCount users for 30% bucket", enrolledCount in 250..350)
    }

    @Test
    fun `test successful OTA update flow with atomic staging`() = runTest {
        val zipBytes = createTestZip()
        val expectedHash = sha256Hex(zipBytes)

        val fakeDownloader = HttpDownloader { _, targetFile, onProgress ->
            targetFile.writeBytes(zipBytes)
            onProgress(zipBytes.size.toLong(), zipBytes.size.toLong())
        }

        val remoteManager = object : GoatRemoteManager(fakeContext, GoatAssetManager(fakeContext), fakeDownloader) {
            override suspend fun fetchManifest(manifestUrl: String): ReleaseManifest {
                return ReleaseManifest(
                    appId = "tenant_test",
                    version = "1.2.0",
                    bundleUrl = "https://cdn.example.com/bundle.zip",
                    sha256 = expectedHash
                )
            }
        }

        val events = remoteManager.checkAndUpdate(
            appId = "tenant_test",
            manifestUrl = "https://cdn.example.com/manifest.json"
        ).toList()

        assertTrue(events.any { it is UpdateProgress.Checking })
        assertTrue(events.any { it is UpdateProgress.Downloading })
        assertTrue(events.any { it is UpdateProgress.Verifying })
        assertTrue(events.any { it is UpdateProgress.Staging })
        val ready = events.last() as UpdateProgress.Ready
        assertEquals("1.2.0", ready.version)
        assertEquals("tenant_test", ready.appId)

        // Verify extracted target file
        val targetDir = GoatAssetManager.getTargetDirectory(filesDir, "tenant_test")
        val indexHtml = File(targetDir, "index.html")
        assertTrue("Extracted index.html must exist", indexHtml.exists())
        assertEquals("<html><body><h1>Goat OTA v2.0</h1></body></html>", indexHtml.readText())

        // Verify version updated in prefs
        assertEquals("1.2.0", remoteManager.getInstalledVersion("tenant_test"))
    }

    @Test
    fun `test OTA check skips when already up to date`() = runTest {
        val fakeDownloader = HttpDownloader { _, _, _ -> }
        val remoteManager = object : GoatRemoteManager(fakeContext, GoatAssetManager(fakeContext), fakeDownloader) {
            override suspend fun fetchManifest(manifestUrl: String): ReleaseManifest {
                return ReleaseManifest(
                    appId = "tenant_test",
                    version = "1.2.0",
                    bundleUrl = "https://cdn.example.com/bundle.zip",
                    sha256 = "dummy"
                )
            }
        }
        remoteManager.setInstalledVersion("tenant_test", "1.2.0", "dummy")

        val events = remoteManager.checkAndUpdate(
            appId = "tenant_test",
            manifestUrl = "https://cdn.example.com/manifest.json"
        ).toList()

        assertEquals(2, events.size)
        assertTrue(events[0] is UpdateProgress.Checking)
        val upToDate = events[1] as UpdateProgress.UpToDate
        assertEquals("1.2.0", upToDate.currentVersion)
    }

    @Test
    fun `test corrupted bundle is rejected on SHA-256 mismatch`() = runTest {
        val zipBytes = createTestZip()

        val fakeDownloader = HttpDownloader { _, targetFile, _ ->
            targetFile.writeBytes(zipBytes)
        }

        val remoteManager = object : GoatRemoteManager(fakeContext, GoatAssetManager(fakeContext), fakeDownloader) {
            override suspend fun fetchManifest(manifestUrl: String): ReleaseManifest {
                return ReleaseManifest(
                    appId = "tenant_test",
                    version = "2.0.0",
                    bundleUrl = "https://cdn.example.com/bundle.zip",
                    sha256 = "invalid_expected_hash_0000000000000000000000000000000000000000000000000000"
                )
            }
        }

        val events = remoteManager.checkAndUpdate(
            appId = "tenant_test",
            manifestUrl = "https://cdn.example.com/manifest.json"
        ).toList()

        val failed = events.last() as UpdateProgress.Failed
        assertTrue(failed.error.contains("SHA-256 checksum mismatch"))

        // Target dir must not have extracted the bad version
        val targetDir = GoatAssetManager.getTargetDirectory(filesDir, "tenant_test")
        assertFalse(File(targetDir, "index.html").exists())
    }
}
