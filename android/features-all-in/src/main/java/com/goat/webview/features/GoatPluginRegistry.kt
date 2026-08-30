package com.goat.webview.features

import android.content.Context
import com.goat.webview.GoatBridgeActionHandler
import com.goat.webview.GoatBridgePlugin
import com.goat.webview.feature.biometrics.GoatBiometricsPlugin
import com.goat.webview.feature.bluetooth.GoatBluetoothPlugin
import com.goat.webview.feature.location.GoatLocationPlugin
import com.goat.webview.feature.media.GoatMediaPlugin
import com.goat.webview.feature.network.GoatNetworkPlugin
import com.goat.webview.feature.scanner.GoatScannerPlugin

/**
 * Registry and factory for all bundled Goat WebView modular feature plugins (Task 10187).
 * Allows host applications including `:features-all-in` to automatically instantiate and
 * register all feature plugins with a [GoatBridgeActionHandler].
 */
object GoatPluginRegistry {

    /**
     * Creates a list containing instances of all available bundled feature plugins.
     *
     * @param context Host application context or Activity context.
     * @return List of [GoatBridgePlugin] instances.
     */
    fun createAllPlugins(context: Context): List<GoatBridgePlugin> {
        return listOf(
            GoatBiometricsPlugin(context),
            GoatBluetoothPlugin(context),
            GoatLocationPlugin(context),
            GoatMediaPlugin(context),
            GoatNetworkPlugin(context),
            GoatScannerPlugin(context)
        )
    }

    /**
     * Automatically registers all available bundled feature plugins with the provided [handler].
     *
     * @param handler Target [GoatBridgeActionHandler] instance.
     * @param context Host application context or Activity context.
     */
    fun registerAll(handler: GoatBridgeActionHandler, context: Context) {
        createAllPlugins(context).forEach { plugin ->
            handler.registerPlugin(plugin)
        }
    }
}
