package com.goat.webview

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.goat.webview.view.GoatView
import java.lang.ref.WeakReference
import kotlinx.coroutines.delay
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

/**
 * T12 (`TASK_PORTABLE_PLUG_AND_PLAY_ADAPTER.md` §4): opens and disposes 100 mini-app [GoatView]
 * instances and asserts nothing beyond the intentional bounded warm pool survives — no leaked
 * native WebView pointers, no unbounded retained-heap growth from repeated create/dispose cycles
 * (G5's device-side counterpart to the pure-Dart 100×(create→use→dispose) test in
 * `goat_webview_compat`'s own controller suite).
 *
 * NOTE: written but not yet run on a device/emulator — see T12 in
 * `TASK_PORTABLE_PLUG_AND_PLAY_ADAPTER.md` for the still-open CI/physical-device wiring this
 * depends on.
 */
@RunWith(AndroidJUnit4::class)
class GoatViewHeapRetentionTest {

    private val instanceCount = 100

    @Test
    fun openAndDispose100Instances_leavesNoRetainedViews() = runBlocking {
        val context: Context = ApplicationProvider.getApplicationContext()
        val weakRefs = mutableListOf<WeakReference<GoatView>>()

        repeat(instanceCount) { i ->
            val view = GoatView(context)
            view.hotReuseEnabled = true
            view.initializeUrlAsync("about:blank", appId = "heap-retention-$i")
            weakRefs += WeakReference(view)
            view.destroy()
        }

        // A handful of forced GC passes is the standard (if inelegant) way to get the ART heap
        // into a state where WeakReferences to genuinely unreachable objects have actually
        // cleared before asserting on them.
        repeat(5) {
            System.gc()
            System.runFinalization()
            delay(50)
        }

        val stillReachable = weakRefs.count { it.get() != null }
        // GoatFastPool intentionally keeps a small bounded number of instances warm (its whole
        // purpose is trading a little RAM for startup latency) — anything beyond that documented
        // bound after 100 dispose cycles is a leak, not the pool doing its job.
        val allowedRetained = GoatFastPool.MAX_POOL_SIZE + GoatFastPool.MAX_HOT_SIZE
        assertTrue(
            "Expected at most $allowedRetained retained GoatView instances (bounded warm pool), " +
                "but $stillReachable of $instanceCount are still reachable after dispose+GC",
            stillReachable <= allowedRetained
        )

        // The standby pool itself must never exceed its own documented cap — the "native
        // view-pointer count" half of the §4 criterion.
        assertTrue(
            "GoatFastPool.poolSize (${GoatFastPool.poolSize}) exceeded MAX_POOL_SIZE (${GoatFastPool.MAX_POOL_SIZE})",
            GoatFastPool.poolSize <= GoatFastPool.MAX_POOL_SIZE
        )
    }
}
