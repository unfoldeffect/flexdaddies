// Browser preview only (used for automated screen checks). Phones use the
// native tab bar in app-tabs.tsx. This one copies the website's navy pill.
import {
  TabList,
  TabSlot,
  TabTrigger,
  Tabs,
  type TabListProps,
  type TabTriggerSlotProps,
} from 'expo-router/ui';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme';
import { Icon, type IconName } from './ui';

const TABS: {
  name: string;
  href: '/' | '/history' | '/body' | '/stats';
  label: string;
  icon: IconName;
}[] = [
  { name: 'index', href: '/', label: 'Log', icon: 'dumbbell' },
  { name: 'history', href: '/history', label: 'History', icon: 'history' },
  { name: 'body', href: '/body', label: 'Body', icon: 'scale-bathroom' },
  { name: 'stats', href: '/stats', label: 'Stats', icon: 'chart-bar' },
];

export default function AppTabs() {
  return (
    <Tabs>
      <TabSlot style={{ height: '100%' }} />
      <TabList asChild>
        <Bar>
          {TABS.map((t) => (
            <TabTrigger key={t.name} name={t.name} href={t.href} asChild>
              <TabButton label={t.label} icon={t.icon} />
            </TabTrigger>
          ))}
        </Bar>
      </TabList>
    </Tabs>
  );
}

function Bar(props: TabListProps) {
  return (
    <View {...(props as object)} style={styles.wrap}>
      <View style={styles.bar}>{props.children}</View>
    </View>
  );
}

function TabButton({
  label,
  icon,
  isFocused,
  ...props
}: TabTriggerSlotProps & { label: string; icon: IconName }) {
  return (
    <Pressable
      {...(props as object)}
      accessibilityRole="tab"
      accessibilityState={{ selected: !!isFocused }}
      style={[styles.btn, isFocused && styles.btnOn]}
    >
      <Icon name={icon} size={20} color={isFocused ? colors.ink : 'rgba(255,255,255,0.6)'} />
      <Text style={[styles.label, isFocused && { color: colors.ink }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 18,
    paddingHorizontal: 18,
    alignItems: 'center',
  },
  bar: {
    flexDirection: 'row',
    gap: 4,
    padding: 8,
    width: '100%',
    maxWidth: 420,
    borderRadius: 999,
    backgroundColor: colors.ink,
  },
  btn: { flex: 1, alignItems: 'center', gap: 3, paddingVertical: 8, borderRadius: 999 },
  btnOn: { backgroundColor: colors.gold },
  label: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.6)' },
});
