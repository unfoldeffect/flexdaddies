// "Together Mode": log for both people at once. Uses the phone's own switch.
import { Platform, Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { tapLight } from '../lib/haptics';
import { USER_COLORS, type WorkoutUser } from '../lib/workout-data';
import { colors, fonts } from '../theme';

export function TogetherToggle({
  on,
  onChange,
  user,
  otherUser,
}: {
  on: boolean;
  onChange: (on: boolean) => void;
  user: WorkoutUser;
  otherUser: WorkoutUser;
}) {
  const toggle = (next: boolean) => {
    tapLight();
    onChange(next);
  };
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: on }}
      accessibilityLabel="Together Mode"
      accessibilityHint={`Log for ${user} and ${otherUser} at the same time`}
      onPress={() => toggle(!on)}
      style={[styles.wrap, on && styles.wrapOn]}
    >
      <View style={styles.dots}>
        <View style={[styles.dot, { backgroundColor: USER_COLORS[user] }]} />
        <View style={[styles.dot, styles.dotSecond, { backgroundColor: USER_COLORS[otherUser] }]} />
      </View>
      <Text style={styles.label}>Together Mode</Text>
      <Switch
        value={on}
        onValueChange={toggle}
        trackColor={{ false: colors.line, true: colors.ink }}
        thumbColor={Platform.OS === 'android' ? (on ? colors.gold : colors.white) : undefined}
        ios_backgroundColor={colors.line}
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 54,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginBottom: 16,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  wrapOn: { borderColor: colors.ink, backgroundColor: 'rgba(11,37,69,0.04)' },
  dots: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.white },
  dotSecond: { marginLeft: -8 },
  label: { flex: 1, fontFamily: fonts.heading, fontSize: 16, color: colors.text },
});
