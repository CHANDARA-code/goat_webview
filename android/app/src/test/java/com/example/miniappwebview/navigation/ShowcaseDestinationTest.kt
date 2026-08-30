package com.example.miniappwebview.navigation

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

class ShowcaseDestinationTest {

    @Test
    fun `test all 5 showcase destinations exist with required contracts`() {
        val destinations = ShowcaseDestination.entries
        assertEquals("Should have exactly 5 destinations", 5, destinations.size)

        val appIds = destinations.map { it.appId }.toSet()
        assertTrue(appIds.contains("com.goat.ecommerce"))
        assertTrue(appIds.contains("com.goat.iot"))
        assertTrue(appIds.contains("com.goat.fieldservice"))
        assertTrue(appIds.contains("com.goat.vault"))
        assertTrue(appIds.contains("com.goat.diagnostics"))

        val routes = destinations.map { it.route }.toSet()
        assertTrue(routes.contains("#/ecommerce"))
        assertTrue(routes.contains("#/iot"))
        assertTrue(routes.contains("#/fieldservice"))
        assertTrue(routes.contains("#/vault"))
        assertTrue(routes.contains("#/diagnostics"))
    }

    @Test
    fun `test destination lookup by id and appId`() {
        assertEquals(ShowcaseDestination.ECOMMERCE, ShowcaseDestination.fromId("ecommerce"))
        assertEquals(ShowcaseDestination.IOT, ShowcaseDestination.fromId("iot"))
        assertEquals(ShowcaseDestination.FIELD_SERVICE, ShowcaseDestination.fromId("fieldservice"))
        assertEquals(ShowcaseDestination.VAULT, ShowcaseDestination.fromId("vault"))
        assertEquals(ShowcaseDestination.DIAGNOSTICS, ShowcaseDestination.fromId("diagnostics"))

        // Lookup by appId
        assertEquals(ShowcaseDestination.ECOMMERCE, ShowcaseDestination.fromAppId("com.goat.ecommerce"))
        assertEquals(ShowcaseDestination.IOT, ShowcaseDestination.fromAppId("com.goat.iot"))
        assertEquals(ShowcaseDestination.FIELD_SERVICE, ShowcaseDestination.fromAppId("com.goat.fieldservice"))
        assertEquals(ShowcaseDestination.VAULT, ShowcaseDestination.fromAppId("com.goat.vault"))
        assertEquals(ShowcaseDestination.DIAGNOSTICS, ShowcaseDestination.fromAppId("com.goat.diagnostics"))

        // Fallback on unknown
        assertEquals(ShowcaseDestination.ECOMMERCE, ShowcaseDestination.fromId("unknown_id"))
        assertEquals(ShowcaseDestination.ECOMMERCE, ShowcaseDestination.fromAppId(null))
    }

    @Test
    fun `test destination badges and metadata`() {
        destinationsHaveNonEmptyLabels()
    }

    private fun destinationsHaveNonEmptyLabels() {
        for (dest in ShowcaseDestination.entries) {
            assertTrue("Title should not be blank", dest.title.isNotBlank())
            assertTrue("Short label should not be blank", dest.shortLabel.isNotBlank())
            assertTrue("Badge should not be blank", dest.badge.isNotBlank())
            assertTrue("Description should not be blank", dest.description.isNotBlank())
            assertNotNull("Icon should be defined", dest.icon)
        }
    }
}
