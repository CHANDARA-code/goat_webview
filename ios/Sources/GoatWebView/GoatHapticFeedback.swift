import Foundation
#if canImport(UIKit) && os(iOS)
import UIKit
#endif

/**
 * Haptic Impact Styles.
 */
public enum GoatHapticImpactStyle: String, CaseIterable, Codable, Sendable {
    case light
    case medium
    case heavy
    case rigid
    case soft

    public static func fromString(_ value: String?) -> GoatHapticImpactStyle {
        guard let value = value?.lowercased().trimmingCharacters(in: .whitespacesAndNewlines) else {
            return .medium
        }
        return GoatHapticImpactStyle(rawValue: value) ?? .medium
    }
}

/**
 * Haptic Notification Types.
 */
public enum GoatHapticNotificationType: String, CaseIterable, Codable, Sendable {
    case success
    case warning
    case error

    public static func fromString(_ value: String?) -> GoatHapticNotificationType {
        guard let value = value?.lowercased().trimmingCharacters(in: .whitespacesAndNewlines) else {
            return .success
        }
        return GoatHapticNotificationType(rawValue: value) ?? .success
    }
}

/**
 * Haptic Profile Names matching Android 10-profile waveform specification.
 */
public enum GoatHapticProfileName: String, CaseIterable, Codable, Sendable {
    case impactLight = "impact_light"
    case impactMedium = "impact_medium"
    case impactHeavy = "impact_heavy"
    case impactRigid = "impact_rigid"
    case impactSoft = "impact_soft"
    case notificationSuccess = "notification_success"
    case notificationWarning = "notification_warning"
    case notificationError = "notification_error"
    case selectionChange = "selection_change"
    case appError = "app_error"
}

/**
 * Native Haptic Feedback Engine for iOS Mini-Apps (Milestone 2 / Task 10072 & R2 Haptics).
 *
 * Implements 10 preset haptic waveforms (5 impact styles, 3 notification feedback types,
 * 1 selection feedback, and 1 app error pattern) utilizing UIKit feedback generators.
 */
public final class GoatHapticFeedback: @unchecked Sendable {
    public static let shared = GoatHapticFeedback()

    public let minBurstInterval: TimeInterval
    private var lastTriggerTime: TimeInterval = 0
    private let lock = NSLock()

    public init(minBurstInterval: TimeInterval = 0.050) {
        self.minBurstInterval = minBurstInterval
    }

    /**
     * Resolves and normalizes haptic profile matching Android's 10 profile waveforms.
     */
    public func resolveProfile(type: String?, style: String?, notificationType: String?) -> GoatHapticProfileName {
        let normalizedType = type?.lowercased().trimmingCharacters(in: .whitespacesAndNewlines) ?? "impact"
        let normalizedStyle = style?.lowercased().trimmingCharacters(in: .whitespacesAndNewlines) ?? "medium"
        let normalizedNotif = notificationType?.lowercased().trimmingCharacters(in: .whitespacesAndNewlines) ?? "success"

        switch normalizedType {
        case "light", "impact_light":
            return .impactLight
        case "medium", "impact_medium":
            return .impactMedium
        case "heavy", "impact_heavy":
            return .impactHeavy
        case "rigid", "impact_rigid":
            return .impactRigid
        case "soft", "impact_soft":
            return .impactSoft
        case "success", "notification_success":
            return .notificationSuccess
        case "warning", "notification_warning":
            return .notificationWarning
        case "error", "notification_error":
            return .notificationError
        case "selection", "selection_change":
            return .selectionChange
        case "app_error":
            return .appError
        case "notification":
            switch normalizedNotif {
            case "warning", "notification_warning":
                return .notificationWarning
            case "error", "notification_error":
                return .notificationError
            default:
                return .notificationSuccess
            }
        case "impact":
            switch normalizedStyle {
            case "light", "impact_light":
                return .impactLight
            case "heavy", "impact_heavy":
                return .impactHeavy
            case "rigid", "impact_rigid":
                return .impactRigid
            case "soft", "impact_soft":
                return .impactSoft
            default:
                return .impactMedium
            }
        default:
            return .impactMedium
        }
    }

    /**
     * Triggers native impact feedback.
     */
    public func impact(style: GoatHapticImpactStyle, intensity: CGFloat? = nil) {
        #if canImport(UIKit) && os(iOS)
        let feedbackStyle: UIImpactFeedbackGenerator.FeedbackStyle
        switch style {
        case .light: feedbackStyle = .light
        case .medium: feedbackStyle = .medium
        case .heavy: feedbackStyle = .heavy
        case .rigid: feedbackStyle = .rigid
        case .soft: feedbackStyle = .soft
        }
        let generator = UIImpactFeedbackGenerator(style: feedbackStyle)
        generator.prepare()
        if let intensity = intensity {
            generator.impactOccurred(intensity: max(0.0, min(1.0, intensity)))
        } else {
            generator.impactOccurred()
        }
        #endif
    }

    /**
     * Triggers native notification feedback (success, warning, error).
     */
    public func notification(type: GoatHapticNotificationType) {
        #if canImport(UIKit) && os(iOS)
        let feedbackType: UINotificationFeedbackGenerator.FeedbackType
        switch type {
        case .success: feedbackType = .success
        case .warning: feedbackType = .warning
        case .error: feedbackType = .error
        }
        let generator = UINotificationFeedbackGenerator()
        generator.prepare()
        generator.notificationOccurred(feedbackType)
        #endif
    }

    /**
     * Triggers native selection change feedback.
     */
    public func selection() {
        #if canImport(UIKit) && os(iOS)
        let generator = UISelectionFeedbackGenerator()
        generator.prepare()
        generator.selectionChanged()
        #endif
    }

    /**
     * Resolves incoming bridge payload and dispatches appropriate haptic generator.
     */
    public func trigger(payload: [String: Any]) -> [String: Any] {
        let rawType = (payload["type"] as? String)?.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
        let rawStyle = (payload["style"] as? String)?.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
        let rawNotif = (payload["notificationType"] as? String)?.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)

        let profile = resolveProfile(type: rawType, style: rawStyle, notificationType: rawNotif)

        let now = Date().timeIntervalSince1970
        lock.lock()
        let isThrottled = (now - lastTriggerTime < minBurstInterval)
        if !isThrottled {
            lastTriggerTime = now
        }
        lock.unlock()

        if !isThrottled {
            switch profile {
            case .impactLight:
                impact(style: .light)
            case .impactMedium:
                impact(style: .medium)
            case .impactHeavy:
                impact(style: .heavy)
            case .impactRigid:
                impact(style: .rigid)
            case .impactSoft:
                impact(style: .soft)
            case .notificationSuccess:
                notification(type: .success)
            case .notificationWarning:
                notification(type: .warning)
            case .notificationError, .appError:
                notification(type: .error)
            case .selectionChange:
                selection()
            }
        }

        var result: [String: Any] = [
            "status": "vibrated",
            "triggered": !isThrottled,
            "success": true,
            "profile": profile.rawValue,
            "type": rawType ?? "impact"
        ]
        if isThrottled {
            result["throttled"] = true
        }
        if let style = rawStyle {
            result["style"] = style
        }
        if let notif = rawNotif {
            result["notificationType"] = notif
        }
        return result
    }
}
