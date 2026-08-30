require 'json'

package = JSON.parse(File.read(File.join(__dir__, 'package.json')))

Pod::Spec.new do |s|
  s.name             = 'react-native-goat-webview'
  s.version          = package['version']
  s.summary          = package['description']
  s.homepage         = 'https://github.com/CHANDARA-code/goat_webview'
  s.license          = { :type => 'MIT', :file => 'LICENSE' }
  s.author           = { 'Goat Engineering Team' => 'dev@goat.io' }
  s.source           = { :git => 'https://github.com/CHANDARA-code/goat_webview.git', :tag => "v#{s.version}" }
  s.platform         = :ios, '15.0'
  s.swift_version    = '5.9'

  s.source_files     = 'ios/**/*.{h,m,mm,swift}'

  s.dependency 'React-Core'
  # Local monorepo checkout: the example app's Podfile resolves this via
  # `pod 'GoatWebView', :path => '../../ios'`. Published consumers pin a released version instead.
  s.dependency 'GoatWebView'
end
