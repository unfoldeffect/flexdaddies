// The Go Pro screen: what Pro adds, the two plans and their prices, and the
// buy button. Buying is not wired yet (in-app purchase comes with the Apple
// Developer account), so the button says so and charges nothing.
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useStore } from '../data/store';
import { confirm } from '../lib/dialogs';
import { tapLight } from '../lib/haptics';
import {
  FREE_SUMMARY,
  PRO_FEATURES,
  PRO_PRICES,
  money,
  yearlyPerMonth,
  yearlySavingPercent,
  type ProPlan,
} from '../lib/pro';
import { colors, fonts, themed } from '../theme';
import { Sheet } from './sheet';
import { Icon, LinkButton, PrimaryButton, type IconName } from './ui';

export const NOT_WIRED_NOTE =
  'Buying opens when Flex Daddies is in the App Store. Nothing was charged.';

export function GoProSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { prefs } = useStore();
  const [plan, setPlan] = useState<ProPlan>('monthly');
  const [note, setNote] = useState<string | null>(null);

  const choose = (p: ProPlan) => {
    tapLight();
    setPlan(p);
    setNote(null);
  };

  // Left unwired on purpose until in-app purchase exists.
  const buy = () => setNote(NOT_WIRED_NOTE);
  const restore = () =>
    setNote('Restoring a purchase opens when Flex Daddies is in the App Store.');

  const buyLabel =
    plan === 'monthly'
      ? `Start Pro for ${money(PRO_PRICES.introMonth)}`
      : `Go Pro for ${money(PRO_PRICES.yearly)} a year`;

  return (
    <Sheet visible={visible} title="Flex Daddies Pro" onClose={onClose}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.lead}>
          {prefs.pro
            ? 'Pro is on. Here is everything it adds.'
            : 'Everything free stays free. Pro adds:'}
        </Text>

        <View style={styles.card}>
          {PRO_FEATURES.map((f) => (
            <View
              key={f.title}
              style={styles.feature}
              accessible
              accessibilityLabel={`${f.title}. ${f.detail}`}
            >
              <View style={styles.featureIcon}>
                <Icon name={f.icon as IconName} size={22} color={colors.goldDeep} />
              </View>
              <View style={styles.featureText}>
                <Text style={styles.featureTitle}>{f.title}</Text>
                <Text style={styles.featureDetail}>{f.detail}</Text>
              </View>
            </View>
          ))}
        </View>

        {prefs.pro ? (
          <Text style={styles.hint}>
            To change or cancel your plan, open your iPhone&apos;s Settings, tap your name, then
            Subscriptions.
          </Text>
        ) : (
          <>
            <Text style={styles.hint}>{FREE_SUMMARY}</Text>

            <PlanCard
              selected={plan === 'monthly'}
              onPress={() => choose('monthly')}
              name="Monthly"
              price={`${money(PRO_PRICES.introMonth)} your first month`}
              detail={`Then ${money(PRO_PRICES.monthly)} a month. Try it for a month and see if you like it.`}
            />
            <PlanCard
              selected={plan === 'yearly'}
              onPress={() => choose('yearly')}
              name="Yearly"
              price={`${money(PRO_PRICES.yearly)} a year`}
              detail={`About ${money(yearlyPerMonth())} a month. Save ${yearlySavingPercent()}% over paying monthly.`}
              badge={`SAVE ${yearlySavingPercent()}%`}
            />

            <PrimaryButton label={buyLabel} onPress={buy} />
            {note && (
              <Text style={styles.note} accessibilityRole="alert">
                {note}
              </Text>
            )}
            <LinkButton label="Restore a purchase" onPress={restore} style={styles.restore} />

            <Text style={styles.small}>
              {plan === 'monthly'
                ? `${money(PRO_PRICES.introMonth)} for the first month, then ${money(PRO_PRICES.monthly)} a month.`
                : `${money(PRO_PRICES.yearly)} a year.`}{' '}
              Paid through your Apple account. Pro renews automatically at that price unless you
              cancel at least 24 hours before the period ends. Cancel anytime in your iPhone&apos;s
              Settings, under your name, then Subscriptions.
            </Text>
            {/* Apple requires working links here; they are wired once the pages are live. */}
            <Text style={styles.small}>Terms of Use · Privacy Policy</Text>
          </>
        )}
      </ScrollView>
    </Sheet>
  );
}

