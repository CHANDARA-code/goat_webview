import Foundation

/// Where a stored pass's bytes live. An interface over an already-encrypted store rather than new
/// crypto: `GoatVaultEngine` (AES-256-GCM, Keychain-anchored) already does what is needed here.
public protocol EncryptedPassVault: Sendable {
    func put(appId: String, passId: String, plaintext: String)
    func get(appId: String, passId: String) -> String?
    func remove(appId: String, passId: String) -> Bool
    func listIds(appId: String) -> [String]
}

/// Renders a barcode for display; left to the host so the SDK carries no barcode library.
public protocol PassBarcodeRenderer: Sendable {
    /// Returns a Base64 PNG, or nil when the format is unsupported.
    func render(barcode: PassBarcode, sizePx: Int) -> String?
}

/**
 * Passes goat holds itself, for issuers targeting neither Wallet. Every pass is scoped to the
 * calling `appId`: a pass is a bearer token, so one mini-app must not read another's.
 */
public struct GenericPassStore: Sendable {

    private let vault: EncryptedPassVault
    private let renderer: PassBarcodeRenderer?

    public init(vault: EncryptedPassVault, renderer: PassBarcodeRenderer? = nil) {
        self.vault = vault
        self.renderer = renderer
    }

    @discardableResult
    public func storePass(appId: String, metadata: PassMetadata, payload: String) throws -> PassMetadata {
        guard !metadata.passTypeIdentifier.isEmpty, !metadata.serialNumber.isEmpty else {
            throw PassError(.invalidParameters, "A generic pass needs both passTypeIdentifier and serialNumber")
        }
        if let barcode = metadata.barcode {
            guard PassBarcode.supportedFormats.contains(barcode.format) else {
                throw PassError(
                    .passInvalid,
                    "Unsupported barcode format '\(barcode.format)'; supported: "
                        + PassBarcode.supportedFormats.sorted().joined(separator: ", ")
                )
            }
            guard !barcode.message.isEmpty else {
                throw PassError(.passInvalid, "Barcode message is empty")
            }
        }
        vault.put(appId: appId, passId: metadata.passId, plaintext: payload)
        return metadata
    }

    public func exportPass(appId: String, passId: String) throws -> String {
        guard let value = vault.get(appId: appId, passId: passId) else {
            throw PassError(.passNotFound, "No stored pass '\(passId)'")
        }
        return value
    }

    public func hasPass(appId: String, passId: String) -> Bool {
        vault.get(appId: appId, passId: passId) != nil
    }

    public func listPasses(appId: String) -> [String] { vault.listIds(appId: appId) }

    @discardableResult
    public func deletePass(appId: String, passId: String) -> Bool {
        vault.remove(appId: appId, passId: passId)
    }

    /// Refusing to create on refresh is deliberate: a webhook must not resurrect a deleted pass.
    public func refreshPass(appId: String, passId: String, payload: String) -> Bool {
        guard vault.get(appId: appId, passId: passId) != nil else { return false }
        vault.put(appId: appId, passId: passId, plaintext: payload)
        return true
    }

    public func renderBarcode(_ barcode: PassBarcode, sizePx: Int = 512) -> String? {
        renderer?.render(barcode: barcode, sizePx: sizePx)
    }
}

/**
 * Digital wallet passes as a `GoatBridgePlugin`, mirroring the Android `GoatPassesPlugin`.
 *
 * Registers on the existing bridge rather than a parallel wallet router: the engine already has
 * the dispatcher, origin sandbox, gesture gate and plugin registry, and a second security gate
 * beside the first is a second thing to drift.
 */
public final class GoatPassesPlugin: GoatBridgePlugin, @unchecked Sendable {

    public static let defaultAppId = "default"

    public let pluginId = "wallet_passes"

    public let supportedActions = [
        "WALLET_SAVE_PASS",
        "WALLET_GET_PASS_STATE",
        "WALLET_OPEN_PASS",
        "WALLET_LIST_PASSES",
        "WALLET_DELETE_PASS"
    ]

    private let lock = NSLock()
    private var adaptersByProvider: [PassProvider: GoatPassAdapter] = [:]
    private let genericStore: GenericPassStore?
    private let appIdProvider: @Sendable () -> String

    public init(
        adapters: [GoatPassAdapter] = [],
        genericStore: GenericPassStore? = nil,
        appIdProvider: @escaping @Sendable () -> String = { GoatPassesPlugin.defaultAppId }
    ) {
        let supplied = adapters.isEmpty ? [AppleWalletPassAdapter()] : adapters
        for adapter in supplied { adaptersByProvider[adapter.provider] = adapter }
        self.genericStore = genericStore
        self.appIdProvider = appIdProvider
    }

    public func registerAdapter(_ adapter: GoatPassAdapter) {
        lock.lock(); defer { lock.unlock() }
        adaptersByProvider[adapter.provider] = adapter
    }

    func registeredProviders() -> Set<PassProvider> {
        lock.lock(); defer { lock.unlock() }
        return Set(adaptersByProvider.keys)
    }

