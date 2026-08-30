package com.goat.webview.payments

import android.net.Uri
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class GoatPaymentReturnLinkVerifierTest {

    private val allowed = setOf("pay.tenant-1.com", "*.checkout.example.com")

    @Test
    fun `accepts an https URL on an exactly-allowlisted domain`() {
        val uri = Uri.parse("https://pay.tenant-1.com/payment/return?intentId=pi_1")
        assertTrue(GoatPaymentReturnLinkVerifier.isValidReturnUrl(uri, allowed))
    }

    @Test
    fun `accepts an https URL on a wildcard-allowlisted subdomain`() {
        val uri = Uri.parse("https://alipay.checkout.example.com/return?intentId=pi_1")
        assertTrue(GoatPaymentReturnLinkVerifier.isValidReturnUrl(uri, allowed))
    }

    @Test
    fun `rejects a legacy unverified custom scheme even on an allowlisted host`() {
        val uri = Uri.parse("goat://pay.tenant-1.com/payment/return?intentId=pi_1")
        assertFalse(GoatPaymentReturnLinkVerifier.isValidReturnUrl(uri, allowed))
    }

    @Test
    fun `rejects a raw PSP app scheme`() {
        val uri = Uri.parse("alipays://payment/return?intentId=pi_1")
        assertFalse(GoatPaymentReturnLinkVerifier.isValidReturnUrl(uri, allowed))
    }

    @Test
    fun `rejects an https URL on a non-allowlisted domain`() {
        val uri = Uri.parse("https://evil.example.com/payment/return?intentId=pi_1")
        assertFalse(GoatPaymentReturnLinkVerifier.isValidReturnUrl(uri, allowed))
    }

    @Test
    fun `rejects a suffix-substring domain that is not a genuine subdomain`() {
        val uri = Uri.parse("https://evilcheckout.example.com/return?intentId=pi_1")
        assertFalse(GoatPaymentReturnLinkVerifier.isValidReturnUrl(uri, allowed))
    }

    @Test
    fun `rejects everything when no return domains are configured`() {
        val uri = Uri.parse("https://pay.tenant-1.com/payment/return?intentId=pi_1")
        assertFalse(GoatPaymentReturnLinkVerifier.isValidReturnUrl(uri, emptySet()))
    }
}
