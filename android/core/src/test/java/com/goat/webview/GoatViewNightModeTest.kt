package com.goat.webview

import android.content.res.Configuration
import com.goat.webview.view.GoatView
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class GoatViewNightModeTest {

    @Test
    fun `night mode is detected when a ui type is packed alongside the night bits`() {
        val darkPhone = Configuration.UI_MODE_TYPE_NORMAL or Configuration.UI_MODE_NIGHT_YES
        assertTrue(GoatView.isNightMode(darkPhone))
    }

    @Test
    fun `light mode is not mistaken for night mode`() {
        val lightPhone = Configuration.UI_MODE_TYPE_NORMAL or Configuration.UI_MODE_NIGHT_NO
        assertFalse(GoatView.isNightMode(lightPhone))
    }

    @Test
    fun `night mode is detected across every ui type`() {
        val uiTypes = intArrayOf(
            Configuration.UI_MODE_TYPE_NORMAL,
            Configuration.UI_MODE_TYPE_DESK,
            Configuration.UI_MODE_TYPE_CAR,
            Configuration.UI_MODE_TYPE_TELEVISION,
            Configuration.UI_MODE_TYPE_APPLIANCE,
            Configuration.UI_MODE_TYPE_WATCH,
            Configuration.UI_MODE_TYPE_VR_HEADSET
        )
        for (type in uiTypes) {
            assertTrue(
                "night not detected for ui type $type",
                GoatView.isNightMode(type or Configuration.UI_MODE_NIGHT_YES)
            )
            assertFalse(
                "night falsely detected for ui type $type",
                GoatView.isNightMode(type or Configuration.UI_MODE_NIGHT_NO)
            )
        }
    }

    @Test
    fun `an undefined ui mode is not night`() {
        assertFalse(GoatView.isNightMode(0))
        assertFalse(GoatView.isNightMode(Configuration.UI_MODE_NIGHT_UNDEFINED))
    }
}
