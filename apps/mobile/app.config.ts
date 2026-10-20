import type { ExpoConfig } from 'expo/config';

const APP_URL = process.env.EXPO_PUBLIC_CHATLOORA_URL || 'https://www.chatloora.com';
const EAS_PROJECT_ID = '35e3a22f-c864-461b-898e-4dfa8c805004';

const config: ExpoConfig = {
  name: 'ChatLoora',
  slug: 'chatloora',
  owner: 'hexdefender1',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  scheme: 'chatloora',
  userInterfaceStyle: 'automatic',
  backgroundColor: '#0f172a',
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.chatloora.app',
    infoPlist: {
      NSCameraUsageDescription: 'ChatLoora needs camera access for media uploads in chat and store.',
      NSPhotoLibraryUsageDescription: 'ChatLoora needs photo library access for media uploads.',
      NSMicrophoneUsageDescription: 'ChatLoora needs microphone access for voice notes.',
      CFBundleAllowMixedLocalizations: true,
      ITSAppUsesNonExemptEncryption: false,
    },
    associatedDomains: ['applinks:www.chatloora.com', 'applinks:chatloora.com'],
  },
  android: {
    package: 'com.chatloora.app',
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#ffffff',
    },
    // The WebView file chooser uses the system picker, so no media/storage permissions are needed.
    permissions: ['INTERNET', 'CAMERA', 'RECORD_AUDIO', 'MODIFY_AUDIO_SETTINGS'],
    blockedPermissions: [
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.WRITE_EXTERNAL_STORAGE',
      'android.permission.READ_MEDIA_IMAGES',
      'android.permission.READ_MEDIA_VIDEO',
      'android.permission.SYSTEM_ALERT_WINDOW',
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
    [
      'expo-splash-screen',
      {
        backgroundColor: '#0f172a',
        image: './assets/splash-icon.png',
        imageWidth: 200,
      },
    ],
    'expo-web-browser',
  ],
  extra: {
    appUrl: APP_URL,
    eas: { projectId: EAS_PROJECT_ID },
  },
};

export default config;
