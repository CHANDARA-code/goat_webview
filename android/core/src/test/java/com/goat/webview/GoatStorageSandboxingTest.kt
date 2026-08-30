package com.goat.webview

import android.content.Context
import android.content.ContextWrapper
import android.content.SharedPreferences
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File
import java.util.concurrent.ConcurrentHashMap

/**
 * Automated test suite validating multi-tenant storage sandboxing & filesystem isolation (MASVS-STORAGE-02).
 */
@OptIn(ExperimentalCoroutinesApi::class)
class GoatStorageSandboxingTest {

    @get:Rule
    val tempFolder = TemporaryFolder()

    private lateinit var fakeContext: FakeTestContext
    private lateinit var storageManager: GoatStorageManager
    private lateinit var rootFilesDir: File

    private class FakeSharedPreferences : SharedPreferences {
        val data = ConcurrentHashMap<String, Any>()

        override fun getAll(): MutableMap<String, *> = HashMap(data)
        override fun getString(key: String?, defValue: String?): String? = (data[key] as? String) ?: defValue
        override fun getStringSet(key: String?, defValues: MutableSet<String>?): MutableSet<String>? = null
        override fun getInt(key: String?, defValue: Int): Int = (data[key] as? Int) ?: defValue
        override fun getLong(key: String?, defValue: Long): Long = (data[key] as? Long) ?: defValue
        override fun getFloat(key: String?, defValue: Float): Float = (data[key] as? Float) ?: defValue
        override fun getBoolean(key: String?, defValue: Boolean): Boolean = (data[key] as? Boolean) ?: defValue
        override fun contains(key: String?): Boolean = data.containsKey(key)
        override fun edit(): SharedPreferences.Editor = FakeEditor(this)
        override fun registerOnSharedPreferenceChangeListener(listener: SharedPreferences.OnSharedPreferenceChangeListener?) {}
        override fun unregisterOnSharedPreferenceChangeListener(listener: SharedPreferences.OnSharedPreferenceChangeListener?) {}

        class FakeEditor(private val prefs: FakeSharedPreferences) : SharedPreferences.Editor {
            private val temp = HashMap<String, Any?>()
            private var clearAll = false

            override fun putString(key: String?, value: String?): SharedPreferences.Editor {
                if (key != null) {
                    if (value != null) temp[key] = value else temp[key] = null
                }
                return this
            }

            override fun putStringSet(key: String?, values: MutableSet<String>?): SharedPreferences.Editor = this
            override fun putInt(key: String?, value: Int): SharedPreferences.Editor {
                if (key != null) temp[key] = value
                return this
            }

            override fun putLong(key: String?, value: Long): SharedPreferences.Editor {
                if (key != null) temp[key] = value
                return this
            }

            override fun putFloat(key: String?, value: Float): SharedPreferences.Editor {
                if (key != null) temp[key] = value
                return this
            }

            override fun putBoolean(key: String?, value: Boolean): SharedPreferences.Editor {
                if (key != null) temp[key] = value
                return this
            }

            override fun remove(key: String?): SharedPreferences.Editor {
                if (key != null) temp[key] = null
                return this
            }

            override fun clear(): SharedPreferences.Editor {
                clearAll = true
                return this
            }

            override fun commit(): Boolean {
                apply()
                return true
            }

            override fun apply() {
                if (clearAll) {
                    prefs.data.clear()
                }
                for ((k, v) in temp) {
                    if (v == null) {
                        prefs.data.remove(k)
                    } else {
                        prefs.data[k] = v
                    }
                }
            }
        }
    }

    private class FakeTestContext(private val baseFilesDir: File) : ContextWrapper(null) {
        private val prefsMap = ConcurrentHashMap<String, FakeSharedPreferences>()

        override fun getFilesDir(): File = baseFilesDir

        override fun getSharedPreferences(name: String?, mode: Int): SharedPreferences {
            val safeName = name ?: "default"
            return prefsMap.computeIfAbsent(safeName) { FakeSharedPreferences() }
        }

        override fun getApplicationContext(): Context = this
    }

