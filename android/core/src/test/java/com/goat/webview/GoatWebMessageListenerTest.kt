package com.goat.webview

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class GoatWebMessageListenerTest {

    @Test
    fun `test bridge request JSON parsing via helper`() {
        val rawJson = """
            {
                "id": "req_1718900000_goat1",
                "action": "STORAGE_SET",
                "payload": {
                    "key": "theme_mode",
                    "value": "dark"
                }
            }
        """.trimIndent()

        val (id, action, payload) = GoatWebMessageListener.parseMessage(rawJson)

        assertEquals("req_1718900000_goat1", id)
        assertEquals("STORAGE_SET", action)
        assertNotNull(payload)
        assertEquals("theme_mode", payload["key"]?.jsonPrimitive?.content)
        assertEquals("dark", payload["value"]?.jsonPrimitive?.content)
    }

    @Test
    fun `test bridge success response serialization matches schema`() {
        val requestId = "req_1718900000_goat1"
        val dataResult = buildJsonObject {
            put("saved", true)
            put("key", "theme_mode")
        }

        val responseJson = GoatWebMessageListener.buildResponse(requestId, Result.success(dataResult))
        val serialized = responseJson.toString()
        val parsed = Json.parseToJsonElement(serialized).jsonObject

        assertEquals(requestId, parsed["id"]?.jsonPrimitive?.content)
        assertEquals("true", parsed["success"]?.jsonPrimitive?.content)
        assertEquals("true", parsed["data"]?.jsonObject?.get("saved")?.jsonPrimitive?.content)
        assertEquals("theme_mode", parsed["data"]?.jsonObject?.get("key")?.jsonPrimitive?.content)
        // Schema requires null error on success
        val errorElement = parsed["error"]
        assertTrue(errorElement == null || errorElement.toString() == "null")
    }

    @Test
    fun `test bridge error response serialization matches schema`() {
        val requestId = "req_1718900000_error99"
        val errorMessage = "Unsupported native action: UNKNOWN_ACTION"

        val responseJson = GoatWebMessageListener.buildResponse(
            requestId,
            Result.failure(IllegalArgumentException(errorMessage))
        )
        val serialized = responseJson.toString()
        val parsed = Json.parseToJsonElement(serialized).jsonObject

        assertEquals(requestId, parsed["id"]?.jsonPrimitive?.content)
        assertEquals("false", parsed["success"]?.jsonPrimitive?.content)
        assertEquals(errorMessage, parsed["error"]?.jsonPrimitive?.content)
        // Schema requires null data on error
        val dataElement = parsed["data"]
        assertTrue(dataElement == null || dataElement.toString() == "null")
    }
}
