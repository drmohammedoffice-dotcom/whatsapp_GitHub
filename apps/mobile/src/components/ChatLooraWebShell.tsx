import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as ExpoLinking from 'expo-linking';
import * as Haptics from 'expo-haptics';
import * as Network from 'expo-network';
import * as SplashScreen from 'expo-splash-screen';
import * as SystemUI from 'expo-system-ui';
import * as WebBrowser from 'expo-web-browser';
// WebView's default generic (P = undefined) collapses its props to `never` under strict TS, so pass `object`.
import { WebView, type WebViewMessageEvent, type WebViewNavigation } from 'react-native-webview';
import {
  APP_URL,
  FALLBACK_PATH,
  START_PATH,
  deepLinkToAppUrl,
  isAllowedNavigation,
  isBlockedHost,
  isBlockedInApp,
  isTrustedAppUrl,
  requiresSystemBrowser,
  safeAppTarget,
} from '../config';
import { buildNativeEventScript, parseWebMessage, type NativeToWebMessage } from '../native/bridge';
import { saveAndShare } from '../native/downloads';
import { registerForPushNotifications, useNotificationTaps } from '../native/push';
import { useShellTheme, type ShellTheme } from '../theme';

type Props = {
  initialPath?: string;
};

type ShellError = { kind: 'network' | 'server'; detail: string };

/** Subset of react-native-webview's ShouldStartLoadRequest that the shell relies on. */
type LoadRequest = { url: string; isTopFrame?: boolean };

/** Hide the native splash even if the first page never finishes loading. */
const SPLASH_TIMEOUT_MS = 8000;

function openOutside(url: string) {
  if (requiresSystemBrowser(url)) {
    WebBrowser.openBrowserAsync(url).catch(() => Linking.openURL(url).catch(() => undefined));
    return;
  }
  Linking.openURL(url).catch(() => undefined);
}

function lightHaptic() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
}

