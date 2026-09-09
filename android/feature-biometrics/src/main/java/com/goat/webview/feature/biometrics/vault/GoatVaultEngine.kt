package com.goat.webview.feature.biometrics.vault

import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import com.goat.webview.feature.biometrics.passkey.PasskeyErrorCode
import com.goat.webview.feature.biometrics.passkey.PasskeyException
import com.goat.webview.feature.biometrics.passkey.VaultMode
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import java.security.KeyStore
import java.security.SecureRandom
import javax.crypto.AEADBadTagException
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.Mac
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec

/**
 * Source of the device-bound secret that anchors every vault key.
 *
 * Split out so the derivation can be unit tested without a KeyStore, and so a host can supply a
 * different hardware root. There is deliberately no software fallback in the production
 * implementation: if the KeyStore is unavailable the vault fails closed rather than silently
 * downgrading to a key an attacker could reproduce off-device.
 */
interface VaultKeyStoreSecretSource {
    fun deviceSecret(appId: String, vaultId: String): ByteArray
    val isHardwareBacked: Boolean
}

class AndroidKeyStoreSecretSource(
    private val keyAliasPrefix: String = "goat_vault_hmac_"
) : VaultKeyStoreSecretSource {

    override val isHardwareBacked: Boolean = true

    override fun deviceSecret(appId: String, vaultId: String): ByteArray {
        val mac = try {
            Mac.getInstance(KeyProperties.KEY_ALGORITHM_HMAC_SHA256).apply {
                init(loadOrCreateKey(appId))
            }
        } catch (e: Throwable) {
            throw PasskeyException(
                PasskeyErrorCode.VAULT_UNAVAILABLE,
                "Hardware KeyStore is unavailable; refusing to derive a vault key in software",
                e
            )
        }
        return mac.doFinal("goat-vault:$appId:$vaultId".toByteArray(Charsets.UTF_8))
    }

    private fun loadOrCreateKey(appId: String): javax.crypto.SecretKey {
        val alias = keyAliasPrefix + appId.replace(Regex("[^A-Za-z0-9_.-]"), "_")
        val keyStore = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (keyStore.getKey(alias, null) as? javax.crypto.SecretKey)?.let { return it }

        val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_HMAC_SHA256, "AndroidKeyStore")
        generator.init(
            KeyGenParameterSpec.Builder(alias, KeyProperties.PURPOSE_SIGN)
                .setDigests(KeyProperties.DIGEST_SHA256)
                .build()
        )
        return generator.generateKey()
    }
}

/**
 * Hardware-anchored AES-256-GCM vault.
 *
 * `VaultKey = HKDF-SHA256(IKM = prfOutput ?: deviceSecret, salt = deviceSecret XOR clientSalt,
 * info = "goat-vault-v1")`. Mixing the KeyStore secret into the salt is what makes an off-device
 * PRF evaluation insufficient on its own: the secret never leaves the KeyStore, so the derived key
 * cannot be reproduced on another machine even by an attacker who replays the PRF.
 *
 * The derived key is zeroed immediately after use; only ciphertext or plaintext crosses the bridge.
 */
