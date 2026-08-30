---
sidebar_position: 6
title: Headless Runtime & Fast Pools
---

# Headless Runtime & Fast Pools

To achieve **sub-15ms cold startup times** and execute background data synchronization without mounting UI elements, Goat WebView provides a dedicated **Headless Runtime Engine** paired with the **`GoatFastPool`** instance recycler.

---

## 🏛️ Headless Runtime Execution

The Headless Runtime instantiates invisible, unattached WebViews to execute background tasks, service workers, pre-fetching algorithms, and offline sync routines:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        HEADLESS RUNTIME & PRE-WARMING PIPELINE                         │
└────────────────────────────────────────────────────────────────────────────────────────┘

  [Application Boot]
         │
         ▼
  GoatRuntime.initialize()
         │
         ├─────────────────────────────────────────┐
         ▼                                         ▼
  [Headless Runtime Engine]              [GoatFastPool Standby]
  - Background JS Sync                   - Pre-warmed base HTML/CSS
  - Pre-fetch API Cache                  - Ready for sub-10ms UI mount
  - Zero View Hierarchy Attachment       - Automatic memory trim hooks
```

---

## ⚡ Key Capabilities

1. **Background Tasks without UI Overhead:**
   Execute cron-style sync routines, push notification processing, and offline state reconciliation without rendering DOM elements to the screen.
2. **LRU Instance Pre-Warming:**
   Pre-instantiates standby WebViews with pre-loaded base JavaScript polyfills, reducing first-contentful paint (FCP) on user navigation.
3. **OS Memory Pressure Resilience:**
   Listens for Android `ComponentCallbacks2` and iOS memory warnings, automatically pruning headless instances when system RAM is constrained.
