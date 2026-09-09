package com.goat.webview.features

import android.content.Context
import com.goat.webview.feature.payments.alipay.GoatAlipayPaymentAdapter
import com.goat.webview.feature.payments.bakong.GoatBakongKhqrPaymentAdapter
import com.goat.webview.feature.payments.bakong.KhqrPresenter
import com.goat.webview.feature.payments.paypay.GoatPayPayPaymentAdapter
import com.goat.webview.feature.payments.stripe.GoatStripePaymentAdapter
import com.goat.webview.feature.payments.stripe.GoatStripeLinkPaymentAdapter
import com.goat.webview.feature.payments.wechat.GoatWechatPaymentAdapter
import com.goat.webview.payments.GoatDefaultPaymentServerProxyClient
import com.goat.webview.payments.GoatPaymentAdapter
import com.goat.webview.payments.GoatPaymentContext
import com.goat.webview.payments.GoatPaymentGatewayManager
import com.goat.webview.payments.GoatPaymentIntentStore
import com.goat.webview.security.GoatAbuseGuardManager
import com.goat.webview.GoatSecureStorageManager

class RegistryKhqrPresenter : KhqrPresenter {
    @Volatile
    var lastShownQr: String? = null
        private set

    override suspend fun showQr(qrString: String, ctx: GoatPaymentContext) {
        lastShownQr = qrString
    }

    override suspend fun dismissQr(ctx: GoatPaymentContext) {}
}

object GoatPaymentPluginRegistry {

    const val DEFAULT_PROXY_BASE_URL = "http://127.0.0.1:3001"

    fun createAllPaymentAdapters(): List<GoatPaymentAdapter> = listOf(
        GoatStripePaymentAdapter(),
        GoatStripeLinkPaymentAdapter(),
        GoatAlipayPaymentAdapter(),
        GoatPayPayPaymentAdapter(),
        GoatBakongKhqrPaymentAdapter(RegistryKhqrPresenter()),
        GoatWechatPaymentAdapter()
    )

    @JvmOverloads
    fun createGatewayManager(
        context: Context,
        appId: String,
        baseUrl: String = DEFAULT_PROXY_BASE_URL
    ): GoatPaymentGatewayManager {
        val manager = GoatPaymentGatewayManager(
            appId = appId,
            proxyClient = GoatDefaultPaymentServerProxyClient(baseUrl),
            intentStore = GoatPaymentIntentStore(GoatSecureStorageManager(context), appId),
            abuseGuardManager = GoatAbuseGuardManager()
        )
        createAllPaymentAdapters().forEach { manager.registerAdapter(it) }
        return manager
    }
}
