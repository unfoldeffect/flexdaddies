// Top of every tab: the FLEX DADDIES wordmark, who is logged in, and Settings.
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useStore } from '../data/store';
import { tapLight } from '../lib/haptics';
import { USER_COLORS } from '../lib/workout-data';
import { colors, fonts } from '../theme';
import { SettingsSheet } from './settings-sheet';
import { Icon, IconButton, Plate } from './ui';

export function AppHeader() {
  const { user, setPrefs } = useStore();
  const insets = useSafeAreaInsets();
  const [settingsOpen, setSettingsOpen] = useState(false);
  if (!user) return null;

  return (
    <View style={[styles.bar, { paddingTop: insets.top + 8 }]}>
      <View
        style={styles.wordmark}
        accessible
        accessibilityRole="header"
        accessibilityLabel="Flex Daddies"
      >
        <Text style={styles.wordText} allowFontScaling={false}>
          FLEX
        </Text>
        <View style={styles.wordGold}>
          <Text style={styles.wordText} allowFontScaling={false}>
            DADDIES
          </Text>
        </View>
      </View>
      <View style={styles.right}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Logged in as ${user}. Switch person.`}
          onPress={() => {
            tapLight();
            setPrefs({ user: null });
          }}
          style={({ pressed }) => [styles.switch, pressed && { opacity: 0.75 }]}
        >
          <Plate size={28} label={user[0]} color={USER_COLORS[user]} />
          <Icon name="account-switch-outline" size={17} color={colors.white} />
          <Text style={styles.switchText}>Switch</Text>
        </Pressable>
        <IconButton
          icon="cog-outline"
          label="Settings"
          color={colors.ink}
          onPress={() => setSettingsOpen(true)}
        />
      </View>
      <SettingsSheet visible={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: colors.bg,
    width: '100%',
    maxWidth: 620,
    alignSelf: 'center',
  },
  wordmark: { flexDirection: 'row', alignItems: 'center' },
  wordText: { fontFamily: fonts.headingBold, fontSize: 25, color: colors.ink },
  wordGold: { backgroundColor: colors.gold, paddingHorizontal: 6 },
  right: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  switch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    minHeight: 44,
    paddingLeft: 8,
    paddingRight: 14,
    borderRadius: 999,
    backgroundColor: colors.ink,
  },
  switchText: { color: colors.white, fontWeight: '600', fontSize: 15 },
});
