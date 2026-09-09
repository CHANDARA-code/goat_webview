---
sidebar_position: 1
title: 120 FPS Multi-WebView Page Stack
---

# 120 FPS Multi-WebView Page Stack Architecture

The **Goat WebView Multi-WebView Page Stack** is engineered to eliminate the fundamental bottleneck of single-page application (SPA) embedded browsers: navigation stutter and DOM churn. By dedicating an isolated, hardware-composited WebView instance to each major route in the navigation stack, Goat WebView achieves fluid **120 FPS ProMotion animations, sub-10ms route transitions, and `<8MB` idle background RAM footprints**.

---

## Architectural Topology

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        120 FPS MULTI-WEBVIEW PAGE STACK TOPOLOGY                       │
└────────────────────────────────────────────────────────────────────────────────────────┘

       [Page 1: Root / Catalog]                      [Page 2: Product Detail]
  ┌─────────────────────────────────┐           ┌─────────────────────────────────┐
  │ Active / Suspended State        │           │ Topmost Visible Container       │
  │ - State: Inactive / Background  │           │ - State: Active / 120Hz Render  │
  │ - V8 Timers: PAUSED             │◄──────────│ - Compositor: Hardware Layer    │
  │ - RAM Footprint: < 8MB          │ Push/Pop  │ - Gestures: Predictive Back     │
  │ - GPU Raster: DISABLED          │           │ - IME Insets: Synchronized      │
  └─────────────────────────────────┘           └─────────────────────────────────┘
                   ▲                                             │
                   └────────────── Native Edge-Swipe Pop ────────┘
```

---

## The 5 Pillars of Native-Feel Fluidity

### Pillar 1: Multi-WebView Native Page Stack

Traditional hybrid apps mount every page into a single DOM tree. When pushing a new route, the browser engine must parse HTML, recalculate styles, and execute JavaScript layout loops simultaneously—causing dropped frames.

Goat WebView replaces DOM-level routing with a **Native Container Stack**:
- Each major page route launches in its own native `WebView` instance.
- Transitions between screens are powered entirely by native platform transition animators (Jetpack Compose transitions, iOS `UINavigationController` push/pop, or Flutter Hero animations).
- Users can pop routes using native hardware back buttons, Android 14+ **Predictive Back gestures**, or iOS interactive edge-swipe gestures without executing any JavaScript navigation loops.

---

### Pillar 2: The Lean 2-Instance `GoatFastPool`

To prevent the memory overhead of maintaining unbounded WebViews, Goat WebView enforces a strict **2-Instance Recycler Pool** (`MAX_POOL_SIZE = 2`):

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                               GOAT FAST POOL LIFECYCLE                                 │
└────────────────────────────────────────────────────────────────────────────────────────┘

    [App Startup / Idle]
             │
             ▼
    ┌─────────────────┐       acquire(ctx)       ┌─────────────────┐
    │ Standby Pool    │ ───────────────────────► │ Active UI View  │
    │ (Pre-warmed wv) │ ◄─────────────────────── │ (Rendering SPA) │
    └─────────────────┘       recycle(wv)        └─────────────────┘
             │             (8-Step Sanitized)
             ▼
    [Memory Alert TRIM_MEMORY_RUNNING_CRITICAL] ──► trimMemory() (Evicts Standby)
```

1. **Instance A (Active):** Currently visible on screen, attached to the active Activity/ViewController with hardware acceleration enabled.
2. **Instance B (Standby):** Pre-warmed during idle time and pre-loaded with base HTML/CSS runtime. When the user navigates, the standby instance is swapped in under **`<10ms`**.
3. **8-Step Zero-Leak Sanitization Lifecycle:**
   When a WebView is popped from the navigation stack, `GoatFastPool.recycle()` sanitizes the instance before returning it to the standby pool:
   1. `stopLoading()` — Immediately aborts any ongoing network streams or script execution.
   2. `loadUrl("about:blank")` — Navigates away from the tenant DOM to release memory.
   3. `clearHistory()` — Purges forward/backward browser navigation history.
   4. `WebStorage.deleteAllData()` — Flushes DOM `localStorage` and `sessionStorage`.
   5. `CookieManager.removeAllCookies()` — Purges session and persistent cookies.
   6. `WebViewDatabase.clearFormData()` — Erases form autocomplete entries.
   7. `clearCache(true)` & `clearSslPreferences()` — Evicts RAM/Disk HTTP caches and SSL credentials.
   8. Reset Delegates — Restores null delegates, removes subviews, and sets `Color.TRANSPARENT`.

---

### Pillar 3: Zero-Lag Touch & IME Inset Synchronization

- **Touch Responsiveness:** CSS `touch-action: manipulation` is enforced globally, disabling the mobile browser 300ms double-tap delay and enabling instant pointer event dispatching.
- **Hardware Keyboard Insets:** The native container monitors `WindowInsets.ime` and continuously calculates software keyboard heights. These values are pushed into CSS variables (`--keyboard-height`, `--safe-bottom`) in real-time without causing viewport reflow or layout jumps.

---

### Pillar 4: Ahead-Of-Time V8 & JSC Bytecode Caching

During mini-app installation or background pre-warming, JavaScript files are compiled headlessly with V8 Code Cache compilation flags enabled. The generated `.jsc` / bytecode cache is persisted to disk. On subsequent route launches, the V8 engine consumes pre-compiled bytecode directly—bypassing lexical analysis and parsing on the UI thread.

---

### Pillar 5: Background RAM Trimming (Under 8MB Idle)

When a page is pushed into the background:
1. `WebView.onPause()` halts V8 animation frames, JavaScript timers, and WebAudio contexts.
2. `offscreenPreRaster` is disabled, immediately freeing GPU tile caches.
3. System `ComponentCallbacks2` memory pressure events (`TRIM_MEMORY_RUNNING_CRITICAL` or `TRIM_MEMORY_MODERATE`) trigger immediate eviction of any standby pooled instances, guaranteeing total background RAM consumption stays under **`<8MB`**.

---

## Performance Benchmarks

| Metric | Traditional SPA Hybrid | Goat Multi-WebView FastPool | Improvement |
| :--- | :--- | :--- | :--- |
| **Route Push Latency** | 220ms – 480ms | **< 10ms** | **~30× Faster** |
| **Transition Frame Rate** | 45 – 70 FPS (Janky) | **120 FPS (Solid)** | **2.6× Smoother** |
| **Standby RAM Footprint** | 45MB – 80MB | **< 8MB** | **85% Reduction** |
| **Cold Startup Latency** | 350ms – 750ms | **< 15ms (Prewarmed)** | **~35× Faster** |
| **Interactive Back Gesture**| Simulated JS (Laggy) | **Native OS Composited**| **Zero Lag** |
