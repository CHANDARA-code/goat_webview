---
sidebar_position: 7
title: Ahead-Of-Time Bytecode Caching
---

# Ahead-Of-Time Bytecode Caching

To eliminate JavaScript parsing and compilation overhead on the main UI thread, Goat WebView implements **Ahead-Of-Time (AOT) V8 Code Cache & JavaScriptCore (JSC) Bytecode Pre-compilation**.

---

## The Compilation Bottleneck in Mobile WebViews

When a mobile browser loads a 1MB JavaScript bundle:
1. **Lexical Analysis (Scanning):** Converting source text into tokens (~25ms).
2. **Parsing (AST Generation):** Constructing the Abstract Syntax Tree (~40ms).
3. **Bytecode Compilation:** Generating executable V8 Ignition / JSC bytecode (~35ms).

Total CPU stall on mid-range devices: **100ms+ of main-thread jank before the first line of code executes**.

---

## How Goat Bytecode Caching Works

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        AHEAD-OF-TIME BYTECODE CACHING PIPELINE                         │
└────────────────────────────────────────────────────────────────────────────────────────┘

  [Mini-App Installation / Download]
                 │
                 ▼
  [Headless Compilation Engine] ──► Produce V8 Code Cache / JSC Bytecode (.jsc)
                 │
                 ▼
  [Tenant Cache Directory: cache/miniapps/{appId}/bytecode/]
                 │
                 ▼
  [Subsequent Mini-App Launch]  ──► Consume .jsc bytecode directly (0ms Parse/Lex)
```

1. **Pre-Compilation during Bundle Extraction:**
   When a mini-app `.zip` bundle is installed or updated via OTA, Goat WebView's headless engine evaluates JavaScript files with V8 compilation flags enabled (`--cache-compiled-code`).
2. **Deterministic Cache Persistence:**
   The resulting bytecode artifacts (`.jsc`) and SHA-256 metadata are stored in tenant-scoped cache directories (`cache/miniapps/{appId}/bytecode/`).
3. **Zero-Overhead Script Execution:**
   On subsequent launches, the WebView consumes the cached bytecode directly, bypassing parsing and lexical analysis entirely for instant startup.