    @Before
    fun setUp() {
        rootFilesDir = tempFolder.newFolder("filesDir")
        fakeContext = FakeTestContext(rootFilesDir)
        storageManager = GoatStorageManager(fakeContext, kotlinx.coroutines.Dispatchers.Unconfined)
    }

    @Test
    fun `test cross-tenant key-value data isolation`() = runTest {
        val tenantAlpha = "app_alpha"
        val tenantBeta = "app_beta"

        // Alpha sets its own token
        storageManager.setValue(tenantAlpha, "auth_token", "jwt_token_alpha_123")
        // Beta sets its own token with identical key name
        storageManager.setValue(tenantBeta, "auth_token", "jwt_token_beta_999")

        // Assert that tenant Alpha retrieves only Alpha's token
        val alphaToken = storageManager.getValue(tenantAlpha, "auth_token")
        assertEquals("jwt_token_alpha_123", alphaToken)

        // Assert that tenant Beta retrieves only Beta's token
        val betaToken = storageManager.getValue(tenantBeta, "auth_token")
        assertEquals("jwt_token_beta_999", betaToken)

        // Non-existent tenant Gamma reading the same key gets null
        val gammaToken = storageManager.getValue("app_gamma", "auth_token")
        assertNull(gammaToken)
    }

    @Test
    fun `test tenant key deletion does not mutate sibling tenants`() = runTest {
        val tenantAlpha = "app_alpha"
        val tenantBeta = "app_beta"

        storageManager.setValue(tenantAlpha, "api_key", "secret_alpha")
        storageManager.setValue(tenantBeta, "api_key", "secret_beta")

        // Remove from Alpha
        val removedAlpha = storageManager.removeValue(tenantAlpha, "api_key")
        assertTrue(removedAlpha)

        // Alpha is now null
        assertNull(storageManager.getValue(tenantAlpha, "api_key"))

        // Beta's key remains completely intact
        assertEquals("secret_beta", storageManager.getValue(tenantBeta, "api_key"))
    }

    @Test
    fun `test filesystem sandbox directory isolation`() {
        val dirAlpha = GoatStorageManager.getTenantDataDirectory(rootFilesDir, "app_alpha")
        val dirBeta = GoatStorageManager.getTenantDataDirectory(rootFilesDir, "app_beta")

        assertFalse("Tenant data directories must not be identical", dirAlpha.canonicalPath == dirBeta.canonicalPath)
        assertTrue("Alpha path must contain app_alpha", dirAlpha.canonicalPath.contains("app_alpha"))
        assertTrue("Beta path must contain app_beta", dirBeta.canonicalPath.contains("app_beta"))

        // Write file in Alpha's directory
        dirAlpha.mkdirs()
        val alphaFile = File(dirAlpha, "cached_state.json")
        alphaFile.writeText("{\"user\": \"alpha\"}")

        assertTrue(alphaFile.exists())

        // Ensure Beta directory does not see Alpha's file
        val betaFile = File(dirBeta, "cached_state.json")
        assertFalse("Beta must not have access to Alpha's file", betaFile.exists())
    }

    @Test
    fun `test path traversal protection in appId sanitization`() {
        // Assert valid appIds pass
        assertEquals("tenant_one", GoatStorageManager.sanitizeIdentifier("tenant_one"))
        assertEquals("com.example.app_123", GoatStorageManager.sanitizeIdentifier("com.example.app_123"))

        // Assert directory traversal attacks throw SecurityException
        try {
            GoatStorageManager.sanitizeIdentifier("../../malicious")
            fail("Expected SecurityException for directory traversal attempt")
        } catch (e: SecurityException) {
            assertTrue(e.message?.contains("Path traversal") == true)
        }

        try {
            GoatStorageManager.sanitizeIdentifier("app/subpath")
            fail("Expected SecurityException for slash character in appId")
        } catch (e: SecurityException) {
            assertTrue(e.message?.contains("Path traversal") == true)
        }

        try {
            GoatStorageManager.sanitizeIdentifier("app\\subpath")
            fail("Expected SecurityException for backslash character in appId")
        } catch (e: SecurityException) {
            assertTrue(e.message?.contains("Path traversal") == true)
        }
    }

