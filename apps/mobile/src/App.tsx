import { useEffect } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ChatLooraWebShell } from './components/ChatLooraWebShell';
import { clearOldDownloads } from './native/downloads';
// Importing push also registers the foreground notification handler.
import { ensureMessagesChannel, useClearBadgeWhenActive } from './native/push';

SplashScreen.preventAutoHideAsync().catch(() => undefined);
SplashScreen.setOptions({ fade: true, duration: 250 });

export default function App() {
  useClearBadgeWhenActive();

  useEffect(() => {
    ensureMessagesChannel().catch(() => undefined);
    clearOldDownloads();
  }, []);

  return (
    <SafeAreaProvider>
      <ChatLooraWebShell />
    </SafeAreaProvider>
  );
}
