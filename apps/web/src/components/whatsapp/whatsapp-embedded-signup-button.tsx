'use client';

import { Loader2, MessageCircle } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { initFacebookSdk } from '@/lib/facebook-sdk';
import { api, parseApiError } from '@/lib/utils';

const META_ORIGINS = new Set([
  'https://www.facebook.com',
  'https://web.facebook.com',
  'https://business.facebook.com',
]);

const POPUP_CLOSE_GRACE_MS = 30_000;
const CODE_WAIT_AFTER_WABA_MS = 45_000;
const EMBED_CODE_STORAGE_KEY = 'chatloora_wa_embed_code';

type EmbeddedConfig = {
  appId: string;
  configId: string;
  onboardUrl: string;
  redirectUri?: string;
  graphVersion?: string;
};

type EmbeddedFinishPayload = {
  code?: string;
  waba_id?: string;
  phone_number_id?: string;
  business_id?: string;
  current_step?: string;
  error_message?: string;
};

type ConnectResult = {
  account?: { id: string; name: string; phoneNumber: string; phoneNumberId: string; status: string };
  channelId?: string | null;
  reconnected?: boolean;
};

type SignupState = {
  code?: string;
  accessToken?: string;
  wabaId?: string;
  phoneNumberId?: string;
  businessId?: string;
};

type FbLoginResponse = {
  authResponse?: { code?: string; accessToken?: string } | null;
};

function isMetaOrigin(origin: string) {
  if (META_ORIGINS.has(origin)) return true;
  try {
    const host = new URL(origin).hostname;
    return host === 'facebook.com' || host.endsWith('.facebook.com');
  } catch {
    return false;
  }
}

