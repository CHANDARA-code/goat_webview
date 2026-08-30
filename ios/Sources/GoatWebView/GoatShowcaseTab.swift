import Foundation
#if canImport(SwiftUI)
import SwiftUI
#endif

/**
 * Domain mini-app tab definitions for the SuperApp showcase application (Showcase R1 & R2).
 */
public enum GoatShowcaseTab: String, CaseIterable, Identifiable, Hashable, Sendable {
    case ecommerce = "ecommerce"
    case iot = "iot"
    case fieldservice = "fieldservice"
    case vault = "vault"
    case diagnostics = "diagnostics"

    public var id: String { rawValue }

    /// Canonical mini-app bundle tenant identifier
    public var appId: String {
        switch self {
        case .ecommerce:    return "com.goat.ecommerce"
        case .iot:          return "com.goat.iot"
        case .fieldservice: return "com.goat.fieldservice"
        case .vault:        return "com.goat.vault"
        case .diagnostics:  return "com.goat.diagnostics"
        }
    }

    /// User-facing navigation display title
    public var title: String {
        switch self {
        case .ecommerce:    return "E-Commerce"
        case .iot:          return "IoT & Hardware"
        case .fieldservice: return "Field Service"
        case .vault:        return "Secure Vault"
        case .diagnostics:  return "Diagnostics"
        }
    }

    /// Descriptive capability subtitle
    public var subtitle: String {
        switch self {
        case .ecommerce:    return "Apple Pay, Bakong KHQR, Alipay & PayPay"
        case .iot:          return "BLE Scanning, NFC NDEF & 3D Motion"
        case .fieldservice: return "GPS Geofencing, Barcode & Audio Memos"
        case .vault:        return "Biometric FaceID Gate & AES-256 Vault"
        case .diagnostics:  return "Live IPC Bridge Console & Benchmarking"
        }
    }

    /// Default SPA routing fragment
    public var initialRoute: String {
        switch self {
        case .ecommerce:    return "#/ecommerce"
        case .iot:          return "#/iot"
        case .fieldservice: return "#/fieldservice"
        case .vault:        return "#/vault"
        case .diagnostics:  return "#/diagnostics"
        }
    }

    /// SF Symbol icon name
    public var systemImage: String {
        switch self {
        case .ecommerce:    return "cart.fill"
        case .iot:          return "cpu"
        case .fieldservice: return "location.fill"
        case .vault:        return "lock.shield.fill"
        case .diagnostics:  return "terminal.fill"
        }
    }

    /// Distinct accent theme color hex for the tab
    public var themeColorHex: String {
        switch self {
        case .ecommerce:    return "#10B981" // Emerald Green
        case .iot:          return "#3B82F6" // Royal Blue
        case .fieldservice: return "#F59E0B" // Amber Gold
        case .vault:        return "#8B5CF6" // Violet Purple
        case .diagnostics:  return "#06B6D4" // Cyan Teal
        }
    }

    /// Virtual asset URL matching the scheme routing contract
    public var assetUrlString: String {
        "goat://assets/\(appId)/index.html\(initialRoute)"
    }

    /// Alternative virtual asset URL format
    public var directAssetUrlString: String {
        "goat://\(appId)/assets/index.html\(initialRoute)"
    }
}
