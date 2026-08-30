package com.goat.webview

import android.net.Uri
import android.webkit.ValueCallback
import android.webkit.WebChromeClient.FileChooserParams
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicReference

/**
 * Parsed request payload for launching a file chooser dialog.
 */
@Serializable
data class FileChooserRequest(
    val isMultiple: Boolean,
    val acceptTypes: List<String>,
    val title: String? = null
)

/**
 * Result of resolving a file chooser interaction.
 */
@Serializable
data class FileChooserResult(
    val isSuccess: Boolean,
    val selectedUris: List<String>,
    val totalFiles: Int,
    val wasCancelled: Boolean = false
)

/**
 * Multi-File Upload & WebChromeClient File Chooser Coordinator (Task 10076).
 *
 * Intercepts `WebChromeClient.onShowFileChooser`, provides leak-safe management of `ValueCallback<Array<Uri>>`,
 * and handles multi-file document picking with MIME type filters and cancellation guarantees.
 */
class GoatFileChooserManager {

    private val pendingCallback = AtomicReference<ValueCallback<Array<Uri>>?>(null)
    private val isPickerActive = AtomicBoolean(false)

    /**
     * Registers a new file chooser callback from WebChromeClient.
     * Automatically flushes any prior dangling callback to avoid WebKit deadlocks.
     *
     * @param callback - Android WebKit ValueCallback for array of file URIs.
     * @param params - FileChooserParams containing mode and accept types.
     * @return [FileChooserRequest] parsed configuration.
     */
    fun onShowFileChooser(
        callback: ValueCallback<Array<Uri>>?,
        params: FileChooserParams?
    ): FileChooserRequest {
        // Prevent callback leak by canceling any prior pending callback
        cancelPendingCallback()

        pendingCallback.set(callback)
        isPickerActive.set(true)

        val isMultiple = params?.mode == FileChooserParams.MODE_OPEN_MULTIPLE
        val acceptTypes = params?.acceptTypes?.filter { it.isNotBlank() } ?: listOf("*/*")
        val title = params?.title?.toString()

        return FileChooserRequest(
            isMultiple = isMultiple,
            acceptTypes = acceptTypes,
            title = title
        )
    }

    /**
     * Resolves the active file chooser with selected URI strings.
     */
    suspend fun handleFileSelection(uris: List<String>): FileChooserResult = withContext(Dispatchers.IO) {
        val callback = pendingCallback.getAndSet(null)
        isPickerActive.set(false)

        val uriArray = uris.map { Uri.parse(it) }.toTypedArray()
        callback?.onReceiveValue(uriArray)

        FileChooserResult(
            isSuccess = true,
            selectedUris = uris,
            totalFiles = uris.size,
            wasCancelled = false
        )
    }

    /**
     * Cancels the active file chooser and safely resolves the pending callback with null.
     */
    fun cancelPendingCallback(): Boolean {
        isPickerActive.set(false)
        val callback = pendingCallback.getAndSet(null)
        if (callback != null) {
            callback.onReceiveValue(null)
            return true
        }
        return false
    }

    /**
     * Checks if a file chooser dialog interaction is currently in flight.
     */
    fun isFileChooserActive(): Boolean = isPickerActive.get()
}
