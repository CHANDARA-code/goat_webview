---
sidebar_position: 5
title: Web JS SDK
---

# Web JS SDK Integration

Build rich mini-apps in HTML, CSS, JavaScript, React, Vue, or Svelte using the lightweight `@goat/miniapp-sdk`.

## Installation

```bash
npm install @goat/miniapp-sdk
```

## Quick Example

```typescript
import { GoatSDK } from '@goat/miniapp-sdk';

const sdk = new GoatSDK();

// Check if a capability is supported on current host
const canUseNfc = await sdk.canIUse('NFC_READ_TAG');
if (canUseNfc) {
  sdk.onNfcTagDiscovered((tag) => {
    console.log('Discovered NFC Tag:', tag.uid);
  });
}

// Perform sandboxed storage
await sdk.storage.set('theme', 'dark');
const theme = await sdk.storage.get('theme');

// Trigger haptic feedback
await sdk.hapticFeedback({ style: 'medium' });
```
