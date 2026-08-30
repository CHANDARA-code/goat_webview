Pod::Spec.new do |s|
  s.name             = 'GoatWebView'
  s.version          = '1.0.0-alpha.1'
  s.summary          = 'Ultra-high performance, modular multi-tenant sandboxed WebView engine for iOS.'
  s.description      = <<-DESC
Goat WebView is a blazing-fast, sandboxed, modular Mini-App and Web3 runtime engine with 120 FPS ProMotion acceleration, sub-millisecond async IPC bridge, and plug-and-play feature modules.
                       DESC
  s.homepage         = 'https://github.com/CHANDARA-code/goat_webview'
  s.license          = { :type => 'MIT', :file => 'LICENSE' }
  s.author           = { 'Goat Team' => 'dev@goat.io' }
  s.source           = { :git => 'https://github.com/CHANDARA-code/goat_webview.git', :tag => "v#{s.version}" }
  s.platform         = :ios, '15.0'
  s.swift_version    = '5.9'

  s.default_subspecs = 'Core'

  s.subspec 'Core' do |core|
    core.source_files = 'Sources/GoatWebView/**/*.{swift}'
    core.resource_bundles = {
      'GoatWebView_Privacy' => ['Sources/GoatWebView/PrivacyInfo.xcprivacy']
    }
    core.frameworks = 'WebKit', 'UIKit', 'SwiftUI', 'Security'
  end

  s.subspec 'Media' do |media|
    media.dependency 'GoatWebView/Core'
    media.frameworks = 'AVFoundation', 'MediaPlayer'
  end

  s.subspec 'Scanner' do |scanner|
    scanner.dependency 'GoatWebView/Core'
    scanner.frameworks = 'Vision', 'AVFoundation'
  end

  s.subspec 'Location' do |loc|
    loc.dependency 'GoatWebView/Core'
    loc.frameworks = 'CoreLocation', 'MapKit'
  end

  s.subspec 'Biometrics' do |bio|
    bio.dependency 'GoatWebView/Core'
    bio.frameworks = 'LocalAuthentication', 'Security'
  end

  s.subspec 'Bluetooth' do |bt|
    bt.dependency 'GoatWebView/Core'
    bt.frameworks = 'CoreBluetooth', 'CoreNFC'
  end

  s.subspec 'Network' do |net|
    net.dependency 'GoatWebView/Core'
    net.frameworks = 'Network'
  end
end
