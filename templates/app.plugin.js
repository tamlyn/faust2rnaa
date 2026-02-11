const {
  withAppBuildGradle,
  createRunOncePlugin,
} = require("@expo/config-plugins");

const AUDIO_API_BLOCK = `
// __PACKAGE_NAME__ audio-api deps
evaluationDependsOn(":react-native-audio-api")
evaluationDependsOn(":__PACKAGE_NAME__")

afterEvaluate {
  def audioApiProject = findProject(":react-native-audio-api")
  if (audioApiProject != null) {
    def mergeDebug = audioApiProject.tasks.findByName("mergeDebugNativeLibs")
    def mergeRelease = audioApiProject.tasks.findByName("mergeReleaseNativeLibs")

    def buildCMakeDebug = tasks.findByName("buildCMakeDebug")
    if (buildCMakeDebug != null && mergeDebug != null) {
      buildCMakeDebug.dependsOn(mergeDebug)
    }

    def buildCMakeRelWithDebInfo = tasks.findByName("buildCMakeRelWithDebInfo")
    if (buildCMakeRelWithDebInfo != null && mergeRelease != null) {
      buildCMakeRelWithDebInfo.dependsOn(mergeRelease)
    }

    def buildCMakeRelease = tasks.findByName("buildCMakeRelease")
    if (buildCMakeRelease != null && mergeRelease != null) {
      buildCMakeRelease.dependsOn(mergeRelease)
    }
  }

  def processorProject = findProject(":__PACKAGE_NAME__")
  if (processorProject != null) {
    def codegenTask = processorProject.tasks.findByName("generateCodegenArtifactsFromSchema")
    if (codegenTask != null) {
      def buildCMakeDebug = tasks.findByName("buildCMakeDebug")
      if (buildCMakeDebug != null) {
        buildCMakeDebug.dependsOn(codegenTask)
      }

      def buildCMakeRelWithDebInfo = tasks.findByName("buildCMakeRelWithDebInfo")
      if (buildCMakeRelWithDebInfo != null) {
        buildCMakeRelWithDebInfo.dependsOn(codegenTask)
      }

      def buildCMakeRelease = tasks.findByName("buildCMakeRelease")
      if (buildCMakeRelease != null) {
        buildCMakeRelease.dependsOn(codegenTask)
      }
    }
  }
}
`;

const withProcessor = (config) => {
  return withAppBuildGradle(config, (config) => {
    if (config.modResults.language !== "groovy") {
      return config;
    }

    if (!config.modResults.contents.includes("__PACKAGE_NAME__ audio-api deps")) {
      config.modResults.contents = `${config.modResults.contents}\n${AUDIO_API_BLOCK}`;
    }

    return config;
  });
};

module.exports = createRunOncePlugin(withProcessor, "__PACKAGE_NAME__", "0.1.0");
