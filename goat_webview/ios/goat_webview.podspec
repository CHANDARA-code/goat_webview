require 'yaml'

pubspec = YAML.load_file(File.join(__dir__, '..', 'pubspec.yaml'))

Pod::Spec.new do |s|
  s.name             = 'goat_webview'
  s.version          = pubspec['version']
  s.summary          = pubspec['description']
  s.homepage         = pubspec['homepage']
  s.license          = { :type => 'MIT' }
  s.author           = { 'Goat Team' => 'dev@goat.io' }
  s.source           = { :path => '.' }
  s.source_files     = 'Classes/**/*.{h,m,swift}'
  s.dependency 'Flutter'
  # Local monorepo checkout: `example/ios/Podfile` resolves this via
  # `pod 'GoatWebView', :path => '../../../ios'`. Published consumers pin a released version.
  s.dependency 'GoatWebView'

  s.platform = :ios, '15.0'
  s.swift_version = '5.9'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
end
