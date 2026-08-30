package com.goat.webview

import android.content.Context
import android.content.ContextWrapper
import android.content.SharedPreferences
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.io.File
import java.util.concurrent.ConcurrentHashMap

class GoatChannelManagerTest {

    private lateinit var fakeContext: FakeTestContext
    private lateinit var channelManager: GoatChannelManager

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
                if (clearAll) prefs.data.clear()
                for ((k, v) in temp) {
                    if (v == null) prefs.data.remove(k) else prefs.data[k] = v
                }
            }
        }
    }

    private class FakeTestContext(private val baseFilesDir: File) : ContextWrapper(null) {
        val prefsMap = ConcurrentHashMap<String, FakeSharedPreferences>()
        override fun getFilesDir(): File = baseFilesDir
        override fun getSharedPreferences(name: String?, mode: Int): SharedPreferences {
            return prefsMap.computeIfAbsent(name ?: "default") { FakeSharedPreferences() }
        }
        override fun getApplicationContext(): Context = this
    }

    @Before
    fun setUp() {
        val tempDir = File(System.getProperty("java.io.tmpdir"), "goat_channel_test_${System.currentTimeMillis()}").apply { mkdirs() }
        fakeContext = FakeTestContext(tempDir)
        channelManager = GoatChannelManager(fakeContext)
    }

    @Test
    fun `test channel setting and retrieval`() = runTest {
        val appId = "com.goat.shop"
        assertEquals(ReleaseChannel.PRODUCTION, channelManager.getChannel(appId))

        channelManager.setChannel(appId, ReleaseChannel.BETA)
        assertEquals(ReleaseChannel.BETA, channelManager.getChannel(appId))

        channelManager.setChannel(appId, ReleaseChannel.CANARY)
        assertEquals(ReleaseChannel.CANARY, channelManager.getChannel(appId))
    }

    @Test
    fun `test grayscale rollout deterministic hashing and percentage distribution`() {
        val manifest10 = ReleaseManifest(
            appId = "com.goat.shop",
            version = "2.0.0",
            bundleUrl = "https://cdn.goat.io/bundle.zip",
            sha256 = "hash123",
            rolloutPercentage = 10
        )

        val manifest50 = manifest10.copy(rolloutPercentage = 50)
        val manifest100 = manifest10.copy(rolloutPercentage = 100)
        val manifest0 = manifest10.copy(rolloutPercentage = 0)

        // 100% rollout must always include all users
        assertTrue(channelManager.evaluateRollout(manifest100, "user_alpha"))
        assertTrue(channelManager.evaluateRollout(manifest100, "user_beta"))
        assertTrue(channelManager.evaluateRollout(manifest100, "user_gamma"))

        // 0% rollout must exclude all users
        assertFalse(channelManager.evaluateRollout(manifest0, "user_alpha"))
        assertFalse(channelManager.evaluateRollout(manifest0, "user_beta"))

        // Multi-user distribution test for 50%
        val totalUsers = 1000
        var enrolledCount50 = 0
        var enrolledCount10 = 0

        for (i in 1..totalUsers) {
            val uid = "user_device_id_$i"
            if (channelManager.evaluateRollout(manifest50, uid)) enrolledCount50++
            if (channelManager.evaluateRollout(manifest10, uid)) enrolledCount10++
        }

        // Expected statistical bucket distributions:
        // ~50% (400-600 users) and ~10% (60-140 users)
        assertTrue("50% rollout should cover approx half the users (actual: $enrolledCount50)", enrolledCount50 in 400..600)
        assertTrue("10% rollout should cover approx 10% of users (actual: $enrolledCount10)", enrolledCount10 in 60..140)

        // Determinism: Repeated calls with same userId produce identical result
        val sampleUser = "stable_user_9988"
        val firstEval = channelManager.evaluateRollout(manifest50, sampleUser)
        val secondEval = channelManager.evaluateRollout(manifest50, sampleUser)
        assertEquals(firstEval, secondEval)
    }

    @Test
    fun `test channel hierarchy eligibility`() {
        // PRODUCTION client can only access PRODUCTION releases
        assertTrue(channelManager.evaluateChannelEligibility(ReleaseChannel.PRODUCTION, ReleaseChannel.PRODUCTION))
        assertFalse(channelManager.evaluateChannelEligibility(ReleaseChannel.BETA, ReleaseChannel.PRODUCTION))
        assertFalse(channelManager.evaluateChannelEligibility(ReleaseChannel.CANARY, ReleaseChannel.PRODUCTION))

        // BETA client can access BETA and PRODUCTION releases
        assertTrue(channelManager.evaluateChannelEligibility(ReleaseChannel.PRODUCTION, ReleaseChannel.BETA))
        assertTrue(channelManager.evaluateChannelEligibility(ReleaseChannel.BETA, ReleaseChannel.BETA))
        assertFalse(channelManager.evaluateChannelEligibility(ReleaseChannel.CANARY, ReleaseChannel.BETA))

        // CANARY client can access all releases
        assertTrue(channelManager.evaluateChannelEligibility(ReleaseChannel.PRODUCTION, ReleaseChannel.CANARY))
        assertTrue(channelManager.evaluateChannelEligibility(ReleaseChannel.BETA, ReleaseChannel.CANARY))
        assertTrue(channelManager.evaluateChannelEligibility(ReleaseChannel.CANARY, ReleaseChannel.CANARY))
    }

    @Test
    fun `test version history recording and instant 1-click rollback`() = runTest {
        val appId = "com.goat.pay"

        // Activate v1.0.0
        channelManager.recordVersionActivation(appId, "1.0.0")
        assertEquals("1.0.0", channelManager.getActiveVersion(appId))
        assertNull(channelManager.getLastKnownGoodVersion(appId))

        // Activate v1.1.0
        channelManager.recordVersionActivation(appId, "1.1.0")
        assertEquals("1.1.0", channelManager.getActiveVersion(appId))
        assertEquals("1.0.0", channelManager.getLastKnownGoodVersion(appId))

        // Activate v1.2.0 (broken canary build)
        channelManager.recordVersionActivation(appId, "1.2.0")
        assertEquals("1.2.0", channelManager.getActiveVersion(appId))
        assertEquals("1.1.0", channelManager.getLastKnownGoodVersion(appId))

        // Verify history trail
        val history = channelManager.getVersionHistory(appId)
        assertEquals(listOf("1.2.0", "1.1.0", "1.0.0"), history)

        // 1-Click Rollback
        val rolledBackVersion = channelManager.rollback(appId)
        assertEquals("1.1.0", rolledBackVersion)
        assertEquals("1.1.0", channelManager.getActiveVersion(appId))
    }
}
