#!/usr/bin/env python3
"""Report Goat* types that no non-test code in the SDK references.

This exists because the same defect keeps recurring: a class or constant is written, unit-tested,
and documented as active, while nothing in production ever calls it. Confirmed instances include
MODULAR_PLUGIN_ACTIONS, GoatManifestParser (until it was wired), GoatManifestWindowApplier, and
three properties on iOS's GoatScriptMessageHandler that shipped with no assignment.

ADVISORY, not a gate. A hit is not automatically a defect: this SDK's public surface is meant to be
called by host apps, so a public entry point legitimately has no internal caller. The output is a
review list -- for each entry, decide whether it is public API (fine) or internal machinery (dead).
PUBLIC_API below records the ones already reviewed, so the list stays short enough to read.
"""
import os
import re
import sys

PUBLIC_API = {
    # Host-facing entry points documented as SDK deliverables; no internal caller is expected.
    "GoatHeadlessWebView", "GoatRemoteManager", "GoatIntegrityVerifier", "GoatDeltaPatcher",
    "GoatChannelManager", "GoatAppInitializer", "GoatProxyController", "GoatCookie",
    "GoatClaimResult", "GoatOAuthException", "GoatDeltaPatcherError",
    "GoatStripePaymentAdapter", "GoatStripeLinkPaymentAdapter", "GoatAlipayPaymentAdapter",
    "GoatBakongKhqrPaymentAdapter", "GoatPayPayPaymentAdapter",
    "GoatBottomSheetContainer", "GoatBottomSheetState", "GoatBottomSheetTabsOverlayController",
    "GoatSheetValue", "GoatNavigationBarState", "GoatNavigationBarView",
    "GoatComposeLifecycleObserver", "GoatShowcaseAppView",
    "GoatHapticImpactStyle", "GoatHapticNotificationType", "GoatGpsPreset",
    "GoatBackGestureState", "GoatFpsSampler", "GoatHapticProfileName", "GoatSafeAreaInsets",
    "GoatPermissionStatus", "GoatPaymentTimeoutError", "GoatNativeWebSocketSession",
    "GoatDebugInspectorView", "GoatHostActionSheet", "GoatHostModal", "GoatHostUiState",
    "GoatZipExtractor",
    # Modular feature entry points: a host links these, the SDK never calls them internally.
    # That is the whole point of "one feature = one module", so absence of an internal caller is
    # the expected shape here, not a defect.
    "GoatWebViewBiometricsFeature", "GoatWebViewBluetoothFeature", "GoatWebViewLocationFeature",
    "GoatWebViewMediaFeature", "GoatWebViewNetworkFeature", "GoatWebViewScannerFeature",
    # Host-facing UI components and benchmark entry points.
    "GoatBottomSheetController", "GoatBottomSheetView", "GoatNavigationBar",
    "GoatDefaultPaymentServerProxyClient", "GoatCompatAdapterBenchmark",
}

SKIP_DIRS = ("/build/", "/node_modules/", "/.git/", "/DerivedData/")
TEST_MARKERS = ("/test/", "/androidTest/", "/Tests/")

TARGETS = [
    ("Kotlin", "android", ".kt", None,
     r'^\s*(?:public\s+|internal\s+)?(?:data\s+|sealed\s+|abstract\s+|open\s+)?(?:object|class)\s+(Goat[A-Za-z0-9_]+)'),
    ("Swift", "ios/Sources", ".swift", "ios/Tests",
     r'^\s*(?:public\s+|internal\s+)?(?:final\s+)?(?:class|struct|enum)\s+(Goat[A-Za-z0-9_]+)'),
]


def collect(base, ext, want_test):
    found = []
    for dirpath, _, filenames in os.walk(base):
        if any(s in dirpath for s in SKIP_DIRS):
            continue
        if (any(m in dirpath for m in TEST_MARKERS)) != want_test:
            continue
        found.extend(os.path.join(dirpath, f) for f in filenames if f.endswith(ext))
    return found


def main():
    rows = []
    for lang, base, ext, test_base, pattern in TARGETS:
        if not os.path.isdir(base):
            continue
        main_files = collect(base, ext, want_test=False)
        if test_base:
            test_files = collect(test_base, ext, want_test=False) + collect(test_base, ext, want_test=True)
        else:
            test_files = collect(base, ext, want_test=True)

        main_src = {p: open(p, encoding="utf8", errors="ignore").read() for p in main_files}
        test_src = [open(p, encoding="utf8", errors="ignore").read() for p in test_files]

        declared = {}
        for path, src in main_src.items():
            for m in re.finditer(pattern, src, re.M):
                declared.setdefault(m.group(1), path)

        for name, decl_path in sorted(declared.items()):
            if name in PUBLIC_API:
                continue
            word = re.compile(r"\b" + re.escape(name) + r"\b")
            other_files = sum(len(word.findall(s)) for p, s in main_src.items() if p != decl_path)
            # Uses inside the declaring file count too -- a type declared in the same file that uses
            # it (GoatZipExtractor inside GoatRemoteManager.swift) is wired, not dead. Subtract the
            # declaration occurrences so the declaration itself is not mistaken for a use.
            own_text = main_src[decl_path]
            own_total = len(word.findall(own_text))
            own_decls = len([m for m in re.finditer(pattern, own_text, re.M) if m.group(1) == name])
            if other_files + (own_total - own_decls) > 0:
                continue
            test_refs = sum(len(word.findall(s)) for s in test_src)
            rows.append((lang, name, os.path.relpath(decl_path), test_refs))

    if not rows:
        print("No unreviewed Goat* type lacks a non-test reference.")
        return 0

    print("Goat* types with NO non-test reference in the SDK")
    print("=" * 100)
    print(f"{'lang':<8}{'symbol':<40}{'test refs':<11}declared in")
    print("-" * 100)
    for lang, name, path, refs in rows:
        print(f"{lang:<8}{name:<40}{refs:<11}{path}")
    print(f"\n{len(rows)} to review. Each is either public API (add it to PUBLIC_API in this script)")
    print("or internal machinery with no caller (a defect -- wire it or remove it).")
    print("\nAdvisory only; exits 0 either way.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
