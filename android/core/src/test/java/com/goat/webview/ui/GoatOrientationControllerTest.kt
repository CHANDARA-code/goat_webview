package com.goat.webview.ui

import android.content.pm.ActivityInfo
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

/**
 * Task 10175. The rule that actually matters is rule 1: a runtime lock must never survive the
 * mini-app that set it, in either direction -- back to the manifest default on route unmount, and
 * back to the host's own setting on teardown.
 */
class GoatOrientationControllerTest {

    @Before
    fun setUp() = GoatOrientationController.resetForTesting()

    @After
    fun tearDown() = GoatOrientationController.resetForTesting()

    @Test
    fun parsesTheThreeDocumentedOrientations() {
        assertEquals("portrait", GoatOrientationController.parseOrientation("portrait")?.manifestValue)
        assertEquals("landscape", GoatOrientationController.parseOrientation("LANDSCAPE")?.manifestValue)
        assertEquals("auto", GoatOrientationController.parseOrientation("  Auto  ")?.manifestValue)
    }

    @Test
    fun rejectsUnknownOrientations() {
        assertNull(GoatOrientationController.parseOrientation("sideways"))
        assertNull(GoatOrientationController.parseOrientation(""))
        assertNull(GoatOrientationController.parseOrientation(null))
    }

    @Test
    fun noLockIsActiveInitially() {
        assertNull(GoatOrientationController.currentLock)
    }

    @Test
    fun autoClearsTheLockRatherThanRecordingOne() {
        // Rule 2: "auto" follows the sensor and means no lock is held -- distinct from the
        // manifest default, which may itself be portrait or landscape.
        GoatOrientationController.setLock(null, "landscape")
        assertEquals("landscape", GoatOrientationController.currentLock)

        GoatOrientationController.setLock(null, "auto")
        assertNull(GoatOrientationController.currentLock)
    }

    @Test
    fun anInvalidOrientationLeavesTheExistingLockUntouched() {
        GoatOrientationController.setLock(null, "portrait")
        assertFalse(GoatOrientationController.setLock(null, "diagonal"))
        assertEquals("portrait", GoatOrientationController.currentLock)
    }

    @Test
    fun releaseToManifestDefaultDropsTheRuntimeLock() {
        GoatOrientationController.setLock(null, "landscape")
        assertEquals("landscape", GoatOrientationController.currentLock)

        GoatOrientationController.releaseToManifestDefault(null)
        assertNull(GoatOrientationController.currentLock)
    }

    @Test
    fun teardownDropsTheLockSoItCannotLeakToTheNextMiniApp() {
        GoatOrientationController.setLock(null, "landscape")
        GoatOrientationController.releaseToHost(null)
        assertNull(GoatOrientationController.currentLock)

        // A second mini-app starting up must not observe the first one's lock.
        assertNull(GoatOrientationController.currentLock)
    }

    @Test
    fun namesMapBackFromActivityInfoConstants() {
        assertEquals("portrait", GoatOrientationController.nameFor(ActivityInfo.SCREEN_ORIENTATION_PORTRAIT))
        assertEquals("landscape", GoatOrientationController.nameFor(ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE))
        assertEquals("auto", GoatOrientationController.nameFor(ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED))
        assertEquals("auto", GoatOrientationController.nameFor(ActivityInfo.SCREEN_ORIENTATION_SENSOR))
    }
}
