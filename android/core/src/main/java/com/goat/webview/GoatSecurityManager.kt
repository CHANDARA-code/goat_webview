package com.goat.webview

import android.util.Base64
import android.util.Log
import java.io.BufferedInputStream
import java.io.File
import java.io.FileInputStream
import java.io.InputStream
import java.security.KeyFactory
import java.security.PrivateKey
import java.security.PublicKey
import java.security.Signature
import java.security.spec.PKCS8EncodedKeySpec
import java.security.spec.X509EncodedKeySpec
import java.net.URLDecoder
import java.security.MessageDigest
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec

/**
 * Enterprise Cryptographic Security Manager for Goat WebView.
 *
 * Implements pre-extraction digital signature verification and tamper-evident validation
 * fulfilling OWASP Mobile Application Security Verification Standard (MASVS-CRYPTO / MSTG-CRYPTO-01).
 *
 * Supported algorithms:
 * - ECDSA with SHA-256 (`SHA256withECDSA`, NIST P-256 / secp256r1)
 * - RSA-2048 with SHA-256 (`SHA256withRSA`, PKCS#1 v1.5)
 */
object GoatSecurityManager {

    private const val TAG = "GoatSecurityManager"
    private const val BUFFER_SIZE = 8192

    /** Digital signature algorithm for Elliptic Curve Digital Signature Algorithm (ECDSA). */
    const val ALGORITHM_ECDSA = "SHA256withECDSA"

    /** Digital signature algorithm for RSA-2048 PKCS#1 v1.5 with SHA-256. */
    const val ALGORITHM_RSA = "SHA256withRSA"

    /** Standard KeyFactory algorithm identifier for Elliptic Curve keys. */
    const val KEY_ALGORITHM_EC = "EC"

    /** Standard KeyFactory algorithm identifier for RSA keys. */
    const val KEY_ALGORITHM_RSA = "RSA"

    /**
     * Verifies the cryptographic signature of raw byte data against a public key.
     *
     * @param data The payload byte array to verify.
     * @param signatureBytes The digital signature bytes.
     * @param publicKey The public key of the publisher.
     * @param algorithm The signature algorithm ([ALGORITHM_ECDSA] or [ALGORITHM_RSA]).
     * @return `true` if the signature is valid, `false` otherwise.
     */
    fun verifyBytesSignature(
        data: ByteArray,
        signatureBytes: ByteArray,
        publicKey: PublicKey,
        algorithm: String = ALGORITHM_ECDSA
    ): Boolean {
        return try {
            val signature = Signature.getInstance(algorithm)
            signature.initVerify(publicKey)
            signature.update(data)
            signature.verify(signatureBytes)
        } catch (e: Exception) {
            Log.e(TAG, "Signature verification failed with algorithm $algorithm", e)
            false
        }
    }

    /**
     * Verifies the cryptographic signature of an [InputStream] against a public key.
     *
     * @param inputStream The input stream providing data to verify.
     * @param signatureBytes The digital signature bytes.
     * @param publicKey The public key of the publisher.
     * @param algorithm The signature algorithm ([ALGORITHM_ECDSA] or [ALGORITHM_RSA]).
     * @return `true` if the signature is valid, `false` otherwise.
     */
    fun verifyStreamSignature(
        inputStream: InputStream,
        signatureBytes: ByteArray,
        publicKey: PublicKey,
        algorithm: String = ALGORITHM_ECDSA
    ): Boolean {
        return try {
            val signature = Signature.getInstance(algorithm)
            signature.initVerify(publicKey)
            val buffer = ByteArray(BUFFER_SIZE)
            var read: Int
            BufferedInputStream(inputStream, BUFFER_SIZE).use { bufferedIn ->
                while (bufferedIn.read(buffer).also { read = it } != -1) {
                    signature.update(buffer, 0, read)
                }
            }
            signature.verify(signatureBytes)
        } catch (e: Exception) {
            Log.e(TAG, "Stream signature verification failed with algorithm $algorithm", e)
            false
        }
    }

