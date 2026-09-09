package com.goat.webview.debug

import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Test

/**
 * Task 10186. The two validation rules are that the controller cannot reach a release build, and
 * that no bridge action can read or set the proxy.
 */
class GoatProxyControllerTest {

    @Test
    fun controllerIsPresentInTheDebugVariant() {
        // Sanity anchor for the release-absence check below: this test source set sees the debug
        // variant, so the class must resolve here. If this ever fails, the absence assertion in
        // GoatReleaseArtifactScanTest would be passing for the wrong reason.
        assertNotNull(Class.forName("com.goat.webview.debug.GoatProxyController"))
    }

    @Test
    fun rejectsBlankHost() {
        assertFalse(GoatProxyController.setProxyOverride("", 8888))
        assertFalse(GoatProxyController.setProxyOverride("   ", 8888))
    }

    @Test
    fun rejectsOutOfRangePorts() {
        assertFalse(GoatProxyController.setProxyOverride("127.0.0.1", 0))
        assertFalse(GoatProxyController.setProxyOverride("127.0.0.1", -1))
        assertFalse(GoatProxyController.setProxyOverride("127.0.0.1", 65536))
    }

    @Test
    fun noOverrideIsActiveBeforeOneIsApplied() {
        // Rejected calls must not record an override; a failed validation that still set state
        // would report a proxy that was never installed.
        GoatProxyController.setProxyOverride("", 8888)
        GoatProxyController.setProxyOverride("127.0.0.1", 70000)
        assertNull(GoatProxyController.activeOverride)
    }
}
