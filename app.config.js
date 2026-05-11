/** @type {import('expo/config').ExpoConfig} */
module.exports = ({ config }) => ({
  ...config,
  name: 'Chiki',
  slug: 'chiki',
  owner: 'freddd2000',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/chicken-app-logo.png',
  splash: {
    image: './assets/images/splash-logo.png',
    resizeMode: 'contain',
    backgroundColor: '#FFFFFF',
  },
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,
  androidStatusBar: {
    backgroundColor: '#48426D',
    translucent: true,
  },
  ios: {
    supportsTablet: false,
    bundleIdentifier: 'com.chiki.app',
    buildNumber: '1',
    infoPlist: {
      NSFaceIDUsageDescription:
        'Chiki uses Face ID to securely protect your financial data.',
    },
  },
  android: {
    package: 'com.chiki.app',
    adaptiveIcon: {
      foregroundImage: './assets/images/chicken-app-icon.png',
      backgroundColor: '#2E2947',
    },
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
    softwareKeyboardLayoutMode: 'pan',
  },
  plugins: [
    'expo-router',
    'react-native-purchases',
    'expo-font',
    'expo-secure-store',
    'expo-local-authentication',
    [
      'expo-notifications',
      {
        icon: './assets/images/chicken-app-logo.png',
        color: '#2E2947',
        defaultChannel: 'chiki',
        sounds: [],
      },
    ],
    [
      'expo-build-properties',
      {
        android: {
          compileSdkVersion: 35,
          targetSdkVersion: 35,
          minSdkVersion: 26,
        },
        ios: {
          deploymentTarget: '16.0',
        },
      },
    ],
  ],
  extra: {
    revenueCatApiKeyIos: process.env.REVENUECAT_API_KEY_IOS,
    revenueCatApiKeyAndroid: process.env.REVENUECAT_API_KEY_ANDROID,
    eas: {
      projectId: process.env.EAS_PROJECT_ID ?? 'e05c7f55-77f0-464f-b733-e6d9f995ff58',
    },
  },
  scheme: 'chiki',
  assetBundlePatterns: [
    'assets/*',
    'node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Ionicons.ttf',
    'node_modules/@expo-google-fonts/montserrat/Montserrat_400Regular.ttf',
    'node_modules/@expo-google-fonts/montserrat/Montserrat_500Medium.ttf',
    'node_modules/@expo-google-fonts/montserrat/Montserrat_600SemiBold.ttf',
    'node_modules/@expo-google-fonts/montserrat/Montserrat_700Bold.ttf',
    'node_modules/@expo-google-fonts/montserrat/Montserrat_800ExtraBold.ttf',
    'node_modules/@expo-google-fonts/montserrat/Montserrat_900Black.ttf',
  ],
});