    /**
     * Verifies the cryptographic signature of a local bundle [File] against a public key.
     *
     * @param bundleFile The archive bundle file to verify.
     * @param signatureBytes The digital signature bytes.
     * @param publicKey The public key of the publisher.
     * @param algorithm The signature algorithm ([ALGORITHM_ECDSA] or [ALGORITHM_RSA]).
     * @return `true` if the signature is valid and authentic, `false` otherwise.
     */
    fun verifyBundleSignature(
        bundleFile: File,
        signatureBytes: ByteArray,
        publicKey: PublicKey,
        algorithm: String = ALGORITHM_ECDSA
    ): Boolean {
        if (!bundleFile.exists() || !bundleFile.isFile) {
            Log.e(TAG, "Bundle file does not exist or is not a file: ${bundleFile.absolutePath}")
            return false
        }
        return FileInputStream(bundleFile).use { input ->
            verifyStreamSignature(input, signatureBytes, publicKey, algorithm)
        }
    }

    /**
     * Alias for [verifyBundleSignature].
     */
    fun verifyFileSignature(
        bundleFile: File,
        signatureBytes: ByteArray,
        publicKey: PublicKey,
        algorithm: String = ALGORITHM_ECDSA
    ): Boolean = verifyBundleSignature(bundleFile, signatureBytes, publicKey, algorithm)

    /**
     * Generates a digital signature for a byte array using a private key.
     *
     * @param data The payload byte array to sign.
     * @param privateKey The private key of the publisher.
     * @param algorithm The signature algorithm ([ALGORITHM_ECDSA] or [ALGORITHM_RSA]).
     * @return Digital signature byte array.
     */
    fun signBytes(
        data: ByteArray,
        privateKey: PrivateKey,
        algorithm: String = ALGORITHM_ECDSA
    ): ByteArray {
        val signature = Signature.getInstance(algorithm)
        signature.initSign(privateKey)
        signature.update(data)
        return signature.sign()
    }

    /**
     * Generates a digital signature for an [InputStream] using a private key.
     *
     * @param inputStream The input stream containing payload data to sign.
     * @param privateKey The private key of the publisher.
     * @param algorithm The signature algorithm ([ALGORITHM_ECDSA] or [ALGORITHM_RSA]).
     * @return Digital signature byte array.
     */
    fun signStream(
        inputStream: InputStream,
        privateKey: PrivateKey,
        algorithm: String = ALGORITHM_ECDSA
    ): ByteArray {
        val signature = Signature.getInstance(algorithm)
        signature.initSign(privateKey)
        val buffer = ByteArray(BUFFER_SIZE)
        var read: Int
        BufferedInputStream(inputStream, BUFFER_SIZE).use { bufferedIn ->
            while (bufferedIn.read(buffer).also { read = it } != -1) {
                signature.update(buffer, 0, read)
            }
        }
        return signature.sign()
    }

    /**
     * Generates a digital signature for a bundle [File] using a private key.
     *
     * @param bundleFile The archive file to sign.
     * @param privateKey The private key of the publisher.
     * @param algorithm The signature algorithm ([ALGORITHM_ECDSA] or [ALGORITHM_RSA]).
     * @return Digital signature byte array.
     */
    fun signBundle(
        bundleFile: File,
        privateKey: PrivateKey,
        algorithm: String = ALGORITHM_ECDSA
    ): ByteArray {
        return FileInputStream(bundleFile).use { input ->
            signStream(input, privateKey, algorithm)
        }
    }

    /**
     * Decodes an X.509 encoded public key byte array into a [PublicKey] instance.
     *
     * @param encodedKey Standard X.509 DER encoded public key bytes (`publicKey.encoded`).
     * @param keyAlgorithm Key factory algorithm, e.g. [KEY_ALGORITHM_EC] or [KEY_ALGORITHM_RSA].
     * @return [PublicKey] instance.
     */
    fun decodePublicKey(encodedKey: ByteArray, keyAlgorithm: String = KEY_ALGORITHM_EC): PublicKey {
        val keySpec = X509EncodedKeySpec(encodedKey)
        val keyFactory = KeyFactory.getInstance(keyAlgorithm)
        return keyFactory.generatePublic(keySpec)
    }

