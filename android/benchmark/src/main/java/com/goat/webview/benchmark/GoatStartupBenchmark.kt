package com.goat.webview.benchmark

import androidx.benchmark.macro.CompilationMode
import androidx.benchmark.macro.FrameTimingMetric
import androidx.benchmark.macro.StartupMode
import androidx.benchmark.macro.StartupTimingMetric
import androidx.benchmark.macro.junit4.MacrobenchmarkRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.uiautomator.By
import androidx.test.uiautomator.Until
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

private const val SHOWCASE_PACKAGE = "com.example.miniappwebview"
private const val COLD_SLA_MS = 300
private const val WARM_SLA_MS = 50

@RunWith(AndroidJUnit4::class)
class GoatStartupBenchmark {

    @get:Rule
    val benchmarkRule = MacrobenchmarkRule()

    @Test
    fun coldStartupMiniAppShowcase() = benchmarkRule.measureRepeated(
        packageName = SHOWCASE_PACKAGE,
        metrics = listOf(StartupTimingMetric()),
        compilationMode = CompilationMode.None(),
        startupMode = StartupMode.COLD,
        iterations = 7
    ) {
        pressHome()
        startActivityAndWait()
        device.wait(Until.hasObject(By.pkg(SHOWCASE_PACKAGE).depth(0)), 10_000)
        device.waitForIdle()
    }

    @Test
    fun warmStartupMiniAppShowcase() = benchmarkRule.measureRepeated(
        packageName = SHOWCASE_PACKAGE,
        metrics = listOf(StartupTimingMetric()),
        compilationMode = CompilationMode.None(),
        startupMode = StartupMode.WARM,
        iterations = 10
    ) {
        pressHome()
        startActivityAndWait()
        device.wait(Until.hasObject(By.pkg(SHOWCASE_PACKAGE).depth(0)), 10_000)
        device.waitForIdle()
    }

    @Test
    fun frameTimingTabSwitchesAndScroll() = benchmarkRule.measureRepeated(
        packageName = SHOWCASE_PACKAGE,
        metrics = listOf(FrameTimingMetric()),
        compilationMode = CompilationMode.None(),
        startupMode = StartupMode.WARM,
        iterations = 5
    ) {
        pressHome()
        startActivityAndWait()
        device.wait(Until.hasObject(By.pkg(SHOWCASE_PACKAGE).depth(0)), 10_000)
        device.waitForIdle()
        repeat(4) {
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
}
