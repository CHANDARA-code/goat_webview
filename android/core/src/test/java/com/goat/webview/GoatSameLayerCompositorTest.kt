package com.goat.webview

import android.graphics.SurfaceTexture
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicInteger

/**
 * Comprehensive Unit Test Suite for GoatSameLayerTextureCompositor.
 */
class GoatSameLayerCompositorTest {

    private lateinit var compositor: GoatSameLayerTextureCompositor

    @Before
    fun setUp() {
        compositor = GoatSameLayerTextureCompositor(defaultFps = 120.0)
    }

    @Test
    fun `test allocateTexture initializes state and triggers available callback`() = runTest {
        val availableCalled = AtomicBoolean(false)
        val listener = object : SameLayerSurfaceListener {
            override fun onSurfaceTextureAvailable(componentId: String, surfaceTexture: SurfaceTexture?, width: Int, height: Int) {
                availableCalled.set(true)
                assertEquals("camera_view_1", componentId)
                assertEquals(360, width)
                assertEquals(640, height)
            }
            override fun onSurfaceTextureSizeChanged(componentId: String, width: Int, height: Int) {}
            override fun onSurfaceTextureDestroyed(componentId: String) {}
            override fun onFrameComposited(componentId: String, frameNumber: Long, timestampNs: Long) {}
        }

        val state = compositor.allocateTexture(
            componentId = "camera_view_1",
            componentType = "CAMERA_PREVIEW",
            x = 0f,
            y = 100f,
            width = 360f,
            height = 640f,
            zIndex = 5,
            opacity = 0.95f,
            cornerRadius = 16.0f,
            listener = listener
        )

        assertNotNull(state)
        assertEquals("camera_view_1", state.componentId)
        assertEquals("CAMERA_PREVIEW", state.componentType)
        assertTrue(state.surfaceTextureId >= 1000L)
        assertEquals(0.95f, state.opacity, 0.001f)
        assertEquals(16.0f, state.cornerRadius, 0.001f)
        assertTrue(availableCalled.get())
        assertEquals(1, compositor.getActiveTextures().size)
    }

    @Test
    fun `test updateTextureBounds notifies size changes and updates coordinates`() = runTest {
        val sizeChangeCount = AtomicInteger(0)
        val listener = object : SameLayerSurfaceListener {
            override fun onSurfaceTextureAvailable(componentId: String, surfaceTexture: SurfaceTexture?, width: Int, height: Int) {}
            override fun onSurfaceTextureSizeChanged(componentId: String, width: Int, height: Int) {
                sizeChangeCount.incrementAndGet()
            }
            override fun onSurfaceTextureDestroyed(componentId: String) {}
            override fun onFrameComposited(componentId: String, frameNumber: Long, timestampNs: Long) {}
        }

        compositor.allocateTexture("video_player", "VIDEO_PLAYER", 0f, 0f, 300f, 200f, listener = listener)

        val updated = compositor.updateTextureBounds(
            componentId = "video_player",
            x = 10f,
            y = 50f,
            width = 360f,
            height = 240f,
            zIndex = 2,
            opacity = 0.8f,
            cornerRadius = 8.0f
        )

        assertNotNull(updated)
        assertEquals(10f, updated!!.x)
        assertEquals(50f, updated.y)
        assertEquals(360f, updated.width)
        assertEquals(240f, updated.height)
        assertEquals(1, sizeChangeCount.get())
    }

    @Test
    fun `test hitTest coordinates accurately intersect component bounding box`() = runTest {
        compositor.allocateTexture("map_view", "MAP_VIEW", 50f, 100f, 200f, 150f)

        // Inside bounds
        assertTrue(compositor.hitTest("map_view", 60f, 120f))
        assertTrue(compositor.hitTest("map_view", 50f, 100f))
        assertTrue(compositor.hitTest("map_view", 250f, 250f))

        // Outside bounds
        assertFalse(compositor.hitTest("map_view", 40f, 120f))
        assertFalse(compositor.hitTest("map_view", 60f, 90f))
        assertFalse(compositor.hitTest("map_view", 300f, 300f))
        assertFalse(compositor.hitTest("non_existent", 60f, 120f))
    }

