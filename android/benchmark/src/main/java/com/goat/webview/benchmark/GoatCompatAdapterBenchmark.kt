package com.goat.webview.benchmark

import androidx.benchmark.macro.CompilationMode
import androidx.benchmark.macro.ExperimentalMetricApi
import androidx.benchmark.macro.FrameTimingMetric
import androidx.benchmark.macro.MemoryUsageMetric
import androidx.benchmark.macro.StartupMode
import androidx.benchmark.macro.StartupTimingMetric
import androidx.benchmark.macro.junit4.MacrobenchmarkRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.uiautomator.By
import androidx.test.uiautomator.Until
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/**
 * The compat-adapter half of the perf/RAM
 * contract. Baseline = `bench/compat_size_check`'s `main_a_engine_only.dart` entry point
 * (`goat_webview` only). Candidate = the same app rebuilt from `main_c_adapter_used.dart`
 * (`goat_webview_compat`'s `InAppWebView`, settings, pull-to-refresh, and callbacks all live).
 *
 * Both variants share one applicationId (`com.goat.bench.compat_size_check`) — they differ only
 * in which entry point was baked into the installed APK — so this class targets the same package
 * name for both runs; `scripts/benchmark-compat-adapter.sh` is what rebuilds+reinstalls the APK
 * between the baseline and candidate passes and diffs the two JSON reports against the §4
 * budgets. Reusing one package name (rather than parameterizing it) keeps this class itself
 * honest to what changed: only the code inside the APK, nothing about how it's measured.
 *
 * NOTE: written but not yet run — see T12's still-open CI/physical-device requirement.
 */
private const val COMPAT_TARGET_PACKAGE = "com.goat.bench.compat_size_check"

@OptIn(ExperimentalMetricApi::class)
@RunWith(AndroidJUnit4::class)
class GoatCompatAdapterBenchmark {

    @get:Rule
    val benchmarkRule = MacrobenchmarkRule()

    /** §4: "Cold start to first contentful paint" / "Warm start (prewarmed instance)". */
    @Test
    fun coldStartup() = benchmarkRule.measureRepeated(
        packageName = COMPAT_TARGET_PACKAGE,
        metrics = listOf(StartupTimingMetric()),
        compilationMode = CompilationMode.None(),
        startupMode = StartupMode.COLD,
        iterations = 20
    ) {
        pressHome()
        startActivityAndWait()
        device.wait(Until.hasObject(By.pkg(COMPAT_TARGET_PACKAGE).depth(0)), 10_000)
        device.waitForIdle()
    }

    @Test
    fun warmStartup() = benchmarkRule.measureRepeated(
        packageName = COMPAT_TARGET_PACKAGE,
        metrics = listOf(StartupTimingMetric()),
        compilationMode = CompilationMode.None(),
        startupMode = StartupMode.WARM,
        iterations = 20
    ) {
        pressHome()
        startActivityAndWait()
        device.wait(Until.hasObject(By.pkg(COMPAT_TARGET_PACKAGE).depth(0)), 10_000)
        device.waitForIdle()
    }

    /**
     * §4: "Jank frames during a 30 s scroll + 200-navigation redirect storm, default nav mode."
     * The compat_size_check fixture app has no redirect-storm harness of its own — this exercises
     * the same WebView-hosting Activity under a sustained scroll, which is the frame-timing half
     * of that budget; the redirect-storm navigation count is `bench/goat_vs_fiw`'s concern, not
     * this fixture's.
     */
    @Test
    fun frameTimingDuringScroll() = benchmarkRule.measureRepeated(
        packageName = COMPAT_TARGET_PACKAGE,
        metrics = listOf(FrameTimingMetric()),
        compilationMode = CompilationMode.None(),
        startupMode = StartupMode.WARM,
        iterations = 10
    ) {
        pressHome()
        startActivityAndWait()
        device.wait(Until.hasObject(By.pkg(COMPAT_TARGET_PACKAGE).depth(0)), 10_000)
        device.waitForIdle()
        repeat(6) {
            device.swipe(
                device.displayWidth / 2,
                device.displayHeight * 3 / 4,
                device.displayWidth / 2,
                device.displayHeight / 4,
                200
            )
            device.waitForIdle()
        }
    }

    /**
     * §4: the three steady-state RSS rows (adapter loaded, per unused feature, all features
     * active) all reduce to "measure resident memory after the app has settled" — which variant
     * of the fixture app is installed when this runs is what actually changes; this test's job is
     * only to capture the number.
     */
    @Test
    fun steadyStateMemory() = benchmarkRule.measureRepeated(
        packageName = COMPAT_TARGET_PACKAGE,
        metrics = listOf(MemoryUsageMetric(MemoryUsageMetric.Mode.Last)),
        compilationMode = CompilationMode.None(),
        startupMode = StartupMode.WARM,
        iterations = 10
    ) {
        pressHome()
        startActivityAndWait()
        device.wait(Until.hasObject(By.pkg(COMPAT_TARGET_PACKAGE).depth(0)), 10_000)
        device.waitForIdle()
        // Let the WebView finish its initial navigation and any idle-callback work settle before
        // the metric captures memory — a mid-load snapshot would just measure noise.
        Thread.sleep(1_500)
    }
}
