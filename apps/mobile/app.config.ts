import type { ExpoConfig } from 'expo/config';

const APP_URL = process.env.EXPO_PUBLIC_CHATLOORA_URL || 'https://www.chatloora.com';

const config: ExpoConfig = {
  name: 'ChatLoora',
  slug: 'chatloora',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  scheme: 'chatloora',
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,
  splash: {
    image: './assets/splash-icon.png',
    resizeMode: 'contain',
    backgroundColor: '#0f172a',
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.chatloora.app',
    buildNumber: '1',
    infoPlist: {
      NSCameraUsageDescription: 'ChatLoora needs camera access for media uploads in chat and store.',
      NSPhotoLibraryUsageDescription: 'ChatLoora needs photo library access for media uploads.',
      NSMicrophoneUsageDescription: 'ChatLoora needs microphone access for voice notes.',
      CFBundleAllowMixedLocalizations: true,
    },
    associatedDomains: ['applinks:www.chatloora.com', 'applinks:chatloora.com'],
  },
  android: {
    package: 'com.chatloora.app',
    versionCode: 1,
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#0f172a',
    },
    permissions: [
      'INTERNET',
      'CAMERA',
      'RECORD_AUDIO',
      'READ_MEDIA_IMAGES',
      'READ_MEDIA_VIDEO',
      'POST_NOTIFICATIONS',
    ],
    intentFilters: [
      {
        action: 'VIEW',
        autoVerify: true,
        data: [
          { scheme: 'https', host: 'www.chatloora.com', pathPrefix: '/' },
          { scheme: 'https', host: 'chatloora.com', pathPrefix: '/' },
        ],
        category: ['BROWSABLE', 'DEFAULT'],
      },
    ],
  },
  web: {
    favicon: './assets/favicon.png',
  },
  plugins: [
    'expo-router',
    [
      'expo-splash-screen',
      {
        backgroundColor: '#0f172a',
        image: './assets/splash-icon.png',
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    appUrl: APP_URL,
    eas: {
      projectId: 'chatloora-mobile-replace-with-eas-id',
    },
  },
};

export default config;
