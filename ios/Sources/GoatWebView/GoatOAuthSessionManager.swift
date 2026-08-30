import Foundation
#if canImport(AuthenticationServices)
import AuthenticationServices
#endif

/**
 * In-App ASWebAuthenticationSession Coordinator for iOS (Task 10182 / Pillar 1).
 *
 * Launches an isolated system browser context for OAuth 2.0 / OIDC flows,
 * capturing callback redirects and dispatching results back across the bridge.
 */
public class GoatOAuthSessionManager: NSObject {
    public static let shared = GoatOAuthSessionManager()

    #if canImport(AuthenticationServices)
    private var activeSession: ASWebAuthenticationSession?
    #endif
    private var currentSessionId: String?

    /**
     * Starts an ASWebAuthenticationSession with the given authorization URL and scheme.
     */
    public func startSession(
        sessionId: String,
        authUrlString: String,
        callbackScheme: String,
        presentationContextProvider: ASWebAuthenticationPresentationContextProviding? = nil,
        completion: @escaping (Result<[String: Any], Error>) -> Void
    ) {
        guard let url = URL(string: authUrlString) else {
            completion(.failure(GoatBridgeError.invalidPayload("Invalid authUrl: \(authUrlString)")))
            return
        }

        #if canImport(AuthenticationServices)
        // Cancel existing session if active
        activeSession?.cancel()
        currentSessionId = sessionId

        let session = ASWebAuthenticationSession(
            url: url,
            callbackURLScheme: callbackScheme
        ) { [weak self] callbackURL, error in
            self?.activeSession = nil
            self?.currentSessionId = nil

            if let error = error {
                completion(.failure(error))
                return
            }

            guard let callbackURL = callbackURL else {
                completion(.failure(GoatBridgeError.invalidPayload("Missing callback URL")))
                return
            }

            let result: [String: Any] = [
                "success": true,
                "sessionId": sessionId,
                "callbackUrl": callbackURL.absoluteString
            ]
            completion(.success(result))
        }

        if let provider = presentationContextProvider {
            session.presentationContextProvider = provider
        }

        self.activeSession = session
        session.start()
        #else
        completion(.failure(GoatBridgeError.unsupportedAction("AuthenticationServices not available on platform")))
        #endif
    }

    /**
     * Cancels any active OAuth authentication session.
     */
    public func cancelSession(sessionId: String? = nil) -> Bool {
        #if canImport(AuthenticationServices)
        if let active = activeSession {
            if sessionId == nil || currentSessionId == sessionId {
                active.cancel()
                activeSession = nil
                currentSessionId = nil
                return true
            }
        }
        #endif
        return false
    }
}
