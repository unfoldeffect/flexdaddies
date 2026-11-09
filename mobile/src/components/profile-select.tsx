// "Who's lifting today?" The first screen, and where Switch takes you.
import { Image } from 'expo-image';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useStore } from '../data/store';
import { tapMedium } from '../lib/haptics';
import { USERS, USER_COLORS } from '../lib/workout-data';
import { colors, fonts } from '../theme';
import { DotCard } from './ui';

export function ProfileSelect() {
  const { setPrefs } = useStore();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 24 },
      ]}
    >
      <Image
        source={require('../../assets/images/logo.png')}
        style={styles.logo}
        contentFit="contain"
        accessibilityLabel="Flex Daddies"
      />
      <DotCard style={styles.card}>
        <Text accessibilityRole="header" style={styles.prompt}>
          Who&apos;s lifting today?
        </Text>
        <View style={styles.buttons}>
          {USERS.map((u) => (
            <Pressable
              key={u}
              accessibilityRole="button"
              accessibilityLabel={`Continue as ${u}`}
              onPress={() => {
                tapMedium();
                setPrefs({ user: u });
              }}
              style={({ pressed }) => [
                styles.pill,
                pressed && { backgroundColor: colors.goldDeep },
              ]}
            >
              <View style={[styles.pillDot, { backgroundColor: USER_COLORS[u] }]}>
                <Text style={styles.pillDotText}>{u[0]}</Text>
              </View>
              <Text style={styles.pillText}>{u.toUpperCase()}</Text>
            </Pressable>
          ))}
        </View>
      </DotCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { alignItems: 'center', paddingHorizontal: 22, flexGrow: 1, justifyContent: 'center' },
  logo: { width: 240, height: 240, marginBottom: 24 },
  card: {
    width: '100%',
    maxWidth: 520,
    borderRadius: 28,
    paddingVertical: 34,
    paddingHorizontal: 24,
  },
  prompt: {
    color: colors.white,
    fontFamily: fonts.heading,
    fontSize: 21,
    textAlign: 'center',
    marginBottom: 22,
  },
  buttons: { gap: 14 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 62,
    paddingHorizontal: 22,
    borderRadius: 999,
    backgroundColor: colors.gold,
  },
  pillDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillDotText: { color: colors.white, fontFamily: fonts.headingBold, fontSize: 17 },
  pillText: { fontFamily: fonts.headingBold, fontSize: 20, letterSpacing: 0.8, color: colors.ink },
});