    @Test
    fun `test recordFrameComposited increments frame counter and invokes listener`() = runTest {
        val frameCount = AtomicInteger(0)
        val listener = object : SameLayerSurfaceListener {
            override fun onSurfaceTextureAvailable(componentId: String, surfaceTexture: SurfaceTexture?, width: Int, height: Int) {}
            override fun onSurfaceTextureSizeChanged(componentId: String, width: Int, height: Int) {}
            override fun onSurfaceTextureDestroyed(componentId: String) {}
            override fun onFrameComposited(componentId: String, frameNumber: Long, timestampNs: Long) {
                frameCount.incrementAndGet()
            }
        }

        compositor.allocateTexture("canvas_2d", "CANVAS_2D", 0f, 0f, 100f, 100f, listener = listener)
        val state1 = compositor.recordFrameComposited("canvas_2d")
        val state2 = compositor.recordFrameComposited("canvas_2d")

        assertEquals(2L, state2?.renderedFrames)
        assertEquals(2, frameCount.get())
    }

    @Test
    fun `test releaseTexture notifies destruction and removes from active list`() = runTest {
        val destroyedCalled = AtomicBoolean(false)
        val listener = object : SameLayerSurfaceListener {
            override fun onSurfaceTextureAvailable(componentId: String, surfaceTexture: SurfaceTexture?, width: Int, height: Int) {}
            override fun onSurfaceTextureSizeChanged(componentId: String, width: Int, height: Int) {}
            override fun onSurfaceTextureDestroyed(componentId: String) {
                destroyedCalled.set(true)
            }
            override fun onFrameComposited(componentId: String, frameNumber: Long, timestampNs: Long) {}
        }

        compositor.allocateTexture("custom_surface", "CUSTOM_SURFACE", 0f, 0f, 100f, 100f, listener = listener)
        val released = compositor.releaseTexture("custom_surface")

        assertTrue(released)
        assertTrue(destroyedCalled.get())
        assertEquals(0, compositor.getActiveTextures().size)
    }

    @Test
    fun `test multi-texture z-index sorting order`() = runTest {
        compositor.allocateTexture("back_layer", "VIDEO_PLAYER", 0f, 0f, 100f, 100f, zIndex = 1)
        compositor.allocateTexture("front_layer", "CAMERA_PREVIEW", 0f, 0f, 100f, 100f, zIndex = 10)
        compositor.allocateTexture("middle_layer", "MAP_VIEW", 0f, 0f, 100f, 100f, zIndex = 5)

        val textures = compositor.getActiveTextures()
        assertEquals(3, textures.size)
        assertEquals("back_layer", textures[0].componentId)
        assertEquals("middle_layer", textures[1].componentId)
        assertEquals("front_layer", textures[2].componentId)
    }