    /**
     * Decodes a PKCS#8 encoded private key byte array into a [PrivateKey] instance.
     *
     * @param encodedKey Standard PKCS#8 DER encoded private key bytes (`privateKey.encoded`).
     * @param keyAlgorithm Key factory algorithm, e.g. [KEY_ALGORITHM_EC] or [KEY_ALGORITHM_RSA].
     * @return [PrivateKey] instance.
     */
    fun decodePrivateKey(encodedKey: ByteArray, keyAlgorithm: String = KEY_ALGORITHM_EC): PrivateKey {
        val keySpec = PKCS8EncodedKeySpec(encodedKey)
        val keyFactory = KeyFactory.getInstance(keyAlgorithm)
        return keyFactory.generatePrivate(keySpec)
    }

    /**
     * Decodes a Base64-encoded digital signature string into a raw byte array.
     *
     * @param base64Signature Base64 encoded signature string.
     * @return Raw signature byte array.
     */
    fun decodeBase64Signature(base64Signature: String): ByteArray {
        val clean = base64Signature.trim()
        return try {
            java.util.Base64.getDecoder().decode(clean)
        } catch (e: Throwable) {
            Base64.decode(clean, Base64.DEFAULT) ?: ByteArray(0)
        }
    }

    /**
     * Encodes raw signature bytes into a Base64 string.
     *
     * @param signatureBytes Raw signature byte array.
     * @return Base64 encoded string.
     */
    fun encodeBase64(signatureBytes: ByteArray): String {
        return try {
            java.util.Base64.getEncoder().encodeToString(signatureBytes)
        } catch (e: Throwable) {
            Base64.encodeToString(signatureBytes, Base64.NO_WRAP) ?: ""
        }
    }

    /** Whitelisted virtual HTTPS origin for Android WebViewAssetLoader. */
    const val VIRTUAL_ORIGIN_HTTPS = "https://appassets.androidplatform.net"

    /** Whitelisted virtual custom scheme origin. */
    const val VIRTUAL_ORIGIN_GOAT = "goat://assets"

    /**
     * Default Strict Content Security Policy (CSP) directives conforming to OWASP MASVS (Task 10086).
     */
    const val DEFAULT_CSP_DIRECTIVES = "default-src 'self' https://appassets.androidplatform.net; " +
            "script-src 'self' 'unsafe-inline' https://appassets.androidplatform.net; " +
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
            "font-src 'self' data: https://fonts.gstatic.com; " +
            "img-src 'self' data: blob: https:; " +
            "connect-src 'self' https://appassets.androidplatform.net https: wss:; " +
            "frame-src 'none'; " +
            "object-src 'none'; " +
            "base-uri 'self';"

    /**
     * Set of default whitelisted origins for WebMessageListener and IPC.
     */
    val DEFAULT_WHITELISTED_ORIGINS = setOf(VIRTUAL_ORIGIN_HTTPS, VIRTUAL_ORIGIN_GOAT)

    /**
     * Validates whether an incoming IPC origin is authorized against the whitelist.
     *
     * @param origin The calling frame origin URL string.
     * @param whitelistedOrigins The allowed origin set.
     * @return `true` if authorized, `false` otherwise.
     */
    fun isOriginAllowed(origin: String?, whitelistedOrigins: Set<String> = DEFAULT_WHITELISTED_ORIGINS): Boolean {
        if (origin.isNullOrBlank()) return false
        val cleanOrigin = origin.trim().removeSuffix("/")

        // Check exact match in whitelisted origins
        if (whitelistedOrigins.any { allowed ->
            val cleanAllowed = allowed.trim().removeSuffix("/")
            cleanOrigin.equals(cleanAllowed, ignoreCase = true)
        }) {
            return true
        }

        // Allow any virtual tenant domain under https://*.appassets.androidplatform.net or https://appassets.androidplatform.net
        if (cleanOrigin.startsWith("https://", ignoreCase = true)) {
            val withoutScheme = cleanOrigin.substring(8)
            val hostAndPort = withoutScheme.split('/', '?', '#')[0]
            val host = hostAndPort.split(':')[0].lowercase()
            if (host == "appassets.androidplatform.net" || host.endsWith(".appassets.androidplatform.net")) {
                return true
            }
        }

        return false
    }

