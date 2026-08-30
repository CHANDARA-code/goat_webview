package com.goat.webview

import android.content.Context
import android.content.ContextWrapper
import android.content.SharedPreferences
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.io.File
import java.security.KeyPair
import java.security.KeyPairGenerator
import java.util.concurrent.ConcurrentHashMap
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream

/**
 * Automated test suite for GoatSecurityManager and digital signature verification:
 * - OWASP MASVS-CRYPTO (MSTG-CRYPTO-01) Digital Signature Verification
 * - ECDSA (SHA256withECDSA) and RSA-2048 (SHA256withRSA) validation
 * - Tampered archive and corrupted signature rejection
 * - Key export/import and Base64 encoding helpers
 * - End-to-end atomic extraction integration with GoatAssetManager
 */
class GoatSecurityManagerTest {

    @get:Rule
    val tempFolder = TemporaryFolder()

    private lateinit var rootFilesDir: File
    private lateinit var fakeContext: FakeTestContext
    private lateinit var assetManager: GoatAssetManager

    private lateinit var ecKeyPair: KeyPair
    private lateinit var ecOtherKeyPair: KeyPair
    private lateinit var rsaKeyPair: KeyPair

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
        assetManager = GoatAssetManager(fakeContext)

        // Generate ECDSA P-256 KeyPairs
        val ecGenerator = KeyPairGenerator.getInstance(GoatSecurityManager.KEY_ALGORITHM_EC)
        ecGenerator.initialize(256)
        ecKeyPair = ecGenerator.generateKeyPair()
        ecOtherKeyPair = ecGenerator.generateKeyPair()

