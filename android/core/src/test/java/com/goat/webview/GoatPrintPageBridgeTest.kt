package com.goat.webview

import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.boolean
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Bridge wiring tests for Task 10185 (nativePrintAndPdfExportController): PRINT_PAGE for both
 * `SYSTEM_SHEET` and `EXPORT_PDF` modes.
 */
class GoatPrintPageBridgeTest {

    private val context = FakeTestContext()

    @Test
    fun `PRINT_PAGE with no host callback wired fails instead of silently succeeding`() = runTest {
        val handler = GoatBridgeActionHandler(context = context, appId = "test_print")

        val result = handler.executeAction("PRINT_PAGE", buildJsonObject { put("jobName", "Invoice-1042"); put("mode", "SYSTEM_SHEET") })

        assertTrue(result.isFailure)
    }

    @Test
    fun `PRINT_PAGE without a jobName throws IllegalArgumentException`() = runTest {
        val handler = GoatBridgeActionHandler(
            context = context,
            appId = "test_print",
            onPrintPage = { _, _ -> buildJsonObject { put("shown", true) } }
        )

        val result = handler.executeAction("PRINT_PAGE", buildJsonObject { put("mode", "SYSTEM_SHEET") })

        assertTrue(result.isFailure)
    }

    @Test
    fun `PRINT_PAGE delegates jobName and mode to the host callback and returns its result`() = runTest {
        var receivedJobName: String? = null
        var receivedMode: String? = null
        val handler = GoatBridgeActionHandler(
            context = context,
            appId = "test_print",
            onPrintPage = { jobName, mode ->
                receivedJobName = jobName
                receivedMode = mode
                buildJsonObject { put("pdfUri", "goat://fs/exports/invoice-1042.pdf") }
            }
        )

        val result = handler.executeAction(
            "PRINT_PAGE",
            buildJsonObject { put("jobName", "Invoice-1042"); put("mode", "EXPORT_PDF") }
        )

        assertTrue(result.isSuccess)
        assertEquals("Invoice-1042", receivedJobName)
        assertEquals("EXPORT_PDF", receivedMode)
        assertEquals("goat://fs/exports/invoice-1042.pdf", result.getOrNull()?.get("pdfUri")?.jsonPrimitive?.content)
    }

    @Test
    fun `PRINT_PAGE defaults mode to SYSTEM_SHEET when omitted`() = runTest {
        var receivedMode: String? = null
        val handler = GoatBridgeActionHandler(
            context = context,
            appId = "test_print",
            onPrintPage = { _, mode ->
                receivedMode = mode
                buildJsonObject { put("shown", true) }
            }
        )

        handler.executeAction("PRINT_PAGE", buildJsonObject { put("jobName", "Invoice-1042") })

        assertEquals("SYSTEM_SHEET", receivedMode)
    }

    @Test
    fun `PRINT_PAGE SYSTEM_SHEET result reports whether the sheet was shown`() = runTest {
        val handler = GoatBridgeActionHandler(
            context = context,
            appId = "test_print",
            onPrintPage = { _, _ -> buildJsonObject { put("shown", true) } }
        )

        val result = handler.executeAction(
            "PRINT_PAGE",
            buildJsonObject { put("jobName", "Invoice-1042"); put("mode", "SYSTEM_SHEET") }
        )

        assertTrue(result.isSuccess)
        assertEquals(true, result.getOrNull()?.get("shown")?.jsonPrimitive?.boolean)
    }

    @Test
    fun `PRINT_PAGE is included in SUPPORTED_ACTIONS`() {
        assertTrue(GoatBridgeActionHandler.SUPPORTED_ACTIONS.contains("PRINT_PAGE"))
    }
}
