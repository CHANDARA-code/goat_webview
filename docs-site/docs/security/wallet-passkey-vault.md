---
sidebar_position: 3
title: Wallet, Passkeys & Hardware Vault
---

# Wallet, Passkeys & the Hardware Vault

Goat WebView exposes three security-sensitive surfaces to a mini-app: a multi-chain **wallet**
(EVM, Solana, TON), **W3C WebAuthn passkeys**, and a **hardware-anchored vault**. All three share
one rule — the secret never enters the web context.

## Custody: goat does not hold your keys

**goat is not a wallet.** It ships the `GoatWalletAdapter` interface, the calldata and typed-data
decoders, the concurrency arbiter and the native confirmation modal. The **host application
supplies the signer.** There is no key generation, no BIP-32/39, no seed storage.

```kotlin
// Android — register your own signer at construction.
val plugin = GoatWeb3Plugin(
    context,
    adapters = listOf(
        GoatEvmWalletAdapter(signer = MyHardwareBackedEvmSigner()),
        GoatSolanaWalletAdapter(signer = MySolanaSigner()),
    ),
)
```

```swift
// iOS — same shape.
let plugin = GoatWeb3Plugin(adapters: [
    GoatEvmWalletAdapter(signer: MyHardwareBackedEvmSigner()),
])
```

### The reference adapter is a simulation, and says so

If you register no adapter, `GoatReferenceWalletAdapter` answers instead so the bridge surface and
the example mini-apps stay runnable. **It performs no cryptography.** Every value it returns is a
deterministic SHA-256 placeholder prefixed `SIMULATED_`, and every signing response carries
`"simulated": true`:

```json
{
  "signature": "SIMULATED_SIG_9f2c…",
  "txHash": "0x…",
  "status": "SIMULATED",
  "simulated": true
}
```

Check that flag before treating a signature as real. Shipping with the reference adapter registered
means shipping an app that cannot sign.

## Blind-signing defence

Before any signature, native decodes the actual payload — not what the page says it is. A mini-app
can render "$1.00" in its own DOM while submitting an unlimited approval; the confirmation modal
shows what is really being authorised.

| Payload | Decoded by | Flags |
| :--- | :--- | :--- |
| ERC-20 `approve` / `increaseAllowance` | `EvmAbiDecoder` | unlimited approval at ≥ 2²⁵⁵ |
| ERC-721 `setApprovalForAll` | `EvmAbiDecoder` | collection-wide grant (revocation is not flagged) |
| Permit2 `PermitSingle` / `PermitBatch` | `Eip712Parser` | unlimited at **2¹⁶⁰−1**, expiry > 30 days |
| Solana legacy + v0 transactions | `SolanaTxDecoder` | SPL amounts with decimal scaling, ALT warning |
| TON Jetton / NFT transfer BOC | `TonBocParser` | opcode decoding, malformed payload rejection |
| anything unrecognised | — | **UNVERIFIED CONTRACT**, slider locked until acknowledged |

:::warning Permit2 uses a different ceiling
An ERC-20 `approve` is `uint256`; a Permit2 allowance is **`uint160`**. Comparing a Permit2 grant
against the `uint256` ceiling makes `2¹⁶⁰−1` read as merely "large" and no warning fires — which is
precisely how off-chain drainers work. `Eip712Parser` picks the ceiling by payload shape.
:::

Off-chain signatures are the dangerous case: a Permit2 `PermitSingle` costs no gas, produces no
transaction the user can see in a block explorer, and grants an unlimited allowance until expiry.
`WEB3_SIGN_MESSAGE` is therefore gesture-gated exactly like `WEB3_SIGN_TRANSACTION`.

## Passkeys: `allowedRpIds` is mandatory

Every mini-app runs under one shared virtual origin, so the platform's own rpId/origin check cannot
separate tenants. Authority comes from the signed manifest:

```json
{
  "appId": "com.merchant.shop",
  "security": {
    "allowedRpIds": ["shop.superapp.com", "superapp.com"]
  }
}
```

- An **absent or empty** `allowedRpIds` refuses every ceremony. That is the safe default, not a bug.
- A subdomain of a declared id is accepted (`login.superapp.com` under `superapp.com`); a
  lookalike is not (`evilsuperapp.com`), and a bare TLD never matches.
- The tenant is always the **container's** `appId`. An `appId` in the request payload is ignored —
  it is attacker-controlled and would let one mini-app borrow another's relying parties.

## The vault: no key ever reaches JavaScript

`window.goat.vault` has `encrypt` and `decrypt` and deliberately **no `deriveKey`**. Encryption
happens natively:

```
VaultKey = HKDF-SHA256(
    IKM  = prfOutput ?? deviceSecret,
    salt = deviceSecret XOR clientSalt,
    info = "goat-vault-v1"
)
```

`deviceSecret` comes from an AndroidKeyStore HMAC key or an iOS Keychain item and never leaves that
boundary, so an attacker who replays the CTAP2 PRF off-device still cannot derive the key. Only the
ciphertext envelope or the decrypted plaintext crosses the bridge.

```ts
const envelope = await window.goat.vault.encrypt('notes', 'my secret');
localStorage.setItem('notes', JSON.stringify(envelope));   // carries no key material

const { plaintext } = await window.goat.vault.decrypt('notes', envelope);
```

### The PRF air-gap

The raw 32-byte CTAP2 PRF output is the vault master key. It is stripped at four independent
layers, each with its own test: the polyfill removes `prf` from outgoing extensions; the native
plugin scrubs `clientExtensionResults.prf` on both platforms; the reconstructed DOM credential
scrubs again; and no client-reachable key-derivation action exists at all.

### `vaultMode` tells you what actually protected the data

| Mode | Meaning |
| :--- | :--- |
| `hardware_keystore` / `hardware_keychain` | AES-256-GCM under a hardware-anchored device secret |
| `webauthn_prf` | additionally anchored to a CTAP2 PRF evaluation (Android 14+ / iOS 18+) |
| `none` | no hardware available — the vault refuses to operate |

:::danger Fails closed, never soft
If the KeyStore or Keychain is unavailable the vault raises `VAULT_UNAVAILABLE` rather than
deriving a key in software. A software-derived key is reproducible off-device, so no vault is
strictly safer than a guessable one. An envelope tagged `webauthn_prf` is likewise refused when no
PRF evaluator is registered — it is never silently opened under the weaker key.
:::

## Anti-tapjacking

The confirmation modal applies `FLAG_SECURE`, `filterTouchesWhenObscured`, and — on Android 12+ —
`setHideOverlayWindows(true)`. Confirmation requires a continuous drag to 100%; releasing early
resets rather than latching, and any touch the platform reports as obscured is discarded outright.

**iOS has no `FLAG_SECURE` equivalent.** The protections there are a dedicated window above the
app's content plus `isExclusiveTouch`. Screen recording cannot be blocked, so it is *detected* via
`UIScreen.isCaptured` and surfaced as a warning in the modal instead of being silently ignored.

## Verifying a build

```bash
bash scripts/verify-wallet-passkey-adapters.sh      # 13 steps across all platforms
bash scripts/benchmark-wallet-passkey-latency.sh    # WebAuthn / BOC / bridge latency budgets
```

The Android vault's real KeyStore path is covered on a physical device by
`:feature-biometrics:connectedDebugAndroidTest`; the gate runs it when a device is attached and
skips loudly when none is.
