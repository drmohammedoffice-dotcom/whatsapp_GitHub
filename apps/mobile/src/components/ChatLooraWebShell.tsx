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
import * as SplashScreen from 'expo-splash-screen';
import * as WebBrowser from 'expo-web-browser';
// WebView's default generic (P = undefined) collapses its props to `never` under strict TS, so pass `object`.
import { WebView, type WebViewNavigation } from 'react-native-webview';
import {
  APP_URL,
  START_PATH,
  deepLinkToAppUrl,
  isAllowedNavigation,
  requiresSystemBrowser,
} from '../config';

type Props = {
  initialPath?: string;
};

function openOutside(url: string) {
  if (requiresSystemBrowser(url)) {
    WebBrowser.openBrowserAsync(url).catch(() => Linking.openURL(url).catch(() => undefined));
    return;
  }
  Linking.openURL(url).catch(() => undefined);
}

export function ChatLooraWebShell({ initialPath = START_PATH }: Props) {
  const webRef = useRef<WebView<object>>(null);
  const canGoBackRef = useRef(false);
  const splashHiddenRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const incomingLink = ExpoLinking.useLinkingURL();
  const defaultUrl = useMemo(
    () => `${APP_URL}${initialPath.startsWith('/') ? initialPath : `/${initialPath}`}`,
    [initialPath],
  );
  const [sourceUrl, setSourceUrl] = useState(() => deepLinkToAppUrl(incomingLink) ?? defaultUrl);

  // Links that arrive while the app is already open (notifications, shared links).
  useEffect(() => {
    const target = deepLinkToAppUrl(incomingLink);
    if (target) setSourceUrl(target);
  }, [incomingLink]);

  // Android hardware back navigates inside the site before leaving the app.
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (canGoBackRef.current) {
        webRef.current?.goBack();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, []);

  const hideSplash = useCallback(() => {
    if (splashHiddenRef.current) return;
    splashHiddenRef.current = true;
    SplashScreen.hideAsync().catch(() => undefined);
  }, []);

  const onShouldStartLoadWithRequest = useCallback((req: { url: string }) => {
    const { url } = req;
    if (!url || url === 'about:blank' || url.startsWith('blob:') || url.startsWith('data:')) return true;
    if (isAllowedNavigation(url)) return true;
    openOutside(url);
    return false;
  }, []);

  const onNavigationStateChange = useCallback((nav: WebViewNavigation) => {
    canGoBackRef.current = nav.canGoBack;
  }, []);

  const retry = useCallback(() => {
    setError(null);
    setLoading(true);
    webRef.current?.reload();
  }, []);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom', 'left', 'right']}>
      <StatusBar style="light" />
      <View style={styles.shell}>
        <WebView<object>
          ref={webRef}
          source={{ uri: sourceUrl }}
          style={styles.webview}
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => {
            setLoading(false);
            hideSplash();
          }}
          onError={(e) => {
            setLoading(false);
            hideSplash();
            setError(e.nativeEvent.description || 'Network error');
          }}
          onHttpError={(e) => {
            if (e.nativeEvent.statusCode >= 500 && e.nativeEvent.url?.startsWith(APP_URL)) {
              setError(`Server error (${e.nativeEvent.statusCode})`);
            }
          }}
          onNavigationStateChange={onNavigationStateChange}
          onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
          // window.open / target=_blank: keep our pages in-app, send the rest outside.
          setSupportMultipleWindows
          onOpenWindow={(e) => {
            const url = e.nativeEvent.targetUrl;
            if (isAllowedNavigation(url)) setSourceUrl(url);
            else openOutside(url);
          }}
          // The OS can kill the web content process under memory pressure.
          onRenderProcessGone={() => webRef.current?.reload()}
          onContentProcessDidTerminate={() => webRef.current?.reload()}
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
          webviewDebuggingEnabled={__DEV__}
          applicationNameForUserAgent="ChatLooraMobile/1.0"
        />
        {error ? (
          <View style={[StyleSheet.absoluteFill, styles.center]}>
            <Text style={styles.errorTitle}>تعذر فتح ChatLoora</Text>
            <Text style={styles.errorBody}>تأكد من اتصالك بالإنترنت ثم أعد المحاولة.</Text>
            <Text style={styles.errorDetail}>{error}</Text>
            <Pressable style={styles.button} onPress={retry}>
              <Text style={styles.buttonText}>إعادة المحاولة</Text>
            </Pressable>
          </View>
        ) : null}
        {loading && !error ? (
          <View style={styles.loadingOverlay} pointerEvents="none">
            <ActivityIndicator size="large" color="#38bdf8" />
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0f172a' },
  shell: { flex: 1, backgroundColor: '#0f172a' },
  webview: { flex: 1, backgroundColor: '#0f172a' },
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
    backgroundColor: '#0f172a',
  },
  errorTitle: { color: '#f8fafc', fontSize: 18, fontWeight: '700' },
  errorBody: { color: '#cbd5e1', textAlign: 'center' },
  errorDetail: { color: '#64748b', fontSize: 12, textAlign: 'center' },
  button: {
    marginTop: 8,
    backgroundColor: '#0284c7',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 10,
  },
  buttonText: { color: '#fff', fontWeight: '700' },
});
