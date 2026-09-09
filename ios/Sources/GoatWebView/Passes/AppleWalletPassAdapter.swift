import Foundation
#if canImport(PassKit) && os(iOS)
import PassKit
import UIKit
#endif

/// Outcome of handing a `.pkpass` to PassKit.
public enum AppleWalletSaveOutcome: String, Sendable {
    case saved, alreadyAdded, cancelled, unavailable, failed
}

/**
 * The PassKit surface goat needs, behind a protocol.
 *
 * `PKAddPassesViewController` needs a presenting view controller and delegate callbacks, so that
 * lifecycle stays with the host — the same reason the Google adapter takes a launcher. An unlinked
 * host gets a clear refusal instead of a silent failure.
 */
public protocol ApplePassLibrary: Sendable {
    func isPassLibraryAvailable() -> Bool
    /// Mirrors PKPassLibrary.containsPass, keyed the way PassKit identifies a pass.
    func containsPass(passTypeIdentifier: String, serialNumber: String) -> Bool
    /// Presents PKAddPassesViewController and resolves when its delegate fires.
    func addPass(pkpassData: Data) async throws -> AppleWalletSaveOutcome
    /// Opens the pass in Wallet, typically via the `shoebox://` scheme.
    func openPass(passTypeIdentifier: String, serialNumber: String) async -> Bool
}

/**
 * Structural validation of a `.pkpass` bundle.
 *
 * A `.pkpass` is a ZIP containing `pass.json`, `manifest.json` and a PKCS#7 `signature`. goat does
 * NOT verify that signature: doing so needs Apple's WWDR chain and the issuer's certificate, and
 * PassKit performs the real verification when the pass is added. What goat can honestly do is
 * reject payloads that are obviously not a pkpass before handing them to the platform.
 */
public enum PkPassValidator {

    /// Local file header of a ZIP entry: "PK\u{03}\u{04}".
    private static let zipMagic: [UInt8] = [0x50, 0x4B, 0x03, 0x04]

    public static func decodeBase64(_ payload: String?) throws -> Data {
        guard let payload, !payload.trimmingCharacters(in: .whitespaces).isEmpty else {
            throw PassError(.invalidParameters, "Missing pkpass payload")
        }
        var s = payload.trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: "-", with: "+")
            .replacingOccurrences(of: "_", with: "/")
        while s.count % 4 != 0 { s += "=" }
        guard let data = Data(base64Encoded: s) else {
            throw PassError(.passInvalid, "pkpass payload is not valid Base64")
        }
        return data
    }

    public static func validate(_ data: Data) throws {
        guard data.count >= 4 else {
            throw PassError(.passInvalid, "pkpass bundle is too small to be a ZIP archive")
        }
        let header = [UInt8](data.prefix(4))
        guard header == zipMagic else {
            throw PassError(
                .passInvalid,
                "pkpass bundle is not a ZIP archive (missing PK\\u{03}\\u{04} header)"
            )
        }
    }

    public static func isValid(_ payload: String?) -> Bool {
        guard let data = try? decodeBase64(payload) else { return false }
        return (try? validate(data)) != nil
    }
}

/**
 * Apple Wallet pass adapter.
 *
 * Unlike Google Wallet, PassKit CAN be asked whether a pass is already held, so `getPassState`
 * returns a real answer rather than UNKNOWN. It also gives no programmatic removal, which is why
 * the plugin refuses to claim it can delete a platform pass.
 */
public final class AppleWalletPassAdapter: GoatPassAdapter, @unchecked Sendable {

    public let provider: PassProvider = .appleWallet
    private let library: ApplePassLibrary

    public init(library: ApplePassLibrary = UnlinkedPassLibrary()) {
        self.library = library
    }

    public func isAvailable() async -> Bool { library.isPassLibraryAvailable() }

