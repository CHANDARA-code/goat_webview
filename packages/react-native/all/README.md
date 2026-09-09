# @goat-webview/all

Option B umbrella: every Goat WebView React Native capability companion in one dependency.

```ts
import { registerAllGoatCapabilities } from '@goat-webview/all';

registerAllGoatCapabilities();
```

Prefer the individual `@goat-webview/*` packages (Option A) if you only need a few capabilities.
Every companion routes through `GoatWebViewNativeModule.executeAction` — none of them synthesise
results, and `scripts/verify-companion-actions.mjs` enforces that.
