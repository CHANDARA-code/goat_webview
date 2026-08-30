pluginManagement {
    repositories {
        google {
            content {
                includeGroupByRegex("androidx.*")
                includeGroupByRegex("com\\.android.*")
                includeGroupByRegex("com\\.google.*")
            }
        }
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google {
            content {
                includeGroupByRegex("androidx.*")
                includeGroupByRegex("com\\.android.*")
                includeGroupByRegex("com\\.google.*")
            }
        }
        mavenCentral()
    }
}

plugins {
    id("org.gradle.toolchains.foojay-resolver-convention") version "1.0.0"
}

rootProject.name = "MiniAppWebView"
include(":app")
include(":benchmark")
include(":core")
include(":feature-media")
include(":feature-scanner")
include(":feature-location")
include(":feature-biometrics")
include(":feature-bluetooth")
include(":feature-network")
include(":feature-payments-stripe")
include(":feature-payments-alipay")
include(":feature-payments-paypay")
include(":feature-payments-bakong")
include(":features-all-in")
