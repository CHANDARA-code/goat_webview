package com.goat.webview

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import java.util.concurrent.ConcurrentHashMap

/**
 * Descriptor model for a same-layer native embedded component.
 */
@Serializable
data class NativeComponentDescriptor(
    val componentId: String,
    val componentType: String,
    val x: Float,
    val y: Float,
    val width: Float,
    val height: Float,
    val zIndex: Int,
    val isVisible: Boolean,
    val opacity: Float = 1.0f,
    val cornerRadius: Float = 0.0f,
    val params: Map<String, String> = emptyMap()
)

/**
 * Same-Layer Native Component Rendering Coordinator (Task 10100 & Compositing Engine).
 *
 * Synchronizes hardware-accelerated native surface views (`TextureView` / `SurfaceView` for
 * video playback, maps, camera viewfinders) with DOM placeholder element bounding rectangles
 * and z-index compositing order.
 */
class GoatSameLayerRenderer(
    val textureCompositor: GoatSameLayerTextureCompositor = GoatSameLayerTextureCompositor()
) {

    private val components = ConcurrentHashMap<String, NativeComponentDescriptor>()

    /**
     * Embeds or registers a new same-layer native component and allocates a hardware texture.
     */
    suspend fun embedNativeComponent(
        componentId: String,
        componentType: String,
        x: Float,
        y: Float,
        width: Float,
        height: Float,
        zIndex: Int = 0,
        opacity: Float = 1.0f,
        cornerRadius: Float = 0.0f,
        params: Map<String, String> = emptyMap()
    ): NativeComponentDescriptor = withContext(Dispatchers.IO) {
        val descriptor = NativeComponentDescriptor(
            componentId = componentId,
            componentType = componentType,
            x = x,
            y = y,
            width = width,
            height = height,
            zIndex = zIndex,
            isVisible = true,
            opacity = opacity,
            cornerRadius = cornerRadius,
            params = params
        )
        components[componentId] = descriptor

        textureCompositor.allocateTexture(
            componentId = componentId,
            componentType = componentType,
            x = x,
            y = y,
            width = width,
            height = height,
            zIndex = zIndex,
            opacity = opacity,
            cornerRadius = cornerRadius,
            customParams = params
        )

        descriptor
    }

    /**
     * Updates viewport coordinates and bounds during DOM scrolling or resize events.
     */
    suspend fun updateComponentBounds(
        componentId: String,
        x: Float,
        y: Float,
        width: Float,
        height: Float,
        zIndex: Int = 0,
        opacity: Float = 1.0f,
        cornerRadius: Float = 0.0f,
        isVisible: Boolean = true
    ): NativeComponentDescriptor? = withContext(Dispatchers.IO) {
        val existing = components[componentId] ?: return@withContext null
        val updated = existing.copy(
            x = x,
            y = y,
            width = width,
            height = height,
            zIndex = zIndex,
            isVisible = isVisible,
            opacity = opacity,
            cornerRadius = cornerRadius
        )
        components[componentId] = updated

        textureCompositor.updateTextureBounds(
            componentId = componentId,
            x = x,
            y = y,
            width = width,
            height = height,
            zIndex = zIndex,
            opacity = opacity,
            cornerRadius = cornerRadius,
            isVisible = isVisible
        )

        updated
    }

    /**
     * Removes and unmounts an embedded native component and frees its hardware texture.
     */
    suspend fun removeNativeComponent(componentId: String): Boolean = withContext(Dispatchers.IO) {
        val removed = components.remove(componentId) != null
        textureCompositor.releaseTexture(componentId)
        removed
    }

    /**
     * Retrieves all currently active embedded native components sorted by zIndex.
     */
    fun getActiveComponents(): List<NativeComponentDescriptor> {
        return components.values.sortedBy { it.zIndex }
    }

    /**
     * Clears all embedded components upon page teardown.
     */
    fun clearAll() {
        components.clear()
        textureCompositor.releaseAll()
    }
}
