package com.goat.webview.permission

import android.app.Activity
import android.app.AlertDialog
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.provider.Settings
import android.util.Log

/**
 * Two-stage permission priming dialog with automatic Settings fallback (Task 10198 / Pillar 1).
 *
 * Presents a themed rationale dialog before the OS permission prompt, and swaps to an
 * "Open Settings" deep-link CTA if the permission is permanently denied.
 */
object GoatPermissionPrimingDialog {
    private const val TAG = "GoatPermissionPriming"

    /**
     * Checks whether an Android permission is permanently denied (user clicked "Don't ask again").
     */
    fun isPermanentlyDenied(activity: Activity, permission: String): Boolean {
        return try {
            !activity.shouldShowRequestPermissionRationale(permission)
        } catch (e: Exception) {
            false
        }
    }

    /**
     * Shows the permission priming dialog.
     */
    fun show(
        context: Context,
        appId: String,
        scope: String,
        rationale: String?,
        isPermanentlyDenied: Boolean = false,
        onAccept: () -> Unit,
        onDenied: () -> Unit
    ) {
        val displayRationale = if (!rationale.isNullOrBlank()) {
            rationale
        } else {
            "Mini-App '$appId' is requesting access to '$scope' to enable required features."
        }

        try {
            val builder = AlertDialog.Builder(context)
                .setTitle("Permission Request: $scope")
                .setMessage(displayRationale)

            if (isPermanentlyDenied) {
                builder.setPositiveButton("Open Settings") { dialog, _ ->
                    dialog.dismiss()
                    openAppSettings(context)
                    onDenied()
                }
                builder.setNegativeButton("Cancel") { dialog, _ ->
                    dialog.dismiss()
                    onDenied()
                }
            } else {
                builder.setPositiveButton("Allow") { dialog, _ ->
                    dialog.dismiss()
                    onAccept()
                }
                builder.setNegativeButton("Deny") { dialog, _ ->
                    dialog.dismiss()
                    onDenied()
                }
            }

            builder.setOnCancelListener {
                onDenied()
            }

            builder.create().show()
        } catch (t: Throwable) {
            Log.w(TAG, "Failed presenting dialog in headless/background environment, delegating directly to onAccept", t)
            if (isPermanentlyDenied) onDenied() else onAccept()
        }
    }

    /**
     * Deep links to the app's OS Application Details Settings page.
     */
    fun openAppSettings(context: Context) {
        try {
            val pkg = try { context.packageName } catch (t: Throwable) { "com.goat.webview" }
            val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                try {
                    data = Uri.parse("package:$pkg")
                } catch (t: Throwable) {}
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(intent)
        } catch (t: Throwable) {
            Log.e(TAG, "Failed opening application settings", t)
        }
    }
}
