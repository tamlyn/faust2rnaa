module.exports = {
  dependency: {
    platforms: {
      android: {
        cmakeListsPath: "CMakeLists.txt",
        cxxModuleHeaderName: "NativeAudioProcessingModule",
      },
      ios: {
        podspecPath: "__PACKAGE_NAME__.podspec",
      },
    },
  },
};