export function ChatLooraWebShell({ initialPath = START_PATH }: Props) {
  const theme = useShellTheme();
  const webRef = useRef<WebView<object>>(null);
  const canGoBackRef = useRef(false);
  const currentUrlRef = useRef<string | null>(null);
  const failedUrlRef = useRef<string | null>(null);
  /** True once the mounted WebView instance has a loaded page that can run injected JS. */
  const webReadyRef = useRef(false);
  /** Set before reloads the shell triggers itself, so only pull-to-refresh gets a haptic. */
  const programmaticReloadRef = useRef(false);
  const splashHiddenRef = useRef(false);

  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [error, setError] = useState<ShellError | null>(null);
  const errorRef = useRef(error);
  errorRef.current = error;
  // Changing the key remounts the WebView: used to (re)load a URL reliably after a failure.
  const [webKey, setWebKey] = useState(0);

  const network = Network.useNetworkState();
  const offline = network.isConnected === false || network.isInternetReachable === false;

  const incomingLink = ExpoLinking.useLinkingURL();
  const handledLinkRef = useRef(incomingLink);
  const defaultUrl = useMemo(
    () => `${APP_URL}${initialPath.startsWith('/') ? initialPath : `/${initialPath}`}`,
    [initialPath],
  );
  const [sourceUrl, setSourceUrl] = useState(() => safeAppTarget(deepLinkToAppUrl(incomingLink) ?? defaultUrl));

  const hideSplash = useCallback(() => {
    if (splashHiddenRef.current) return;
    splashHiddenRef.current = true;
    SplashScreen.hideAsync().catch(() => undefined);
  }, []);

  useEffect(() => {
    const timer = setTimeout(hideSplash, SPLASH_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [hideSplash]);

  // Root view color behind the WebView (keyboard transitions, rotation) follows the theme.
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(theme.background).catch(() => undefined);
  }, [theme.background]);

  /** Starts over with a fresh WebView instance at `url` (its history starts empty). */
  const remountWebView = useCallback((url: string) => {
    webReadyRef.current = false;
    canGoBackRef.current = false;
    setError(null);
    setLoading(true);
    setSourceUrl(url);
    setWebKey((k) => k + 1);
  }, []);

  /** Loads a ChatLoora URL: in-page when possible (keeps history), otherwise via a fresh WebView. */
  const navigateTo = useCallback((target: string) => {
    const url = safeAppTarget(target);
    if (webReadyRef.current && !errorRef.current && webRef.current) {
      webRef.current.injectJavaScript(`window.location.assign(${JSON.stringify(url)});true;`);
      return;
    }
    remountWebView(url);
  }, [remountWebView]);

  const retry = useCallback(() => {
    const target = [failedUrlRef.current, currentUrlRef.current].find(
      (u): u is string => !!u && isAllowedNavigation(u),
    );
    failedUrlRef.current = null;
    remountWebView(safeAppTarget(target ?? defaultUrl));
  }, [defaultUrl, remountWebView]);

  // Links that arrive while the app is already open (universal/app links, chatloora://).
  useEffect(() => {
    if (!incomingLink || incomingLink === handledLinkRef.current) return;
    handledLinkRef.current = incomingLink;
    const target = deepLinkToAppUrl(incomingLink);
    if (target) navigateTo(target);
  }, [incomingLink, navigateTo]);

  // Notification taps, including the one that launched the app.
  useNotificationTaps(navigateTo);

  // Back online after a failed load: reload automatically.
  const wasOfflineRef = useRef(offline);
  useEffect(() => {
    const cameBack = wasOfflineRef.current && !offline;
    wasOfflineRef.current = offline;
    if (cameBack && errorRef.current) retry();
  }, [offline, retry]);

  // Android hardware back navigates inside the site before leaving the app.
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (canGoBackRef.current) {
        // Leaving the failed page: the previous one gets a fresh chance (errors are re-reported).
        setError(null);
        webRef.current?.goBack();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, []);

  const postToWeb = useCallback((msg: NativeToWebMessage) => {
    webRef.current?.injectJavaScript(buildNativeEventScript(msg));
  }, []);

  const onMessage = useCallback(
    (e: WebViewMessageEvent) => {
      // Only ChatLoora pages may use the bridge (never the OAuth/third-party pages shown in-app).
      if (!isTrustedAppUrl(e.nativeEvent.url)) return;
      const msg = parseWebMessage(e.nativeEvent.data);
      if (!msg) return;
      if (msg.type === 'download') {
        saveAndShare(msg).then(postToWeb);
      } else if (msg.type === 'push:register') {
        registerForPushNotifications().then(postToWeb);
      }
    },
    [postToWeb],
  );

  const onShouldStartLoadWithRequest = useCallback(
    (req: LoadRequest) => {
      const { url } = req;
      if (!url || url.startsWith('about:') || url.startsWith('blob:') || url.startsWith('data:')) return true;
      // iOS also asks for iframes: embeds (YouTube, Maps) load inline; only payment hosts are refused.
      if (req.isTopFrame === false) return !isBlockedHost(url);
      if (isBlockedInApp(url)) {
        if (!currentUrlRef.current?.startsWith(`${APP_URL}${FALLBACK_PATH}`)) navigateTo(`${APP_URL}${FALLBACK_PATH}`);
        return false;
      }
      if (isAllowedNavigation(url)) return true;
      openOutside(url);
      return false;
    },
    [navigateTo],
  );

  const onNavigationStateChange = useCallback((nav: WebViewNavigation) => {
    canGoBackRef.current = nav.canGoBack;
    if (nav.url && isAllowedNavigation(nav.url)) currentUrlRef.current = nav.url;
  }, []);

  const reloadInPlace = useCallback(() => {
    programmaticReloadRef.current = true;
    webRef.current?.reload();
  }, []);

  const showProgressBar = loading && hasLoadedOnce && !error;
  const showSpinner = loading && !hasLoadedOnce && !error;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top', 'bottom', 'left', 'right']}>
      <StatusBar style={theme.scheme === 'dark' ? 'light' : 'dark'} />
      {offline && !error ? <OfflineBanner theme={theme} /> : null}
      <View style={[styles.shell, { backgroundColor: theme.background }]}>
        <WebView<object>
          key={webKey}
          ref={webRef}
          source={{ uri: sourceUrl }}
          style={[styles.webview, { backgroundColor: theme.background }]}
          onLoadStart={(e) => {
            setLoading(true);
            setProgress(0);
            // Pull-to-refresh (iOS) reloads the page natively; acknowledge it with a light tap.
            if (Platform.OS === 'ios' && e.nativeEvent.navigationType === 'reload' && !programmaticReloadRef.current) {
              lightHaptic();
            }
            programmaticReloadRef.current = false;
          }}
          onLoadProgress={(e) => setProgress(e.nativeEvent.progress)}
          // Errors are not cleared here: a 5xx page still "loads" right after onHttpError.
          onLoad={() => {
            webReadyRef.current = true;
            setHasLoadedOnce(true);
          }}
          onLoadEnd={() => {
            setLoading(false);
            hideSplash();
          }}
          onError={(e) => {
            failedUrlRef.current = e.nativeEvent.url || null;
            setLoading(false);
            hideSplash();
            setError({ kind: 'network', detail: e.nativeEvent.description || 'Network error' });
          }}
          onHttpError={(e) => {
            if (e.nativeEvent.statusCode >= 500 && isTrustedAppUrl(e.nativeEvent.url)) {
              failedUrlRef.current = e.nativeEvent.url || null;
              setError({ kind: 'server', detail: `Server error (${e.nativeEvent.statusCode})` });
            }
          }}
          onMessage={onMessage}
          onNavigationStateChange={onNavigationStateChange}
          onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
          // window.open / target=_blank: keep our pages in-app, send the rest outside.
          setSupportMultipleWindows
          onOpenWindow={(e) => {
            const url = e.nativeEvent.targetUrl;
            if (!url || isBlockedInApp(url)) return;
            if (isAllowedNavigation(url)) navigateTo(url);
            else openOutside(url);
          }}
          // The OS can kill the web content process under memory pressure.
          onRenderProcessGone={reloadInPlace}
          onContentProcessDidTerminate={reloadInPlace}
          javaScriptEnabled
          domStorageEnabled
          sharedCookiesEnabled
          thirdPartyCookiesEnabled
          allowsBackForwardNavigationGestures
          allowsInlineMediaPlayback
          allowsFullscreenVideo
          mediaPlaybackRequiresUserAction={false}
          mediaCapturePermissionGrantType="grantIfSameHostElsePrompt"
          pullToRefreshEnabled
          refreshControlLightMode={theme.scheme === 'dark'}
          webviewDebuggingEnabled={__DEV__}
          applicationNameForUserAgent="ChatLooraMobile/1.0"
        />
        {showProgressBar ? (
          <View style={styles.progressTrack} pointerEvents="none">
            <View style={[styles.progressBar, { backgroundColor: theme.primary, width: `${Math.max(progress, 0.1) * 100}%` }]} />
          </View>
        ) : null}
        {showSpinner ? (
          <View style={[styles.spinnerOverlay, { backgroundColor: theme.background }]} pointerEvents="none">
            <ActivityIndicator size="large" color={theme.primary} />
          </View>
        ) : null}
        {error ? <ErrorScreen theme={theme} error={error} offline={offline} onRetry={retry} /> : null}
      </View>
    </SafeAreaView>
  );
}

