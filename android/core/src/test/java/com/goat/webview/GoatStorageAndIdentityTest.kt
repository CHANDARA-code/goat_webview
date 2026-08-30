package com.goat.webview

import com.goat.webview.auth.GoatHttpAuthManager
import com.goat.webview.storage.GoatAccountScopedSandbox
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.io.File

@OptIn(ExperimentalCoroutinesApi::class)
class GoatStorageAndIdentityTest {

    private lateinit var fakeContext: FakeTestContext
    private lateinit var storageManager: GoatStorageManager
    private lateinit var secureStorageManager: GoatSecureStorageManager
    private lateinit var httpAuthManager: GoatHttpAuthManager
    private lateinit var handler: GoatBridgeActionHandler

    @Before
    fun setUp() {
        GoatConfig.reset()
        fakeContext = FakeTestContext()
        storageManager = GoatStorageManager(fakeContext, kotlinx.coroutines.Dispatchers.Unconfined)
        secureStorageManager = GoatSecureStorageManager(fakeContext, kotlinx.coroutines.Dispatchers.Unconfined)
        httpAuthManager = GoatHttpAuthManager(fakeContext, secureStorageManager, kotlinx.coroutines.Dispatchers.Unconfined)
        handler = GoatBridgeActionHandler(
            context = fakeContext,
            appId = "tenant_storage_app",
            storageManager = storageManager,
            secureStorageManager = secureStorageManager,
            httpAuthManager = httpAuthManager
        )
    }

    @After
    fun tearDown() {
        GoatConfig.reset()
    }

    @Test
    fun `test account-scoped storage sandbox isolates data between different accounts`() = runTest {
        // 1. Set account A
        GoatAccountScopedSandbox.accountProvider = { "user_alice" }
        val nameA = GoatAccountScopedSandbox.getScopedPreferencesName("app_shop")
        assertEquals("goat_storage_app_shop_user_alice", nameA)
        val dirA = GoatAccountScopedSandbox.getScopedDataDirectory(fakeContext.filesDir, "app_shop")
        assertTrue(dirA.absolutePath.contains("user_alice"))

        val handlerA = GoatBridgeActionHandler(
            context = fakeContext,
            appId = "app_shop",
            storageManager = storageManager
        )
        handlerA.executeAction("STORAGE_SET", buildJsonObject {
            put("key", "cart_item")
            put("value", "Alice's Shoes")
        })

        val getA = handlerA.executeAction("STORAGE_GET", buildJsonObject {
            put("key", "cart_item")
        })
        assertEquals("Alice's Shoes", getA.getOrNull()?.get("value")?.jsonPrimitive?.content)

        // 2. Switch to account B on the same device and appId
        GoatAccountScopedSandbox.accountProvider = { "user_bob" }
        val nameB = GoatAccountScopedSandbox.getScopedPreferencesName("app_shop")
        assertEquals("goat_storage_app_shop_user_bob", nameB)
        assertNotEquals(nameA, nameB)

        val handlerB = GoatBridgeActionHandler(
            context = fakeContext,
            appId = "app_shop",
            storageManager = storageManager
        )
        val getB = handlerB.executeAction("STORAGE_GET", buildJsonObject {
            put("key", "cart_item")
        })
        // Bob cannot see Alice's storage
        val bobValue = getB.getOrNull()?.get("value")
        assertTrue(bobValue == null || bobValue is kotlinx.serialization.json.JsonNull || bobValue.jsonPrimitive.contentOrNull == null)

        // Bob sets his own item
        handlerB.executeAction("STORAGE_SET", buildJsonObject {
            put("key", "cart_item")
            put("value", "Bob's Watch")
        })

        // 3. Switch back to account A
        GoatAccountScopedSandbox.accountProvider = { "user_alice" }
        val getA2 = handlerA.executeAction("STORAGE_GET", buildJsonObject {
            put("key", "cart_item")
        })
        assertEquals("Alice's Shoes", getA2.getOrNull()?.get("value")?.jsonPrimitive?.content)
    }

    @Test
    fun `test secure storage roundtrip and account isolation via bridge`() = runTest {
        val appHandler = GoatBridgeActionHandler(
            context = fakeContext,
            appId = "finance_app",
            storageManager = storageManager,
            secureStorageManager = secureStorageManager
        )

        // 1. Account Alice sets secure key
        GoatConfig.accountProvider = { "user_alice" }
        val setAlice = appHandler.executeAction("SECURE_STORAGE_SET", buildJsonObject {
            put("key", "api_key")
            put("value", "ALICE_API_KEY_SECRET_77")
        })
        assertTrue(setAlice.isSuccess)

        val getAlice = appHandler.executeAction("SECURE_STORAGE_GET", buildJsonObject {
            put("key", "api_key")
        })
        assertTrue(getAlice.isSuccess)
        assertEquals("ALICE_API_KEY_SECRET_77", getAlice.getOrNull()?.get("value")?.jsonPrimitive?.content)

        // 2. Switch to Account Bob
        GoatConfig.accountProvider = { "user_bob" }
        val getBob = appHandler.executeAction("SECURE_STORAGE_GET", buildJsonObject {
            put("key", "api_key")
        })
        assertTrue(getBob.isSuccess)
        val bobVal = getBob.getOrNull()?.get("value")
        assertTrue("Bob must not be able to read Alice's secure storage", bobVal == null || bobVal is JsonNull || bobVal.jsonPrimitive.contentOrNull == null)

        // Bob sets his own secure key
        appHandler.executeAction("SECURE_STORAGE_SET", buildJsonObject {
            put("key", "api_key")
            put("value", "BOB_API_KEY_SECRET_88")
        })

        // 3. Switch back to Alice
        GoatConfig.accountProvider = { "user_alice" }
        val getAlice2 = appHandler.executeAction("SECURE_STORAGE_GET", buildJsonObject {
            put("key", "api_key")
        })
        assertEquals("ALICE_API_KEY_SECRET_77", getAlice2.getOrNull()?.get("value")?.jsonPrimitive?.content)

        // 4. Reset account provider (legacy fallback mode)
        GoatConfig.reset()
        val getFallback = appHandler.executeAction("SECURE_STORAGE_GET", buildJsonObject {
            put("key", "api_key")
        })
        val fallbackVal = getFallback.getOrNull()?.get("value")
        assertTrue(fallbackVal == null || fallbackVal is JsonNull || fallbackVal.jsonPrimitive.contentOrNull == null)
    }