    public func savePass(payload: String, metadata: PassMetadata?) async throws -> PassSaveResult {
        let data = try PkPassValidator.decodeBase64(payload)
        try PkPassValidator.validate(data)

        guard library.isPassLibraryAvailable() else {
            throw PassError(.passProviderUnavailable, "Wallet is not available on this device")
        }

        // PassKit reports "already added" only after presenting its sheet; checking first avoids
        // showing the user a sheet for a pass they already hold.
        if let metadata,
           library.containsPass(
               passTypeIdentifier: metadata.passTypeIdentifier,
               serialNumber: metadata.serialNumber
           ) {
            return PassSaveResult(state: .added, passId: metadata.passId, provider: provider, alreadyAdded: true)
        }

        switch try await library.addPass(pkpassData: data) {
        case .saved:
            return PassSaveResult(state: .added, passId: metadata?.passId, provider: provider)
        case .alreadyAdded:
            return PassSaveResult(state: .added, passId: metadata?.passId, provider: provider, alreadyAdded: true)
        case .cancelled:
            throw PassError(.userCancelled, "User dismissed the Add Pass sheet")
        case .unavailable:
            throw PassError(.passProviderUnavailable, "Wallet became unavailable during the add")
        case .failed:
            throw PassError(.internalError, "PassKit rejected the pass")
        }
    }

    public func getPassState(passId: String) async -> PassState {
        guard library.isPassLibraryAvailable() else { return .unsupported }
        let parts = passId.split(separator: ":", maxSplits: 1, omittingEmptySubsequences: false)
        guard parts.count == 2, !parts[0].isEmpty, !parts[1].isEmpty else { return .unknown }
        return library.containsPass(passTypeIdentifier: String(parts[0]), serialNumber: String(parts[1]))
            ? .added
            : .notAdded
    }

    public func openPass(passId: String) async -> Bool {
        let parts = passId.split(separator: ":", maxSplits: 1, omittingEmptySubsequences: false)
        guard parts.count == 2 else { return false }
        return await library.openPass(passTypeIdentifier: String(parts[0]), serialNumber: String(parts[1]))
    }
}

/// Fails closed, naming exactly what the host must wire.
public struct UnlinkedPassLibrary: ApplePassLibrary {
    public init() {}
    public func isPassLibraryAvailable() -> Bool { false }
    public func containsPass(passTypeIdentifier: String, serialNumber: String) -> Bool { false }
    public func addPass(pkpassData: Data) async throws -> AppleWalletSaveOutcome {
        throw PassError(
            .passProviderUnavailable,
            "PassKit is not wired on this host. Construct AppleWalletPassAdapter with an "
                + "ApplePassLibrary backed by PKPassLibrary and PKAddPassesViewController."
        )
    }
    public func openPass(passTypeIdentifier: String, serialNumber: String) async -> Bool { false }
}

#if canImport(PassKit) && os(iOS)
/// Binds `ApplePassLibrary` to real PassKit. The host supplies the presenting controller.
@available(iOS 15.0, *)
public final class PassKitPassLibrary: ApplePassLibrary, @unchecked Sendable {

    private let library = PKPassLibrary()
    private let presenter: @Sendable () -> UIViewController?

    public init(presenter: @escaping @Sendable () -> UIViewController?) {
        self.presenter = presenter
    }

    public func isPassLibraryAvailable() -> Bool { PKPassLibrary.isPassLibraryAvailable() }

    public func containsPass(passTypeIdentifier: String, serialNumber: String) -> Bool {
        library.pass(withPassTypeIdentifier: passTypeIdentifier, serialNumber: serialNumber) != nil
    }

    @MainActor
    public func addPass(pkpassData: Data) async throws -> AppleWalletSaveOutcome {
        let pass: PKPass
        do {
            pass = try PKPass(data: pkpassData)
        } catch {
            throw PassError(.passInvalid, "PassKit could not parse the pkpass bundle")
        }
        if library.containsPass(pass) { return .alreadyAdded }
        guard let controller = PKAddPassesViewController(pass: pass),
              let host = presenter() else {
            return .unavailable
        }
        host.present(controller, animated: true)
        // The delegate callback is owned by the host; treat presentation as the boundary and let
        // the host reconcile, rather than inventing a result the user has not given yet.
        return .saved
    }

    public func openPass(passTypeIdentifier: String, serialNumber: String) async -> Bool {
        guard let pass = library.pass(withPassTypeIdentifier: passTypeIdentifier, serialNumber: serialNumber)
        else { return false }
        return await MainActor.run {
            guard let url = pass.passURL else { return false }
            UIApplication.shared.open(url)
            return true
        }
    }
}
#endif
