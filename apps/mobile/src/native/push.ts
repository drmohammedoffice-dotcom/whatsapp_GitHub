import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { appUrlFromRelativePath } from '../config';
import { BRAND } from '../theme';
import type { NativeToWebMessage } from './bridge';

/** Android channel for chat messages; the server should send `channelId: 'messages'`. */
export const MESSAGES_CHANNEL_ID = 'messages';

// Notifications that arrive while the app is open are still shown as a banner.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function ensureMessagesChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(MESSAGES_CHANNEL_ID, {
    name: 'الرسائل',
    description: 'رسائل المحادثات الجديدة',
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'default',
    vibrationPattern: [0, 250, 250, 250],
    lightColor: BRAND.primary,
  });
}

function getProjectId(): string | undefined {
  const fromExtra = (Constants.expoConfig?.extra?.eas as { projectId?: string } | undefined)?.projectId;
  return fromExtra ?? Constants.easConfig?.projectId ?? undefined;
}

function isGranted(p: Notifications.NotificationPermissionsStatus): boolean {
  return p.granted || p.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
}

let pending: Promise<NativeToWebMessage> | null = null;

/** Asks for notification permission and returns the Expo push token for the web app. */
export function registerForPushNotifications(): Promise<NativeToWebMessage> {
  pending ??= (async (): Promise<NativeToWebMessage> => {
    try {
      // Android 13+: the channel must exist before the permission prompt can be shown.
      await ensureMessagesChannel();
      let permissions = await Notifications.getPermissionsAsync();
      if (!isGranted(permissions) && permissions.canAskAgain) {
        permissions = await Notifications.requestPermissionsAsync({
          ios: { allowAlert: true, allowBadge: true, allowSound: true },
        });
      }
      if (!isGranted(permissions)) return { type: 'push:denied', reason: 'permission' };

      const projectId = getProjectId();
      if (!projectId) return { type: 'push:denied', reason: 'unavailable' };
      const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
      return { type: 'push:token', token: data, platform: Platform.OS === 'ios' ? 'ios' : 'android' };
    } catch (e) {
      // Typical causes: simulator, missing FCM config (google-services.json) or no network.
      if (__DEV__) console.warn('[push] token unavailable', e);
      return { type: 'push:denied', reason: 'unavailable' };
    }
  })().finally(() => {
    pending = null;
  });
  return pending;
}

/**
 * Calls `onOpen` with the in-app URL of a tapped notification (`data.url` must be a
 * site-relative path such as `/inbox/42`), including the tap that cold-started the app.
 */
export function useNotificationTaps(onOpen: (url: string) => void): void {
  const onOpenRef = useRef(onOpen);
  onOpenRef.current = onOpen;

  useEffect(() => {
    const handled = new Set<string>();
    const handle = (response: Notifications.NotificationResponse | null) => {
      if (!response) return;
      const key = `${response.notification.request.identifier}:${response.actionIdentifier}`;
      if (handled.has(key)) return;
      handled.add(key);
      Notifications.clearLastNotificationResponseAsync().catch(() => undefined);
      const url = appUrlFromRelativePath(response.notification.request.content.data?.url);
      if (url) onOpenRef.current(url);
    };

    const sub = Notifications.addNotificationResponseReceivedListener(handle);
    Notifications.getLastNotificationResponseAsync().then(handle).catch(() => undefined);
    return () => sub.remove();
  }, []);
}

/** Clears the app icon badge on launch and whenever the app returns to the foreground. */
export function useClearBadgeWhenActive(): void {
  useEffect(() => {
    const clear = () => {
      Notifications.setBadgeCountAsync(0).catch(() => undefined);
    };
    clear();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') clear();
    });
    return () => sub.remove();
  }, []);
}