    @Test
    fun `test tenant purge removes all data and leaves sibling tenants untouched`() = runTest {
        val tenantAlpha = "app_alpha"
        val tenantBeta = "app_beta"

        storageManager.setValue(tenantAlpha, "key1", "val1")
        storageManager.setValue(tenantAlpha, "key2", "val2")
        storageManager.setValue(tenantBeta, "key1", "val_beta")

        val dirAlpha = storageManager.ensureTenantDataDirectory(tenantAlpha)
        val fileAlpha = File(dirAlpha, "document.txt").apply { writeText("sensitive data") }
        assertTrue(fileAlpha.exists())

        val dirBeta = storageManager.ensureTenantDataDirectory(tenantBeta)
        val fileBeta = File(dirBeta, "document.txt").apply { writeText("beta data") }
        assertTrue(fileBeta.exists())

        // Purge Alpha
        val purged = storageManager.purgeTenantData(tenantAlpha)
        assertTrue(purged)

        // Alpha preferences and directory are wiped
        assertNull(storageManager.getValue(tenantAlpha, "key1"))
        assertNull(storageManager.getValue(tenantAlpha, "key2"))
        assertFalse(fileAlpha.exists())
        assertFalse(dirAlpha.exists())

        // Beta is untouched
        assertEquals("val_beta", storageManager.getValue(tenantBeta, "key1"))
        assertTrue(fileBeta.exists())
        assertEquals("beta data", fileBeta.readText())
    }

    @Test
    fun `test bridge action handler executes tenant-scoped storage operations`() = runTest {
        val actionHandler = GoatBridgeActionHandler(
            context = fakeContext,
            appId = "tenant_ecommerce",
            storageManager = storageManager
        )

        // 1. STORAGE_SET
        val setPayload = buildJsonObject {
            put("key", "cart_id")
            put("value", "cart_998811")
        }
        val setResult = actionHandler.executeAction("STORAGE_SET", setPayload)
        assertTrue(setResult.isSuccess)
        val setData = setResult.getOrNull()
        assertNotNull(setData)
        assertEquals("true", setData?.get("saved")?.jsonPrimitive?.content)
        assertEquals("cart_id", setData?.get("key")?.jsonPrimitive?.content)
        assertEquals("tenant_ecommerce", setData?.get("appId")?.jsonPrimitive?.content)

        // 2. STORAGE_GET
        val getPayload = buildJsonObject {
            put("key", "cart_id")
        }
        val getResult = actionHandler.executeAction("STORAGE_GET", getPayload)
        assertTrue(getResult.isSuccess)
        val getData = getResult.getOrNull()
        assertEquals("cart_998811", getData?.get("value")?.jsonPrimitive?.content)
        assertEquals("tenant_ecommerce", getData?.get("appId")?.jsonPrimitive?.content)

        // 3. STORAGE_REMOVE
        val removePayload = buildJsonObject {
            put("key", "cart_id")
        }
        val removeResult = actionHandler.executeAction("STORAGE_REMOVE", removePayload)
        assertTrue(removeResult.isSuccess)
        assertEquals("true", removeResult.getOrNull()?.get("removed")?.jsonPrimitive?.content)

        // Assert removed
        val getAfterRemove = actionHandler.executeAction("STORAGE_GET", getPayload)
        val valueAfterRemove = getAfterRemove.getOrNull()?.get("value")?.jsonPrimitive?.content
        assertTrue(valueAfterRemove == null || valueAfterRemove == "null")
    }

    @Test
    fun `test sandboxed filesystem resolveTenantPath enforces strict containment`() {
        val tenant = "app_secure"
        val validFile = storageManager.resolveTenantPath(tenant, "cache/user_session.json")
        assertTrue(validFile.canonicalPath.contains("app_secure"))
        assertTrue(validFile.canonicalPath.contains("data"))

        // Path traversal attempts must throw SecurityException
        try {
            storageManager.resolveTenantPath(tenant, "../../malicious.txt")
            fail("Expected SecurityException for directory traversal attempt")
        } catch (e: SecurityException) {
            assertTrue(e.message?.contains("Path traversal") == true)
        }

        try {
            storageManager.resolveTenantPath(tenant, "../other_tenant/secret.txt")
            fail("Expected SecurityException for sibling directory traversal attempt")
        } catch (e: SecurityException) {
            assertTrue(e.message?.contains("Path traversal") == true)
        }
    }

