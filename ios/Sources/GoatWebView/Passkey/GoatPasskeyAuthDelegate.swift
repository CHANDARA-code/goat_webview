import Foundation
#if canImport(AuthenticationServices) && os(iOS)
import AuthenticationServices
import UIKit
#endif

/// The platform passkey ceremony, behind a protocol.
///
/// `AuthenticationServices` needs a live window scene and a real authenticator, so the seam exists
/// to keep the plugin's routing, RP-ID gate and PRF scrubbing testable off-device. The
/// `AuthenticationServices` implementation below is the only part that cannot run in a unit test.
public protocol PasskeyCeremonyEngine: Sendable {
    func register(optionsJson: String) async throws -> String
    func assert(optionsJson: String) async throws -> String
}

#if canImport(AuthenticationServices) && os(iOS)

@available(iOS 16.0, *)
public final class GoatPasskeyAuthDelegate: NSObject, ASAuthorizationControllerDelegate,
    ASAuthorizationControllerPresentationContextProviding {

    private var continuation: CheckedContinuation<ASAuthorization, Error>?
    private let onFinish: @Sendable () -> Void

    init(onFinish: @escaping @Sendable () -> Void) {
        self.onFinish = onFinish
    }

    func attach(_ continuation: CheckedContinuation<ASAuthorization, Error>) {
        self.continuation = continuation
    }

    public func authorizationController(
        controller: ASAuthorizationController,
        didCompleteWithAuthorization authorization: ASAuthorization
    ) {
        continuation?.resume(returning: authorization)
        continuation = nil
        onFinish()
    }

    public func authorizationController(controller: ASAuthorizationController, didCompleteWithError error: Error) {
        let mapped: Error
        if let asError = error as? ASAuthorizationError {
            switch asError.code {
            case .canceled:
                mapped = PasskeyError(.userCancelled, "User cancelled the passkey ceremony")
            case .notHandled, .failed:
                mapped = PasskeyError(.noCredentialFound, "No matching passkey on this device")
            case .invalidResponse:
                mapped = PasskeyError(.invalidState, "Authenticator returned an invalid response")
            default:
                mapped = PasskeyError(.passkeyUnsupported, "Passkey ceremony failed: \(asError.localizedDescription)")
            }
        } else {
            mapped = PasskeyError(.internalError, error.localizedDescription)
        }
        continuation?.resume(throwing: mapped)
        continuation = nil
        onFinish()
    }

    /// Resolved from the active foreground scene so this works under iPadOS multi-window and
    /// SwiftUI, where a captured single window may already be gone.
    public func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        let scenes = UIApplication.shared.connectedScenes
        let active = scenes.first { $0.activationState == .foregroundActive } ?? scenes.first
        if let windowScene = active as? UIWindowScene,
           let window = windowScene.windows.first(where: { $0.isKeyWindow }) ?? windowScene.windows.first {
            return window
        }
        return ASPresentationAnchor()
    }
}

@available(iOS 16.0, *)
public final class AuthenticationServicesCeremonyEngine: PasskeyCeremonyEngine, @unchecked Sendable {

    /// Controllers and delegates are retained here for the lifetime of the ceremony. Without this
    /// ARC releases them at the first suspension point and the continuation never resumes — the
    /// bridge call then hangs forever rather than failing.
    private let lock = NSLock()
    private var activeSessions: [UUID: (ASAuthorizationController, GoatPasskeyAuthDelegate)] = [:]

    public init() {}

