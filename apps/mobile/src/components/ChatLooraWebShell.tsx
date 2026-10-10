import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { WebView, type WebViewNavigation } from 'react-native-webview';
import { APP_URL, START_PATH, isAllowedNavigation } from '../config';

type Props = {
  initialPath?: string;
};

export function ChatLooraWebShell({ initialPath = START_PATH }: Props) {
  const webRef = useRef<WebView>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const startUrl = useMemo(() => `${APP_URL}${initialPath.startsWith('/') ? initialPath : `/${initialPath}`}`, [initialPath]);

  const onShouldStartLoadWithRequest = useCallback((req: { url: string }) => {
    const { url } = req;
    if (!url || url === 'about:blank') return true;
    if (url.startsWith('mailto:') || url.startsWith('tel:') || url.startsWith('whatsapp:')) {
      Linking.openURL(url).catch(() => undefined);
      return false;
    }
    if (isAllowedNavigation(url)) return true;
    Linking.openURL(url).catch(() => undefined);
    return false;
  }, []);

  const onNavigationStateChange = useCallback((nav: WebViewNavigation) => {
    if (nav.loading) setLoading(true);
  }, []);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <StatusBar style="light" />
      <View style={styles.shell}>
        {error ? (
          <View style={styles.center}>
            <Text style={styles.errorTitle}>تعذر فتح ChatLoora</Text>
            <Text style={styles.errorBody}>{error}</Text>
            <Pressable
              style={styles.button}
              onPress={() => {
                setError(null);
                webRef.current?.reload();
              }}
            >
              <Text style={styles.buttonText}>إعادة المحاولة</Text>
            </Pressable>
          </View>
        ) : (
          <WebView
            ref={webRef}
            source={{ uri: startUrl }}
            style={styles.webview}
            onLoadStart={() => {
              setLoading(true);
              setError(null);
            }}
            onLoadEnd={() => setLoading(false)}
            onError={(e) => {
              setLoading(false);
              setError(e.nativeEvent.description || 'Network error');
            }}
            onHttpError={(e) => {
              if (e.nativeEvent.statusCode >= 500) {
                setError(`Server error (${e.nativeEvent.statusCode})`);
              }
            }}
            onNavigationStateChange={onNavigationStateChange}
            onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
            javaScriptEnabled
            domStorageEnabled
            sharedCookiesEnabled
            thirdPartyCookiesEnabled
            allowsBackForwardNavigationGestures
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            setSupportMultipleWindows={false}
            pullToRefreshEnabled={Platform.OS === 'android'}
            startInLoadingState
            applicationNameForUserAgent="ChatLooraMobile/1.0"
          />
        )}
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
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  errorTitle: { color: '#f8fafc', fontSize: 18, fontWeight: '700' },
  errorBody: { color: '#cbd5e1', textAlign: 'center' },
  button: {
    marginTop: 8,
    backgroundColor: '#0284c7',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 10,
  },
  buttonText: { color: '#fff', fontWeight: '700' },
});
