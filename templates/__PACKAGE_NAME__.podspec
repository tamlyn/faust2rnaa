require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))
repo = package["repository"]
repo_url = repo.is_a?(Hash) ? repo["url"] : repo
homepage = package["homepage"] || (repo_url ? repo_url.gsub("git+","").gsub(".git","") : "https://github.com/example/__PACKAGE_NAME__")

Pod::Spec.new do |s|
  s.name         = "__PACKAGE_NAME__"
  s.version      = package["version"]
  s.summary      = package["description"] || "__PACKAGE_NAME__ TurboModule"
  s.license      = package["license"] || "MIT"
  s.author       = package["author"] || ""
  s.platforms    = { :ios => "14.0" }
  s.homepage     = homepage
  s.source       = { :git => (repo_url || "https://github.com/example/__PACKAGE_NAME__.git"), :tag => s.version }

  s.source_files = [
    "ios/**/*.{h,m,mm}",
    "shared/**/*.{h,cpp}",
    "build/generated/ios/**/*.{h,m,mm,cpp}"
  ]

  s.header_mappings_dir = "shared"
  s.header_dir = "__CODEGEN_NAME__"

  install_modules_dependencies(s)
  s.dependency "RNAudioAPI"

  s.pod_target_xcconfig = {
    "HEADER_SEARCH_PATHS" => [
      '"$(PODS_TARGET_SRCROOT)"',
      '"$(PODS_TARGET_SRCROOT)/shared"',
      '"$(PODS_TARGET_SRCROOT)/build/generated/ios"'
    ].join(' '),
    "CLANG_CXX_LANGUAGE_STANDARD" => "c++20",
    "OTHER_CPLUSPLUSFLAGS" => "-Wno-documentation"
  }
end
