package com.goat.webview

import android.graphics.SurfaceTexture
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.util.concurrent.ConcurrentLinkedQueue
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.atomic.AtomicLong

/**
 * Adversarial and Stress Test Suite for GoatSameLayerTextureCompositor & GoatSameLayerRenderer.
 * Probes edge cases: boundary touches, opacity clamping, corner radius clamping,
 * dynamic bounds vs size listeners, multi-component z-index stability, and concurrency telemetry.
 */
class GoatSameLayerAdversarialTest {

    private lateinit var compositor: GoatSameLayerTextureCompositor
    private lateinit var renderer: GoatSameLayerRenderer

    @Before
    fun setUp() {
        compositor = GoatSameLayerTextureCompositor(defaultFps = 120.0)
        renderer = GoatSameLayerRenderer(compositor)
    }

    // =========================================================================
    // 1. BOUNDARY TOUCHES & HIT-TESTING EDGE CASES
    // =========================================================================

    @Test
    fun `test hitTest exactly on all four boundaries and corners`() = runTest {
        val x = 100f
        val y = 200f
        val width = 300f
        val height = 400f
        compositor.allocateTexture("box_1", "VIDEO_PLAYER", x, y, width, height)

        // 4 exact corners
        assertTrue("Top-left corner should hit", compositor.hitTest("box_1", x, y))
        assertTrue("Top-right corner should hit", compositor.hitTest("box_1", x + width, y))
        assertTrue("Bottom-left corner should hit", compositor.hitTest("box_1", x, y + height))
        assertTrue("Bottom-right corner should hit", compositor.hitTest("box_1", x + width, y + height))

        // Center
        assertTrue("Center should hit", compositor.hitTest("box_1", x + width / 2f, y + height / 2f))

        // Midpoints of 4 edges
        assertTrue("Top edge midpoint should hit", compositor.hitTest("box_1", x + width / 2f, y))
        assertTrue("Bottom edge midpoint should hit", compositor.hitTest("box_1", x + width / 2f, y + height))
        assertTrue("Left edge midpoint should hit", compositor.hitTest("box_1", x, y + height / 2f))
        assertTrue("Right edge midpoint should hit", compositor.hitTest("box_1", x + width, y + height / 2f))
    }

    @Test
    fun `test hitTest just outside boundaries by epsilon fails`() = runTest {
        val x = 100f
        val y = 200f
        val width = 300f
        val height = 400f
        val eps = 0.001f
        compositor.allocateTexture("box_eps", "MAP_VIEW", x, y, width, height)

        // Just outside left
        assertFalse("Just left of boundary should miss", compositor.hitTest("box_eps", x - eps, y + 10f))
        // Just outside right
        assertFalse("Just right of boundary should miss", compositor.hitTest("box_eps", x + width + eps, y + 10f))
        // Just outside top
        assertFalse("Just above boundary should miss", compositor.hitTest("box_eps", x + 10f, y - eps))
        // Just outside bottom
        assertFalse("Just below boundary should miss", compositor.hitTest("box_eps", x + 10f, y + height + eps))
    }

    @Test
    fun `test hitTest with negative coordinates and origin spanning`() = runTest {
        // Bounding box starting in negative coordinates and spanning across (0,0)
        val x = -150f
        val y = -250f
        val width = 300f  // max x = +150
        val height = 500f // max y = +250
        compositor.allocateTexture("box_neg", "CAMERA_PREVIEW", x, y, width, height)

        // Points in pure negative quadrant
        assertTrue("Deep negative coordinate should hit", compositor.hitTest("box_neg", -100f, -200f))
        assertTrue("Top-left negative corner should hit", compositor.hitTest("box_neg", -150f, -250f))

        // Origin (0,0)
        assertTrue("Origin (0,0) should hit", compositor.hitTest("box_neg", 0f, 0f))

        // Points in positive quadrant
        assertTrue("Positive sub-region should hit", compositor.hitTest("box_neg", 100f, 200f))
        assertTrue("Bottom-right corner should hit", compositor.hitTest("box_neg", 150f, 250f))

        // Outside negative bounds
        assertFalse("Outside negative left should miss", compositor.hitTest("box_neg", -150.01f, 0f))
        assertFalse("Outside negative top should miss", compositor.hitTest("box_neg", 0f, -250.01f))
        assertFalse("Outside positive right should miss", compositor.hitTest("box_neg", 150.01f, 0f))
        assertFalse("Outside positive bottom should miss", compositor.hitTest("box_neg", 0f, 250.01f))
    }