    private func adapter(for provider: PassProvider) throws -> GoatPassAdapter {
        lock.lock(); defer { lock.unlock() }
        guard let found = adaptersByProvider[provider] else {
            throw PassError(.passProviderUnavailable, "No pass adapter registered for \(provider.rawValue)")
        }
        return found
    }

    public func execute(action: String, payload: [String: Any]) async throws -> [String: Any] {
        switch action {
        case "WALLET_SAVE_PASS": return try await savePass(payload)
        case "WALLET_GET_PASS_STATE": return try await getPassState(payload)
        case "WALLET_OPEN_PASS": return try await openPass(payload)
        case "WALLET_LIST_PASSES": return listPasses()
        case "WALLET_DELETE_PASS": return try deletePass(payload)
        default:
            throw PassError(.invalidParameters, "Unsupported passes action: \(action)")
        }
    }

    private func savePass(_ payload: [String: Any]) async throws -> [String: Any] {
        guard let provider = PassProvider.fromWireName(payload["provider"] as? String) else {
            throw PassError(
                .invalidParameters,
                "Unknown or missing 'provider'; expected GOOGLE_WALLET, APPLE_WALLET or GENERIC"
            )
        }
        guard let passPayload = payload["payload"] as? String, !passPayload.isEmpty else {
            throw PassError(.invalidParameters, "Missing 'payload'")
        }
        let metadata = Self.parseMetadata(payload, provider: provider)

        if provider == .generic {
            guard let store = genericStore else {
                throw PassError(.passProviderUnavailable, "No generic pass store is configured on this host")
            }
            guard let required = metadata else {
                throw PassError(.invalidParameters, "A generic pass needs passTypeIdentifier and serialNumber")
            }
            let stored = try store.storePass(appId: appIdProvider(), metadata: required, payload: passPayload)
            return [
                "state": PassState.added.rawValue,
                "passId": stored.passId,
                "provider": provider.rawValue,
                "alreadyAdded": false
            ]
        }

        let result = try await adapter(for: provider).savePass(payload: passPayload, metadata: metadata)
        var out: [String: Any] = [
            "state": result.state.rawValue,
            "provider": result.provider.rawValue,
            "alreadyAdded": result.alreadyAdded
        ]
        if let passId = result.passId { out["passId"] = passId }
        return out
    }

    private func getPassState(_ payload: [String: Any]) async throws -> [String: Any] {
        guard let passId = payload["passId"] as? String, !passId.isEmpty else {
            throw PassError(.invalidParameters, "Missing 'passId'")
        }
        let provider = PassProvider.fromWireName(payload["provider"] as? String) ?? .generic

        let state: PassState
        if provider == .generic {
            if let store = genericStore {
                state = store.hasPass(appId: appIdProvider(), passId: passId) ? .added : .notAdded
            } else {
                state = .unsupported
            }
        } else {
            let resolved = try adapter(for: provider)
            state = await resolved.getPassState(passId: passId)
        }

        return ["passId": passId, "provider": provider.rawValue, "state": state.rawValue]
    }

    private func openPass(_ payload: [String: Any]) async throws -> [String: Any] {
        guard let passId = payload["passId"] as? String, !passId.isEmpty else {
            throw PassError(.invalidParameters, "Missing 'passId'")
        }
        let provider = PassProvider.fromWireName(payload["provider"] as? String) ?? .generic
        var opened = false
        if provider != .generic {
            let resolved = try adapter(for: provider)
            opened = await resolved.openPass(passId: passId)
        }
        return ["passId": passId, "opened": opened]
    }

    private func listPasses() -> [String: Any] {
        let ids = genericStore?.listPasses(appId: appIdProvider()) ?? []
        return ["count": ids.count, "passIds": ids]
    }

    private func deletePass(_ payload: [String: Any]) throws -> [String: Any] {
        guard let passId = payload["passId"] as? String, !passId.isEmpty else {
            throw PassError(.invalidParameters, "Missing 'passId'")
        }
        // Only goat's own store can be deleted from: neither platform wallet offers programmatic
        // removal, and claiming otherwise would lie to the caller.
        let deleted = genericStore?.deletePass(appId: appIdProvider(), passId: passId) ?? false
        return ["passId": passId, "deleted": deleted]
    }

    static func parseMetadata(_ payload: [String: Any], provider: PassProvider) -> PassMetadata? {
        guard let meta = payload["metadata"] as? [String: Any],
              let typeId = meta["passTypeIdentifier"] as? String, !typeId.isEmpty,
              let serial = meta["serialNumber"] as? String, !serial.isEmpty else {
            return nil
        }
        var barcode: PassBarcode?
        if let b = meta["barcode"] as? [String: Any] {
            barcode = PassBarcode(
                format: (b["format"] as? String)?.uppercased() ?? "QR",
                message: b["message"] as? String ?? "",
                altText: b["altText"] as? String,
                encoding: b["encoding"] as? String ?? "iso-8859-1"
            )
        }
        return PassMetadata(
            passTypeIdentifier: typeId,
            serialNumber: serial,
            provider: provider,
            description: meta["description"] as? String,
            organizationName: meta["organizationName"] as? String,
            barcode: barcode,
            savedAtEpochMs: Int64(Date().timeIntervalSince1970 * 1000)
        )
    }
}
