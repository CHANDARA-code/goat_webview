package com.example.miniappwebview.ui

import androidx.compose.animation.Crossfade
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Badge
import androidx.compose.material3.BadgedBox
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.miniappwebview.hud.DebugHudManager
import com.example.miniappwebview.hud.DebugHudOverlay
import com.example.miniappwebview.navigation.ShowcaseDestination
import com.goat.webview.GoatAssetManager
import com.goat.webview.GoatBridgeActionHandler
import com.goat.webview.GoatFastPool
import com.goat.webview.features.GoatPluginRegistry
import com.goat.webview.features.GoatPaymentPluginRegistry
import java.io.File

private val NavBgDark = Color(0xFF0F172A)
private val TopBarBgDark = Color(0xFF020617)
private val AccentCyan = Color(0xFF38BDF8)
private val TextSecondary = Color(0xFF94A3B8)

/**
 * Main Jetpack Compose Host Application Screen (R2).
 * Integrates Material 3 NavigationBar with 5 destinations, GoatFastPool multi-tenant recycling,
 * and the floating Developer Debug HUD (R3).
 */
@Composable
fun ShowcaseScreen(
    onNavigateBack: () -> Unit,
    onThemeChange: (isDark: Boolean) -> Unit,
    onTriggerBiometricPrompt: (() -> Unit)? = null
) {
    val context = LocalContext.current
    val assetManager = remember { GoatAssetManager(context) }
    var assetDir by remember { mutableStateOf<File?>(null) }
    var extractionError by remember { mutableStateOf<String?>(null) }

    var currentDestination by remember { mutableStateOf(ShowcaseDestination.ECOMMERCE) }
    val hudManager = remember { DebugHudManager.shared }

    // Initialize Bridge Action Handler with all feature plugins
    val bridgeActionHandler = remember(context, currentDestination.appId) {
        GoatBridgeActionHandler(
            context = context,
            appId = currentDestination.appId,
            plugins = GoatPluginRegistry.createAllPlugins(context),
            paymentGatewayManager = GoatPaymentPluginRegistry.createGatewayManager(context, currentDestination.appId),
            onNavigateBack = onNavigateBack,
            onThemeChange = onThemeChange
        )
    }

    // Pre-warm FastPool and ensure assets are extracted
    LaunchedEffect(Unit) {
        try {
            GoatFastPool.prewarmPool(context)
            val dir = assetManager.ensureAssetsReady()
            assetDir = dir
        } catch (e: Exception) {
            extractionError = e.message ?: "Failed extracting showcase mini-app bundle"
        }
    }

    Scaffold(
        topBar = {
            ShowcaseTopBar(
                destination = currentDestination,
                onOpenHud = { hudManager.setExpanded(true) }
            )
        },
        bottomBar = {
            ShowcaseNavigationBar(
                currentDestination = currentDestination,
                onDestinationSelected = { dest ->
                    currentDestination = dest
                }
            )
        },
        containerColor = Color(0xFF020617)
    ) { innerPadding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
        ) {
            val dir = assetDir
            when {
                dir != null -> {
                    Crossfade(
                        targetState = currentDestination,
                        label = "MiniAppDestinationCrossfade"
                    ) { destination ->
                        GoatFastPoolContainer(
                            destination = destination,
                            assetDir = dir,
                            hudManager = hudManager,
                            bridgeActionHandler = bridgeActionHandler,
                            modifier = Modifier.fillMaxSize()
                        )
                    }
                }
                extractionError != null -> {
                    Box(
                        modifier = Modifier.fillMaxSize(),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally,
                            modifier = Modifier.padding(24.dp)
                        ) {
                            Text(
                                text = "Mini-App Asset Loading Error",
                                color = Color(0xFFEF4444),
                                fontWeight = FontWeight.Bold,
                                fontSize = 16.sp
                            )
                            Spacer(modifier = Modifier.height(8.dp))
                            Text(
                                text = extractionError ?: "Unknown extraction fault",
                                color = TextSecondary,
                                fontSize = 12.sp
                            )
                        }
                    }
                }
                else -> {
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .background(Color(0xFF020617)),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            CircularProgressIndicator(color = AccentCyan)
                            Spacer(modifier = Modifier.height(16.dp))
                            Text(
                                text = "Initializing Goat FastPool & Sandboxed Assets...",
                                color = TextSecondary,
                                fontSize = 12.sp
                            )
                        }
                    }
                }
            }

            // Floating Developer Debug HUD Overlay
            DebugHudOverlay(
                manager = hudManager,
                currentAppId = currentDestination.appId,
                onTriggerBiometricAuth = onTriggerBiometricPrompt
            )
        }
    }
}

@Composable
private fun ShowcaseTopBar(
    destination: ShowcaseDestination,
    onOpenHud: () -> Unit
) {
    Surface(
        color = TopBarBgDark,
        shadowElevation = 4.dp
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Column {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = "Goat SuperApp",
                        color = Color.White,
                        fontWeight = FontWeight.ExtraBold,
                        fontSize = 17.sp
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(4.dp))
                            .background(Color(0xFF0369A1))
                            .padding(horizontal = 6.dp, vertical = 2.dp)
                    ) {
                        Text(
                            text = destination.badge,
                            color = Color.White,
                            fontWeight = FontWeight.Bold,
                            fontSize = 10.sp
                        )
                    }
                }
                Text(
                    text = destination.title,
                    color = TextSecondary,
                    fontSize = 12.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }

            // FastPool status & HUD Shortcut Pill
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                // FastPool Indicator
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(12.dp))
                        .background(Color(0xFF1E293B))
                        .border(1.dp, Color(0xFF334155), RoundedCornerShape(12.dp))
                        .padding(horizontal = 8.dp, vertical = 4.dp)
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            modifier = Modifier
                                .size(6.dp)
                                .clip(CircleShape)
                                .background(Color(0xFF10B981))
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(
                            text = "FastPool",
                            color = Color(0xFF94A3B8),
                            fontSize = 10.sp,
                            fontFamily = FontFamily.Monospace,
                            fontWeight = FontWeight.SemiBold
                        )
                    }
                }

                // HUD Button
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(12.dp))
                        .background(Color(0xFF0F172A))
                        .border(1.dp, AccentCyan.copy(alpha = 0.6f), RoundedCornerShape(12.dp))
                        .clickable { onOpenHud() }
                        .padding(horizontal = 8.dp, vertical = 4.dp)
                ) {
                    Text(
                        text = "HUD ⚡",
                        color = AccentCyan,
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
            }
        }
    }
}

@Composable
private fun ShowcaseNavigationBar(
    currentDestination: ShowcaseDestination,
    onDestinationSelected: (ShowcaseDestination) -> Unit
) {
    NavigationBar(
        containerColor = NavBgDark,
        contentColor = Color.White
    ) {
        ShowcaseDestination.entries.forEach { destination ->
            val isSelected = currentDestination == destination

            NavigationBarItem(
                selected = isSelected,
                onClick = { onDestinationSelected(destination) },
                icon = {
                    Icon(
                        imageVector = destination.icon,
                        contentDescription = destination.title,
                        modifier = Modifier.size(22.dp)
                    )
                },
                label = {
                    Text(
                        text = destination.shortLabel,
                        fontSize = 11.sp,
                        fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal
                    )
                },
                colors = NavigationBarItemDefaults.colors(
                    selectedIconColor = AccentCyan,
                    selectedTextColor = AccentCyan,
                    unselectedIconColor = Color(0xFF64748B),
                    unselectedTextColor = Color(0xFF64748B),
                    indicatorColor = Color(0xFF1E293B)
                )
            )
        }
    }
}