    @Test
    fun `test SameLayerComponentType alias normalization and cross-platform parity`() {
        // CAMERA aliases
        assertEquals(SameLayerComponentType.CAMERA_PREVIEW, SameLayerComponentType.fromString("CAMERA"))
        assertEquals(SameLayerComponentType.CAMERA_PREVIEW, SameLayerComponentType.fromString("CAMERA_PREVIEW"))
        assertEquals(SameLayerComponentType.CAMERA_PREVIEW, SameLayerComponentType.fromString("camera"))
        assertEquals(SameLayerComponentType.CAMERA_PREVIEW, SameLayerComponentType.fromString("camera_preview"))
        assertEquals(SameLayerComponentType.CAMERA_PREVIEW, SameLayerComponentType.fromString(" Camera_Preview "))

        // VIDEO aliases
        assertEquals(SameLayerComponentType.VIDEO_PLAYER, SameLayerComponentType.fromString("VIDEO"))
        assertEquals(SameLayerComponentType.VIDEO_PLAYER, SameLayerComponentType.fromString("VIDEO_PLAYER"))
        assertEquals(SameLayerComponentType.VIDEO_PLAYER, SameLayerComponentType.fromString("EXO_PLAYER"))
        assertEquals(SameLayerComponentType.VIDEO_PLAYER, SameLayerComponentType.fromString("AVPLAYER"))
        assertEquals(SameLayerComponentType.VIDEO_PLAYER, SameLayerComponentType.fromString("video"))
        assertEquals(SameLayerComponentType.VIDEO_PLAYER, SameLayerComponentType.fromString("video_player"))
        assertEquals(SameLayerComponentType.VIDEO_PLAYER, SameLayerComponentType.fromString("exo_player"))
        assertEquals(SameLayerComponentType.VIDEO_PLAYER, SameLayerComponentType.fromString("avplayer"))
        assertEquals(SameLayerComponentType.VIDEO_PLAYER, SameLayerComponentType.fromString(" Exo_Player "))

        // MAP aliases
        assertEquals(SameLayerComponentType.MAP_VIEW, SameLayerComponentType.fromString("MAP"))
        assertEquals(SameLayerComponentType.MAP_VIEW, SameLayerComponentType.fromString("MAP_VIEW"))
        assertEquals(SameLayerComponentType.MAP_VIEW, SameLayerComponentType.fromString("map"))
        assertEquals(SameLayerComponentType.MAP_VIEW, SameLayerComponentType.fromString("map_view"))
        assertEquals(SameLayerComponentType.MAP_VIEW, SameLayerComponentType.fromString(" Map_View "))

        // CANVAS aliases
        assertEquals(SameLayerComponentType.CANVAS_2D, SameLayerComponentType.fromString("CANVAS"))
        assertEquals(SameLayerComponentType.CANVAS_2D, SameLayerComponentType.fromString("CANVAS_2D"))
        assertEquals(SameLayerComponentType.CANVAS_2D, SameLayerComponentType.fromString("canvas"))
        assertEquals(SameLayerComponentType.CANVAS_2D, SameLayerComponentType.fromString("canvas_2d"))
        assertEquals(SameLayerComponentType.CANVAS_2D, SameLayerComponentType.fromString(" Canvas "))

        // WEBGL aliases
        assertEquals(SameLayerComponentType.WEBGL_NATIVE, SameLayerComponentType.fromString("WEBGL"))
        assertEquals(SameLayerComponentType.WEBGL_NATIVE, SameLayerComponentType.fromString("WEBGL_NATIVE"))
        assertEquals(SameLayerComponentType.WEBGL_NATIVE, SameLayerComponentType.fromString("webgl"))
        assertEquals(SameLayerComponentType.WEBGL_NATIVE, SameLayerComponentType.fromString("webgl_native"))
        assertEquals(SameLayerComponentType.WEBGL_NATIVE, SameLayerComponentType.fromString(" WebGL_Native "))

        // CUSTOM aliases
        assertEquals(SameLayerComponentType.CUSTOM_SURFACE, SameLayerComponentType.fromString("CUSTOM"))
        assertEquals(SameLayerComponentType.CUSTOM_SURFACE, SameLayerComponentType.fromString("CUSTOM_SURFACE"))
        assertEquals(SameLayerComponentType.CUSTOM_SURFACE, SameLayerComponentType.fromString("custom"))
        assertEquals(SameLayerComponentType.CUSTOM_SURFACE, SameLayerComponentType.fromString("custom_surface"))
        assertEquals(SameLayerComponentType.CUSTOM_SURFACE, SameLayerComponentType.fromString(" Custom_Surface "))

        // Fallbacks
        assertEquals(SameLayerComponentType.CUSTOM_SURFACE, SameLayerComponentType.fromString(null))
        assertEquals(SameLayerComponentType.CUSTOM_SURFACE, SameLayerComponentType.fromString(""))
        assertEquals(SameLayerComponentType.CUSTOM_SURFACE, SameLayerComponentType.fromString("   "))
        assertEquals(SameLayerComponentType.CUSTOM_SURFACE, SameLayerComponentType.fromString("UNKNOWN_TYPE"))
        assertEquals(SameLayerComponentType.CUSTOM_SURFACE, SameLayerComponentType.fromString("flutter_widget_xyz"))
    }

    @Test
    fun `test allocateTexture normalizes component type aliases to canonical enum names`() = runTest {
        val exoState = compositor.allocateTexture("comp_exo", "EXO_PLAYER", 0f, 0f, 100f, 100f)
        assertEquals("VIDEO_PLAYER", exoState.componentType)

        val cameraState = compositor.allocateTexture("comp_cam", "camera", 0f, 0f, 100f, 100f)
        assertEquals("CAMERA_PREVIEW", cameraState.componentType)

        val avplayerState = compositor.allocateTexture("comp_av", "AVPLAYER", 0f, 0f, 100f, 100f)
        assertEquals("VIDEO_PLAYER", avplayerState.componentType)

        val mapState = compositor.allocateTexture("comp_map", "MAP", 0f, 0f, 100f, 100f)
        assertEquals("MAP_VIEW", mapState.componentType)

        val canvasState = compositor.allocateTexture("comp_canvas", "CANVAS", 0f, 0f, 100f, 100f)
        assertEquals("CANVAS_2D", canvasState.componentType)

        val webglState = compositor.allocateTexture("comp_webgl", "WEBGL", 0f, 0f, 100f, 100f)
        assertEquals("WEBGL_NATIVE", webglState.componentType)

        val fallbackState = compositor.allocateTexture("comp_unknown", "unknown_embedded_view", 0f, 0f, 100f, 100f)
        assertEquals("CUSTOM_SURFACE", fallbackState.componentType)
    }
}