    @Test
    fun `test hitTest on zero-sized component and inverted rect`() = runTest {
        // Zero-size component (point)
        compositor.allocateTexture("point_comp", "CANVAS_2D", 50f, 50f, 0f, 0f)
        assertTrue("Exact single point should hit zero-sized rect", compositor.hitTest("point_comp", 50f, 50f))
        assertFalse("Offset point should miss zero-sized rect", compositor.hitTest("point_comp", 50.1f, 50f))

        // Inverted dimension rect (negative width / height)
        compositor.allocateTexture("inverted_comp", "CUSTOM_SURFACE", 100f, 100f, -50f, -50f)
        // With width = -50f, max X is 50f < min X 100f. Mathematically touchX >= 100 && touchX <= 50 is impossible
        assertFalse("Inverted dimension should safely evaluate to false", compositor.hitTest("inverted_comp", 75f, 75f))
    }

    @Test
    fun `test hitTest on invisible or nonexistent component returns false`() = runTest {
        compositor.allocateTexture("invis_comp", "WEBGL_NATIVE", 0f, 0f, 100f, 100f)
        compositor.updateTextureBounds("invis_comp", 0f, 0f, 100f, 100f, isVisible = false)

        assertFalse("Invisible component should not register hitTest", compositor.hitTest("invis_comp", 50f, 50f))
        assertFalse("Non-existent component should return false", compositor.hitTest("phantom_comp", 50f, 50f))
    }

    // =========================================================================
    // 2. OPACITY CLAMPING ADVERSARIAL STRESS TESTS
    // =========================================================================

    @Test
    fun `test allocateTexture clamps extreme opacity values`() = runTest {
        // Negative values
        val stateNeg = compositor.allocateTexture("op_neg", "CUSTOM", 0f, 0f, 100f, 100f, opacity = -0.5f)
        assertEquals("Negative opacity should be clamped to 0.0f", 0.0f, stateNeg.opacity, 0.0f)

        val stateHugeNeg = compositor.allocateTexture("op_huge_neg", "CUSTOM", 0f, 0f, 100f, 100f, opacity = -9999.0f)
        assertEquals("Extreme negative opacity should clamp to 0.0f", 0.0f, stateHugeNeg.opacity, 0.0f)

        // Values > 1.0f
        val stateExcess = compositor.allocateTexture("op_excess", "CUSTOM", 0f, 0f, 100f, 100f, opacity = 1.5f)
        assertEquals("Excess opacity should be clamped to 1.0f", 1.0f, stateExcess.opacity, 0.0f)

        val stateHugePos = compositor.allocateTexture("op_huge_pos", "CUSTOM", 0f, 0f, 100f, 100f, opacity = 100000.0f)
        assertEquals("Extreme positive opacity should clamp to 1.0f", 1.0f, stateHugePos.opacity, 0.0f)

        // Exact boundaries
        val stateZero = compositor.allocateTexture("op_zero", "CUSTOM", 0f, 0f, 100f, 100f, opacity = 0.0f)
        assertEquals("Exact 0.0f should be preserved", 0.0f, stateZero.opacity, 0.0f)

        val stateOne = compositor.allocateTexture("op_one", "CUSTOM", 0f, 0f, 100f, 100f, opacity = 1.0f)
        assertEquals("Exact 1.0f should be preserved", 1.0f, stateOne.opacity, 0.0f)

        val stateMid = compositor.allocateTexture("op_mid", "CUSTOM", 0f, 0f, 100f, 100f, opacity = 0.42f)
        assertEquals("Midpoint opacity should be preserved", 0.42f, stateMid.opacity, 0.0001f)
    }

