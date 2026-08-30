package com.goat.webview

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class GoatLaunchHashAuthTest {

    private val secret = "goat-host-secret-key".toByteArray(Charsets.UTF_8)
    private val now = 1_756_500_000L

    private fun signedParams(authDate: Long = now): Map<String, String> = mapOf(
        "user" to "{\"id\":42,\"name\":\"Dara\"}",
        "chat_type" to "private",
        "auth_date" to authDate.toString()
    )

    private fun signedFragment(params: Map<String, String> = signedParams()): String {
        val hash = GoatSecurityManager.generateLaunchHash(params, secret)
        val query = params.entries.joinToString("&") { "${it.key}=${it.value}" } + "&hash=$hash"
        return "#${GoatSecurityManager.LAUNCH_HASH_PARAM}=$query"
    }

    @Test
    fun dataCheckStringIsSortedAndExcludesHash() {
        val checkString = GoatSecurityManager.buildDataCheckString(
            mapOf("b" to "2", "a" to "1", "hash" to "deadbeef", "c" to "3")
        )
        assertEquals("a=1\nb=2\nc=3", checkString)
    }

    @Test
    fun validLaunchHashIsAccepted() {
        assertTrue(
            GoatSecurityManager.verifyLaunchHash(
                signedFragment(), secret, nowEpochSeconds = now
            )
        )
    }

    @Test
    fun tamperedParameterIsRejected() {
        val params = signedParams()
        val hash = GoatSecurityManager.generateLaunchHash(params, secret)
        val tampered = "#${GoatSecurityManager.LAUNCH_HASH_PARAM}=" +
            "user={\"id\":43,\"name\":\"Mallory\"}&chat_type=private&auth_date=$now&hash=$hash"
        assertFalse(GoatSecurityManager.verifyLaunchHash(tampered, secret, nowEpochSeconds = now))
    }

    @Test
    fun tamperedHashIsRejected() {
        val fragment = signedFragment().dropLast(1) + "0"
        assertFalse(GoatSecurityManager.verifyLaunchHash(fragment, secret, nowEpochSeconds = now))
    }

    @Test
    fun wrongSecretIsRejected() {
        assertFalse(
            GoatSecurityManager.verifyLaunchHash(
                signedFragment(), "attacker-key".toByteArray(Charsets.UTF_8), nowEpochSeconds = now
            )
        )
    }

    @Test
    fun expiredLaunchHashIsRejected() {
        val stale = signedFragment(signedParams(authDate = now - 90_000L))
        assertFalse(GoatSecurityManager.verifyLaunchHash(stale, secret, nowEpochSeconds = now))
        assertTrue(
            GoatSecurityManager.verifyLaunchHash(
                stale, secret, maxAgeSeconds = 120_000L, nowEpochSeconds = now
            )
        )
    }

    @Test
    fun farFutureAuthDateIsRejected() {
        val future = signedFragment(signedParams(authDate = now + 8_000L))
        assertFalse(GoatSecurityManager.verifyLaunchHash(future, secret, nowEpochSeconds = now))
    }

    @Test
    fun missingHashOrAuthDateIsRejected() {
        assertFalse(GoatSecurityManager.verifyLaunchHash("#goatWebAppData=user=x", secret, nowEpochSeconds = now))
        assertFalse(GoatSecurityManager.verifyLaunchHash("", secret, nowEpochSeconds = now))
        val noAuthDate = mapOf("user" to "x")
        val hash = GoatSecurityManager.generateLaunchHash(noAuthDate, secret)
        assertFalse(
            GoatSecurityManager.verifyLaunchHash(
                "#goatWebAppData=user=x&hash=$hash", secret, nowEpochSeconds = now
            )
        )
    }

    @Test
    fun emptySecretIsRejected() {
        assertFalse(GoatSecurityManager.verifyLaunchHash(signedFragment(), ByteArray(0), nowEpochSeconds = now))
    }

    @Test
    fun percentEncodedFragmentIsParsed() {
        val params = signedParams()
        val hash = GoatSecurityManager.generateLaunchHash(params, secret)
        val inner = params.entries.joinToString("&") { "${it.key}=${it.value}" } + "&hash=$hash"
        val encoded = java.net.URLEncoder.encode(inner, "UTF-8")
        assertTrue(
            GoatSecurityManager.verifyLaunchHash(
                "#${GoatSecurityManager.LAUNCH_HASH_PARAM}=$encoded", secret, nowEpochSeconds = now
            )
        )
    }

    @Test
    fun verificationCompletesUnderTwoMilliseconds() {
        val fragment = signedFragment()
        repeat(200) { GoatSecurityManager.verifyLaunchHash(fragment, secret, nowEpochSeconds = now) }
        val started = System.nanoTime()
        repeat(1000) { GoatSecurityManager.verifyLaunchHash(fragment, secret, nowEpochSeconds = now) }
        val averageMs = (System.nanoTime() - started) / 1000.0 / 1_000_000.0
        assertTrue("Average verification took ${averageMs}ms", averageMs < 2.0)
    }
}

class GoatWebViewClientLaunchHashGateTest {

    private val secret = "host-secret".toByteArray(Charsets.UTF_8)

    private fun client(secretKey: ByteArray?) = GoatWebViewClient(
        context = FakeTestContext(),
        extractedDir = java.io.File(System.getProperty("java.io.tmpdir"), "goat-launch-hash-test"),
        appId = "com.goat.launchhash",
        launchHashSecretKey = secretKey
    )

    private fun signedUrl(authDate: Long = System.currentTimeMillis() / 1000L): String {
        val params = mapOf("user" to "dara", "auth_date" to authDate.toString())
        val hash = GoatSecurityManager.generateLaunchHash(params, secret)
        val query = params.entries.joinToString("&") { "${it.key}=${it.value}" } + "&hash=$hash"
        return "https://appassets.androidplatform.net/assets/index.html#goatWebAppData=$query"
    }

    @Test
    fun signedLaunchUrlIsAuthorized() {
        assertTrue(client(secret).isLaunchHashAuthorized(signedUrl()))
    }

    @Test
    fun tamperedLaunchUrlIsBlocked() {
        val tampered = signedUrl().replace("user=dara", "user=mallory")
        assertFalse(client(secret).isLaunchHashAuthorized(tampered))
    }

    @Test
    fun expiredLaunchUrlIsBlocked() {
        val stale = signedUrl(authDate = (System.currentTimeMillis() / 1000L) - 200_000L)
        assertFalse(client(secret).isLaunchHashAuthorized(stale))
    }

    @Test
    fun urlsWithoutLaunchHashAreUnaffected() {
        val plain = "https://appassets.androidplatform.net/assets/index.html"
        assertTrue(client(secret).isLaunchHashAuthorized(plain))
        assertTrue(client(secret).isLaunchHashAuthorized("$plain#section-2"))
    }

    @Test
    fun gateIsInertWhenNoSecretConfigured() {
        val tampered = signedUrl().replace("user=dara", "user=mallory")
        assertTrue(client(null).isLaunchHashAuthorized(tampered))
    }
}
