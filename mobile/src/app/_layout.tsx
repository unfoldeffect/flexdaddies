// The frame around every screen: loads the fonts and the data saved on the
// phone, then shows either "Who's lifting today?" or the four tabs.
import { Oswald_600SemiBold, Oswald_700Bold, useFonts } from '@expo-google-fonts/oswald';
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
import { colors } from '@/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  // A missing font should never block the app: fall back to the system font.
  const [fontsLoaded, fontError] = useFonts({ Oswald_600SemiBold, Oswald_700Bold });
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <StoreProvider>
          <StatusBar style="dark" />
          <App fontsReady={fontsLoaded || !!fontError} />
        </StoreProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function App({ fontsReady }: { fontsReady: boolean }) {
  const { ready, user } = useStore();
  const loaded = ready && fontsReady;

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync().catch(() => {});
  }, [loaded]);

  if (!loaded) return <View style={styles.root} />;
  if (!user) return <ProfileSelect />;
  return <SignedIn />;
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

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
});