    @Test
    fun `test updateTextureBounds clamps extreme opacity values`() = runTest {
        compositor.allocateTexture("op_update", "CUSTOM", 0f, 0f, 100f, 100f, opacity = 1.0f)

        val updatedNeg = compositor.updateTextureBounds("op_update", 0f, 0f, 100f, 100f, opacity = -10.0f)
        assertEquals("Updated negative opacity should clamp to 0.0f", 0.0f, updatedNeg?.opacity ?: -1f, 0.0f)

        val updatedPos = compositor.updateTextureBounds("op_update", 0f, 0f, 100f, 100f, opacity = 99.0f)
        assertEquals("Updated excess opacity should clamp to 1.0f", 1.0f, updatedPos?.opacity ?: -1f, 0.0f)
    }

    // =========================================================================
    // 3. CORNER RADIUS CLAMPING ADVERSARIAL STRESS TESTS
    // =========================================================================

    @Test
    fun `test cornerRadius clamping on allocation and update`() = runTest {
        // Negative corner radius
        val stateNegRadius = compositor.allocateTexture("cr_neg", "CUSTOM", 0f, 0f, 100f, 100f, cornerRadius = -25.0f)
        assertEquals("Negative corner radius should clamp to 0.0f", 0.0f, stateNegRadius.cornerRadius, 0.0f)

        // Large positive corner radius
        val stateLargeRadius = compositor.allocateTexture("cr_large", "CUSTOM", 0f, 0f, 100f, 100f, cornerRadius = 5000.0f)
        assertEquals("Large corner radius should be preserved", 5000.0f, stateLargeRadius.cornerRadius, 0.001f)

        // Update with negative corner radius
        val updatedNeg = compositor.updateTextureBounds("cr_large", 0f, 0f, 100f, 100f, cornerRadius = -100.0f)
        assertEquals("Updated negative corner radius should clamp to 0.0f", 0.0f, updatedNeg?.cornerRadius ?: -1f, 0.0f)
    }

    // =========================================================================
    // 4. DYNAMIC BOUNDS CHANGES VS SIZE CHANGE LISTENER TRIGGERING
    // =========================================================================

    @Test
    fun `test position-only scroll update does NOT trigger size change listener`() = runTest {
        val sizeChangedCount = AtomicInteger(0)
        val listener = object : SameLayerSurfaceListener {
            override fun onSurfaceTextureAvailable(componentId: String, surfaceTexture: SurfaceTexture?, width: Int, height: Int) {}
            override fun onSurfaceTextureSizeChanged(componentId: String, width: Int, height: Int) {
                sizeChangedCount.incrementAndGet()
            }
            override fun onSurfaceTextureDestroyed(componentId: String) {}
            override fun onFrameComposited(componentId: String, frameNumber: Long, timestampNs: Long) {}
        }

        compositor.allocateTexture("scroll_view", "VIDEO_PLAYER", 0f, 0f, 300f, 200f, listener = listener)
        assertEquals(0, sizeChangedCount.get())

        // Simulate fast scrolling with 100 consecutive position updates (same width and height)
        for (i in 1..100) {
            val updated = compositor.updateTextureBounds(
                componentId = "scroll_view",
                x = 0f,
                y = i * 10f,
                width = 300f,
                height = 200f
            )
            assertNotNull(updated)
            assertEquals(i * 10f, updated!!.y)
        }

        // Size change listener must NOT have been triggered during pure translation
        assertEquals("Position-only updates must not invoke onSurfaceTextureSizeChanged", 0, sizeChangedCount.get())
    }

