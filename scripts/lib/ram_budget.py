#!/usr/bin/env python3
"""Parse `dumpsys meminfo` output and decide a RAM budget verdict.

Kept separate from check-ram-budget.sh so the parsing and threshold rules can be tested without
an attached device -- the shell around it cannot be.
"""
import re
import sys

SKIPPED = "SKIPPED"
PASS = "PASS"
FAIL = "FAIL"


class UnparseableDump(ValueError):
    pass


def extract_pss_kb(dump: str) -> int:
    """PSS in KB from a meminfo dump.

    `TOTAL PSS:` is the App Summary line emitted by `--local`. The bare `TOTAL` row is the
    per-section table's total and is only used when the summary is absent, because on some
    Android versions the two differ and the summary is the authoritative one.
    """
    if not dump or not dump.strip():
        raise UnparseableDump("empty meminfo dump")
    stripped = dump.strip()
    if re.fullmatch(r"\d+(\.\d+)?", stripped):
        return int(float(stripped))
    m = re.search(r"TOTAL PSS:\s+(\d+)", dump)
    if m:
        return int(m.group(1))
    m = re.search(r"^\s*TOTAL\s+(\d+)", dump, re.M)
    if m:
        return int(m.group(1))
    raise UnparseableDump("no TOTAL PSS or TOTAL row found in meminfo dump")


def evaluate_pss(app_mb: float, renderer_mb: float = None, ceiling_mb: float = 150.0):
    """Returns (verdict, app_pss_mb, renderer_pss_mb_or_None, lines_to_print)."""
    lines = [
        "=== Goat WebView RAM Budget Report ===",
        f"App process steady-state PSS   : {app_mb:.2f} MB (ceiling {ceiling_mb:.1f} MB)",
    ]
    if renderer_mb is None:
        lines.append("Renderer process PSS (isolated): not detected (in-process, or no sandboxed renderer)")
    else:
        lines.append(f"Renderer process PSS (isolated): {renderer_mb:.2f} MB")
        lines.append(f"Combined app + renderer PSS    : {app_mb + renderer_mb:.2f} MB")

    if app_mb > ceiling_mb:
        verdict = FAIL
        lines.append(f"FAIL: app steady-state PSS {app_mb:.2f} MB exceeds the {ceiling_mb:.1f} MB ceiling")
    else:
        verdict = PASS
        headroom = ceiling_mb - app_mb
        lines.append(f"PASS: app steady-state PSS is {headroom:.2f} MB under the {ceiling_mb:.1f} MB ceiling")
    return verdict, app_mb, renderer_mb, lines


def evaluate_pss_kb(app_kb: float, renderer_kb: float = None, ceiling_mb: float = 150.0):
    """Returns (verdict, app_pss_mb, renderer_pss_mb_or_None, lines_to_print)."""
    app_mb = app_kb / 1024.0
    renderer_mb = (renderer_kb / 1024.0) if renderer_kb is not None else None
    return evaluate_pss(app_mb, renderer_mb, ceiling_mb)


def evaluate(app_dump: str, renderer_dump: str = "", ceiling_mb: float = 150.0):
    """Returns (verdict, app_pss_mb, renderer_pss_mb_or_None, lines_to_print)."""
    app_mb = extract_pss_kb(app_dump) / 1024.0

    renderer_mb = None
    if renderer_dump and renderer_dump.strip():
        try:
            renderer_mb = extract_pss_kb(renderer_dump) / 1024.0
        except UnparseableDump:
            renderer_mb = None

    return evaluate_pss(app_mb, renderer_mb, ceiling_mb)


def main(argv):
    ceiling = float(argv[1])
    app_dump = argv[2]
    renderer_dump = argv[3] if len(argv) > 3 else ""
    try:
        verdict, _, _, lines = evaluate(app_dump, renderer_dump, ceiling)
    except UnparseableDump as exc:
        print(f"ERROR: {exc}")
        print("Refusing to report a verdict from a dump that could not be parsed.")
        return 2
    print("\n".join(lines))
    return 0 if verdict == PASS else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv))