function PlanCard({
  selected,
  onPress,
  name,
  price,
  detail,
  badge,
}: {
  selected: boolean;
  onPress: () => void;
  name: string;
  price: string;
  detail: string;
  badge?: string;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      aria-checked={selected}
      accessibilityLabel={`${name}: ${price}. ${detail}`}
      onPress={onPress}
      style={({ pressed }) => [styles.plan, selected && styles.planOn, pressed && { opacity: 0.8 }]}
    >
      <View style={[styles.radio, selected && styles.radioOn]}>
        {selected && <View style={styles.radioDot} />}
      </View>
      <View style={styles.planText}>
        <View style={styles.planHead}>
          <Text style={styles.planName}>{name}</Text>
          {badge && <Text style={styles.badge}>{badge}</Text>}
        </View>
        <Text style={styles.planPrice}>{price}</Text>
        <Text style={styles.planDetail}>{detail}</Text>
      </View>
    </Pressable>
  );
}

/**
 * Lets any screen open the Go Pro screen. Render `sheet` where the screen is
 * drawn, so it also works from inside another sheet (Settings, say).
 */
export function useGoPro() {
  const [open, setOpen] = useState(false);
  return {
    open: () => setOpen(true),
    /** Shows a short message with "See Pro"; opens the Go Pro screen on yes. */
    offer: async (title: string, message: string) => {
      if (await confirm({ title, message, confirmLabel: 'See Pro', cancelLabel: 'Not now' })) {
        setOpen(true);
      }
    },
    sheet: <GoProSheet visible={open} onClose={() => setOpen(false)} />,
  };
}

const styles = themed(() =>
  StyleSheet.create({
    content: { paddingHorizontal: 18, paddingBottom: 40, gap: 12 },
    lead: { fontFamily: fonts.headingBold, fontSize: 20, color: colors.text, marginTop: 4 },
    card: {
      backgroundColor: colors.surface,
      borderWidth: 2,
      borderColor: colors.line,
      borderRadius: 20,
      padding: 16,
      gap: 14,
    },
    feature: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
    featureIcon: { width: 28, alignItems: 'center', paddingTop: 1 },
    featureText: { flex: 1, gap: 2 },
    featureTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
    featureDetail: { fontSize: 15, color: colors.muted, lineHeight: 20 },
    hint: { fontSize: 15, color: colors.muted, lineHeight: 21 },
    plan: {
      flexDirection: 'row',
      gap: 14,
      alignItems: 'flex-start',
      backgroundColor: colors.surface,
      borderWidth: 2,
      borderColor: colors.line,
      borderRadius: 20,
      padding: 16,
    },
    planOn: { borderColor: colors.gold },
    radio: {
      width: 26,
      height: 26,
      borderRadius: 13,
      borderWidth: 2,
      borderColor: colors.muted,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 2,
    },
    radioOn: { borderColor: colors.gold },
    radioDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.gold },
    planText: { flex: 1, gap: 3 },
    planHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    planName: { fontSize: 15, fontWeight: '700', color: colors.muted, letterSpacing: 0.5 },
    badge: {
      fontSize: 12,
      fontWeight: '800',
      color: colors.onGold,
      backgroundColor: colors.gold,
      borderRadius: 8,
      overflow: 'hidden',
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    planPrice: { fontFamily: fonts.headingBold, fontSize: 22, color: colors.text },
    planDetail: { fontSize: 15, color: colors.muted, lineHeight: 20 },
    note: { fontSize: 16, fontWeight: '600', color: colors.text, textAlign: 'center' },
    restore: { alignSelf: 'center' },
    small: { fontSize: 13, color: colors.muted, lineHeight: 18, textAlign: 'center' },
  }),
);