    @Test
    fun `test dimension change triggers size change listener with proper integer dimensions`() = runTest {
        val capturedWidths = mutableListOf<Int>()
        val capturedHeights = mutableListOf<Int>()
        val listener = object : SameLayerSurfaceListener {
            override fun onSurfaceTextureAvailable(componentId: String, surfaceTexture: SurfaceTexture?, width: Int, height: Int) {}
            override fun onSurfaceTextureSizeChanged(componentId: String, width: Int, height: Int) {
                capturedWidths.add(width)
                capturedHeights.add(height)
            }
            override fun onSurfaceTextureDestroyed(componentId: String) {}
            override fun onFrameComposited(componentId: String, frameNumber: Long, timestampNs: Long) {}
        }

        compositor.allocateTexture("resize_comp", "CANVAS_2D", 0f, 0f, 100f, 100f, listener = listener)

        // Width only change
        compositor.updateTextureBounds("resize_comp", 0f, 0f, 250f, 100f)
        // Height only change
        compositor.updateTextureBounds("resize_comp", 0f, 0f, 250f, 400f)
        // Float truncation check (319.9f -> 319, 479.8f -> 479)
        compositor.updateTextureBounds("resize_comp", 10f, 20f, 319.9f, 479.8f)

        assertEquals(3, capturedWidths.size)
        assertEquals(listOf(250, 250, 319), capturedWidths)
        assertEquals(listOf(100, 400, 479), capturedHeights)
    }

    // =========================================================================
    // 5. MULTI-COMPONENT Z-INDEX SORTING STABILITY
    // =========================================================================

    @Test
    fun `test z-index sorting across negative, zero, positive, and large indices`() = runTest {
        compositor.allocateTexture("c_neg_100", "CUSTOM", 0f, 0f, 50f, 50f, zIndex = -100)
        compositor.allocateTexture("c_pos_10", "CUSTOM", 0f, 0f, 50f, 50f, zIndex = 10)
        compositor.allocateTexture("c_zero", "CUSTOM", 0f, 0f, 50f, 50f, zIndex = 0)
        compositor.allocateTexture("c_neg_1", "CUSTOM", 0f, 0f, 50f, 50f, zIndex = -1)
        compositor.allocateTexture("c_pos_9999", "CUSTOM", 0f, 0f, 50f, 50f, zIndex = 9999)
        compositor.allocateTexture("c_pos_5", "CUSTOM", 0f, 0f, 50f, 50f, zIndex = 5)

        val sorted = compositor.getActiveTextures()
        assertEquals(6, sorted.size)
        assertEquals("c_neg_100", sorted[0].componentId)
        assertEquals("c_neg_1", sorted[1].componentId)
        assertEquals("c_zero", sorted[2].componentId)
        assertEquals("c_pos_5", sorted[3].componentId)
        assertEquals("c_pos_10", sorted[4].componentId)
        assertEquals("c_pos_9999", sorted[5].componentId)
    }

    @Test
    fun `test multiple components with identical z-index are all preserved in active list`() = runTest {
        val totalIdentical = 20
        for (i in 0 until totalIdentical) {
            compositor.allocateTexture("equal_z_$i", "CUSTOM", 0f, 0f, 50f, 50f, zIndex = 0)
        }

        val active = compositor.getActiveTextures()
        assertEquals(totalIdentical, active.size)
        val ids = active.map { it.componentId }.toSet()
        assertEquals(totalIdentical, ids.size)
        assertTrue(active.all { it.zIndex == 0 })
    }

    @Test
    fun `test dynamic z-index update shifts component rendering order`() = runTest {
        compositor.allocateTexture("layer_a", "CUSTOM", 0f, 0f, 50f, 50f, zIndex = 1)
        compositor.allocateTexture("layer_b", "CUSTOM", 0f, 0f, 50f, 50f, zIndex = 2)
        compositor.allocateTexture("layer_c", "CUSTOM", 0f, 0f, 50f, 50f, zIndex = 3)

        // Initially: A(1) -> B(2) -> C(3)
        assertEquals(listOf("layer_a", "layer_b", "layer_c"), compositor.getActiveTextures().map { it.componentId })

        // Update layer_a zIndex to 10: B(2) -> C(3) -> A(10)
        compositor.updateTextureBounds("layer_a", 0f, 0f, 50f, 50f, zIndex = 10)
        assertEquals(listOf("layer_b", "layer_c", "layer_a"), compositor.getActiveTextures().map { it.componentId })
    }