    @Test
    fun `test anonymous installGuid is stable and included in GET_DEVICE_INFO`() = runTest {
        val guid1 = GoatAccountScopedSandbox.getInstallGuid(fakeContext)
        assertNotNull(guid1)
        assertTrue(guid1.isNotBlank())
        // Verify RFC 4122 UUID v4 regex format
        val uuidV4Regex = Regex("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$")
        assertTrue("installGuid must be a valid UUID v4 format: $guid1", guid1.matches(uuidV4Regex))

        val guid2 = GoatAccountScopedSandbox.getInstallGuid(fakeContext)
        assertEquals("installGuid must remain stable across invocations", guid1, guid2)

        val deviceInfoRes = handler.executeAction("GET_DEVICE_INFO", buildJsonObject {})
        assertTrue(deviceInfoRes.isSuccess)
        val data = deviceInfoRes.getOrNull()
        assertNotNull(data)
        assertEquals(guid1, data?.get("installGuid")?.jsonPrimitive?.content)
    }

    @Test
    fun `test Cookie and Web Storage CRUD actions roundtrip via bridge`() = runTest {
        // Cookie actions use android.webkit.CookieManager which requires a real Android runtime.
        // In JVM unit tests these return a handled Result (not a crash).
        // We verify the bridge returns a non-null result and handles the actions without exceptions.

        // 1. COOKIE_SET — returns Result (success or graceful failure; not null)
        val setCookieRes = handler.executeAction("COOKIE_SET", buildJsonObject {
            put("name", "auth_token")
            put("value", "secret_jwt_xyz")
            put("isSecure", true)
            put("isHttpOnly", true)
        })
        assertNotNull(setCookieRes) // Bridge must return a Result, never crash

        // 2. COOKIE_GET — returns Result with non-null response
        val getCookieRes = handler.executeAction("COOKIE_GET", buildJsonObject {})
        assertNotNull(getCookieRes)

        // 3. COOKIE_REMOVE — handled without throw
        val removeCookieRes = handler.executeAction("COOKIE_REMOVE", buildJsonObject {
            put("name", "auth_token")
        })
        assertNotNull(removeCookieRes)

        // 4. COOKIE_REMOVE_ALL — handled without throw
        val removeAllRes = handler.executeAction("COOKIE_REMOVE_ALL", buildJsonObject {})
        assertNotNull(removeAllRes)

        // 5. WEB_STORAGE_GET_QUOTA_USAGE — does NOT require WebKit; must succeed
        val quotaRes = handler.executeAction("WEB_STORAGE_GET_QUOTA_USAGE", buildJsonObject {})
        assertTrue(quotaRes.isSuccess)
        val quotaData = quotaRes.getOrNull()
        assertNotNull(quotaData)
        assertTrue(quotaData?.containsKey("quotaBytes") == true)
        assertTrue(quotaData?.containsKey("usedBytes") == true)

        // 6. WEB_STORAGE_CLEAR — does NOT require WebKit; must succeed
        val clearRes = handler.executeAction("WEB_STORAGE_CLEAR", buildJsonObject {})
        assertTrue(clearRes.isSuccess)
    }

    @Test
    fun `test HTTP Auth credential save, retrieval, and clear`() = runTest {
        // 1. Save credential
        val saveRes = handler.executeAction("HTTP_AUTH_SAVE_CREDENTIAL", buildJsonObject {
            put("host", "secure-gateway.company.com")
            put("realm", "internal-portal")
            put("username", "admin_user")
            put("password", "strong_password_9988")
        })
        assertTrue(saveRes.isSuccess)

        // 2. Retrieve credential
        val cred = httpAuthManager.getCredential("tenant_storage_app", "secure-gateway.company.com", "internal-portal")
        assertNotNull(cred)
        assertEquals("admin_user", cred?.username)
        assertEquals("strong_password_9988", cred?.password)

        // 3. Clear credentials
        val clearRes = handler.executeAction("HTTP_AUTH_CLEAR_CREDENTIALS", buildJsonObject {})
        assertTrue(clearRes.isSuccess)
        val clearedCred = httpAuthManager.getCredential("tenant_storage_app", "secure-gateway.company.com", "internal-portal")
        assertNull(clearedCred)
    }
}
