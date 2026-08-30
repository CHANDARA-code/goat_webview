package com.example.miniappwebview.security

import android.content.Context
import android.util.Log
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricManager.Authenticators.BIOMETRIC_STRONG
import androidx.biometric.BiometricManager.Authenticators.BIOMETRIC_WEAK
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import com.goat.webview.GoatSecureStorageManager
import com.goat.webview.GoatSecurityManager
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.security.PublicKey

/**
 * Enterprise Host Security Helper for the Android Showcase Application.
 * Coordinates AndroidX BiometricPrompt authentication, hardware KeyStore operations,
 * and cryptographic bundle signature verification.
 */
object ShowcaseSecurityHelper {

    private const val TAG = "ShowcaseSecurity"

    /**
     * Checks if biometric hardware is present and ready on this device.
     */
    fun canAuthenticateBiometrics(context: Context): Boolean {
        return try {
            val biometricManager = BiometricManager.from(context)
            biometricManager.canAuthenticate(BIOMETRIC_STRONG or BIOMETRIC_WEAK) == BiometricManager.BIOMETRIC_SUCCESS
        } catch (e: Exception) {
            Log.e(TAG, "Failed checking biometric capability", e)
            false
        }
    }

    /**
     * Triggers interactive AndroidX BiometricPrompt authentication.
     */
    fun authenticate(
        activity: FragmentActivity,
        title: String = "Biometric Vault Authentication",
        subtitle: String = "Verify identity to access secure keys",
        negativeButtonText: String = "Cancel",
        onSuccess: (token: String, isBiometric: Boolean) -> Unit,
        onError: (errorCode: Int, message: String) -> Unit
    ) {
        val executor = ContextCompat.getMainExecutor(activity)
        val callback = object : BiometricPrompt.AuthenticationCallback() {
            override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                val isBio = result.authenticationType == BiometricPrompt.AUTHENTICATION_RESULT_TYPE_BIOMETRIC
                val token = "bio_auth_${System.currentTimeMillis()}_${result.authenticationType}"
                Log.d(TAG, "BiometricPrompt authentication succeeded (isBio=$isBio)")
                onSuccess(token, isBio)
            }

            override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                Log.w(TAG, "BiometricPrompt authentication error: $errorCode - $errString")
                onError(errorCode, errString.toString())
            }

            override fun onAuthenticationFailed() {
                Log.d(TAG, "BiometricPrompt authentication attempt failed, retrying...")
            }
        }

        val promptInfo = BiometricPrompt.PromptInfo.Builder()
            .setTitle(title)
            .setSubtitle(subtitle)
            .setNegativeButtonText(negativeButtonText)
            .setAllowedAuthenticators(BIOMETRIC_STRONG or BIOMETRIC_WEAK)
            .build()

        try {
            val prompt = BiometricPrompt(activity, executor, callback)
            prompt.authenticate(promptInfo)
        } catch (e: Exception) {
            Log.e(TAG, "Failed launching BiometricPrompt", e)
            onError(-1, e.message ?: "Authentication failed to start")
        }
    }

    /**
     * Verifies hardware KeyStore AES-256 encrypted storage at rest for a tenant.
     */
    suspend fun verifyTenantKeyStore(
        context: Context,
        appId: String
    ): Boolean = withContext(Dispatchers.IO) {
        try {
            val secureStorage = GoatSecureStorageManager(context)
            val testKey = "sec_test_${System.currentTimeMillis()}"
            val testVal = "SampleVaultPayload_${System.currentTimeMillis()}"

            val saved = secureStorage.setSecureValue(appId, testKey, testVal)
            if (!saved) return@withContext false

            val retrieved = secureStorage.getSecureValue(appId, testKey)
            val isEncrypted = secureStorage.isEncryptedAtRest(appId, testKey)

            secureStorage.removeSecureValue(appId, testKey)
            saved && retrieved == testVal && isEncrypted
        } catch (e: Exception) {
            Log.e(TAG, "KeyStore verification failed for appId=$appId", e)
            false
        }
    }

    /**
     * Verifies cryptographic digital signature of an asset bundle file.
     */
    fun verifyBundleSignature(
        bundleFile: File,
        signatureBytes: ByteArray,
        publicKey: PublicKey
    ): Boolean {
        return GoatSecurityManager.verifyBundleSignature(
            bundleFile = bundleFile,
            signatureBytes = signatureBytes,
            publicKey = publicKey,
            algorithm = GoatSecurityManager.ALGORITHM_ECDSA
        )
    }
}