        // Generate RSA-2048 KeyPair
        val rsaGenerator = KeyPairGenerator.getInstance(GoatSecurityManager.KEY_ALGORITHM_RSA)
        rsaGenerator.initialize(2048)
        rsaKeyPair = rsaGenerator.generateKeyPair()
    }

    @Test
    fun `test ECDSA sign and verify bytes successfully`() {
        val payload = "Goat MiniApp Bundle Payload Content".toByteArray()
        val signature = GoatSecurityManager.signBytes(payload, ecKeyPair.private, GoatSecurityManager.ALGORITHM_ECDSA)

        val isValid = GoatSecurityManager.verifyBytesSignature(payload, signature, ecKeyPair.public, GoatSecurityManager.ALGORITHM_ECDSA)
        assertTrue("Valid ECDSA signature should verify successfully", isValid)
    }

    @Test
    fun `test RSA-2048 sign and verify bytes successfully`() {
        val payload = "Enterprise RSA Security Payload".toByteArray()
        val signature = GoatSecurityManager.signBytes(payload, rsaKeyPair.private, GoatSecurityManager.ALGORITHM_RSA)

        val isValid = GoatSecurityManager.verifyBytesSignature(payload, signature, rsaKeyPair.public, GoatSecurityManager.ALGORITHM_RSA)
        assertTrue("Valid RSA signature should verify successfully", isValid)
    }

    @Test
    fun `test ECDSA sign and verify stream and file`() {
        val bundleFile = tempFolder.newFile("test_bundle.zip")
        val content = createZipArchive("index.html" to "<h1>Goat Stream Test</h1>")
        bundleFile.writeBytes(content)

        val signature = GoatSecurityManager.signBundle(bundleFile, ecKeyPair.private, GoatSecurityManager.ALGORITHM_ECDSA)

        // Verify via stream
        val isStreamValid = ByteArrayInputStream(content).use { stream ->
            GoatSecurityManager.verifyStreamSignature(stream, signature, ecKeyPair.public, GoatSecurityManager.ALGORITHM_ECDSA)
        }
        assertTrue("Stream signature verification should succeed", isStreamValid)

        // Verify via file
        val isFileValid = GoatSecurityManager.verifyBundleSignature(bundleFile, signature, ecKeyPair.public, GoatSecurityManager.ALGORITHM_ECDSA)
        assertTrue("Bundle file signature verification should succeed", isFileValid)
    }

    @Test
    fun `test tampered payload is rejected by signature verification`() {
        val originalPayload = "Authentic Application Bundle".toByteArray()
        val tamperedPayload = "Tampered Application Bundle".toByteArray()

        val signature = GoatSecurityManager.signBytes(originalPayload, ecKeyPair.private, GoatSecurityManager.ALGORITHM_ECDSA)

        val isValid = GoatSecurityManager.verifyBytesSignature(tamperedPayload, signature, ecKeyPair.public, GoatSecurityManager.ALGORITHM_ECDSA)
        assertFalse("Tampered payload must fail signature verification", isValid)
    }

    @Test
    fun `test corrupted signature bytes return false`() {
        val payload = "Protected MiniApp Bytes".toByteArray()
        val corruptedSignature = ByteArray(64) { 0x00 }

        val isValid = GoatSecurityManager.verifyBytesSignature(payload, corruptedSignature, ecKeyPair.public, GoatSecurityManager.ALGORITHM_ECDSA)
        assertFalse("Corrupted signature bytes must fail verification", isValid)
    }

    @Test
    fun `test mismatched public key returns false`() {
        val payload = "Protected MiniApp Bytes".toByteArray()
        val signature = GoatSecurityManager.signBytes(payload, ecKeyPair.private, GoatSecurityManager.ALGORITHM_ECDSA)

        // Verify using a different EC public key
        val isValid = GoatSecurityManager.verifyBytesSignature(payload, signature, ecOtherKeyPair.public, GoatSecurityManager.ALGORITHM_ECDSA)
        assertFalse("Verification with mismatched public key must fail", isValid)
    }

    @Test
    fun `test key decoding round trip for EC and RSA`() {
        // EC Key decoding
        val ecPublicEncoded = ecKeyPair.public.encoded
        val decodedEcPublic = GoatSecurityManager.decodePublicKey(ecPublicEncoded, GoatSecurityManager.KEY_ALGORITHM_EC)
        assertEquals(ecKeyPair.public.algorithm, decodedEcPublic.algorithm)
        assertEquals(ecKeyPair.public.format, decodedEcPublic.format)

        val ecPrivateEncoded = ecKeyPair.private.encoded
        val decodedEcPrivate = GoatSecurityManager.decodePrivateKey(ecPrivateEncoded, GoatSecurityManager.KEY_ALGORITHM_EC)
        assertEquals(ecKeyPair.private.algorithm, decodedEcPrivate.algorithm)

        // RSA Key decoding
        val rsaPublicEncoded = rsaKeyPair.public.encoded
        val decodedRsaPublic = GoatSecurityManager.decodePublicKey(rsaPublicEncoded, GoatSecurityManager.KEY_ALGORITHM_RSA)
        assertEquals(rsaKeyPair.public.algorithm, decodedRsaPublic.algorithm)

        val rsaPrivateEncoded = rsaKeyPair.private.encoded
        val decodedRsaPrivate = GoatSecurityManager.decodePrivateKey(rsaPrivateEncoded, GoatSecurityManager.KEY_ALGORITHM_RSA)
        assertEquals(rsaKeyPair.private.algorithm, decodedRsaPrivate.algorithm)
    }

    @Test
    fun `test Base64 signature encoding and decoding`() {
        val payload = "Base64 Signature Test Content".toByteArray()
        val signatureBytes = GoatSecurityManager.signBytes(payload, ecKeyPair.private, GoatSecurityManager.ALGORITHM_ECDSA)

        val base64String = GoatSecurityManager.encodeBase64(signatureBytes)
        val decodedBytes = GoatSecurityManager.decodeBase64Signature(base64String)

        assertTrue(signatureBytes.contentEquals(decodedBytes))

        val isValid = GoatSecurityManager.verifyBytesSignature(payload, decodedBytes, ecKeyPair.public, GoatSecurityManager.ALGORITHM_ECDSA)
        assertTrue(isValid)
    }

    @Test
    fun `test GoatAssetManager extractSignedBundleStreamAtomically succeeds for valid ECDSA signed bundle`() {
        val appId = "tenant_crypto_valid"
        val targetDir = GoatAssetManager.getTargetDirectory(rootFilesDir, appId)
        val stagingDir = GoatAssetManager.getStagingDirectory(rootFilesDir, appId)

        val zipBytes = createZipArchive(
            "index.html" to "<!DOCTYPE html><html><body><h1>Signed App</h1></body></html>",
            "app.js" to "console.log('cryptographically verified');"
        )
        val signature = GoatSecurityManager.signBytes(zipBytes, ecKeyPair.private, GoatSecurityManager.ALGORITHM_ECDSA)

        assetManager.extractSignedBundleStreamAtomically(
            inputStream = ByteArrayInputStream(zipBytes),
            signatureBytes = signature,
            publicKey = ecKeyPair.public,
            targetDir = targetDir,
            appId = appId,
            algorithm = GoatSecurityManager.ALGORITHM_ECDSA
        )

        assertTrue("Target directory should exist after valid extraction", targetDir.exists())
        assertFalse("Staging directory should be cleaned up", stagingDir.exists())
        assertTrue("Extracted index.html must exist", File(targetDir, "index.html").exists())
        assertEquals("console.log('cryptographically verified');", File(targetDir, "app.js").readText())
    }

    @Test
    fun `test GoatAssetManager extractSignedBundleStreamAtomically succeeds for valid RSA signed bundle`() {
        val appId = "tenant_rsa_valid"
        val targetDir = GoatAssetManager.getTargetDirectory(rootFilesDir, appId)

        val zipBytes = createZipArchive(
            "index.html" to "<h1>RSA Signed App</h1>"
        )
        val signature = GoatSecurityManager.signBytes(zipBytes, rsaKeyPair.private, GoatSecurityManager.ALGORITHM_RSA)

        assetManager.extractSignedBundleStreamAtomically(
            inputStream = ByteArrayInputStream(zipBytes),
            signatureBytes = signature,
            publicKey = rsaKeyPair.public,
            targetDir = targetDir,
            appId = appId,
            algorithm = GoatSecurityManager.ALGORITHM_RSA
        )

        assertTrue("Target directory should exist after RSA extraction", targetDir.exists())
        assertTrue(File(targetDir, "index.html").exists())
    }

    @Test
    fun `test GoatAssetManager extractSignedBundleStreamAtomically aborts and throws SecurityException on tampered bundle`() {
        val appId = "tenant_crypto_tampered"
        val targetDir = GoatAssetManager.getTargetDirectory(rootFilesDir, appId)
        val stagingDir = GoatAssetManager.getStagingDirectory(rootFilesDir, appId)

        val originalZipBytes = createZipArchive(
            "index.html" to "<h1>Original Content</h1>"
        )
        val signature = GoatSecurityManager.signBytes(originalZipBytes, ecKeyPair.private, GoatSecurityManager.ALGORITHM_ECDSA)

        val tamperedZipBytes = createZipArchive(
            "index.html" to "<h1>Malicious Injected Content</h1>"
        )

        try {
            assetManager.extractSignedBundleStreamAtomically(
                inputStream = ByteArrayInputStream(tamperedZipBytes),
                signatureBytes = signature,
                publicKey = ecKeyPair.public,
                targetDir = targetDir,
                appId = appId,
                algorithm = GoatSecurityManager.ALGORITHM_ECDSA
            )
            fail("Expected SecurityException for tampered bundle signature failure")
        } catch (e: SecurityException) {
            assertTrue(e.message?.contains("Digital signature verification failed") == true)
        }

        assertFalse("Target directory must not be created on signature failure", targetDir.exists())
        assertFalse("Staging directory must be cleaned up on signature failure", stagingDir.exists())
    }

    @Test
    fun `test non-existent bundle file signature verification returns false`() {
        val nonExistentFile = File(rootFilesDir, "does_not_exist.zip")
        val isValid = GoatSecurityManager.verifyBundleSignature(
            bundleFile = nonExistentFile,
            signatureBytes = ByteArray(64),
            publicKey = ecKeyPair.public
        )
        assertFalse("Non-existent bundle file must return false", isValid)
    }

    private fun createZipArchive(vararg entries: Pair<String, String>): ByteArray {
        val byteOut = ByteArrayOutputStream()
        ZipOutputStream(byteOut).use { zipOut ->
            for ((name, content) in entries) {
                val entry = ZipEntry(name)
                zipOut.putNextEntry(entry)
                zipOut.write(content.toByteArray())
                zipOut.closeEntry()
            }
        }
        return byteOut.toByteArray()
    }
}
