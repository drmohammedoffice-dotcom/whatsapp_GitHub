import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ChatLooraWebShell } from './components/ChatLooraWebShell';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function App() {
  return (
    <SafeAreaProvider>
      <ChatLooraWebShell />
    </SafeAreaProvider>
  );
}
