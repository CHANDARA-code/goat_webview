---
sidebar_position: 14
title: Domain 13 - Web3 & Payments
description: Complete API reference for Web3 & Payments (7 actions).
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Domain 13: Web3 & Payments 💳

EVM / Solana Web3 wallet connection, transaction signing with user gesture gate, in-app invoice checkout, and IAP product queries.

**Total Actions in Domain:** `7 actions`

---

## Action Summary

| # | Action String | Permission | Inputs | Returns |
| :--- | :--- | :--- | :--- | :--- |
| 1 | [`WEB3_CONNECT_WALLET`](#web3-connect-wallet) | `none` | `network` | `Web3WalletAccountResult` |
| 2 | [`WEB3_SIGN_TRANSACTION`](#web3-sign-transaction) | `none` | `to`, `amount`, `payload` | `Web3SignedTransactionResult` |
| 3 | [`WEB3_DISCONNECT`](#web3-disconnect) | `none` | `{}` | `Web3DisconnectResult` |
| 4 | [`WEB3_GET_ACCOUNT`](#web3-get-account) | `none` | `{}` | `Web3WalletAccountResult` |
| 5 | [`OPEN_INVOICE`](#open-invoice) | `none` | `invoiceSlug`, `amount`, `currency`, `title` | `InvoicePaymentResult` |
| 6 | [`GET_PURCHASE_PRODUCTS`](#get-purchase-products) | `none` | `{}` | `IapProductsResult` |
| 7 | [`RESTORE_PURCHASES`](#restore-purchases) | `none` | `{}` | `RestorePurchasesResult` |

---

## Action Specifications

---

### 1. `WEB3_CONNECT_WALLET` {#web3-connect-wallet}

Requests connection to the host embedded Web3 crypto wallet (EVM / Solana) or launches WalletConnect modal.

**Purpose & Context:** Authorizes mini-app to query public address, active chainId, and request token transactions.

#### Platform Support Matrix
`Android: ✅` `iOS: ✅` `React Native: ✅` `Flutter: ✅` `Web Mock: ✅`

#### Aliases & Method Signatures
- **Canonical Action String:** `WEB3_CONNECT_WALLET`
- **Supported Aliases:** `web3ConnectWallet`, `requestWalletConnect`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** ✅ **No Gesture Required**

#### Input Parameters
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `network` | `string` | No | `"ethereum"` | Target network (e.g. "ethereum", "polygon", "solana"). |


#### Return Value
- **Schema Type:** `Web3WalletAccountResult`
- **Description:** Connected public wallet address and network metadata.

```json title="Return Payload Shape"
{
  "address": "string",
  "publicKey": "string",
  "wallet": "string",
  "network": "string",
  "chainId": "string"
}
```

#### Error Codes & Troubleshooting
_This action executes without throwing domain-specific error codes._


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
const wallet = await goatBridge.callNative('WEB3_CONNECT_WALLET', { network: 'ethereum' });
console.log('Connected wallet address:', wallet.address, 'Chain:', wallet.chainId);
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
// Connect to Host Web3 Wallet Keyring
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
// Connect to Secure Enclave Wallet
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
final wallet = await goatController.callNativeAction('WEB3_CONNECT_WALLET', {'network': 'ethereum'});
```

  </TabItem>
</Tabs>


---

### 2. `WEB3_SIGN_TRANSACTION` {#web3-sign-transaction}

Prompts user with native transaction confirmation bottom sheet and signs transaction with private key under biometric/gesture gate.

**Purpose & Context:** Authorizes crypto transfers, smart contract interactions, and NFT purchases.

#### Platform Support Matrix
`Android: ✅` `iOS: ✅` `React Native: ✅` `Flutter: ✅` `Web Mock: ✅`

#### Aliases & Method Signatures
- **Canonical Action String:** `WEB3_SIGN_TRANSACTION`
- **Supported Aliases:** `web3SignTransaction`, `signTransaction`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** ⚠️ **Active User Gesture Required** (User touch within &lt;10s)

#### Input Parameters
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `to` | `string` | **Yes** | - | Recipient contract or wallet address. |
| `amount` | `string` | **Yes** | - | Amount in native currency wei or tokens. |
| `payload` | `string` | No | - | ABI encoded hex data for smart contract call. |


#### Return Value
- **Schema Type:** `Web3SignedTransactionResult`
- **Description:** Cryptographic signature and broadcast transaction hash.

```json title="Return Payload Shape"
{
  "signature": "string",
  "txHash": "string",
  "network": "string",
  "from": "string"
}
```

#### Error Codes & Troubleshooting
| Error Code | Meaning | Troubleshooting |
| :--- | :--- | :--- |
| `INVALID_ARGUMENT` | Missing to address or amount. | Provide valid recipient address and amount. |
| `GESTURE_REQUIRED` | Transaction requested without recent user gesture. | Call from click/tap event. |
| `USER_CANCEL` | User rejected the transaction in the confirmation sheet. | Handle payment cancellation. |


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
const tx = await goatBridge.callNative('WEB3_SIGN_TRANSACTION', {
  to: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
  amount: '0.05',
  payload: '0x'
});
console.log('Transaction broadcast hash:', tx.txHash);
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
// Prompt signing sheet and sign using Web3j / KeyStore
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
// Present transaction modal and sign with Secure Enclave
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
final tx = await goatController.callNativeAction('WEB3_SIGN_TRANSACTION', {
  'to': '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
  'amount': '0.05',
});
```

  </TabItem>
</Tabs>


---

### 3. `WEB3_DISCONNECT` {#web3-disconnect}

Disconnects the active Web3 crypto wallet session.

**Purpose & Context:** Cleans up wallet authorization on sign-out.

#### Platform Support Matrix
`Android: ✅` `iOS: ✅` `React Native: ✅` `Flutter: ✅` `Web Mock: ✅`

#### Aliases & Method Signatures
- **Canonical Action String:** `WEB3_DISCONNECT`
- **Supported Aliases:** `web3Disconnect`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** ✅ **No Gesture Required**

#### Input Parameters
_No input parameters required (`{}`)._


#### Return Value
- **Schema Type:** `Web3DisconnectResult`
- **Description:** Confirmation that wallet was disconnected.

```json title="Return Payload Shape"
{
  "disconnected": "boolean"
}
```

#### Error Codes & Troubleshooting
_This action executes without throwing domain-specific error codes._


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
await goatBridge.callNative('WEB3_DISCONNECT', {});
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
// Disconnect wallet
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
// Disconnect wallet
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
await goatController.callNativeAction('WEB3_DISCONNECT', {});
```

  </TabItem>
</Tabs>


---

### 4. `WEB3_GET_ACCOUNT` {#web3-get-account}

Queries active connected wallet address and account state without triggering a prompt.

**Purpose & Context:** Checks if wallet is currently authorized.

#### Platform Support Matrix
`Android: ✅` `iOS: ✅` `React Native: ✅` `Flutter: ✅` `Web Mock: ✅`

#### Aliases & Method Signatures
- **Canonical Action String:** `WEB3_GET_ACCOUNT`
- **Supported Aliases:** `web3GetAccount`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** ✅ **No Gesture Required**

#### Input Parameters
_No input parameters required (`{}`)._


#### Return Value
- **Schema Type:** `Web3WalletAccountResult`
- **Description:** Active account status.

```json title="Return Payload Shape"
{
  "connected": "boolean",
  "address": "string (optional)",
  "publicKey": "string (optional)",
  "wallet": "string (optional)",
  "network": "string (optional)",
  "chainId": "string (optional)"
}
```

#### Error Codes & Troubleshooting
_This action executes without throwing domain-specific error codes._


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
const account = await goatBridge.callNative('WEB3_GET_ACCOUNT', {});
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
// Query active wallet account
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
// Query active account
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
final res = await goatController.callNativeAction('WEB3_GET_ACCOUNT', {});
```

  </TabItem>
</Tabs>


---

### 5. `OPEN_INVOICE` {#open-invoice}

Presents native checkout bottom sheet for paying an in-app order invoice (via credit card, Apple Pay, Google Pay, or wallet balance).

**Purpose & Context:** Enables 1-click in-app purchasing and checkout in mini-apps.

#### Platform Support Matrix
`Android: ✅` `iOS: ✅` `React Native: ✅` `Flutter: ✅` `Web Mock: ✅`

#### Aliases & Method Signatures
- **Canonical Action String:** `OPEN_INVOICE`
- **Supported Aliases:** `openInvoice`, `requestPayment`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** ✅ **No Gesture Required**

#### Input Parameters
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `invoiceSlug` | `string` | **Yes** | - | Backend-generated invoice order slug. |
| `amount` | `number` | No | - | Order total amount in minor units or dollars. |
| `currency` | `string` | No | `"USD"` | ISO 4217 currency code (e.g. "USD"). |
| `title` | `string` | No | - | Item order summary. |


#### Return Value
- **Schema Type:** `InvoicePaymentResult`
- **Description:** Receipt record with digital signature for payment verification.

```json title="Return Payload Shape"
{
  "status": "\"PAID\" | \"CANCELLED\" | \"FAILED\"",
  "invoiceSlug": "string",
  "transactionId": "string",
  "amount": "number",
  "currency": "string",
  "signature": "string"
}
```

#### Error Codes & Troubleshooting
| Error Code | Meaning | Troubleshooting |
| :--- | :--- | :--- |
| `INVALID_ARGUMENT` | invoiceSlug missing. | Pass a valid invoiceSlug generated by your server. |
| `USER_CANCEL` | User closed payment sheet without completing payment. | Keep order draft open. |


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
const receipt = await goatBridge.callNative('OPEN_INVOICE', {
  invoiceSlug: 'inv_839210_coffee',
  amount: 4.50,
  currency: 'USD',
  title: 'Caramel Macchiato'
});
if (receipt.status === 'PAID') {
  console.log('Payment complete! TxID:', receipt.transactionId);
}
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
// Launch Google Pay / In-App Payment Sheet
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
// Present PKPaymentAuthorizationController for Apple Pay
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
final res = await goatController.callNativeAction('OPEN_INVOICE', {
  'invoiceSlug': 'inv_839210',
  'amount': 4.50,
});
```

  </TabItem>
</Tabs>


---

### 6. `GET_PURCHASE_PRODUCTS` {#get-purchase-products}

Queries in-app purchase (IAP) product catalog from Apple StoreKit 2 / Google Play Billing.

**Purpose & Context:** Renders in-app subscriptions and coin bundles with localized prices and currency symbols.

#### Platform Support Matrix
`Android: ✅` `iOS: ✅` `React Native: ✅` `Flutter: ✅` `Web Mock: ✅`

#### Aliases & Method Signatures
- **Canonical Action String:** `GET_PURCHASE_PRODUCTS`
- **Supported Aliases:** `getPurchaseProducts`, `getInAppProducts`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** ✅ **No Gesture Required**

#### Input Parameters
_No input parameters required (`{}`)._


#### Return Value
- **Schema Type:** `IapProductsResult`
- **Description:** Array of IAP items (productId, title, description, price, currency, type).

```json title="Return Payload Shape"
{
  "products": "IapProductItem[]"
}
```

#### Error Codes & Troubleshooting
_This action executes without throwing domain-specific error codes._


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
const { products } = await goatBridge.callNative('GET_PURCHASE_PRODUCTS', {});
console.log('Available IAP products:', products);
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
// Query BillingClient.queryProductDetailsAsync
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
// Query StoreKit Product.products(for: identifiers)
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
final res = await goatController.callNativeAction('GET_PURCHASE_PRODUCTS', {});
```

  </TabItem>
</Tabs>


---

### 7. `RESTORE_PURCHASES` {#restore-purchases}

Restores previously purchased non-consumable products and active auto-renewing subscriptions from StoreKit / Google Play.

**Purpose & Context:** Restores user subscriptions on a new device.

#### Platform Support Matrix
`Android: ✅` `iOS: ✅` `React Native: ✅` `Flutter: ✅` `Web Mock: ✅`

#### Aliases & Method Signatures
- **Canonical Action String:** `RESTORE_PURCHASES`
- **Supported Aliases:** `restorePurchases`, `buyInAppProduct`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** ✅ **No Gesture Required**

#### Input Parameters
_No input parameters required (`{}`)._


#### Return Value
- **Schema Type:** `RestorePurchasesResult`
- **Description:** List of restored active entitlements.

```json title="Return Payload Shape"
{
  "purchases": "Array<{ invoiceSlug: string, status: string, transactionId: string, amount: number }>"
}
```

#### Error Codes & Troubleshooting
_This action executes without throwing domain-specific error codes._


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
const { purchases } = await goatBridge.callNative('RESTORE_PURCHASES', {});
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
// BillingClient.queryPurchasesAsync
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
// AppStore.sync()
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
final res = await goatController.callNativeAction('RESTORE_PURCHASES', {});
```

  </TabItem>
</Tabs>

