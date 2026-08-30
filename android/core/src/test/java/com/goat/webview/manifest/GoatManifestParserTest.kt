package com.goat.webview.manifest

import android.content.pm.ActivityInfo
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test

class GoatManifestParserTest {

    private val fullManifest = """
        {
          "appId": "com.goat.shop",
          "version": "2.3.1",
          "entrypoint": "pages/home.html",
          "window": {
            "navigationBarTitleText": "Goat Shop",
            "navigationBarBackgroundColor": "#1A2B3C",
            "navigationBarTextStyle": "white",
            "orientation": "landscape"
          },
          "permissions": { "requiredScopes": ["camera", "location", " storage "] },
          "security": { "allowedDomains": ["api.goat.dev", "cdn.goat.dev"] }
        }
    """.trimIndent()

    @Test
    fun parsesValidManifestIntoTypedModel() {
        val manifest = GoatManifestParser.parseManifest(fullManifest)
        assertEquals("com.goat.shop", manifest.appId)
        assertEquals("2.3.1", manifest.version)
        assertEquals("pages/home.html", manifest.entrypoint)
        assertEquals("Goat Shop", manifest.window.navigationBarTitleText)
        assertEquals("#1A2B3C", manifest.window.navigationBarBackgroundColor)
        assertEquals(listOf("camera", "location", "storage"), manifest.requiredScopes)
        assertEquals(listOf("api.goat.dev", "cdn.goat.dev"), manifest.allowedDomains)
    }

    @Test
    fun orientationMapsToActivityInfoScreenOrientation() {
        assertEquals(
            ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE,
            GoatManifestParser.parseManifest(fullManifest).window.screenOrientation
        )
        assertEquals(
            ActivityInfo.SCREEN_ORIENTATION_PORTRAIT,
            MiniAppOrientation.fromManifestValue("portrait").screenOrientation
        )
        assertEquals(
            ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED,
            MiniAppOrientation.fromManifestValue("auto").screenOrientation
        )
        assertEquals(MiniAppOrientation.AUTO, MiniAppOrientation.fromManifestValue("sideways"))
        assertEquals(MiniAppOrientation.AUTO, MiniAppOrientation.fromManifestValue(null))
    }

    @Test
    fun missingAppIdThrowsMalformedManifestException() {
        val e = assertThrows(MalformedManifestException::class.java) {
            GoatManifestParser.parseManifest("""{"version":"1.0.0"}""")
        }
        assertTrue(e.message!!.contains("appId"))
    }

    @Test
    fun missingVersionThrowsMalformedManifestException() {
        val e = assertThrows(MalformedManifestException::class.java) {
            GoatManifestParser.parseManifest("""{"appId":"com.goat.x"}""")
        }
        assertTrue(e.message!!.contains("version"))
    }

    @Test
    fun blankMandatoryFieldIsTreatedAsMissing() {
        assertThrows(MalformedManifestException::class.java) {
            GoatManifestParser.parseManifest("""{"appId":"   ","version":"1.0.0"}""")
        }
    }

    @Test
    fun malformedJsonThrowsMalformedManifestException() {
        assertThrows(MalformedManifestException::class.java) {
            GoatManifestParser.parseManifest("{ not json at all ")
        }
    }

    @Test
    fun traversalEntrypointIsRejected() {
        assertThrows(MalformedManifestException::class.java) {
            GoatManifestParser.parseManifest(
                """{"appId":"a","version":"1","entrypoint":"../../etc/passwd"}"""
            )
        }
        assertThrows(MalformedManifestException::class.java) {
            GoatManifestParser.parseManifest(
                """{"appId":"a","version":"1","entrypoint":"https://evil.example.com/x.html"}"""
            )
        }
    }

    @Test
    fun missingOptionalSectionsFallBackToDefaults() {
        val manifest = GoatManifestParser.parseManifest("""{"appId":"com.goat.min","version":"1.0.0"}""")
        assertEquals(MiniAppManifest.DEFAULT_ENTRYPOINT, manifest.entrypoint)
        assertEquals(MiniAppWindowConfig.DEFAULT, manifest.window)
        assertTrue(manifest.requiredScopes.isEmpty())
        assertTrue(manifest.allowedDomains.isEmpty())
    }

    @Test
    fun invalidNavigationBarColorFallsBackToDefault() {
        val manifest = GoatManifestParser.parseManifest(
            """{"appId":"a","version":"1","window":{"navigationBarBackgroundColor":"rgb(1,2,3)"}}"""
        )
        assertEquals(
            MiniAppWindowConfig.DEFAULT_BACKGROUND_COLOR,
            manifest.window.navigationBarBackgroundColor
        )
    }

    @Test
    fun parseManifestOrDefaultNeverThrows() {
        assertEquals("com.goat.fallback", GoatManifestParser.parseManifestOrDefault(null, "com.goat.fallback").appId)
        assertEquals("com.goat.fallback", GoatManifestParser.parseManifestOrDefault("{{{", "com.goat.fallback").appId)
        assertEquals("com.goat.shop", GoatManifestParser.parseManifestOrDefault(fullManifest, "com.goat.fallback").appId)
    }

    @Test
    fun unknownFieldsAreIgnored() {
        val manifest = GoatManifestParser.parseManifest(
            """{"appId":"a","version":"1","futureField":{"nested":true},"tabBar":[1,2]}"""
        )
        assertEquals("a", manifest.appId)
    }
}
