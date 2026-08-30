package com.goat.webview

import android.net.Uri
import android.webkit.ValueCallback
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.util.concurrent.atomic.AtomicReference

class GoatFileChooserManagerTest {

    private lateinit var fileChooserManager: GoatFileChooserManager

    @Before
    fun setup() {
        fileChooserManager = GoatFileChooserManager()
    }

    @Test
    fun `test onShowFileChooser registers and resolves with selected URIs (Task 10076)`() = runTest {
        val receivedValue = AtomicReference<Array<Uri>?>()
        val callback = ValueCallback<Array<Uri>> { uris ->
            receivedValue.set(uris)
        }

        val request = fileChooserManager.onShowFileChooser(callback, null)
        assertTrue(fileChooserManager.isFileChooserActive())
        assertFalse(request.isMultiple)

        val selected = listOf("content://media/external/images/media/1", "content://media/external/images/media/2")
        val result = fileChooserManager.handleFileSelection(selected)

        assertTrue(result.isSuccess)
        assertEquals(2, result.totalFiles)
        assertFalse(fileChooserManager.isFileChooserActive())
        assertNotNull(receivedValue.get())
        assertEquals(2, receivedValue.get()?.size)
    }

    @Test
    fun `test cancelPendingCallback delivers null to prevent WebKit deadlocks`() {
        val receivedValue = AtomicReference<Array<Uri>?>()
        val callback = ValueCallback<Array<Uri>> { uris ->
            receivedValue.set(uris)
        }

        fileChooserManager.onShowFileChooser(callback, null)
        assertTrue(fileChooserManager.isFileChooserActive())

        val cancelled = fileChooserManager.cancelPendingCallback()
        assertTrue(cancelled)
        assertFalse(fileChooserManager.isFileChooserActive())
        assertEquals(null, receivedValue.get())
    }

    private fun assertNotNull(obj: Any?) {
        assertTrue(obj != null)
    }
}
