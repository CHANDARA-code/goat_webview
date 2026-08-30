# @goat/compiler-uniapp

Universal Uni-app (Vue 3 / SFC) Compiler Adapter & Runtime JSAPI Bridge for Goat WebView.

`@goat/compiler-uniapp` compiles standard Uni-app mini-program source projects into Goat WebView high-performance distribution packages with full JSAPI compatibility, multi-thread isolation, hardware-accelerated same-layer rendering, and sub-millisecond bridge IPC.

---

## Features

- **Vite & Rollup Plugin**: Hooks directly into standard Uni-app Vue 3 / Vite pipelines (`goatUniAppPlugin`).
- **pages.json & manifest.json Transformer**: Normalizes Uni-app routing tables, window styles, tabBar configurations, and subpackages into schema-valid Goat `manifest.json` and `goat.config.json`.
- **Conditional Preprocessor Engine**: Evaluates `#ifdef`, `#ifndef`, `#endif` across JS/TS, Vue templates (`<!-- #ifdef -->`), CSS/SCSS (`/* #ifdef */`), and JSON comments with line-preserving masking for 1:1 SourceMap accuracy.
- **Unified JSAPI Bridge Proxy**: Implements `uni.*` global runtime shims with Promise and callback (`success`, `fail`, `complete`) dual-return patterns for 41+ mini-program APIs.
- **Dual-Thread & Single-Thread Compilation**: Emits isolated logic worker (`appservice.worker.js`) + view renderer (`webview.html` + `appview.renderer.js`) or single-thread SPA web bundles.
- **Cryptographic SHA-256 Integrity Generator**: Automatically generates and verifies `integrity.json` checksum manifests for tamper detection.

---

## Installation & Usage

### 1. Configure in `vite.config.ts`

```ts
import { defineConfig } from 'vite';
import uni from '@dcloudio/vite-plugin-uni';
import { goatUniAppPlugin } from '@goat/compiler-uniapp';

export default defineConfig({
  plugins: [
    uni(),
    goatUniAppPlugin({
      targetPlatform: 'goat',
      threadModel: 'dual-thread', // or 'single-thread'
      enableEasycom: true,
      compatMode: true,
    }),
  ],
});
```

### 2. Virtual Modules

The plugin exposes typed virtual modules:

```ts
// Import compiled Goat route table
import routes from 'virtual:goat-routes';

// Import generated manifest
import manifest from 'virtual:goat-manifest';

// Import runtime bridge
import uni from 'virtual:goat-bridge';
```

---

## JSAPI Support Matrix

| Category | Supported APIs | Bridge Action |
|---|---|---|
| **Network** | `uni.request`, `uni.downloadFile`, `uni.uploadFile` | `API_REQUEST`, `DOWNLOAD_FILE`, `UPLOAD_FILE` |
| **Storage** | `uni.getStorage`, `setStorage`, `removeStorage`, `clearStorage`, `getStorageInfo` (+ Sync variants) | `STORAGE_GET`, `STORAGE_SET`, `STORAGE_REMOVE`, `STORAGE_CLEAR` + in-memory cache |
| **Navigation** | `uni.navigateTo`, `redirectTo`, `navigateBack`, `switchTab`, `reLaunch`, `preloadPage` | `NAV_PUSH`, `NAV_REPLACE`, `NAV_POP`, `TAB_SWITCH`, `NAV_POP_TO_ROOT` |
| **UI** | `uni.showModal`, `showToast`, `hideToast`, `showLoading`, `hideLoading`, `showActionSheet`, `setNavigationBarTitle`, `setNavigationBarColor` | `SHOW_MODAL`, `SHOW_TOAST`, `HIDE_TOAST`, `SHOW_LOADING`, `HIDE_LOADING`, `SHOW_ACTION_SHEET`, `SET_NAV_BAR_TITLE`, `SET_NAV_BAR_COLOR` |
| **System** | `uni.getSystemInfo`, `getSystemInfoSync`, `getDeviceInfo`, `getWindowInfo`, `getAppBaseInfo`, `canIUse`, `vibrateShort`, `vibrateLong`, `setClipboardData`, `getClipboardData`, `makePhoneCall` | `GET_DEVICE_INFO`, `GET_SAFE_AREA_INSETS`, `HAPTIC_FEEDBACK`, `CLIPBOARD_SET`, `CLIPBOARD_GET`, `MAKE_PHONE_CALL`, `CAN_I_USE` |
| **Payment** | `uni.requestPayment` | `OPEN_INVOICE` / `REQUEST_PAYMENT` |
| **Media & Location** | `uni.scanCode`, `chooseImage`, `chooseMedia`, `previewImage`, `getLocation`, `chooseLocation`, `openLocation` | `SCAN_CODE`, `CHOOSE_MEDIA`, `PREVIEW_IMAGE`, `GET_LOCATION`, `CHOOSE_LOCATION`, `OPEN_LOCATION` |
| **Responsive Units** | `rpx2px`, `px2rpx`, `transformRpxInCss` | Pure calculation & CSS viewport clamp |

---

## Verification & Testing

Run unit & integration tests:

```bash
npm test
```

Build distribution bundle:

```bash
npm run build
```
