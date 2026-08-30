package com.goat.webview.util

import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.floatOrNull
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.longOrNull

/**
 * Type-safe JSON extraction helper extensions to prevent [IllegalStateException]
 * and [ClassCastException] on unexpected/malformed JSON shapes.
 */

val JsonPrimitive.contentOrNull: String?
    get() = if (this is JsonNull) null else content

fun JsonObject.getOptionalString(key: String): String? =
    (this[key] as? JsonPrimitive)?.contentOrNull

fun JsonObject.getRequiredString(key: String, actionName: String = "ACTION"): String =
    getOptionalString(key) ?: throw IllegalArgumentException("Missing required parameter '$key' for action '$actionName'")

fun JsonObject.getOptionalBoolean(key: String): Boolean? =
    (this[key] as? JsonPrimitive)?.booleanOrNull

fun JsonObject.getOptionalInt(key: String): Int? =
    (this[key] as? JsonPrimitive)?.intOrNull ?: (this[key] as? JsonPrimitive)?.contentOrNull?.toIntOrNull()

fun JsonObject.getOptionalLong(key: String): Long? =
    (this[key] as? JsonPrimitive)?.longOrNull ?: (this[key] as? JsonPrimitive)?.contentOrNull?.toLongOrNull()

fun JsonObject.getOptionalDouble(key: String): Double? =
    (this[key] as? JsonPrimitive)?.doubleOrNull ?: (this[key] as? JsonPrimitive)?.contentOrNull?.toDoubleOrNull()

fun JsonObject.getOptionalFloat(key: String): Float? =
    (this[key] as? JsonPrimitive)?.floatOrNull ?: (this[key] as? JsonPrimitive)?.contentOrNull?.toFloatOrNull()

fun JsonObject.getJsonObjectOrNull(key: String): JsonObject? =
    this[key] as? JsonObject

fun JsonObject.getJsonArrayOrNull(key: String): JsonArray? =
    this[key] as? JsonArray

fun JsonObject.getStringList(key: String): List<String> =
    (this[key] as? JsonArray)?.mapNotNull { (it as? JsonPrimitive)?.contentOrNull } ?: emptyList()

fun JsonArray.mapStrings(): List<String> =
    mapNotNull { (it as? JsonPrimitive)?.contentOrNull }