    @Test
    fun `test sandboxed filesystem CRUD lifecycle and stats`() = runTest {
        val tenant = "app_fs_test"

        // 1. Write file
        val textData = "Hello Sandboxed FileSystem!"
        val writeSuccess = storageManager.writeFile(tenant, "docs/readme.txt", textData.toByteArray())
        assertTrue(writeSuccess)

        // 2. File exists
        assertTrue(storageManager.fileExists(tenant, "docs/readme.txt"))
        assertFalse(storageManager.fileExists(tenant, "docs/missing.txt"))

        // 3. Read file
        val readBytes = storageManager.readFile(tenant, "docs/readme.txt")
        assertEquals(textData, String(readBytes))

        // 4. File stat
        val stat = storageManager.getFileStat(tenant, "docs/readme.txt")
        assertEquals(textData.length.toLong(), stat["size"])
        assertEquals(true, stat["isFile"])
        assertEquals(false, stat["isDirectory"])
        assertEquals("readme.txt", stat["name"])

        // 5. Copy file
        val copySuccess = storageManager.copyFile(tenant, "docs/readme.txt", "backup/readme_copy.txt")
        assertTrue(copySuccess)
        assertTrue(storageManager.fileExists(tenant, "backup/readme_copy.txt"))
        assertEquals(textData, String(storageManager.readFile(tenant, "backup/readme_copy.txt")))

        // 6. List directory
        val dirContents = storageManager.listDirectory(tenant, "docs")
        assertTrue(dirContents.contains("readme.txt"))

        // 7. Delete file (FS_UNLINK)
        val deleteSuccess = storageManager.deleteFile(tenant, "docs/readme.txt")
        assertTrue(deleteSuccess)
        assertFalse(storageManager.fileExists(tenant, "docs/readme.txt"))

        // 8. Remove directory (FS_RMDIR)
        val rmdirSuccess = storageManager.removeDirectory(tenant, "backup", recursive = true)
        assertTrue(rmdirSuccess)
        assertFalse(storageManager.fileExists(tenant, "backup"))
    }

