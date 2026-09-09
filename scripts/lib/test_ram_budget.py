#!/usr/bin/env python3
import sys
import unittest

sys.path.insert(0, __file__.rsplit("/", 1)[0])
from ram_budget import (
    FAIL,
    PASS,
    UnparseableDump,
    evaluate,
    evaluate_pss,
    evaluate_pss_kb,
    extract_pss_kb,
)

APP_SUMMARY_DUMP = """
 App Summary
                       Pss(KB)                        Rss(KB)
                        ------                         ------
           Java Heap:     3032                          12844
         Native Heap:    29491                          31204
                TOTAL PSS:   143360            TOTAL RSS:   210488
"""

SECTION_TABLE_ONLY = """
                   Pss      Private     Private
                 Total        Dirty       Clean
                ------       ------      ------
  Native Heap    29491        29400          12
    Dalvik Heap   3032         2900           4
        TOTAL    143360       120000        4096
"""


class ExtractPss(unittest.TestCase):
    def test_prefers_the_app_summary_total(self):
        self.assertEqual(extract_pss_kb(APP_SUMMARY_DUMP), 143360)

    def test_falls_back_to_the_section_table_total(self):
        self.assertEqual(extract_pss_kb(SECTION_TABLE_ONLY), 143360)

    def test_the_summary_wins_when_the_two_disagree(self):
        both = SECTION_TABLE_ONLY + "\n                TOTAL PSS:   99999\n"
        self.assertEqual(extract_pss_kb(both), 99999)

    def test_an_empty_dump_raises_rather_than_returning_zero(self):
        for bad in ("", "   \n  ", "error: device offline"):
            with self.assertRaises(UnparseableDump):
                extract_pss_kb(bad)

    def test_a_truncated_dump_raises_rather_than_matching_a_stray_number(self):
        with self.assertRaises(UnparseableDump):
            extract_pss_kb("Applications Memory Usage (in Kilobytes):\nUptime: 123456")

    def test_numeric_string_is_parsed_as_pss_kb(self):
        self.assertEqual(extract_pss_kb("143360"), 143360)
        self.assertEqual(extract_pss_kb("  153600.0 \n"), 153600)


class Evaluate(unittest.TestCase):
    def test_under_ceiling_passes(self):
        verdict, app_mb, _, _ = evaluate(APP_SUMMARY_DUMP, ceiling_mb=150.0)
        self.assertEqual(verdict, PASS)
        self.assertAlmostEqual(app_mb, 140.0, places=1)

    def test_evaluate_pss_under_ceiling(self):
        verdict, app_mb, renderer_mb, lines = evaluate_pss(140.0, ceiling_mb=150.0)
        self.assertEqual(verdict, PASS)
        self.assertEqual(app_mb, 140.0)
        self.assertIsNone(renderer_mb)
        self.assertTrue(any("PASS: app steady-state PSS is 10.00 MB under the 150.0 MB ceiling" in ln for ln in lines))

    def test_evaluate_pss_over_ceiling(self):
        verdict, app_mb, _, lines = evaluate_pss(155.5, ceiling_mb=150.0)
        self.assertEqual(verdict, FAIL)
        self.assertEqual(app_mb, 155.5)
        self.assertTrue(any("FAIL: app steady-state PSS 155.50 MB exceeds the 150.0 MB ceiling" in ln for ln in lines))

    def test_evaluate_pss_kb_under_ceiling(self):
        verdict, app_mb, _, _ = evaluate_pss_kb(143360, ceiling_mb=150.0)
        self.assertEqual(verdict, PASS)
        self.assertAlmostEqual(app_mb, 140.0, places=1)

    def test_evaluate_pss_kb_over_ceiling(self):
        verdict, app_mb, _, _ = evaluate_pss_kb(153600 + 1024, ceiling_mb=150.0)
        self.assertEqual(verdict, FAIL)

    def test_over_ceiling_fails(self):
        verdict, _, _, _ = evaluate(APP_SUMMARY_DUMP, ceiling_mb=139.0)
        self.assertEqual(verdict, FAIL)

    def test_exactly_at_the_ceiling_passes(self):
        verdict, app_mb, _, _ = evaluate(APP_SUMMARY_DUMP, ceiling_mb=143360 / 1024.0)
        self.assertEqual(verdict, PASS)

    def test_one_kb_over_the_ceiling_fails(self):
        verdict, _, _, _ = evaluate(APP_SUMMARY_DUMP, ceiling_mb=(143360 - 1) / 1024.0)
        self.assertEqual(verdict, FAIL)

    def test_renderer_pss_is_reported_and_summed_but_not_charged_to_the_ceiling(self):
        renderer = "                TOTAL PSS:   40960\n"
        verdict, app_mb, renderer_mb, lines = evaluate(APP_SUMMARY_DUMP, renderer, ceiling_mb=150.0)
        self.assertEqual(verdict, PASS)
        self.assertAlmostEqual(renderer_mb, 40.0, places=1)
        self.assertTrue(any("Combined app + renderer PSS    : 180.00 MB" in ln for ln in lines))

    def test_an_unparseable_renderer_dump_does_not_sink_the_run(self):
        verdict, _, renderer_mb, lines = evaluate(APP_SUMMARY_DUMP, "device offline", ceiling_mb=150.0)
        self.assertEqual(verdict, PASS)
        self.assertIsNone(renderer_mb)
        self.assertTrue(any("not detected" in ln for ln in lines))

    def test_an_unparseable_app_dump_is_never_a_pass(self):
        with self.assertRaises(UnparseableDump):
            evaluate("", ceiling_mb=150.0)


if __name__ == "__main__":
    unittest.main(verbosity=2)
