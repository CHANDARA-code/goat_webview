package com.goat.webview.feature.media

import android.content.Context
import android.content.ContextWrapper
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.io.File

@OptIn(ExperimentalCoroutinesApi::class)
class GoatMediaPluginTest {

    private lateinit var fakeContext: FakeTestContext
    private lateinit var plugin: GoatMediaPlugin

    private class FakeTestContext(private val tempDir: File) : ContextWrapper(null) {
        override fun getApplicationContext(): Context = this
        override fun getCacheDir(): File = tempDir
    }

    @Before
    fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
        val tempDir = File(System.getProperty("java.io.tmpdir"), "goat_media_test_${System.currentTimeMillis()}")
        tempDir.mkdirs()
        fakeContext = FakeTestContext(tempDir)
        plugin = GoatMediaPlugin(fakeContext)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun testPluginIdAndSupportedActions() {
        assertEquals("media", plugin.pluginId)
        assertTrue(plugin.supportedActions.contains("CHOOSE_MEDIA"))
        assertTrue(plugin.supportedActions.contains("PREVIEW_IMAGE"))
        assertTrue(plugin.supportedActions.contains("AUDIO_PLAY"))
        assertTrue(plugin.supportedActions.contains("AUDIO_PAUSE"))
        assertTrue(plugin.supportedActions.contains("AUDIO_STOP"))
        assertTrue(plugin.supportedActions.contains("AUDIO_SEEK"))
        assertTrue(plugin.supportedActions.contains("RECORD_AUDIO_START"))
        assertTrue(plugin.supportedActions.contains("RECORD_AUDIO_STOP"))
    }

    @Test
    fun testChooseMediaReturnsStructure() = runTest {
        val payload = buildJsonObject {
            put("count", 3)
        }
        val result = plugin.execute("CHOOSE_MEDIA", payload)
        assertTrue(result.isSuccess)
        val data = result.getOrNull()
        assertNotNull(data)
        assertTrue(data!!.containsKey("tempFiles"))
    }

    @Test
    fun testPreviewImageSuccess() = runTest {
        val payload = buildJsonObject {
            put("urls", buildJsonArray {
                add(kotlinx.serialization.json.JsonPrimitive("https://example.com/img1.png"))
                add(kotlinx.serialization.json.JsonPrimitive("https://example.com/img2.png"))
            })
            put("current", "https://example.com/img1.png")
        }
        val result = plugin.execute("PREVIEW_IMAGE", payload)
        assertTrue(result.isSuccess)
        val data = result.getOrNull()
        assertEquals("2", data?.get("count")?.jsonPrimitive?.content)
    }

    @Test
    fun testPreviewImageEmptyUrlsFails() = runTest {
        val payload = buildJsonObject {
            put("urls", buildJsonArray {})
        }
        val result = plugin.execute("PREVIEW_IMAGE", payload)
        assertTrue(result.isFailure)
    }

    @Test
    fun testAudioLifecycle() = runTest {
        // AUDIO_PLAY
        val playPayload = buildJsonObject {
            put("src", "https://example.com/song.mp3")
            put("title", "Test Song")
        }
        val playResult = plugin.execute("AUDIO_PLAY", playPayload)
        assertTrue(playResult.isSuccess)
        assertEquals("playing", playResult.getOrNull()?.get("status")?.jsonPrimitive?.content)

        // AUDIO_PAUSE
        val pauseResult = plugin.execute("AUDIO_PAUSE", buildJsonObject {})
        assertTrue(pauseResult.isSuccess)
        assertEquals("paused", pauseResult.getOrNull()?.get("status")?.jsonPrimitive?.content)

        // AUDIO_SEEK
        val seekResult = plugin.execute("AUDIO_SEEK", buildJsonObject { put("position", 42.0) })
        assertTrue(seekResult.isSuccess)
        assertEquals("seeked", seekResult.getOrNull()?.get("status")?.jsonPrimitive?.content)

        // AUDIO_STOP
        val stopResult = plugin.execute("AUDIO_STOP", buildJsonObject {})
        assertTrue(stopResult.isSuccess)
        assertEquals("stopped", stopResult.getOrNull()?.get("status")?.jsonPrimitive?.content)
    }

    @Test
    fun testAudioPlayMissingSrcFails() = runTest {
        val result = plugin.execute("AUDIO_PLAY", buildJsonObject {})
        assertTrue(result.isFailure)
    }

    @Test
    fun testUnsupportedActionFails() = runTest {
        val result = plugin.execute("UNKNOWN_ACTION", buildJsonObject {})
        assertTrue(result.isFailure)
    }
}
