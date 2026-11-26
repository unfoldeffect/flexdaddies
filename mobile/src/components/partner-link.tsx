// Settings > Lift with a partner: link the partner's phone (Pro), so sessions
// logged for both show up on both phones.
import { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { usePartner } from '../data/partner';
import { useStore } from '../data/store';
import { tidyCode } from '../lib/auth-api';
import { confirm } from '../lib/dialogs';
import { buzzSuccess, buzzWarning } from '../lib/haptics';
import { colors, fonts, themed } from '../theme';
import { OutlineButton, SmallButton } from './ui';

export function PartnerLink() {
  const { prefs } = useStore();
  const partner = usePartner();
  const [code, setCode] = useState<string | null>(null);
  const [typing, setTyping] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  // While a code is on screen, keep checking whether the partner has typed it in.
  const waiting = !!code && !partner.linkedWith;
  const refresh = partner.refresh;
  useEffect(() => {
    if (!waiting) return;
    const timer = setInterval(() => void refresh(), 4000);
    return () => clearInterval(timer);
  }, [waiting, refresh]);

  if (partner.linkedWith) {
    return (
      <View style={styles.box}>
        <Text style={styles.title}>Linked with {partner.linkedWith}</Text>
        <Text style={styles.text}>
          Sessions either of you logs in Together Mode show up on both phones. Nothing else is
          shared: not your solo workouts, your weight or your measurements.
        </Text>
        {problem && <Text style={styles.problem}>{problem}</Text>}
        <OutlineButton
          label="Unlink phones"
          onPress={async () => {
            buzzWarning();
            const yes = await confirm({
              title: `Unlink from ${partner.linkedWith}?`,
              message: 'Workouts already on each phone stay. New sessions will no longer be shared.',
              confirmLabel: 'Unlink',
              destructive: true,
            });
            if (!yes) return;
            const r = await partner.unlink();
            setProblem(r.ok ? null : r.message);
          }}
        />
      </View>
    );
  }

  if (!prefs.pro) {
    return (
      <View style={styles.box}>
        <Text style={styles.title}>Link your partner&apos;s phone (Pro)</Text>
        <Text style={styles.text}>
          With Pro, a session you log for both of you shows up on your partner&apos;s phone too.
        </Text>
      </View>
    );
  }

  const getCode = async () => {
    setBusy(true);
    setProblem(null);
    setTyping(null);
    const r = await partner.createInvite();
    setBusy(false);
    if (r.ok) setCode(r.data.code);
    else setProblem(r.message);
  };

  const link = async () => {
    if (!typing || typing.length !== 6 || busy) return;
    setBusy(true);
    setProblem(null);
    const r = await partner.join(typing);
    setBusy(false);
    if (r.ok) {
      buzzSuccess();
      setTyping(null);
    } else setProblem(r.message);
  };

  return (
    <View style={styles.box}>
      <Text style={styles.title}>Link your partner&apos;s phone</Text>
      <Text style={styles.text}>
        One of you gets a code and the other types it in. After that, sessions logged in Together
        Mode show up on both phones.
      </Text>
      {code && (
        <View style={styles.codeBox} accessible accessibilityLabel={`Invite code ${code.split('').join(' ')}`}>
          <Text style={styles.code}>{code}</Text>
          <Text style={styles.text}>
            Your partner opens Settings, Lift with a partner, Enter a code. It works for 15 minutes.
            This card changes by itself once they have typed it in.
          </Text>
        </View>
      )}
      {typing !== null && (
        <View style={styles.enter}>
          <TextInput
            style={styles.input}
            value={typing}
            onChangeText={(text) => setTyping(tidyCode(text))}
            keyboardType="number-pad"
            inputMode="numeric"
            maxLength={6}
            placeholder="000000"
            placeholderTextColor={colors.placeholder}
            accessibilityLabel="Partner's invite code"
          />
          <SmallButton gold label={busy ? 'Linking...' : 'Link'} disabled={busy || typing.length !== 6} onPress={link} />
        </View>
      )}
      {problem && (
        <Text style={styles.problem} accessibilityRole="alert">
          {problem}
        </Text>
      )}
      <View style={styles.buttons}>
        <OutlineButton compact label={code ? 'Get a new code' : 'Get an invite code'} disabled={busy} onPress={getCode} />
        {typing === null && (
          <OutlineButton
            compact
            label="Enter a code"
            onPress={() => {
              setCode(null);
              setProblem(null);
              setTyping('');
            }}
          />
        )}
      </View>
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  box: { borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 12, gap: 10 },
  title: { fontSize: 16, fontWeight: '700', color: colors.text },
  text: { fontSize: 14, lineHeight: 20, color: colors.muted },
  codeBox: { borderRadius: 14, backgroundColor: colors.field, padding: 14, gap: 8, alignItems: 'center' },
  code: { fontFamily: fonts.headingBold, fontSize: 36, letterSpacing: 6, color: colors.text },
  enter: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  input: {
    flex: 1,
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.gold,
    backgroundColor: colors.field,
    color: colors.text,
    fontFamily: fonts.heading,
    fontSize: 24,
    letterSpacing: 4,
    textAlign: 'center',
  },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  problem: { fontSize: 15, fontWeight: '600', color: colors.danger },
}));
