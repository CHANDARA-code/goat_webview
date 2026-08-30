// swift-tools-version: 5.9
import PackageDescription

let featureTargets = [
    ("GoatWebViewMedia", ["AVFoundation", "MediaPlayer"]),
    ("GoatWebViewScanner", ["Vision", "AVFoundation"]),
    ("GoatWebViewLocation", ["CoreLocation", "MapKit"]),
    ("GoatWebViewBiometrics", ["LocalAuthentication", "Security"]),
    ("GoatWebViewBluetooth", ["CoreBluetooth", "CoreNFC"]),
    ("GoatWebViewNetwork", ["Network"])
]

let package = Package(
    name: "GoatWebView",
    platforms: [
        .iOS(.v15)
    ],
    products: [
        .library(name: "GoatWebView", targets: ["GoatWebView"]),
        .library(name: "GoatWebViewCore", targets: ["GoatWebView"]),
        .library(name: "GoatWebViewAllIn", targets: ["GoatWebView"] + featureTargets.map(\.0)),
    ] + featureTargets.map { .library(name: $0.0, targets: [$0.0]) },
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
    ] + featureTargets.map { name, frameworks in
        .target(
            name: name,
            dependencies: ["GoatWebView"],
            path: "ios/Sources/\(name)",
            linkerSettings: frameworks.map { .linkedFramework($0) }
        )
    } + [
        .testTarget(
            name: "GoatWebViewTests",
            dependencies: ["GoatWebView"] + featureTargets.map { .byName(name: $0.0) },
            path: "ios/Tests/GoatWebViewTests"
        )
    ]
)
