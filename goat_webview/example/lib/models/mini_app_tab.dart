import 'package:flutter/material.dart';

/// Metadata for a SuperApp mini-app showcase tab.
class MiniAppTabInfo {
  final String appId;
  final String title;
  final String shortLabel;
  final String route;
  final IconData icon;
  final IconData selectedIcon;
  final String subtitle;
  final String badgeText;
  final Color accentColor;
  final List<String> keyFeatures;

  const MiniAppTabInfo({
    required this.appId,
    required this.title,
    required this.shortLabel,
    required this.route,
    required this.icon,
    required this.selectedIcon,
    required this.subtitle,
    required this.badgeText,
    required this.accentColor,
    required this.keyFeatures,
  });

  static const List<MiniAppTabInfo> allTabs = [
    MiniAppTabInfo(
      appId: 'com.goat.ecommerce',
      title: 'E-Commerce & Payments',
      shortLabel: 'E-Commerce',
      route: '#/ecommerce',
      icon: Icons.shopping_bag_outlined,
      selectedIcon: Icons.shopping_bag,
      subtitle: 'Apple Pay, Bakong, Alipay & Cart',
      badgeText: 'Payments',
      accentColor: Color(0xFF6366F1), // Indigo
      keyFeatures: [
        'Product Catalog & Live Cart State',
        'Native Bottom-Sheet Checkout Sheet',
        'Multi-Rail Payments (Bakong, Alipay, PayPay)',
        'Apple Pay / Google Pay / StoreKit 2 IAP',
      ],
    ),
    MiniAppTabInfo(
      appId: 'com.goat.iot',
      title: 'IoT & Hardware Dashboard',
      shortLabel: 'IoT & BLE',
      route: '#/iot',
      icon: Icons.bluetooth_searching_rounded,
      selectedIcon: Icons.bluetooth_connected_rounded,
      subtitle: 'BLE GATT, NFC NDEF & 3D Motion',
      badgeText: 'Hardware',
      accentColor: Color(0xFF0EA5E9), // Sky Blue
      keyFeatures: [
        'Bluetooth Low Energy Scanning & RSSI',
        'GATT Service & Characteristic Read/Write',
        'NFC Tag Reading & NDEF Payload Emission',
        '3D Device Motion Orientation Telemetry',
      ],
    ),
    MiniAppTabInfo(
      appId: 'com.goat.fieldservice',
      title: 'Field Service & Navigation',
      shortLabel: 'Field Service',
      route: '#/fieldservice',
      icon: Icons.map_outlined,
      selectedIcon: Icons.map,
      subtitle: 'GPS Telemetry, Geofence & Scanner',
      badgeText: 'Navigation',
      accentColor: Color(0xFF10B981), // Emerald
      keyFeatures: [
        'Real-time GPS Tracking with Accuracy Badge',
        'Circular Geofence Boundary Monitoring',
        'Camera Barcode & QR Code Scanner',
        'Audio Voice Memo Recording & Playback',
      ],
    ),
    MiniAppTabInfo(
      appId: 'com.goat.vault',
      title: 'Secure Biometric Vault',
      shortLabel: 'Vault',
      route: '#/vault',
      icon: Icons.shield_outlined,
      selectedIcon: Icons.shield,
      subtitle: 'FaceID, AES-256 KeyStore & Sandbox',
      badgeText: 'Security',
      accentColor: Color(0xFFF59E0B), // Amber
      keyFeatures: [
        'Biometric Gate (Face ID / Fingerprint)',
        'Hardware KeyStore & AES-256 Encryption',
        'Isolated Sandbox Filesystem Storage',
        'Encrypted Key-Value Credential Vault',
      ],
    ),
    MiniAppTabInfo(
      appId: 'com.goat.diagnostics',
      title: 'Engine Lab & Diagnostics',
      shortLabel: 'Engine Lab',
      route: '#/diagnostics',
      icon: Icons.biotech_outlined,
      selectedIcon: Icons.biotech,
      subtitle: '18 Domains, 197 Actions & IPC Traces',
      badgeText: 'Diagnostics',
      accentColor: Color(0xFFEC4899), // Pink
      keyFeatures: [
        'Comprehensive 18-Domain Bridge Exercise',
        'Warm-Path IPC Latency Benchmarking (<5ms)',
        'Live Memory, Storage & Engine Telemetry',
        'Dynamic Companion SPI Plugin Inspector',
      ],
    ),
  ];
}
