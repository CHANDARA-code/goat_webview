apply(plugin = "org.gradle.maven-publish")

afterEvaluate {
    val publishingExt = extensions.getByType(org.gradle.api.publish.PublishingExtension::class.java)
    publishingExt.publications {
        register<MavenPublication>("release") {
            from(components["release"])
            groupId = "com.goat.webview"
            artifactId = project.name
            version = (project.findProperty("GOAT_PUBLISH_VERSION") as String?) ?: "1.0.0-alpha.2"
            pom {
                name.set("Goat WebView ${project.name}")
                description.set("Goat WebView mini-app engine module ${project.name}.")
                url.set("https://github.com/CHANDARA-code/goat_webview")
                licenses {
                    license {
                        name.set("MIT License")
                        url.set("https://github.com/CHANDARA-code/goat_webview/blob/main/LICENSE")
                    }
                }
                scm {
                    connection.set("scm:git:git://github.com/CHANDARA-code/goat_webview.git")
                    developerConnection.set("scm:git:ssh://github.com/CHANDARA-code/goat_webview.git")
                    url.set("https://github.com/CHANDARA-code/goat_webview")
                }
            }
        }
    }
    publishingExt.repositories {
        maven {
            name = "GitHubPackages"
            url = uri("https://maven.pkg.github.com/CHANDARA-code/goat_webview")
            credentials {
                username = System.getenv("GITHUB_ACTOR") ?: System.getenv("GOAT_MAVEN_USERNAME") ?: ""
                password = System.getenv("GITHUB_TOKEN") ?: System.getenv("GOAT_MAVEN_PASSWORD") ?: ""
            }
        }
    }
}
