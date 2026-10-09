// Extends app.json with values that differ per environment or are not decided yet.
// Set them in a .env file (see .env.example) or in your EAS build environment.
module.exports = ({ config }) => ({
  ...config,
  android: {
    ...config.android,
    // Permanent once published on Google Play. Required for EAS builds.
    ...(process.env.ANDROID_PACKAGE ? { package: process.env.ANDROID_PACKAGE } : {}),
  },
  ios: {
    ...config.ios,
    ...(process.env.IOS_BUNDLE_ID ? { bundleIdentifier: process.env.IOS_BUNDLE_ID } : {}),
  },
});
