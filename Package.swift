// swift-tools-version: 5.9
import PackageDescription

let featureTargets: [(name: String, frameworks: [String])] = [
    (name: "GoatWebViewMedia",     frameworks: ["AVFoundation", "MediaPlayer"]),
    (name: "GoatWebViewScanner",   frameworks: ["Vision", "AVFoundation"]),
    (name: "GoatWebViewLocation",  frameworks: ["CoreLocation", "MapKit"]),
    (name: "GoatWebViewBiometrics",frameworks: ["LocalAuthentication", "Security"]),
    (name: "GoatWebViewBluetooth", frameworks: ["CoreBluetooth", "CoreNFC"]),
    (name: "GoatWebViewNetwork",   frameworks: ["Network"])
]

// Frameworks that only exist on iOS — linked conditionally so `swift test` on macOS compiles.
let iosOnlyFrameworks: Set<String> = ["MediaPlayer", "CoreNFC", "Vision", "MapKit"]

func linkerSettings(for frameworks: [String]) -> [LinkerSetting] {
    frameworks.map { fw -> LinkerSetting in
        if iosOnlyFrameworks.contains(fw) {
            return .linkedFramework(fw, .when(platforms: [.iOS]))
        }
        return .linkedFramework(fw)
    }
}

let package = Package(
    name: "GoatWebView",
    platforms: [
        .iOS(.v15),
        .macOS(.v13)
    ],
    products: [
        .library(name: "GoatWebView",    targets: ["GoatWebView"]),
        .library(name: "GoatWebViewCore", targets: ["GoatWebView"]),
        .library(
            name: "GoatWebViewAllIn",
            targets: ["GoatWebView"] + featureTargets.map(\.name)
        ),
    ] + featureTargets.map { ft in
        Product.library(name: ft.name, targets: [ft.name])
    },
    dependencies: [],
    targets: [
        .target(
            name: "GoatWebView",
            dependencies: [],
            path: "ios/Sources/GoatWebView",
            resources: [
                .process("PrivacyInfo.xcprivacy")
            ]
        )
    ] + featureTargets.map { ft in
        Target.target(
            name: ft.name,
            dependencies: ["GoatWebView"],
            path: "ios/Sources/\(ft.name)",
            linkerSettings: linkerSettings(for: ft.frameworks)
        )
    } + [
        .testTarget(
            name: "GoatWebViewTests",
            dependencies: ["GoatWebView"] + featureTargets.map { .byName(name: $0.name) },
            path: "ios/Tests/GoatWebViewTests"
        )
    ]
)
