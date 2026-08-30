package com.example.miniappwebview

import android.os.Bundle
import android.widget.Toast
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.core.view.WindowCompat
import androidx.fragment.app.FragmentActivity
import com.example.miniappwebview.security.ShowcaseSecurityHelper
import com.example.miniappwebview.theme.MiniAppWebViewTheme
import com.example.miniappwebview.ui.ShowcaseScreen

/**
 * Android Host Activity for Goat SuperApp Showcase.
 * Extends FragmentActivity to support interactive AndroidX BiometricPrompt triggers.
 */
class MainActivity : FragmentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        setContent {
            MiniAppWebViewTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = Color(0xFF020617)
                ) {
                    ShowcaseScreen(
                        onNavigateBack = { finish() },
                        onThemeChange = { isDark ->
                            WindowCompat.getInsetsController(window, window.decorView).apply {
                                isAppearanceLightStatusBars = !isDark
                                isAppearanceLightNavigationBars = !isDark
                            }
                        },
                        onTriggerBiometricPrompt = {
                            triggerNativeBiometricAuth()
                        }
                    )
                }
            }
        }
    }

    private fun triggerNativeBiometricAuth() {
        if (!ShowcaseSecurityHelper.canAuthenticateBiometrics(this)) {
            Toast.makeText(
                this,
                "Biometric hardware not enrolled or unavailable on this device/emulator",
                Toast.LENGTH_LONG
            ).show()
            return
        }

        ShowcaseSecurityHelper.authenticate(
            activity = this,
            title = "Biometric Vault Authentication",
            subtitle = "Authenticate to unlock hardware KeyStore partition",
            onSuccess = { token, isBio ->
                Toast.makeText(
                    this,
                    "Biometric Authentication Succeeded! (Type: ${if (isBio) "Biometric" else "Credential"})",
                    Toast.LENGTH_SHORT
                ).show()
            },
            onError = { errorCode, message ->
                Toast.makeText(
                    this,
                    "Biometric Auth Error ($errorCode): $message",
                    Toast.LENGTH_SHORT
                ).show()
            }
        )
    }
}