function OfflineBanner({ theme }: { theme: ShellTheme }) {
  return (
    <View
      style={[styles.banner, { backgroundColor: theme.foreground }]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <View style={[styles.bannerDot, { backgroundColor: '#F59E0B' }]} />
      <Text style={[styles.bannerText, { color: theme.background }]}>لا يوجد اتصال بالإنترنت</Text>
    </View>
  );
}

function ErrorScreen({
  theme,
  error,
  offline,
  onRetry,
}: {
  theme: ShellTheme;
  error: ShellError;
  offline: boolean;
  onRetry: () => void;
}) {
  const copy = offline
    ? {
        title: 'لا يوجد اتصال بالإنترنت',
        body: 'تحقق من اتصالك بالشبكة. سنعيد تحميل الصفحة تلقائياً عند عودة الاتصال.',
      }
    : error.kind === 'server'
      ? { title: 'الخدمة غير متاحة مؤقتاً', body: 'حدث خطأ في الخادم. حاول مرة أخرى بعد قليل.' }
      : { title: 'تعذر الوصول إلى ChatLoora', body: 'تعذر الاتصال بالخادم. تأكد من اتصالك ثم أعد المحاولة.' };

  return (
    <View style={[StyleSheet.absoluteFill, styles.center, { backgroundColor: theme.background }]}>
      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <Text style={[styles.errorTitle, { color: theme.foreground }]} accessibilityRole="header">
          {copy.title}
        </Text>
        <Text style={[styles.errorBody, { color: theme.muted }]}>{copy.body}</Text>
        {!offline ? <Text style={[styles.errorDetail, { color: theme.muted }]}>{error.detail}</Text> : null}
        <Pressable
          style={({ pressed }) => [styles.button, { backgroundColor: theme.primary, opacity: pressed ? 0.85 : 1 }]}
          onPress={onRetry}
          accessibilityRole="button"
        >
          <Text style={[styles.buttonText, { color: theme.onPrimary }]}>إعادة المحاولة</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  shell: { flex: 1 },
  webview: { flex: 1 },
  progressTrack: { position: 'absolute', top: 0, left: 0, right: 0, height: 2 },
  progressBar: { height: 2 },
  spinnerOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
  bannerDot: { width: 8, height: 8, borderRadius: 4 },
  bannerText: { fontSize: 13, fontWeight: '600' },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 28,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  errorTitle: { fontSize: 18, fontWeight: '700', textAlign: 'center' },
  errorBody: { fontSize: 14, lineHeight: 21, textAlign: 'center' },
  errorDetail: { fontSize: 12, textAlign: 'center', opacity: 0.8 },
  button: {
    marginTop: 8,
    minWidth: 160,
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  buttonText: { fontSize: 15, fontWeight: '700' },
});
