package com.goat.webview

import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

/**
 * Unit test suite for GoatSameLayerRenderer (Task 10100).
 */
class GoatSameLayerRendererTest {

    private lateinit var renderer: GoatSameLayerRenderer

    @Before
    fun setUp() {
        renderer = GoatSameLayerRenderer()
    }

    @Test
    fun `test embedNativeComponent registers component descriptor`() = runTest {
        val desc = renderer.embedNativeComponent(
            componentId = "video_player_1",
            componentType = "EXO_PLAYER",
            x = 0f,
            y = 100f,
            width = 360f,
            height = 240f,
            zIndex = 1,
            params = mapOf("src" to "https://cdn.goat.io/video.mp4")
        )

        assertEquals("video_player_1", desc.componentId)
        assertEquals("EXO_PLAYER", desc.componentType)
        assertEquals(1, desc.zIndex)
        assertTrue(desc.isVisible)
        assertEquals(1, renderer.getActiveComponents().size)
    }

    @Test
    fun `test updateComponentBounds syncs scroll positions`() = runTest {
        renderer.embedNativeComponent("map_1", "MAP_VIEW", 0f, 200f, 360f, 300f)

        val updated = renderer.updateComponentBounds("map_1", 0f, 50f, 360f, 300f, zIndex = 2)
        assertNotNull(updated)
        assertEquals(50f, updated!!.y)
        assertEquals(2, updated.zIndex)
    }

    @Test
    fun `test removeNativeComponent unregisters component`() = runTest {
        renderer.embedNativeComponent("comp_1", "CUSTOM", 0f, 0f, 100f, 100f)
        val removed = renderer.removeNativeComponent("comp_1")
        assertTrue(removed)
        assertEquals(0, renderer.getActiveComponents().size)

        val removeNonExistent = renderer.removeNativeComponent("comp_unknown")
        assertFalse(removeNonExistent)
    }

    @Test
    fun `test embedNativeComponent normalizes component type in underlying texture compositor`() = runTest {
        renderer.embedNativeComponent("cam_1", "CAMERA", 0f, 0f, 200f, 200f)
        renderer.embedNativeComponent("vid_1", "AVPLAYER", 0f, 0f, 200f, 200f)
        renderer.embedNativeComponent("canvas_1", "CANVAS", 0f, 0f, 200f, 200f)
        renderer.embedNativeComponent("webgl_1", "WEBGL", 0f, 0f, 200f, 200f)
        renderer.embedNativeComponent("unknown_1", "RANDOM_CUSTOM", 0f, 0f, 200f, 200f)

        val activeTextures = renderer.textureCompositor.getActiveTextures()
        assertEquals(5, activeTextures.size)

        val textureMap = activeTextures.associateBy { it.componentId }
        assertEquals("CAMERA_PREVIEW", textureMap["cam_1"]?.componentType)
        assertEquals("VIDEO_PLAYER", textureMap["vid_1"]?.componentType)
        assertEquals("CANVAS_2D", textureMap["canvas_1"]?.componentType)
        assertEquals("WEBGL_NATIVE", textureMap["webgl_1"]?.componentType)
        assertEquals("CUSTOM_SURFACE", textureMap["unknown_1"]?.componentType)
    }
}
