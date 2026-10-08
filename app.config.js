// Extends app.json with values that differ per environment or are not decided yet.
// Set them in a .env file (see .env.example) or in your EAS build environment.
module.exports = ({ config }) => ({
  ...config,
  android: {
    ...config.android,
    // Permanent once published on Google Play. Required for EAS builds and Google sign-in.
    ...(process.env.ANDROID_PACKAGE ? { package: process.env.ANDROID_PACKAGE } : {}),
  },
  ios: {
    ...config.ios,
    ...(process.env.IOS_BUNDLE_ID ? { bundleIdentifier: process.env.IOS_BUNDLE_ID } : {}),
  },
  plugins: [
    ...config.plugins,
    [
      '@react-native-google-signin/google-signin',
      // Required by the plugin; only used for iOS builds. Android needs no option here.
      { iosUrlScheme: process.env.GOOGLE_IOS_URL_SCHEME || 'com.googleusercontent.apps.not-configured' },
    ],
  ],
});
