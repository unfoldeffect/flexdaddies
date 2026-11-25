// The frame around every screen: loads the fonts and the data saved on the
// phone, then shows either "Who's lifting today?" or the four tabs.
import { Sora_700Bold, Sora_800ExtraBold, useFonts } from '@expo-google-fonts/sora';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import AppTabs from '@/components/app-tabs';
import { ProfileSelect } from '@/components/profile-select';
import { RestTimer } from '@/components/rest-timer';
import { LogDraftProvider } from '@/data/log-draft';
import { StoreProvider, useStore } from '@/data/store';
import { colors, setThemeMode, themed } from '@/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  // A missing font should never block the app: fall back to the system font.
  const [fontsLoaded, fontError] = useFonts({ Sora_700Bold, Sora_800ExtraBold });
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <StoreProvider>
          <App fontsReady={fontsLoaded || !!fontError} />
        </StoreProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function App({ fontsReady }: { fontsReady: boolean }) {
  const { ready, user, prefs } = useStore();
  const loaded = ready && fontsReady;
  // Set the look before anything below is drawn. The key makes the whole
  // screen tree redraw when the look is switched in Settings.
  const mode = prefs.theme === 'light' ? 'light' : 'dark';
  setThemeMode(mode);

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync().catch(() => {});
  }, [loaded]);

  if (!loaded) return <View style={styles.root} />;
  return (
    <View key={mode} style={styles.root}>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      {user ? <SignedIn /> : <ProfileSelect />}
    </View>
  );
}

function SignedIn() {
  // Keep the screen on while a profile is open, so the phone does not lock
  // mid-workout. If the phone refuses (low-power mode, say), carry on without.
  useEffect(() => {
    const tag = 'flex-daddies';
    activateKeepAwakeAsync(tag).catch(() => {});
    return () => {
      deactivateKeepAwake(tag).catch(() => {});
    };
  }, []);
  return (
    <LogDraftProvider>
      <View style={styles.root}>
        <AppTabs />
        <RestTimer />
      </View>
    </LogDraftProvider>
  );
}

const styles = themed(() => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
}));
