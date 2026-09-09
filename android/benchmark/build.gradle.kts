plugins {
    id("com.android.test")
}

android {
    namespace = "com.goat.webview.benchmark"
    compileSdk = 36

    defaultConfig {
        minSdk = 24
        targetSdk = 36
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        // A macrobenchmark instruments a *separate* target app by design, which the shared
        // androidx.benchmark error checks flag as NOT-SELF-INSTRUMENTING. Suppressing only this
        // one is safe: it is structural, not a measurement-validity problem. The two errors that
        // WOULD invalidate numbers are fixed properly instead -- the benchmark build type is
        // non-debuggable, and :app declares <profileable android:shell="true"/>.
        testInstrumentationRunnerArguments["androidx.benchmark.suppressErrors"] =
            "NOT-SELF-INSTRUMENTING"
    }

    targetProjectPath = ":app"

    buildTypes {
        create("benchmark") {
            // A debuggable target invalidates macrobenchmark numbers; the target app is made
            // profileable instead (see app/src/main/AndroidManifest.xml).
            isDebuggable = false
            signingConfig = getByName("debug").signingConfig
            matchingFallbacks += listOf("release")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

kotlin {
    jvmToolchain(17)
}

dependencies {
    implementation(libs.androidx.macrobenchmark)
    implementation(libs.androidx.benchmark.common)
    implementation(libs.androidx.test.ext.junit)
    implementation(libs.androidx.uiautomator)
    implementation(libs.junit)
}