    /**
     * Asserts whether a URL is secure (HTTPS or sandboxed virtual scheme) and strictly rejects cleartext HTTP.
     *
     * @param url Target URL to test.
     * @return `true` if secure, `false` if cleartext HTTP or unencrypted scheme.
     */
    fun isSecureUrl(url: String?): Boolean {
        if (url.isNullOrBlank()) return false
        val clean = url.trim().lowercase()
        if (clean.startsWith("http://")) return false
        return clean.startsWith("https://") || clean.startsWith("goat://") || clean.startsWith("wss://")
    }

    /**
     * Generates a standard HTML Content-Security-Policy `<meta>` tag string for HTML document injection.
     */
    fun generateCspMetaTag(customDirectives: String? = null): String {
        val directives = customDirectives ?: DEFAULT_CSP_DIRECTIVES
        return "<meta http-equiv=\"Content-Security-Policy\" content=\"$directives\">"
    }

    const val LAUNCH_HASH_PARAM = "goatWebAppData"
    const val LAUNCH_HASH_FIELD = "hash"
    const val LAUNCH_AUTH_DATE_FIELD = "auth_date"
    const val DEFAULT_LAUNCH_HASH_MAX_AGE_SECONDS = 86_400L

    private const val HMAC_SHA256 = "HmacSHA256"

    class MalformedLaunchHashException(message: String) : IllegalArgumentException(message)

    fun buildDataCheckString(params: Map<String, String>): String =
        params.filterKeys { it != LAUNCH_HASH_FIELD }
            .toSortedMap()
            .entries
            .joinToString("\n") { entry -> entry.key + "=" + entry.value }

    fun generateLaunchHash(params: Map<String, String>, secretKey: ByteArray): String {
        require(secretKey.isNotEmpty()) { "secretKey must not be empty" }
        val mac = Mac.getInstance(HMAC_SHA256)
        mac.init(SecretKeySpec(secretKey, HMAC_SHA256))
        val digest = mac.doFinal(buildDataCheckString(params).toByteArray(Charsets.UTF_8))
        return digest.joinToString("") { "%02x".format(it) }
    }

    fun parseLaunchFragment(hashFragment: String): Map<String, String> {
        var payload = hashFragment.removePrefix("#")
        val marker = LAUNCH_HASH_PARAM + "="
        val markerIndex = payload.indexOf(marker)
        if (markerIndex >= 0) {
            payload = payload.substring(markerIndex + marker.length)
            val ampersandAfterOuter = payload.indexOf('&')
            val looksNested = payload.contains("%3D") || payload.contains("%26")
            if (looksNested || ampersandAfterOuter < 0) {
                payload = decodeComponent(payload)
            }
        }
        if (payload.isBlank()) return emptyMap()
        return payload.split("&")
            .mapNotNull { pair ->
                val separator = pair.indexOf('=')
                if (separator <= 0) null
                else decodeComponent(pair.substring(0, separator)) to
                    decodeComponent(pair.substring(separator + 1))
            }
            .toMap()
    }

    private fun decodeComponent(value: String): String =
        try {
            URLDecoder.decode(value, "UTF-8")
        } catch (_: Exception) {
            value
        }

    @JvmOverloads
    fun verifyLaunchHash(
        hashFragment: String,
        secretKey: ByteArray,
        maxAgeSeconds: Long = DEFAULT_LAUNCH_HASH_MAX_AGE_SECONDS,
        nowEpochSeconds: Long = System.currentTimeMillis() / 1000L
    ): Boolean {
        if (secretKey.isEmpty()) return false
        val params = try {
            parseLaunchFragment(hashFragment)
        } catch (_: Exception) {
            return false
        }
        val providedHash = params[LAUNCH_HASH_FIELD]?.lowercase()
        if (providedHash.isNullOrBlank()) return false

        val authDate = params[LAUNCH_AUTH_DATE_FIELD]?.toLongOrNull() ?: return false
        if (maxAgeSeconds > 0) {
            val age = nowEpochSeconds - authDate
            if (age > maxAgeSeconds) return false
            if (age < -MAX_CLOCK_SKEW_SECONDS) return false
        }

        val expected = try {
            generateLaunchHash(params, secretKey)
        } catch (_: Exception) {
            return false
        }
        return MessageDigest.isEqual(
            expected.toByteArray(Charsets.UTF_8),
            providedHash.toByteArray(Charsets.UTF_8)
        )
    }

    private const val MAX_CLOCK_SKEW_SECONDS = 300L
}
