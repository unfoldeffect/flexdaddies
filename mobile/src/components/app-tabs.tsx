// The tab bar. This is each phone's own native tab bar (the system one on
// iPhone, the Material one on Android), so it looks and behaves like the rest
// of the phone.
import { NativeTabs } from 'expo-router/native-tabs';

import { colors } from '../theme';

export default function AppTabs() {
  return (
    <NativeTabs
      tintColor={colors.ink}
      backgroundColor={colors.bg}
      indicatorColor="rgba(201,162,39,0.35)"
      iconColor={{ default: colors.muted, selected: colors.ink }}
      labelStyle={{
        default: { color: colors.muted },
        selected: { color: colors.ink },
      }}
    >
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Log</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="dumbbell.fill" md="fitness_center" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="history">
        <NativeTabs.Trigger.Label>History</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="clock.arrow.circlepath" md="history" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="body">
        <NativeTabs.Trigger.Label>Body</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="scalemass.fill" md="monitor_weight" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="stats">
        <NativeTabs.Trigger.Label>Stats</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="chart.bar.fill" md="bar_chart" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
