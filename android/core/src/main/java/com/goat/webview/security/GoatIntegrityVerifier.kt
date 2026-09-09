package com.goat.webview.security

import android.util.Base64
import java.io.File
import java.io.FileInputStream
import java.io.InputStream
import java.security.MessageDigest
import java.security.SecureRandom

object GoatIntegrityVerifier {

    private val secureRandom = SecureRandom()

    fun generateCspNonce(byteCount: Int = 16): String {
        val bytes = ByteArray(byteCount)
        secureRandom.nextBytes(bytes)
        return encodeBase64(bytes)
    }

    fun injectDynamicCspNonce(html: String, nonce: String): String {
        var result = html

        val scriptPattern = Regex("<script(\\s+[^>]*|)>", RegexOption.IGNORE_CASE)
        result = scriptPattern.replace(result) { matchResult ->
            val attrs = matchResult.groupValues[1]
            if (attrs.contains(Regex("""\bnonce\s*=""", RegexOption.IGNORE_CASE))) {
                val replacedAttrs = attrs.replace(
                    Regex("""nonce\s*=\s*["'][^"']*["']""", RegexOption.IGNORE_CASE),
                    """nonce="$nonce""""
                )
                "<script$replacedAttrs>"
            } else {
                "<script nonce=\"$nonce\"$attrs>"
            }
        }

        val metaCspPattern = Regex(
            """<meta\s+([^>]*http-equiv\s*=\s*["']Content-Security-Policy["'][^>]*)>""",
            RegexOption.IGNORE_CASE
        )

        val metaMatch = metaCspPattern.find(result)
        if (metaMatch != null) {
            val fullMeta = metaMatch.value
            val contentPattern = Regex("""content\s*=\s*(["'])(.*?)\1""", RegexOption.IGNORE_CASE)
            val contentMatch = contentPattern.find(fullMeta)
            if (contentMatch != null) {
                val quote = contentMatch.groupValues[1]
                val originalContent = contentMatch.groupValues[2]
                val updatedContent = injectNonceIntoCspDirective(originalContent, nonce)
                val updatedMeta = fullMeta.replace(contentMatch.value, "content=$quote$updatedContent$quote")
                result = result.replace(fullMeta, updatedMeta)
            }
        } else {
            val defaultCspMeta = """<meta http-equiv="Content-Security-Policy" content="default-src 'self' https://appassets.androidplatform.net; script-src 'nonce-$nonce' 'strict-dynamic' 'self' https: 'unsafe-inline'; style-src 'self' 'unsafe-inline';">"""
            val headPattern = Regex("""<head(\s+[^>]*)?>""", RegexOption.IGNORE_CASE)
            val headMatch = headPattern.find(result)
            if (headMatch != null) {
                val insertIndex = headMatch.range.last + 1
                result = result.substring(0, insertIndex) + defaultCspMeta + result.substring(insertIndex)
            } else {
                val htmlPattern = Regex("""<html(\s+[^>]*)?>""", RegexOption.IGNORE_CASE)
                val htmlMatch = htmlPattern.find(result)
                if (htmlMatch != null) {
                    val insertIndex = htmlMatch.range.last + 1
                    result = result.substring(0, insertIndex) + defaultCspMeta + result.substring(insertIndex)
                } else {
                    result = defaultCspMeta + result
                }
            }
        }

        return result
    }

    private fun injectNonceIntoCspDirective(csp: String, nonce: String): String {
        val nonceDirective = "'nonce-$nonce' 'strict-dynamic'"
        val scriptSrcPattern = Regex("""\bscript-src\b([^;]*)""", RegexOption.IGNORE_CASE)
        val match = scriptSrcPattern.find(csp)
        return if (match != null) {
            val existingDirectives = match.groupValues[1].trim()
            val cleanedDirectives = existingDirectives.replace(
                Regex("""'nonce-[^']*'""", RegexOption.IGNORE_CASE),
                ""
            ).replace(
                Regex("""'strict-dynamic'""", RegexOption.IGNORE_CASE),
                ""
            ).trim()
            val replacement = if (cleanedDirectives.isNotEmpty()) {
                "script-src $nonceDirective $cleanedDirectives"
            } else {
                "script-src $nonceDirective"
            }
            csp.replace(match.value, replacement)
        } else {
            val trimmed = csp.trim()
            if (trimmed.endsWith(";")) {
                "$trimmed script-src $nonceDirective 'self';"
            } else if (trimmed.isNotEmpty()) {
                "$trimmed; script-src $nonceDirective 'self';"
            } else {
                "script-src $nonceDirective 'self';"
            }
        }
    }

    fun computeSriHash(bytes: ByteArray, algorithm: String = "SHA-384"): String {
        val stdAlg = normalizeAlgorithm(algorithm)
        val digest = MessageDigest.getInstance(stdAlg)
        val hash = digest.digest(bytes)
        return "${prefixForAlgorithm(stdAlg)}${encodeBase64(hash)}"
    }

