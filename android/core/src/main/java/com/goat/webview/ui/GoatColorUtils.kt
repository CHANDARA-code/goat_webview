package com.goat.webview.ui

/**
 * Compose-free color helpers. Previously nested inside `GoatNavigationBar.kt`, which meant the
 * non-Compose bridge action handler could not reach it without the Compose runtime coming along.
 */
object GoatColorUtils {
    /**
     * Parses a hex color string (#RGB, #ARGB, #RRGGBB, #AARRGGBB) into an ARGB Int.
     * Throws [IllegalArgumentException] with code INVALID_ARGUMENT if the format is invalid.
     */
    fun parseHexColor(hexString: String, defaultColor: Int = 0xFF000000.toInt()): Int {
        val trimmed = hexString.trim()
        if (trimmed.isEmpty()) return defaultColor

        val sanitized = if (trimmed.startsWith("#")) trimmed.substring(1) else trimmed
        if (sanitized.isEmpty() || !sanitized.all { it in '0'..'9' || it in 'a'..'f' || it in 'A'..'F' }) {
            throw IllegalArgumentException("INVALID_ARGUMENT: backgroundColor must be a valid hex string: $hexString")
        }

        return when (sanitized.length) {
            3 -> {
                val r = sanitized[0]
                val g = sanitized[1]
                val b = sanitized[2]
                val rVal = "$r$r".toInt(16)
                val gVal = "$g$g".toInt(16)
                val bVal = "$b$b".toInt(16)
                (0xFF shl 24) or (rVal shl 16) or (gVal shl 8) or bVal
            }
            4 -> {
                val a = sanitized[0]
                val r = sanitized[1]
                val g = sanitized[2]
                val b = sanitized[3]
                val aVal = "$a$a".toInt(16)
                val rVal = "$r$r".toInt(16)
                val gVal = "$g$g".toInt(16)
                val bVal = "$b$b".toInt(16)
                (aVal shl 24) or (rVal shl 16) or (gVal shl 8) or bVal
            }
            6 -> {
                val rVal = sanitized.substring(0, 2).toInt(16)
                val gVal = sanitized.substring(2, 4).toInt(16)
                val bVal = sanitized.substring(4, 6).toInt(16)
                (0xFF shl 24) or (rVal shl 16) or (gVal shl 8) or bVal
            }
            8 -> {
                val aVal = sanitized.substring(0, 2).toLong(16).toInt()
                val rVal = sanitized.substring(2, 4).toInt(16)
                val gVal = sanitized.substring(4, 6).toInt(16)
                val bVal = sanitized.substring(6, 8).toInt(16)
                (aVal shl 24) or (rVal shl 16) or (gVal shl 8) or bVal
            }
            else -> {
                throw IllegalArgumentException("INVALID_ARGUMENT: backgroundColor must be a valid hex string: $hexString")
            }
        }
    }
}