    public func register(optionsJson: String) async throws -> String {
        let options = try Self.decode(optionsJson)
        guard let rp = options["rp"] as? [String: Any], let rpId = rp["id"] as? String else {
            throw PasskeyError(.invalidParameters, "optionsJson is missing rp.id")
        }
        guard let user = options["user"] as? [String: Any],
              let userName = user["name"] as? String,
              let userIdRaw = user["id"] as? String,
              let userId = GoatVaultEngine.decodeBase64Url(userIdRaw) else {
            throw PasskeyError(.invalidParameters, "optionsJson is missing a well-formed user")
        }
        guard let challengeRaw = options["challenge"] as? String,
              let challenge = GoatVaultEngine.decodeBase64Url(challengeRaw) else {
            throw PasskeyError(.invalidParameters, "optionsJson is missing a Base64URL challenge")
        }

        let provider = ASAuthorizationPlatformPublicKeyCredentialProvider(relyingPartyIdentifier: rpId)
        let request = provider.createCredentialRegistrationRequest(
            challenge: challenge,
            name: userName,
            userID: userId
        )

        let authorization = try await perform([request])
        guard let credential = authorization.credential
            as? ASAuthorizationPlatformPublicKeyCredentialRegistration else {
            throw PasskeyError(.invalidState, "Unexpected credential type returned from registration")
        }

        var response: [String: Any] = [
            "clientDataJSON": GoatVaultEngine.base64Url(credential.rawClientDataJSON)
        ]
        if let attestation = credential.rawAttestationObject {
            response["attestationObject"] = GoatVaultEngine.base64Url(attestation)
        }

        return try Self.encode([
            "id": GoatVaultEngine.base64Url(credential.credentialID),
            "rawId": GoatVaultEngine.base64Url(credential.credentialID),
            "type": "public-key",
            "authenticatorAttachment": "platform",
            "response": response,
            "clientExtensionResults": [String: Any]()
        ])
    }

    public func assert(optionsJson: String) async throws -> String {
        let options = try Self.decode(optionsJson)
        guard let rpId = options["rpId"] as? String else {
            throw PasskeyError(.invalidParameters, "optionsJson is missing rpId")
        }
        guard let challengeRaw = options["challenge"] as? String,
              let challenge = GoatVaultEngine.decodeBase64Url(challengeRaw) else {
            throw PasskeyError(.invalidParameters, "optionsJson is missing a Base64URL challenge")
        }

        let provider = ASAuthorizationPlatformPublicKeyCredentialProvider(relyingPartyIdentifier: rpId)
        let request = provider.createCredentialAssertionRequest(challenge: challenge)
        if let allow = options["allowCredentials"] as? [[String: Any]] {
            request.allowedCredentials = allow.compactMap { entry in
                guard let raw = entry["id"] as? String,
                      let id = GoatVaultEngine.decodeBase64Url(raw) else { return nil }
                return ASAuthorizationPlatformPublicKeyCredentialDescriptor(credentialID: id)
            }
        }

        let authorization = try await perform([request])
        guard let credential = authorization.credential
            as? ASAuthorizationPlatformPublicKeyCredentialAssertion else {
            throw PasskeyError(.invalidState, "Unexpected credential type returned from assertion")
        }

        var response: [String: Any] = [
            "clientDataJSON": GoatVaultEngine.base64Url(credential.rawClientDataJSON),
            "authenticatorData": GoatVaultEngine.base64Url(credential.rawAuthenticatorData),
            "signature": GoatVaultEngine.base64Url(credential.signature)
        ]
        if let userHandle = credential.userID {
            response["userHandle"] = GoatVaultEngine.base64Url(userHandle)
        }

        return try Self.encode([
            "id": GoatVaultEngine.base64Url(credential.credentialID),
            "rawId": GoatVaultEngine.base64Url(credential.credentialID),
            "type": "public-key",
            "authenticatorAttachment": "platform",
            "response": response,
            "clientExtensionResults": [String: Any]()
        ])
    }

    @MainActor
    private func perform(_ requests: [ASAuthorizationRequest]) async throws -> ASAuthorization {
        let sessionId = UUID()
        let controller = ASAuthorizationController(authorizationRequests: requests)
        let delegate = GoatPasskeyAuthDelegate { [weak self] in
            self?.releaseSession(sessionId)
        }
        controller.delegate = delegate
        controller.presentationContextProvider = delegate

        lock.lock()
        activeSessions[sessionId] = (controller, delegate)
        lock.unlock()

        return try await withCheckedThrowingContinuation { continuation in
            delegate.attach(continuation)
            controller.performRequests()
        }
    }

    private func releaseSession(_ id: UUID) {
        lock.lock(); defer { lock.unlock() }
        activeSessions.removeValue(forKey: id)
    }

    private static func decode(_ json: String) throws -> [String: Any] {
        guard let data = json.data(using: .utf8),
              let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            throw PasskeyError(.invalidParameters, "optionsJson is not a JSON object")
        }
        return object
    }

    private static func encode(_ object: [String: Any]) throws -> String {
        guard let data = try? JSONSerialization.data(withJSONObject: object),
              let string = String(data: data, encoding: .utf8) else {
            throw PasskeyError(.internalError, "Could not serialise the authenticator response")
        }
        return string
    }
}

#endif