    @Test
    fun `test bridge action handler executes FS operations with utf8 and base64`() = runTest {
        val actionHandler = GoatBridgeActionHandler(
            context = fakeContext,
            appId = "tenant_fs_bridge",
            storageManager = storageManager
        )

        // 1. FS_WRITE_FILE (utf8)
        val writePayload = buildJsonObject {
            put("filePath", "logs/session.log")
            put("data", "Session log entry 1")
            put("encoding", "utf8")
        }
        val writeResult = actionHandler.executeAction("FS_WRITE_FILE", writePayload)
        assertTrue(writeResult.isSuccess)
        val writeData = writeResult.getOrNull()
        assertEquals("true", writeData?.get("saved")?.jsonPrimitive?.content)

        // 2. FS_READ_FILE (utf8)
        val readPayload = buildJsonObject {
            put("filePath", "logs/session.log")
            put("encoding", "utf8")
        }
        val readResult = actionHandler.executeAction("FS_READ_FILE", readPayload)
        assertTrue(readResult.isSuccess)
        assertEquals("Session log entry 1", readResult.getOrNull()?.get("data")?.jsonPrimitive?.content)

        // 3. FS_STAT
        val statPayload = buildJsonObject {
            put("filePath", "logs/session.log")
        }
        val statResult = actionHandler.executeAction("FS_STAT", statPayload)
        assertTrue(statResult.isSuccess)
        assertEquals("session.log", statResult.getOrNull()?.get("name")?.jsonPrimitive?.content)
        assertEquals("true", statResult.getOrNull()?.get("isFile")?.jsonPrimitive?.content)

        // 4. FS_WRITE_FILE (base64) & FS_READ_FILE (base64)
        val binaryString = "Binary Data 12345"
        val base64Encoded = GoatSecurityManager.encodeBase64(binaryString.toByteArray())
        val writeB64Payload = buildJsonObject {
            put("filePath", "images/pixel.bin")
            put("data", base64Encoded)
            put("encoding", "base64")
        }
        val writeB64Result = actionHandler.executeAction("FS_WRITE_FILE", writeB64Payload)
        assertTrue(writeB64Result.isSuccess)

        val readB64Payload = buildJsonObject {
            put("filePath", "images/pixel.bin")
            put("encoding", "base64")
        }
        val readB64Result = actionHandler.executeAction("FS_READ_FILE", readB64Payload)
        assertTrue(readB64Result.isSuccess)
        val readB64Data = readB64Result.getOrNull()?.get("data")?.jsonPrimitive?.content ?: ""
        val decodedBytes = GoatSecurityManager.decodeBase64Signature(readB64Data)
        assertEquals(binaryString, String(decodedBytes))

        // 5. FS_EXISTS
        val existsPayload = buildJsonObject { put("filePath", "images/pixel.bin") }
        val existsResult = actionHandler.executeAction("FS_EXISTS", existsPayload)
        assertTrue(existsResult.isSuccess)
        assertEquals("true", existsResult.getOrNull()?.get("exists")?.jsonPrimitive?.content)

        // 6. FS_UNLINK
        val unlinkPayload = buildJsonObject { put("filePath", "images/pixel.bin") }
        val unlinkResult = actionHandler.executeAction("FS_UNLINK", unlinkPayload)
        assertTrue(unlinkResult.isSuccess)
        assertEquals("true", unlinkResult.getOrNull()?.get("deleted")?.jsonPrimitive?.content)

        // Assert no longer exists
        val existsAfterUnlink = actionHandler.executeAction("FS_EXISTS", existsPayload)
        assertEquals("false", existsAfterUnlink.getOrNull()?.get("exists")?.jsonPrimitive?.content)
    }

    @Test
    fun `test bridge action handler rejects path traversal in FS_WRITE_FILE and FS_READ_FILE`() = runTest {
        val actionHandler = GoatBridgeActionHandler(
            context = fakeContext,
            appId = "tenant_victim",
            storageManager = storageManager
        )

        // Malicious write attempt
        val maliciousWritePayload = buildJsonObject {
            put("filePath", "../../escape.txt")
            put("data", "malicious payload")
        }
        val writeResult = actionHandler.executeAction("FS_WRITE_FILE", maliciousWritePayload)
        assertFalse("Path traversal write should fail", writeResult.isSuccess)
        assertTrue(writeResult.exceptionOrNull() is SecurityException)

        // Malicious read attempt
        val maliciousReadPayload = buildJsonObject {
            put("filePath", "../../../etc/shadow")
        }
        val readResult = actionHandler.executeAction("FS_READ_FILE", maliciousReadPayload)
        assertFalse("Path traversal read should fail", readResult.isSuccess)
        assertTrue(readResult.exceptionOrNull() is SecurityException)
    }

    @Test
    fun `test cross-tenant filesystem isolation between Alpha and Beta`() = runTest {
        val tenantAlpha = "app_alpha"
        val tenantBeta = "app_beta"

        // Alpha writes its secret document
        storageManager.writeFile(tenantAlpha, "secret.txt", "Alpha Secret Key".toByteArray())

        // Beta writes its document with the same relative name
        storageManager.writeFile(tenantBeta, "secret.txt", "Beta Secret Key".toByteArray())

        // Assert Alpha reads Alpha's content
        val alphaRead = String(storageManager.readFile(tenantAlpha, "secret.txt"))
        assertEquals("Alpha Secret Key", alphaRead)

        // Assert Beta reads Beta's content
        val betaRead = String(storageManager.readFile(tenantBeta, "secret.txt"))
        assertEquals("Beta Secret Key", betaRead)

        // Non-existent tenant Gamma reading returns FileNotFoundException
        try {
            storageManager.readFile("app_gamma", "secret.txt")
            fail("Expected FileNotFoundException for non-existent tenant file")
        } catch (e: java.io.FileNotFoundException) {
            assertTrue(e.message?.contains("File not found") == true)
        }
    }
}
