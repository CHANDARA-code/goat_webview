import Foundation

/**
 * Extension SPI protocol for modular iOS Goat WebView feature plugins (Task 10134 / Task 10153).
 * Enables zero-bloat modular builds by allowing host applications to link only required native
 * frameworks (e.g. AVFoundation, Vision, CoreLocation, LocalAuthentication, CoreBluetooth).
 */
public protocol GoatBridgePlugin: AnyObject {
    /** Unique identifier for the plugin (e.g. "media", "scanner", "location"). */
    var pluginId: String { get }

    /** List of IPC action types handled by this plugin. */
    var supportedActions: [String] { get }

    /**
     * Executes the requested action payload.
     *
     * - Parameters:
     *   - action: Action identifier string.
     *   - payload: Request parameters dictionary from the web client.
     * - Returns: Response dictionary conforming to JSON-serializable types.
     */
    func execute(action: String, payload: [String: Any]) async throws -> [String: Any]

    /**
     * Determines whether this plugin can handle the specified action.
     */
    func canHandle(action: String) -> Bool
}

extension GoatBridgePlugin {
    public func canHandle(action: String) -> Bool {
        return supportedActions.contains(action)
    }
}
