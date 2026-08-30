package com.goat.webview

import android.content.Context
import android.content.ContextWrapper
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class GoatPermissionManagerTest {

    private lateinit var fakeContext: FakeTestContext
    private lateinit var permissionManager: GoatPermissionManager

    private class FakeTestContext : ContextWrapper(null) {
        override fun getApplicationContext(): Context = this
    }

    @Before
    fun setUp() {
        fakeContext = FakeTestContext()
        permissionManager = GoatPermissionManager(fakeContext)
    }

    @Test
    fun testRequestPermissionFlow() = runTest {
        val appId = "mini_app_shop_01"
        assertFalse(permissionManager.isPermissionGranted(appId, GoatPermissionManager.SCOPE_CAMERA))

        val result = permissionManager.requestPermission(appId, GoatPermissionManager.SCOPE_CAMERA)
        assertTrue(result.granted)
        assertTrue(result.isDeclaredInManifest)
        assertTrue(permissionManager.isPermissionGranted(appId, GoatPermissionManager.SCOPE_CAMERA))

        // Check settings query
        val settings = permissionManager.getSettings(appId)
        val cameraSetting = settings.find { it.scope == GoatPermissionManager.SCOPE_CAMERA }
        assertTrue(cameraSetting?.granted == true)

        // Revoke
        permissionManager.setPermission(appId, GoatPermissionManager.SCOPE_CAMERA, false)
        assertFalse(permissionManager.isPermissionGranted(appId, GoatPermissionManager.SCOPE_CAMERA))
    }

    @Test
    fun testUndeclaredManifestScopeBlocked() = runTest {
        val appId = "mini_app_strict_02"
        // Manifest only declares userLocation
        permissionManager.registerManifestScopes(appId, setOf(GoatPermissionManager.SCOPE_USER_LOCATION))

        // Requesting camera should be blocked because it's not declared in manifest
        val result = permissionManager.requestPermission(appId, GoatPermissionManager.SCOPE_CAMERA)
        assertFalse(result.granted)
        assertFalse(result.isDeclaredInManifest)
        assertFalse(permissionManager.isPermissionGranted(appId, GoatPermissionManager.SCOPE_CAMERA))

        // Requesting userLocation should succeed
        val locResult = permissionManager.requestPermission(appId, GoatPermissionManager.SCOPE_USER_LOCATION)
        assertTrue(locResult.granted)
        assertTrue(locResult.isDeclaredInManifest)
    }
}
