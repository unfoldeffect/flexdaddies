// Top of every tab: the FLEX DADDIES wordmark and Settings.
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, fonts, themed } from '../theme';
import { SettingsSheet } from './settings-sheet';
import { IconButton } from './ui';

export function AppHeader() {
  const insets = useSafeAreaInsets();
  const [settingsOpen, setSettingsOpen] = useState(false);

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
          <Text style={[styles.wordText, styles.wordOnGold]} allowFontScaling={false}>
            DADDIES
          </Text>
        </View>
      </View>
      <View style={styles.right}>
        <IconButton
          icon="cog-outline"
          label="Settings"
          color={colors.text}
          onPress={() => setSettingsOpen(true)}
        />
      </View>
      <SettingsSheet visible={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
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
  wordText: { fontFamily: fonts.headingBold, fontSize: 21, color: colors.text },
  wordOnGold: { color: colors.onGold },
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
    backgroundColor: colors.panel,
  },
  switchText: { color: colors.white, fontWeight: '600', fontSize: 15 },
}));
