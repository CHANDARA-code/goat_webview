plugins {
    alias(libs.plugins.android.library)
    alias(libs.plugins.kotlin.serialization)
}

android {
    namespace = "com.goat.webview.features.all"
    compileSdk = 36

    defaultConfig {
        minSdk = 24
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    testOptions {
        unitTests.isReturnDefaultValues = true
    }
}

kotlin {
    jvmToolchain(17)
}

dependencies {
    api(project(":core"))
    api(project(":feature-media"))
    api(project(":feature-scanner"))
    api(project(":feature-location"))
    api(project(":feature-biometrics"))
    api(project(":feature-bluetooth"))
    api(project(":feature-network"))
    api(project(":feature-payments-stripe"))
    api(project(":feature-payments-alipay"))
    api(project(":feature-payments-paypay"))
    api(project(":feature-payments-bakong"))

    testImplementation(libs.junit)
    testImplementation(libs.kotlinx.coroutines.test)
}

android {
    publishing {
        singleVariant("release") {
            withSourcesJar()
        }
    }
}

apply(from = "../publish-maven.gradle.kts")
