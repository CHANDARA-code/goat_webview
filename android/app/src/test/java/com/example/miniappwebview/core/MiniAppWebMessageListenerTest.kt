package com.example.miniappwebview.core

import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class MiniAppWebMessageListenerTest {

    @Test
    fun `test bridge request JSON parsing`() {
        val rawJson = """
            {
                "id": "req_1718900000_abc123",
                "action": "STORAGE_SET",
                "payload": {
                    "key": "theme_mode",
                    "value": "dark"
                }
            }
        """.trimIndent()

        val json = Json.parseToJsonElement(rawJson).jsonObject
        val id = json["id"]?.jsonPrimitive?.content
        val action = json["action"]?.jsonPrimitive?.content
        val payload = json["payload"]?.jsonObject

        assertEquals("req_1718900000_abc123", id)
        assertEquals("STORAGE_SET", action)
        assertNotNull(payload)
        assertEquals("theme_mode", payload?.get("key")?.jsonPrimitive?.content)
        assertEquals("dark", payload?.get("value")?.jsonPrimitive?.content)
    }

    @Test
    fun `test bridge success response serialization`() {
        val requestId = "req_1718900000_abc123"
        val dataResult = buildJsonObject {
            put("saved", true)
            put("key", "theme_mode")
        }

        val responseJson = buildJsonObject {
            put("id", requestId)
            put("success", true)
            put("data", dataResult)
        }

        val serialized = responseJson.toString()
        val parsed = Json.parseToJsonElement(serialized).jsonObject

        assertEquals(requestId, parsed["id"]?.jsonPrimitive?.content)
        assertEquals("true", parsed["success"]?.jsonPrimitive?.content)
        assertEquals("true", parsed["data"]?.jsonObject?.get("saved")?.jsonPrimitive?.content)
        assertEquals("theme_mode", parsed["data"]?.jsonObject?.get("key")?.jsonPrimitive?.content)
    }

    @Test
    fun `test bridge error response serialization`() {
        val requestId = "req_1718900000_error99"
        val errorMessage = "Unsupported native action: UNKNOWN_ACTION"

        val responseJson = buildJsonObject {
            put("id", requestId)
            put("success", false)
            put("error", errorMessage)
        }

        val serialized = responseJson.toString()
        val parsed = Json.parseToJsonElement(serialized).jsonObject

        assertEquals(requestId, parsed["id"]?.jsonPrimitive?.content)
        assertEquals("false", parsed["success"]?.jsonPrimitive?.content)
        assertEquals(errorMessage, parsed["error"]?.jsonPrimitive?.content)
    }
}