function extractOAuthCode(raw: unknown): string | null {
  if (typeof raw === 'string') {
    const text = raw.trim();
    const match = text.match(/(?:^|[?&#])code=([^&\s#]+)/);
    if (!match?.[1]) return null;
    try {
      return decodeURIComponent(match[1]);
    } catch {
      return match[1];
    }
  }
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  for (const key of ['code', 'auth_code', 'authCode']) {
    const value = obj[key];
    if (typeof value === 'string' && value.trim().length > 8) return value.trim();
  }
  if (obj.data) return extractOAuthCode(obj.data);
  return null;
}

function parseEmbeddedMessage(raw: unknown): { event?: string; data?: EmbeddedFinishPayload } | null {
  if (!raw) return null;
  let payload: Record<string, unknown>;
  try {
    payload = typeof raw === 'string' ? (JSON.parse(raw) as Record<string, unknown>) : (raw as Record<string, unknown>);
  } catch {
    return null;
  }
  if (payload.type !== 'WA_EMBEDDED_SIGNUP') return null;
  return {
    event: typeof payload.event === 'string' ? payload.event : undefined,
    data: (payload.data as EmbeddedFinishPayload | undefined) ?? undefined,
  };
}

export function WhatsAppEmbeddedSignupButton({
  label,
  busyLabel,
  onSuccess,
  onError,
  onNotice,
  className,
  variant = 'default',
  size = 'default',
}: {
  label: string;
  busyLabel: string;
  onSuccess?: (result: ConnectResult) => void;
  onError?: (message: string) => void;
  onNotice?: (message: string) => void;
  className?: string;
  variant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'destructive' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}) {
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState<EmbeddedConfig | null>(null);
  const signupRef = useRef<SignupState>({});
  const completingRef = useRef(false);
  const popupRef = useRef<Window | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const popupClosedAtRef = useRef<number | null>(null);
  const wabaReceivedAtRef = useRef<number | null>(null);
  const completeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tryCompleteRef = useRef<() => Promise<boolean>>(async () => false);

  useEffect(() => {
    api<EmbeddedConfig>('/whatsapp-cloud/embedded-signup/config')
      .then((next) => {
        setConfig(next);
        if (!next.appId) return;
        void initFacebookSdk({
          appId: next.appId,
          graphVersion: next.graphVersion || 'v21.0',
          locale: document.documentElement.lang?.startsWith('ar') ? 'ar' : 'en',
        }).catch(() => undefined);
      })
      .catch((err) => onError?.(parseApiError(err)));
  }, [onError]);

  const stopPopupPoll = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    popupRef.current = null;
    popupClosedAtRef.current = null;
  }, []);

  const cleanup = useCallback(
    (keepLoading = false) => {
      stopPopupPoll();
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      wabaReceivedAtRef.current = null;
      if (completeTimerRef.current) {
        clearTimeout(completeTimerRef.current);
        completeTimerRef.current = null;
      }
      if (!keepLoading) setLoading(false);
    },
    [stopPopupPoll],
  );

  const storeCode = useCallback((code: string) => {
    const next = code.trim();
    if (next) signupRef.current.code = next;
  }, []);

  const scheduleComplete = useCallback(() => {
    if (completeTimerRef.current) {
      clearTimeout(completeTimerRef.current);
      completeTimerRef.current = null;
    }
    const hasSession = Boolean(signupRef.current.wabaId || signupRef.current.phoneNumberId);
    // Meta sends the OAuth code and the phone/WABA ids in separate messages.
    // Wait briefly so the saved account includes the number the customer just linked.
    const delay = hasSession ? 150 : 2500;
    completeTimerRef.current = setTimeout(() => {
      completeTimerRef.current = null;
      void tryCompleteRef.current();
    }, delay);
  }, []);

  const tryComplete = useCallback(async () => {
    if (completingRef.current) return false;
    const { code, accessToken } = signupRef.current;
    if (!code && !accessToken) return false;

    completingRef.current = true;
    setLoading(true);
    try {
      const { code, accessToken, wabaId, phoneNumberId, businessId } = signupRef.current;
      const result = code
        ? await api<ConnectResult>('/whatsapp-cloud/embedded-signup', {
            method: 'POST',
            body: JSON.stringify({ code, wabaId, phoneNumberId, businessId }),
          })
        : await api<ConnectResult>('/whatsapp-cloud/connect-shared', {
            method: 'POST',
            body: JSON.stringify({ accessToken, wabaId, phoneNumberId, businessId }),
          });
      signupRef.current = {};
      try {
        popupRef.current?.close();
      } catch {
        /* ignore */
      }
      cleanup();
      onSuccess?.(result);
      return true;
    } catch (err) {
      completingRef.current = false;
      onError?.(parseApiError(err));
      setLoading(false);
      return false;
    }
  }, [cleanup, onSuccess, onError]);

  useEffect(() => {
    tryCompleteRef.current = tryComplete;
  }, [tryComplete]);

  const applySessionPayload = useCallback(
    (data: EmbeddedFinishPayload) => {
      if (data.code) storeCode(data.code);
      if (data.waba_id) {
        signupRef.current.wabaId = data.waba_id.trim();
        wabaReceivedAtRef.current = Date.now();
      }
      if (data.phone_number_id) signupRef.current.phoneNumberId = data.phone_number_id.trim();
      if (data.business_id) signupRef.current.businessId = data.business_id.trim();

      if (signupRef.current.code || signupRef.current.accessToken) {
        scheduleComplete();
        return;
      }

      if (signupRef.current.wabaId || signupRef.current.phoneNumberId) {
        onNotice?.('تم ربط الحساب في ميتا. انتظر حتى يُحفظ الرقم في المنصة.');
      }
    },
    [onNotice, scheduleComplete, storeCode],
  );

  const failWithoutCode = useCallback(() => {
    cleanup();
    onError?.(
      'لم يصل رمز الربط من ميتا، لذلك لم يُحفظ الرقم. أعد الضغط على زر الربط وأكمل نافذة فيسبوك حتى النهاية دون إغلاقها.',
    );
  }, [cleanup, onError]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin === window.location.origin) {
        const local = event.data as { type?: string; code?: string; message?: string };
        if (local?.type === 'CHATLOORA_WA_EMBED_CODE' && local.code) {
          storeCode(local.code);
          scheduleComplete();
        }
        if (local?.type === 'CHATLOORA_WA_EMBED_ERROR' && local.message) {
          cleanup();
          onError?.(local.message);
        }
        return;
      }

      if (!isMetaOrigin(event.origin)) return;

      const oauthCode = extractOAuthCode(event.data);
      if (oauthCode) {
        storeCode(oauthCode);
        scheduleComplete();
        return;
      }

      const parsed = parseEmbeddedMessage(event.data);
      if (!parsed?.event) return;

      if (parsed.event === 'CANCEL') {
        signupRef.current = {};
        completingRef.current = false;
        cleanup();
        onError?.('تم إلغاء ربط واتساب');
        return;
      }
      if (parsed.event === 'ERROR') {
        signupRef.current = {};
        completingRef.current = false;
        cleanup();
        onError?.(parsed.data?.error_message ?? 'أبلغت ميتا عن خطأ أثناء ربط واتساب');
        return;
      }

      if (
        parsed.event === 'FINISH' ||
        parsed.event === 'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING' ||
        parsed.event === 'FINISH_ONLY_WABA' ||
        parsed.event === 'FINISH_GRANT_ONLY_API_ACCESS'
      ) {
        applySessionPayload(parsed.data ?? {});
      }
    };

    window.addEventListener('message', onMessage);
    const onStorage = (event: StorageEvent) => {
      if (event.key !== EMBED_CODE_STORAGE_KEY || !event.newValue) return;
      try {
        const parsed = JSON.parse(event.newValue) as { code?: string };
        if (!parsed.code) return;
        storeCode(parsed.code);
        scheduleComplete();
      } catch {
        /* ignore */
      }
    };
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('message', onMessage);
      window.removeEventListener('storage', onStorage);
    };
  }, [applySessionPayload, cleanup, onError, scheduleComplete, storeCode]);

  useEffect(() => () => cleanup(), [cleanup]);

  const openMetaOnboard = useCallback(() => {
    if (!config?.appId || !config.configId) {
      onError?.('إعدادات ربط ميتا غير متوفرة على السيرفر');
      return;
    }

    signupRef.current = {};
    completingRef.current = false;
    wabaReceivedAtRef.current = null;
    popupClosedAtRef.current = null;
    try {
      localStorage.removeItem(EMBED_CODE_STORAGE_KEY);
    } catch {
      /* ignore */
    }
    setLoading(true);
    onNotice?.('ستفتح نافذة فيسبوك. أكمل كل الخطوات حتى النهاية ولا تغلقها قبل ظهور الرقم في هذه الصفحة.');

    timeoutRef.current = setTimeout(() => {
      if (!completingRef.current && !signupRef.current.code && !signupRef.current.accessToken) {
        failWithoutCode();
      }
    }, 300_000);

    const fb = window.FB;
    if (fb?.login) {
      fb.login(
        (response: unknown) => {
          const res = response as FbLoginResponse;
          const code = res.authResponse?.code?.trim();
          const accessToken = res.authResponse?.accessToken?.trim();
          if (code) {
            storeCode(code);
            scheduleComplete();
            return;
          }
          if (accessToken) {
            signupRef.current.accessToken = accessToken;
            scheduleComplete();
            return;
          }
          if (!signupRef.current.code && !signupRef.current.accessToken) {
            cleanup();
            onError?.('أُغلقت نافذة ميتا قبل إصدار رمز الربط. أعد المحاولة وأكمل كل الخطوات داخل النافذة.');
          }
        },
        {
          config_id: config.configId,
          response_type: 'code',
          override_default_response_type: true,
          extras: {
            setup: {},
            sessionInfoVersion: '3',
            version: 'v4',
          },
        },
      );
      return;
    }

    if (!config.onboardUrl) {
      cleanup();
      onError?.('رابط تأهيل ميتا غير متوفر على السيرفر');
      return;
    }

    const popup = window.open(
      config.onboardUrl,
      'chatloora_wa_meta_onboard',
      'width=860,height=760,menubar=no,toolbar=no,location=yes,status=no,scrollbars=yes,resizable=yes',
    );
    if (!popup) {
      cleanup();
      onError?.('تم حظر النافذة المنبثقة — اسمح بالنوافذ المنبثقة لهذا الموقع ثم أعد المحاولة');
      return;
    }
    popupRef.current = popup;

    pollRef.current = setInterval(() => {
      try {
        const raw = localStorage.getItem(EMBED_CODE_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as { code?: string };
          if (parsed.code) {
            localStorage.removeItem(EMBED_CODE_STORAGE_KEY);
            storeCode(parsed.code);
            scheduleComplete();
            stopPopupPoll();
            return;
          }
        }
      } catch {
        /* ignore */
      }

      const activePopup = popupRef.current;
      if (!activePopup) return;

      if (!activePopup.closed) {
        popupClosedAtRef.current = null;
        try {
          const href = activePopup.location.href;
          if (href && href.startsWith(window.location.origin)) {
            const code = new URL(href).searchParams.get('code');
            if (code) {
              storeCode(code);
              scheduleComplete();
              stopPopupPoll();
            }
          }
        } catch {
          /* cross-origin until redirect */
        }
        return;
      }

      if (completingRef.current || signupRef.current.code || signupRef.current.accessToken) {
        stopPopupPoll();
        return;
      }

      if (!popupClosedAtRef.current) {
        popupClosedAtRef.current = Date.now();
        return;
      }

      const sinceClose = Date.now() - popupClosedAtRef.current;
      const sinceWaba = wabaReceivedAtRef.current ? Date.now() - wabaReceivedAtRef.current : 0;
      const grace = signupRef.current.wabaId
        ? Math.max(POPUP_CLOSE_GRACE_MS, CODE_WAIT_AFTER_WABA_MS - sinceWaba)
        : POPUP_CLOSE_GRACE_MS;

      if (sinceClose < grace) return;

      stopPopupPoll();
      failWithoutCode();
    }, 400);
  }, [cleanup, config, failWithoutCode, onError, onNotice, scheduleComplete, stopPopupPoll, storeCode]);

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      disabled={loading || !config}
      onClick={openMetaOnboard}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
      {loading ? busyLabel : label}
    </Button>
  );
}
