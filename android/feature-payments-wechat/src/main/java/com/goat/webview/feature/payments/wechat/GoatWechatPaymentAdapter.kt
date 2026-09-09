package com.goat.webview.feature.payments.wechat

import com.goat.webview.payments.GoatPaymentAdapter
import com.goat.webview.payments.GoatPaymentContext
import com.goat.webview.payments.GoatPaymentErrorCode
import com.goat.webview.payments.GoatPaymentException
import com.goat.webview.payments.GoatPaymentOutcome
import com.goat.webview.payments.GoatPaymentRequest
import com.goat.webview.payments.GoatPaymentStatus
import com.goat.webview.payments.GoatPaymentSubCode

/** Classification of `IWXAPI.sendReq` / `WXPayEntryActivity` return codes. */
enum class WechatResult { SUCCESS, CANCELED, FAILED, NOT_INSTALLED }

/**
 * WeChat's documented `BaseResp.errCode` values.
 *
 * `-1` covers signature errors, an unsupported client version and a rejected request alike; WeChat
 * does not distinguish them, so neither does this — reporting a specific cause would be inventing
 * one.
 */
object WechatErrorCode {
    const val OK = 0
    const val COMMON = -1
    const val USER_CANCEL = -2
    const val SENT_FAILED = -3
    const val AUTH_DENIED = -4
    const val UNSUPPORT = -5

    fun classify(errCode: Int?): WechatResult = when (errCode) {
        OK -> WechatResult.SUCCESS
        USER_CANCEL -> WechatResult.CANCELED
        null -> WechatResult.FAILED
        else -> WechatResult.FAILED
    }
}

/**
 * The four fields a merchant server signs for WeChat Pay v3, plus the signature itself.
 *
 * These are produced server-side from a `prepay_id`; the private key never reaches the device, so
 * this adapter only carries the envelope across to the SDK.
 */
data class WechatPayOrder(
    val appId: String,
    val partnerId: String,
    val prepayId: String,
    val nonceStr: String,
    val timeStamp: String,
    val packageValue: String = "Sign=WXPay",
    val sign: String
)

/**
 * Abstraction over `com.tencent.mm.opensdk` (`IWXAPI`). Zero compile-time dependency on the
 * proprietary WeChat SDK — a host wires a real launcher, exactly as the Alipay adapter does.
 */
interface WechatPayLauncher {
    /** Mirrors `IWXAPI.isWXAppInstalled()`. */
    suspend fun isWechatInstalled(): Boolean

    /**
     * Mirrors `IWXAPI.sendReq(PayReq)`. The result arrives asynchronously in the host's
     * `<package>.wxapi.WXPayEntryActivity`, which must forward it back to complete this call.
     */
    suspend fun sendPayRequest(order: WechatPayOrder, ctx: GoatPaymentContext): WechatResult
}

/**
 * Built-in WeChat Pay adapter.
 *
 * Like every other adapter here, the client-side result is provisional: `errCode == 0` means the
 * WeChat UI reported success, not that the money moved. The authoritative state always comes from
 * the Zone 4 proxy, which reconciles the PSP webhook.
 */
class GoatWechatPaymentAdapter(
    private val launcher: WechatPayLauncher = UnlinkedLauncher
) : GoatPaymentAdapter {

    override val providerId: String = PROVIDER_ID

    override suspend fun processPayment(
        request: GoatPaymentRequest,
        ctx: GoatPaymentContext
    ): GoatPaymentOutcome {
        val token = request.ephemeralClientToken
            ?: throw GoatPaymentException(
                GoatPaymentErrorCode.PAYMENT_FAILED,
                "Missing ephemeral order payload for WeChat Pay."
            )

        if (!launcher.isWechatInstalled()) {
            throw GoatPaymentException(
                GoatPaymentErrorCode.PAYMENT_FAILED,
                "PROVIDER_NOT_INSTALLED: WeChat is not installed on this device.",
                GoatPaymentSubCode.AUTHENTICATION_FAILED
            )
        }

        val order = parseOrder(token)
        val provisional = launcher.sendPayRequest(order, ctx)

        // The SDK result is provisional only — confirm against the authoritative proxy state.
        val authoritative = ctx.proxyClient.queryIntent(request.intentId)
        if (authoritative.status.isTerminal) return authoritative

        return when (provisional) {
            WechatResult.SUCCESS -> GoatPaymentOutcome(GoatPaymentStatus.PROCESSING, request.intentId)
            WechatResult.CANCELED -> GoatPaymentOutcome(GoatPaymentStatus.DISMISSED, request.intentId)
            WechatResult.NOT_INSTALLED, WechatResult.FAILED -> GoatPaymentOutcome(
                GoatPaymentStatus.FAILED,
                request.intentId,
                failureSubCode = GoatPaymentSubCode.AUTHENTICATION_FAILED
            )
        }
    }

    override suspend fun queryStatus(intentId: String, ctx: GoatPaymentContext): GoatPaymentStatus =
        ctx.proxyClient.queryIntent(intentId).status

    override suspend fun cancelPayment(intentId: String, ctx: GoatPaymentContext): GoatPaymentStatus =
        ctx.proxyClient.cancelIntent(intentId).status

    /**
     * The proxy hands down the signed envelope as a compact `key=value;` string. Parsing here
     * rather than trusting field order keeps a malformed or truncated payload from being sent to
     * the SDK as a half-filled request.
     */
    internal fun parseOrder(token: String): WechatPayOrder {
        val fields = token.split(';')
            .mapNotNull { part ->
                val index = part.indexOf('=')
                if (index <= 0) null else part.substring(0, index).trim() to part.substring(index + 1).trim()
            }
            .toMap()

        fun require(key: String): String = fields[key]?.takeIf { it.isNotEmpty() }
            ?: throw GoatPaymentException(
                GoatPaymentErrorCode.PAYMENT_FAILED,
                "WeChat order envelope is missing '$key'."
            )

        return WechatPayOrder(
            appId = require("appId"),
            partnerId = require("partnerId"),
            prepayId = require("prepayId"),
            nonceStr = require("nonceStr"),
            timeStamp = require("timeStamp"),
            packageValue = fields["package"]?.takeIf { it.isNotEmpty() } ?: "Sign=WXPay",
            sign = require("sign")
        )
    }

    companion object {
        const val PROVIDER_ID = "wechat_pay"

        val UnlinkedLauncher = object : WechatPayLauncher {
            override suspend fun isWechatInstalled(): Boolean = false
            override suspend fun sendPayRequest(order: WechatPayOrder, ctx: GoatPaymentContext): WechatResult =
                throw GoatPaymentException(
                    GoatPaymentErrorCode.PAYMENT_FAILED,
                    "WeChat SDK is not linked on this host. Construct GoatWechatPaymentAdapter with a " +
                        "WechatPayLauncher backed by com.tencent.mm.opensdk IWXAPI, and place " +
                        "WXPayEntryActivity at <package>.wxapi.WXPayEntryActivity.",
                    GoatPaymentSubCode.AUTHENTICATION_FAILED
                )
        }
    }
}
