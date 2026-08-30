package com.goat.webview.manifest

import android.content.pm.ActivityInfo
import android.graphics.Color
import com.goat.webview.FakeTestContext
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class GoatManifestWindowApplierTest {

    @Test
    fun resolvesTitleColorAndOrientationFromManifest() {
        val manifest = GoatManifestParser.parseManifest(
            """
            {"appId":"a","version":"1","window":{
              "navigationBarTitleText":"Checkout",
              "navigationBarBackgroundColor":"#112233",
              "navigationBarTextStyle":"white",
              "orientation":"portrait"}}
            """.trimIndent()
        )
        val state = GoatManifestWindowApplier.resolveWindowState(manifest.window)
        assertEquals("Checkout", state.titleText)
        assertEquals(Color.parseColor("#112233"), state.backgroundColor)
        assertFalse(state.lightStatusBarIcons)
        assertEquals(ActivityInfo.SCREEN_ORIENTATION_PORTRAIT, state.screenOrientation)
    }

    @Test
    fun blackTextStyleRequestsLightStatusBarIcons() {
        val state = GoatManifestWindowApplier.resolveWindowState(MiniAppWindowConfig.DEFAULT)
        assertTrue(state.lightStatusBarIcons)
    }

    @Test
    fun unparseableColorFallsBackToDefaultWhite() {
        assertEquals(
            Color.parseColor(MiniAppWindowConfig.DEFAULT_BACKGROUND_COLOR),
            GoatManifestWindowApplier.parseColor("not-a-color")
        )
    }

    @Test
    fun applyWithoutHostActivityStillResolvesStateAndDoesNotThrow() {
        val state = GoatManifestWindowApplier.apply(FakeTestContext(), MiniAppWindowConfig.DEFAULT)
        assertEquals(MiniAppWindowConfig.DEFAULT_TITLE, state.titleText)
        assertEquals(ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED, state.screenOrientation)
    }
}