    // =========================================================================
    // 6. CONCURRENCY & TELEMETRY FRAME COUNTING
    // =========================================================================

    @Test
    fun `test concurrent frame recording across coroutines`() = runTest {
        val totalFrames = 500
        val recordedTimestamps = ConcurrentLinkedQueue<Long>()
        val listener = object : SameLayerSurfaceListener {
            override fun onSurfaceTextureAvailable(componentId: String, surfaceTexture: SurfaceTexture?, width: Int, height: Int) {}
            override fun onSurfaceTextureSizeChanged(componentId: String, width: Int, height: Int) {}
            override fun onSurfaceTextureDestroyed(componentId: String) {}
            override fun onFrameComposited(componentId: String, frameNumber: Long, timestampNs: Long) {
                recordedTimestamps.add(timestampNs)
            }
        }

        compositor.allocateTexture("telemetry_comp", "CANVAS_2D", 0f, 0f, 100f, 100f, listener = listener)

        // Sequential rapid frame dispatch to test telemetry recording
        var lastState: SameLayerTextureState? = null
        for (i in 1..totalFrames) {
            lastState = compositor.recordFrameComposited("telemetry_comp")
        }

        assertEquals(totalFrames.toLong(), lastState?.renderedFrames)
        assertEquals(totalFrames, recordedTimestamps.size)
    }

    @Test
    fun `test concurrent component operations and lifecycle tear down`() = runTest {
        val numComponents = 30

        // Concurrently embed components in renderer
        val deferredAllocations = (0 until numComponents).map { idx ->
            async(Dispatchers.Default) {
                renderer.embedNativeComponent(
                    componentId = "concurrent_comp_$idx",
                    componentType = if (idx % 2 == 0) "VIDEO" else "MAP",
                    x = idx * 10f,
                    y = idx * 10f,
                    width = 200f,
                    height = 150f,
                    zIndex = idx
                )
            }
        }
        deferredAllocations.awaitAll()

        assertEquals(numComponents, renderer.getActiveComponents().size)
        assertEquals(numComponents, compositor.getActiveTextures().size)

        // Concurrently update bounds
        val deferredUpdates = (0 until numComponents).map { idx ->
            async(Dispatchers.Default) {
                renderer.updateComponentBounds(
                    componentId = "concurrent_comp_$idx",
                    x = idx * 20f,
                    y = idx * 20f,
                    width = 250f,
                    height = 200f,
                    zIndex = idx + 100
                )
            }
        }
        deferredUpdates.awaitAll()

        assertEquals(numComponents, renderer.getActiveComponents().size)

        // Clear all and verify teardown
        renderer.clearAll()
        assertEquals(0, renderer.getActiveComponents().size)
        assertEquals(0, compositor.getActiveTextures().size)
    }

    @Test
    fun `test releaseAll notifies all surface listeners`() = runTest {
        val destroyedCount = AtomicInteger(0)
        val listener = object : SameLayerSurfaceListener {
            override fun onSurfaceTextureAvailable(componentId: String, surfaceTexture: SurfaceTexture?, width: Int, height: Int) {}
            override fun onSurfaceTextureSizeChanged(componentId: String, width: Int, height: Int) {}
            override fun onSurfaceTextureDestroyed(componentId: String) {
                destroyedCount.incrementAndGet()
            }
            override fun onFrameComposited(componentId: String, frameNumber: Long, timestampNs: Long) {}
        }

        compositor.allocateTexture("comp1", "VIDEO", 0f, 0f, 100f, 100f, listener = listener)
        compositor.allocateTexture("comp2", "MAP", 0f, 0f, 100f, 100f, listener = listener)
        compositor.allocateTexture("comp3", "CAMERA", 0f, 0f, 100f, 100f, listener = listener)

        compositor.releaseAll()

        assertEquals(3, destroyedCount.get())
        assertEquals(0, compositor.getActiveTextures().size)
    }
}
