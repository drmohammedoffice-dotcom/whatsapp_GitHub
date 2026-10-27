'use client';

import { useEffect } from 'react';
import { isNativeApp, onNativeMessage, postToNative } from '@/lib/native-bridge';
import { PUSH_REQUESTED_SESSION_KEY, registerPushDevice } from '@/lib/push-devices';
import { getAccessToken, getTeamId } from '@/lib/utils';

/** Ask the native app for a push token once per app session (and again if the workspace changes). */
function requestMarker() {
  return getTeamId() || '1';
}

function alreadyRequested() {
  try {
    return window.sessionStorage.getItem(PUSH_REQUESTED_SESSION_KEY) === requestMarker();
  } catch {
    return false;
  }
}

function markRequested() {
  try {
    window.sessionStorage.setItem(PUSH_REQUESTED_SESSION_KEY, requestMarker());
  } catch {
    /* storage unavailable */
  }
}

/**
 * Registers the native app's push token for the signed-in user.
 * Mounted inside the authenticated AppShell; renders nothing and does nothing
 * outside the ChatLoora native app.
 */
export function PushRegistration() {
  useEffect(() => {
    if (!isNativeApp() || !getAccessToken()) return;

    const unsubscribe = onNativeMessage((message) => {
      if (message.type === 'push:token') {
        if (!getAccessToken()) return;
        void registerPushDevice(message.token, message.platform);
      }
      // 'push:denied': user declined notifications — nothing to register.
    });

    if (!alreadyRequested()) {
      markRequested();
      postToNative({ type: 'push:register' });
    }

    return unsubscribe;
  }, []);

  return null;
}
