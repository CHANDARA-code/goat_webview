package com.example.miniappwebview.navigation

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Build
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Place
import androidx.compose.material.icons.filled.Share
import androidx.compose.material.icons.filled.ShoppingCart
import androidx.compose.ui.graphics.vector.ImageVector

/**
 * The 5 Core Showcase Mini-App Destinations for the Android SuperApp (R2 & R1).
 * Each destination maps to an isolated multi-tenant appId, hash route, and capability domain.
 */
enum class ShowcaseDestination(
    val id: String,
    val appId: String,
    val route: String,
    val title: String,
    val shortLabel: String,
    val badge: String,
    val icon: ImageVector,
    val description: String
) {
    ECOMMERCE(
        id = "ecommerce",
        appId = "com.goat.ecommerce",
        route = "#/ecommerce",
        title = "E-Commerce & Payments",
        shortLabel = "E-Commerce",
        badge = "Pay",
        icon = Icons.Default.ShoppingCart,
        description = "Native checkout bottom-sheet, Apple/Google Pay, multi-rail Bakong/Alipay"
    ),
    IOT(
        id = "iot",
        appId = "com.goat.iot",
        route = "#/iot",
        title = "IoT & BLE Dashboard",
        shortLabel = "IoT & BLE",
        badge = "BLE",
        icon = Icons.Default.Share,
        description = "BLE GATT scanning/connection, NFC NDEF read/write, 3D motion orientation"
    ),
    FIELD_SERVICE(
        id = "fieldservice",
        appId = "com.goat.fieldservice",
        route = "#/fieldservice",
        title = "Field Service & Nav",
        shortLabel = "Field Service",
        badge = "GPS",
        icon = Icons.Default.Place,
        description = "Real-time GPS tracking, circular geofencing, QR scanner, audio memos"
    ),
    VAULT(
        id = "vault",
        appId = "com.goat.vault",
        route = "#/vault",
        title = "Secure Biometric Vault",
        shortLabel = "Vault",
        badge = "AES-256",
        icon = Icons.Default.Lock,
        description = "Biometric gate, hardware KeyStore AES-256-GCM, isolated sandbox filesystem"
    ),
    DIAGNOSTICS(
        id = "diagnostics",
        appId = "com.goat.diagnostics",
        route = "#/diagnostics",
        title = "Diagnostics & APM",
        shortLabel = "Diagnostics",
        badge = "HUD",
        icon = Icons.Default.Build,
        description = "Bridge telemetry inspector, warm-path latency gauges, hardware overrides"
    );

    companion object {
        fun fromId(id: String?): ShowcaseDestination {
            return entries.firstOrNull { it.id.equals(id, ignoreCase = true) } ?: ECOMMERCE
        }

        fun fromAppId(appId: String?): ShowcaseDestination {
            return entries.firstOrNull { it.appId.equals(appId, ignoreCase = true) } ?: ECOMMERCE
        }
    }
}
