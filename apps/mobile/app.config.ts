import type { ExpoConfig } from 'expo/config';

const APP_URL = process.env.EXPO_PUBLIC_CHATLOORA_URL || 'https://www.chatloora.com';
const EAS_PROJECT_ID = '35e3a22f-c864-461b-898e-4dfa8c805004';

// Brand palette (shared with the web app).
const BRAND_PRIMARY = '#7C3AED';
const LIGHT_BACKGROUND = '#F8F7FC';
const DARK_BACKGROUND = '#0E0B1A';

/**
 * Firebase config for Android push (FCM). It is not committed: on EAS it comes from a
 * secret file env var (`eas env:create --name GOOGLE_SERVICES_JSON --type file ...`).
 * Without it the app still builds, but Android cannot get a push token.
 */
const GOOGLE_SERVICES_FILE = process.env.GOOGLE_SERVICES_JSON || undefined;

/** Data the ChatLoora service collects; mirrors the App Store privacy labels. */
const COLLECTED_DATA_TYPES = [
  'NSPrivacyCollectedDataTypeName',
  'NSPrivacyCollectedDataTypeEmailAddress',
  'NSPrivacyCollectedDataTypePhoneNumber',
  'NSPrivacyCollectedDataTypeUserID',
  'NSPrivacyCollectedDataTypeEmailsOrTextMessages',
  'NSPrivacyCollectedDataTypeOtherUserContent',
  'NSPrivacyCollectedDataTypePhotosorVideos',
  'NSPrivacyCollectedDataTypeAudioData',
  'NSPrivacyCollectedDataTypePurchaseHistory',
  'NSPrivacyCollectedDataTypeCrashData',
  'NSPrivacyCollectedDataTypeOtherDiagnosticData',
].map((type) => ({
  NSPrivacyCollectedDataType: type,
  NSPrivacyCollectedDataTypeLinked: true,
  NSPrivacyCollectedDataTypeTracking: false,
  NSPrivacyCollectedDataTypePurposes: ['NSPrivacyCollectedDataTypePurposeAppFunctionality'],
}));

const config: ExpoConfig = {
  name: 'ChatLoora',
  slug: 'chatloora',
  owner: 'hexdefender1',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  scheme: 'chatloora',
  userInterfaceStyle: 'automatic',
  primaryColor: BRAND_PRIMARY,
  backgroundColor: LIGHT_BACKGROUND,
  // Arabic app name and permission prompts (base strings below are English).
  locales: {
    ar: './locales/ar.json',
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'hexdefender.chatloora.app',
    infoPlist: {
      // WebView file inputs ("Take Photo or Video").
      NSCameraUsageDescription:
        'ChatLoora uses the camera when you choose to take a photo or video to attach to a message or upload.',
      NSPhotoLibraryUsageDescription:
        'ChatLoora accesses your photo library when you choose photos or videos to attach to a message or upload.',
      // WebView long-press menu "Save to Photos".
      NSPhotoLibraryAddUsageDescription:
        'ChatLoora saves images to your photo library when you choose to save an image.',
      // Voice notes recorded in the web chat (getUserMedia).
      NSMicrophoneUsageDescription: 'ChatLoora uses the microphone to record the voice notes you send in chats.',
      CFBundleAllowMixedLocalizations: true,
      ITSAppUsesNonExemptEncryption: false,
    },
    associatedDomains: ['applinks:www.chatloora.com', 'applinks:chatloora.com'],
    privacyManifests: {
      // Required-reason APIs used by React Native, Expo modules and the WebView.
      NSPrivacyAccessedAPITypes: [
        {
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryUserDefaults',
          NSPrivacyAccessedAPITypeReasons: ['CA92.1'],
        },
        {
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryFileTimestamp',
          NSPrivacyAccessedAPITypeReasons: ['C617.1'],
        },
        {
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategorySystemBootTime',
          NSPrivacyAccessedAPITypeReasons: ['35F9.1'],
        },
        {
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryDiskSpace',
          NSPrivacyAccessedAPITypeReasons: ['E174.1'],
        },
      ],
      NSPrivacyTracking: false,
      NSPrivacyTrackingDomains: [],
      NSPrivacyCollectedDataTypes: COLLECTED_DATA_TYPES,
    },
  },
  android: {
    package: 'hexdefender.chatloora.app',
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#ffffff',
    },
    // Session cookies and tokens must not be restored onto another device.
    allowBackup: false,
    googleServicesFile: GOOGLE_SERVICES_FILE,
    // The WebView file chooser uses the system picker (which can also capture a photo through
    // the camera app), so no camera/media/storage permissions are needed. CAMERA is blocked
    // on purpose: when it is declared but not granted, the WebView hides the capture option.
    permissions: ['INTERNET', 'RECORD_AUDIO', 'MODIFY_AUDIO_SETTINGS'],
    blockedPermissions: [
      'android.permission.CAMERA',
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
        backgroundColor: LIGHT_BACKGROUND,
        image: './assets/splash-icon.png',
        imageWidth: 200,
        dark: {
          backgroundColor: DARK_BACKGROUND,
        },
      },
    ],
    'expo-web-browser',
    [
      'expo-notifications',
      {
        icon: './assets/notification-icon.png',
        color: BRAND_PRIMARY,
        // Created at startup in src/native/push.ts; also used for FCM messages without a channelId.
        defaultChannel: 'messages',
      },
    ],
  ],
  extra: {
    appUrl: APP_URL,
    eas: { projectId: EAS_PROJECT_ID },
  },
};

export default config;
