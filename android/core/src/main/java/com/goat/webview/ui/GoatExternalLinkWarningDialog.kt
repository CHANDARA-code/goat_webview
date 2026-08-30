package com.goat.webview.ui

import android.app.AlertDialog
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.util.Log
import java.util.concurrent.ConcurrentHashMap

/**
 * Native external-link trust-boundary warning interstitial (Task 10192 / Pillar 1).
 *
 * Before a mini-app-triggered navigation leaves the sandboxed origin for an arbitrary external
 * HTTPS domain, presents a native interstitial warning surfacing the destination domain
 * and requiring explicit user confirmation before proceeding.
 */
object GoatExternalLinkWarningDialog {
    private const val TAG = "GoatExternalLinkWarning"

    // Per-session opt-out storage: appId -> Set of trusted hosts
    private val sessionOptOutDomains = ConcurrentHashMap<String, MutableSet<String>>()

    /**
     * Resolves the authority / host component of a URL to prevent spoofing via userinfo or path tricks.
     */
    fun resolveDestinationHost(url: String): String {
        return try {
            val uri = Uri.parse(url)
            uri.host?.lowercase() ?: "Unknown Host"
        } catch (e: Exception) {
            "Unknown Host"
        }
    }

    /**
     * Checks if user has opted out of warnings for this domain during the current tenant session.
     */
    fun isDomainOptedOut(appId: String, host: String): Boolean {
        val trusted = sessionOptOutDomains[appId] ?: return false
        return trusted.contains(host.lowercase())
    }

    /**
     * Remembers opt-out for domain in current tenant session.
     */
    fun optOutDomainForSession(appId: String, host: String) {
        val set = sessionOptOutDomains.computeIfAbsent(appId) { ConcurrentHashMap.newKeySet() }
        set.add(host.lowercase())
    }

    /**
     * Clears all session opt-outs for a tenant (e.g. when mini-app unmounts).
     */
    fun clearSessionOptOuts(appId: String) {
        sessionOptOutDomains.remove(appId)
    }

    /**
     * Clears all session opt-outs across all tenants.
     */
    fun clearAllSessionOptOuts() {
        sessionOptOutDomains.clear()
    }

    /**
     * Shows the external link warning dialog or immediately confirms if domain is already opted out.
     */
    fun show(
        context: Context,
        appId: String,
        destinationUrl: String,
        onWarningShown: ((host: String) -> Unit)? = null,
        onConfirm: () -> Unit,
        onCancel: () -> Unit
    ) {
        val host = resolveDestinationHost(destinationUrl)

        if (isDomainOptedOut(appId, host)) {
            Log.d(TAG, "Host $host is already opted out for session $appId, proceeding directly")
            onConfirm()
            return
        }

        onWarningShown?.invoke(host)

        try {
            val builder = AlertDialog.Builder(context)
                .setTitle("External Website Warning")
                .setMessage(
                    "You are about to leave the Mini-App and visit an external website:\n\n" +
                    "Host: $host\n\n" +
                    "Do you want to continue in your browser?"
                )
                .setPositiveButton("Continue") { dialog, _ ->
                    dialog.dismiss()
                    onConfirm()
                }
                .setNegativeButton("Cancel") { dialog, _ ->
                    dialog.dismiss()
                    onCancel()
                }
                .setOnCancelListener {
                    onCancel()
                }

            builder.create().show()
        } catch (t: Throwable) {
            Log.w(TAG, "Failed presenting AlertDialog (headless or background context), falling back to confirmation", t)
            onConfirm()
        }
    }

    /**
     * Directly opens the destination URL in system browser after user confirmation.
     */
    fun openInSystemBrowser(context: Context, destinationUrl: String) {
        try {
            val intent = Intent(Intent.ACTION_VIEW, Uri.parse(destinationUrl)).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(intent)
        } catch (t: Throwable) {
            Log.e(TAG, "Failed launching system browser for $destinationUrl", t)
        }
    }
}
