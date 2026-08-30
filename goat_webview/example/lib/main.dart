import 'package:flutter/material.dart';
import 'package:goat_webview/goat_webview.dart';
import 'package:goat_webview_biometrics/goat_webview_biometrics.dart';
import 'package:goat_webview_bluetooth/goat_webview_bluetooth.dart';
import 'package:goat_webview_location/goat_webview_location.dart';
import 'package:goat_webview_media/goat_webview_media.dart';
import 'package:goat_webview_network/goat_webview_network.dart';
import 'package:goat_webview_payments/goat_webview_payments.dart';
import 'package:goat_webview_scanner/goat_webview_scanner.dart';

import 'models/mini_app_tab.dart';
import 'widgets/debug_hud.dart';
import 'widgets/showcase_tabs.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // 1. Register all 7 modular companion capability plugins via SPI (Task 10202)
  GoatBiometricsCapabilityPlugin.register();
  GoatBluetoothCapabilityPlugin.register();
  GoatLocationCapabilityPlugin.register();
  GoatMediaCapabilityPlugin.register();
  GoatNetworkCapabilityPlugin.register();
  GoatPaymentsCapabilityPlugin.register();
  GoatScannerCapabilityPlugin.register();

  // 2. Pre-warm Chromium engine during app startup for <15ms warm start
  await GoatWebViewEngine.prewarm();

  runApp(const GoatSuperAppShowcase());
}

/// Root Application for the Flutter SuperApp Showcase.
class GoatSuperAppShowcase extends StatefulWidget {
  const GoatSuperAppShowcase({super.key});

  @override
  State<GoatSuperAppShowcase> createState() => _GoatSuperAppShowcaseState();
}

class _GoatSuperAppShowcaseState extends State<GoatSuperAppShowcase> {
  ThemeMode _themeMode = ThemeMode.dark;

  void _toggleTheme() {
    setState(() {
      _themeMode =
          _themeMode == ThemeMode.dark ? ThemeMode.light : ThemeMode.dark;
    });
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Goat WebView SuperApp Showcase',
      debugShowCheckedModeBanner: false,
      themeMode: _themeMode,
      theme: ThemeData(
        brightness: Brightness.light,
        colorSchemeSeed: const Color(0xFF6366F1),
        scaffoldBackgroundColor: const Color(0xFFF8FAFC),
        useMaterial3: true,
      ),
      darkTheme: ThemeData(
        brightness: Brightness.dark,
        colorSchemeSeed: const Color(0xFF6366F1),
        scaffoldBackgroundColor: const Color(0xFF0F172A),
        useMaterial3: true,
      ),
      home: ShowcaseMainScreen(
        onToggleTheme: _toggleTheme,
        isDarkMode: _themeMode == ThemeMode.dark,
      ),
    );
  }
}

/// Main Screen with Material 3 NavigationBar and Floating Developer Debug HUD.
class ShowcaseMainScreen extends StatefulWidget {
  final VoidCallback onToggleTheme;
  final bool isDarkMode;

  const ShowcaseMainScreen({
    super.key,
    required this.onToggleTheme,
    required this.isDarkMode,
  });

  @override
  State<ShowcaseMainScreen> createState() => _ShowcaseMainScreenState();
}

class _ShowcaseMainScreenState extends State<ShowcaseMainScreen> {
  int _selectedTabIndex = 0;

  @override
  Widget build(BuildContext context) {
    const tabs = MiniAppTabInfo.allTabs;
    final activeTab = tabs[_selectedTabIndex];

    return FloatingDebugHud(
      child: Scaffold(
        body: IndexedStack(
          index: _selectedTabIndex,
          children: tabs.map((tab) {
            return MiniAppHostContainer(
              key: ValueKey(tab.appId),
              tabInfo: tab,
              isDarkMode: widget.isDarkMode,
              onToggleTheme: widget.onToggleTheme,
            );
          }).toList(),
        ),
        bottomNavigationBar: NavigationBar(
          selectedIndex: _selectedTabIndex,
          onDestinationSelected: (index) {
            setState(() {
              _selectedTabIndex = index;
            });
          },
          indicatorColor: activeTab.accentColor.withValues(alpha: 0.25),
          destinations: tabs.map((tab) {
            return NavigationDestination(
              icon: Icon(tab.icon),
              selectedIcon: Icon(tab.selectedIcon, color: tab.accentColor),
              label: tab.shortLabel,
              tooltip: tab.title,
            );
          }).toList(),
        ),
      ),
    );
  }
}