class GoatVaultEngine(
    private val secretSource: VaultKeyStoreSecretSource,
    private val prfEvaluator: VaultPrfEvaluator? = null,
    private val random: SecureRandom = SecureRandom()
) {

    companion object {
        const val ENVELOPE_VERSION = 1
        private const val HKDF_INFO = "goat-vault-v1"
        private const val GCM_TAG_BITS = 128
        private const val GCM_TAG_BYTES = GCM_TAG_BITS / 8
        private const val IV_BYTES = 12
        private const val SALT_BYTES = 32
        private const val KEY_BYTES = 32
    }

    fun encrypt(appId: String, vaultId: String, plaintext: String): JsonObject {
        val clientSalt = ByteArray(SALT_BYTES).also(random::nextBytes)
        val iv = ByteArray(IV_BYTES).also(random::nextBytes)
        val prf = prfEvaluator?.evaluate(appId, vaultId, clientSalt)
        val key = deriveKey(appId, vaultId, clientSalt, prf)

        try {
            val cipher = Cipher.getInstance("AES/GCM/NoPadding")
            cipher.init(Cipher.ENCRYPT_MODE, SecretKeySpec(key, "AES"), GCMParameterSpec(GCM_TAG_BITS, iv))
            val sealed = cipher.doFinal(plaintext.toByteArray(Charsets.UTF_8))

            val ciphertext = sealed.copyOfRange(0, sealed.size - GCM_TAG_BYTES)
            val tag = sealed.copyOfRange(sealed.size - GCM_TAG_BYTES, sealed.size)

            return buildJsonObject {
                put("version", ENVELOPE_VERSION)
                put("vaultMode", if (prf != null) VaultMode.WEBAUTHN_PRF else VaultMode.HARDWARE_KEYSTORE)
                put("appId", appId)
                put("vaultId", vaultId)
                put("salt", base64Url(clientSalt))
                put("iv", base64Url(iv))
                put("ciphertext", base64Url(ciphertext))
                put("tag", base64Url(tag))
            }
        } catch (e: PasskeyException) {
            throw e
        } catch (e: Throwable) {
            throw PasskeyException(PasskeyErrorCode.INTERNAL_ERROR, "Vault encryption failed", e)
        } finally {
            key.fill(0)
            prf?.fill(0)
        }
    }

    fun decrypt(appId: String, vaultId: String, envelope: JsonObject): JsonObject {
        val storedAppId = envelope.str("appId")
        if (storedAppId != null && storedAppId != appId) {
            throw PasskeyException(
                PasskeyErrorCode.VAULT_DECRYPTION_FAILED,
                "Envelope belongs to a different mini-app tenant"
            )
        }
        val storedVaultId = envelope.str("vaultId")
        if (storedVaultId != null && storedVaultId != vaultId) {
            throw PasskeyException(
                PasskeyErrorCode.VAULT_DECRYPTION_FAILED,
                "Envelope belongs to a different vault"
            )
        }

        val clientSalt = decodeField(envelope, "salt")
        val iv = decodeField(envelope, "iv")
        val ciphertext = decodeField(envelope, "ciphertext")
        val tag = decodeField(envelope, "tag")
        val mode = envelope.str("vaultMode") ?: VaultMode.HARDWARE_KEYSTORE

        val prf = if (mode == VaultMode.WEBAUTHN_PRF) {
            prfEvaluator?.evaluate(appId, vaultId, clientSalt)
                ?: throw PasskeyException(
                    PasskeyErrorCode.VAULT_DECRYPTION_FAILED,
                    "Envelope was sealed with a WebAuthn PRF key but no PRF evaluator is registered"
                )
        } else {
            null
        }
        val key = deriveKey(appId, vaultId, clientSalt, prf)

        try {
            val cipher = Cipher.getInstance("AES/GCM/NoPadding")
            cipher.init(Cipher.DECRYPT_MODE, SecretKeySpec(key, "AES"), GCMParameterSpec(GCM_TAG_BITS, iv))
            val plaintext = cipher.doFinal(ciphertext + tag)
            return buildJsonObject { put("plaintext", String(plaintext, Charsets.UTF_8)) }
        } catch (e: AEADBadTagException) {
            throw PasskeyException(
                PasskeyErrorCode.VAULT_DECRYPTION_FAILED,
                "Authentication tag verification failed",
                e
            )
        } catch (e: PasskeyException) {
            throw e
        } catch (e: Throwable) {
            throw PasskeyException(PasskeyErrorCode.VAULT_DECRYPTION_FAILED, "Vault decryption failed", e)
        } finally {
            key.fill(0)
            prf?.fill(0)
        }
    }

    private fun deriveKey(appId: String, vaultId: String, clientSalt: ByteArray, prf: ByteArray?): ByteArray {
        val deviceSecret = secretSource.deviceSecret(appId, vaultId)
        try {
            val salt = xor(deviceSecret, clientSalt)
            val ikm = prf ?: deviceSecret
            return hkdf(ikm, salt, HKDF_INFO.toByteArray(Charsets.UTF_8), KEY_BYTES)
        } finally {
            deviceSecret.fill(0)
        }
    }

    private fun hkdf(ikm: ByteArray, salt: ByteArray, info: ByteArray, length: Int): ByteArray {
        val extractMac = Mac.getInstance("HmacSHA256")
        extractMac.init(SecretKeySpec(salt, "HmacSHA256"))
        val prk = extractMac.doFinal(ikm)

        val expandMac = Mac.getInstance("HmacSHA256")
        expandMac.init(SecretKeySpec(prk, "HmacSHA256"))
        val out = ByteArray(length)
        var previous = ByteArray(0)
        var generated = 0
        var counter = 1
        while (generated < length) {
            expandMac.reset()
            expandMac.update(previous)
            expandMac.update(info)
            expandMac.update(counter.toByte())
            previous = expandMac.doFinal()
            val take = minOf(previous.size, length - generated)
            previous.copyInto(out, generated, 0, take)
            generated += take
            counter++
        }
        prk.fill(0)
        previous.fill(0)
        return out
    }

    private fun xor(a: ByteArray, b: ByteArray): ByteArray {
        val size = maxOf(a.size, b.size)
        val out = ByteArray(size)
        for (i in 0 until size) {
            val left = if (i < a.size) a[i] else 0
            val right = if (i < b.size) b[i] else 0
            out[i] = (left.toInt() xor right.toInt()).toByte()
        }
        return out
    }

    private fun decodeField(envelope: JsonObject, key: String): ByteArray {
        val value = envelope.str(key)
            ?: throw PasskeyException(PasskeyErrorCode.INVALID_PARAMETERS, "Envelope is missing '$key'")
        return try {
            decodeBase64Url(value)
        } catch (e: Throwable) {
            throw PasskeyException(PasskeyErrorCode.INVALID_PARAMETERS, "Envelope field '$key' is not Base64URL", e)
        }
    }

    private fun JsonObject.str(key: String): String? =
        this[key]?.let { runCatching { it.jsonPrimitive.content }.getOrNull() }?.takeIf { it.isNotBlank() }

    private fun base64Url(bytes: ByteArray): String {
        val table = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"
        val sb = StringBuilder()
        var i = 0
        while (i + 2 < bytes.size) {
            val n = ((bytes[i].toInt() and 0xff) shl 16) or
                ((bytes[i + 1].toInt() and 0xff) shl 8) or
                (bytes[i + 2].toInt() and 0xff)
            sb.append(table[(n shr 18) and 63]).append(table[(n shr 12) and 63])
                .append(table[(n shr 6) and 63]).append(table[n and 63])
            i += 3
        }
        when (bytes.size - i) {
            1 -> {
                val n = (bytes[i].toInt() and 0xff) shl 16
                sb.append(table[(n shr 18) and 63]).append(table[(n shr 12) and 63])
            }
            2 -> {
                val n = ((bytes[i].toInt() and 0xff) shl 16) or ((bytes[i + 1].toInt() and 0xff) shl 8)
                sb.append(table[(n shr 18) and 63]).append(table[(n shr 12) and 63]).append(table[(n shr 6) and 63])
            }
        }
        return sb.toString()
    }

    private fun decodeBase64Url(value: String): ByteArray {
        val table = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"
        val clean = value.trim()
        require(clean.all { table.indexOf(it) >= 0 }) { "not base64url" }
        val out = java.io.ByteArrayOutputStream()
        var buffer = 0
        var bits = 0
        for (ch in clean) {
            buffer = (buffer shl 6) or table.indexOf(ch)
            bits += 6
            if (bits >= 8) {
                bits -= 8
                out.write((buffer shr bits) and 0xff)
            }
        }
        return out.toByteArray()
    }
}

/**
 * Evaluates the CTAP2 PRF (`hmac-secret`) for a vault salt, strictly inside native memory.
 *
 * Left unregistered by default: the platform only exposes PRF through a real passkey ceremony on
 * a capable device, and returning invented bytes here would produce vaults that look encrypted
 * but are not anchored to any authenticator. With no evaluator the vault is still real AES-256-GCM
 * anchored to the hardware KeyStore, tagged `hardware_keystore` so the mode is never ambiguous.
 */
interface VaultPrfEvaluator {
    fun evaluate(appId: String, vaultId: String, salt: ByteArray): ByteArray
}
