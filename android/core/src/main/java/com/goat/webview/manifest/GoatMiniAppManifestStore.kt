package com.goat.webview.manifest

import java.util.concurrent.ConcurrentHashMap

/**
 * Process-wide lookup of the parsed manifest for a loaded mini-app, keyed by `appId`.
 *
 * Exists because security checks that run far from bundle loading — the passkey plugin's
 * `allowedRpIds` gate in particular — need the manifest of the tenant making the call, and the
 * bridge plugin SPI passes only an action and a payload. A payload-supplied `appId` is attacker
 * controlled, so callers must resolve the tenant from the container, never from the payload.
 */
object GoatMiniAppManifestStore {

    private val manifests = ConcurrentHashMap<String, MiniAppManifest>()

    fun put(manifest: MiniAppManifest) {
        manifests[manifest.appId] = manifest
    }

    fun get(appId: String): MiniAppManifest? = manifests[appId]

    fun remove(appId: String): Boolean = manifests.remove(appId) != null

    fun clear() = manifests.clear()

    fun size(): Int = manifests.size
}