    fun computeSriHash(file: File, algorithm: String = "SHA-384"): String {
        val stdAlg = normalizeAlgorithm(algorithm)
        val digest = MessageDigest.getInstance(stdAlg)
        FileInputStream(file).use { fis ->
            val buffer = ByteArray(8192)
            var read: Int
            while (fis.read(buffer).also { read = it } != -1) {
                digest.update(buffer, 0, read)
            }
        }
        return "${prefixForAlgorithm(stdAlg)}${encodeBase64(digest.digest())}"
    }

    fun computeSriHash(stream: InputStream, algorithm: String = "SHA-384"): String {
        val stdAlg = normalizeAlgorithm(algorithm)
        val digest = MessageDigest.getInstance(stdAlg)
        val buffer = ByteArray(8192)
        var read: Int
        while (stream.read(buffer).also { read = it } != -1) {
            digest.update(buffer, 0, read)
        }
        return "${prefixForAlgorithm(stdAlg)}${encodeBase64(digest.digest())}"
    }

    fun verifySriHash(bytes: ByteArray, expectedSha: String): Boolean {
        val parsed = parseSriHash(expectedSha) ?: return false
        val digest = MessageDigest.getInstance(parsed.first)
        val computedHashBytes = digest.digest(bytes)
        return MessageDigest.isEqual(computedHashBytes, parsed.second)
    }

    fun verifySriHash(file: File, expectedSha: String): Boolean {
        if (!file.exists() || !file.isFile) return false
        val parsed = parseSriHash(expectedSha) ?: return false
        val digest = MessageDigest.getInstance(parsed.first)
        FileInputStream(file).use { fis ->
            val buffer = ByteArray(8192)
            var read: Int
            while (fis.read(buffer).also { read = it } != -1) {
                digest.update(buffer, 0, read)
            }
        }
        val computedHashBytes = digest.digest()
        return MessageDigest.isEqual(computedHashBytes, parsed.second)
    }

    fun verifySriHash(stream: InputStream, expectedSha: String): Boolean {
        val parsed = parseSriHash(expectedSha) ?: return false
        val digest = MessageDigest.getInstance(parsed.first)
        val buffer = ByteArray(8192)
        var read: Int
        while (stream.read(buffer).also { read = it } != -1) {
            digest.update(buffer, 0, read)
        }
        val computedHashBytes = digest.digest()
        return MessageDigest.isEqual(computedHashBytes, parsed.second)
    }

    fun verifySriManifest(
        manifest: Map<String, String>,
        assetResolver: (String) -> ByteArray?
    ): Map<String, Boolean> {
        val results = mutableMapOf<String, Boolean>()
        for ((path, expectedHash) in manifest) {
            val bytes = assetResolver(path)
            results[path] = if (bytes != null) {
                verifySriHash(bytes, expectedHash)
            } else {
                false
            }
        }
        return results
    }

    private fun normalizeAlgorithm(algo: String): String {
        return when (algo.trim().lowercase().replace("-", "")) {
            "sha256" -> "SHA-256"
            "sha384" -> "SHA-384"
            "sha512" -> "SHA-512"
            else -> throw IllegalArgumentException("Unsupported SRI algorithm: $algo")
        }
    }

    private fun prefixForAlgorithm(stdAlg: String): String {
        return when (stdAlg) {
            "SHA-256" -> "sha256-"
            "SHA-384" -> "sha384-"
            "SHA-512" -> "sha512-"
            else -> throw IllegalArgumentException("Unsupported algorithm: $stdAlg")
        }
    }

    private fun parseSriHash(sri: String): Pair<String, ByteArray>? {
        val trimmed = sri.trim()
        val hyphenIdx = trimmed.indexOf('-')
        if (hyphenIdx <= 0 || hyphenIdx >= trimmed.length - 1) return null
        val prefix = trimmed.substring(0, hyphenIdx).lowercase()
        val stdAlg = when (prefix) {
            "sha256" -> "SHA-256"
            "sha384" -> "SHA-384"
            "sha512" -> "SHA-512"
            else -> return null
        }
        val base64Str = trimmed.substring(hyphenIdx + 1).trim()
        val bytes = decodeBase64(base64Str) ?: return null
        return Pair(stdAlg, bytes)
    }

    private fun encodeBase64(bytes: ByteArray): String {
        return try {
            java.util.Base64.getEncoder().encodeToString(bytes).trim()
        } catch (e: Throwable) {
            Base64.encodeToString(bytes, Base64.NO_WRAP).trim()
        }
    }

    private fun decodeBase64(base64Str: String): ByteArray? {
        return try {
            java.util.Base64.getDecoder().decode(base64Str)
        } catch (e: Throwable) {
            try {
                Base64.decode(base64Str, Base64.NO_WRAP)
            } catch (e2: Throwable) {
                null
            }
        }
    }
}

