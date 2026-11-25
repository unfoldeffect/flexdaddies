// The store app's front door: sign in with Apple, Google or a 6-digit code
// sent by email (no passwords), then a quick first-time setup.
import { Image } from 'expo-image';
import { useRef, useState, type ComponentRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../data/auth';
import { useStore } from '../data/store';
import { isEmail, tidyCode } from '../lib/auth-api';
import { buzzSuccess, tapLight, tapMedium } from '../lib/haptics';
import { colors, fonts, themed } from '../theme';
import { Icon, PrimaryButton } from './ui';

type InputRef = ComponentRef<typeof TextInput>;

function Screen({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={styles.root}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 28 },
      ]}
    >
      <View style={styles.column}>{children}</View>
    </ScrollView>
  );
}

function Problem({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <Text style={styles.problem} accessibilityRole="alert" accessibilityLiveRegion="polite">
      {text}
    </Text>
  );
}

export function SignIn() {
  const { startEmail, verifyCode } = useAuth();
  const [step, setStep] = useState<'start' | 'code'>('start');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  /** Only a test server sends the code back; a real one emails it. */
  const [testCode, setTestCode] = useState<string | null>(null);
  const codeRef = useRef<InputRef>(null);

  const sendCode = async (fromCodeScreen = false) => {
    if (busy) return;
    if (!isEmail(email)) {
      setProblem('Enter your email address, like you@example.com.');
      return;
    }
    tapMedium();
    setBusy(true);
    setProblem(null);
    setNotice(null);
    const r = await startEmail(email);
    setBusy(false);
    if (!r.ok) {
      setProblem(r.message);
      return;
    }
    setTestCode(r.data.devCode ?? null);
    setCode('');
    setStep('code');
    if (fromCodeScreen) setNotice('A new code is on its way.');
    setTimeout(() => codeRef.current?.focus(), 400);
  };

  const signIn = async (typed = code) => {
    if (busy || typed.length !== 6) return;
    tapMedium();
    setBusy(true);
    setProblem(null);
    setNotice(null);
    const r = await verifyCode(email, typed);
    // On success this screen is replaced, so there is nothing more to set.
    if (!r.ok) {
      setBusy(false);
      setProblem(r.message);
    } else {
      buzzSuccess();
    }
  };

  const comingSoon = (who: string) => {
    tapLight();
    setProblem(null);
    setNotice(`${who} sign-in is coming soon. Use your email for now.`);
  };

  if (step === 'code') {
    return (
      <Screen>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={12}
          onPress={() => {
            setStep('start');
            setProblem(null);
            setNotice(null);
          }}
          style={styles.back}
        >
          <Icon name="chevron-left" size={24} color={colors.goldDeep} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>
        <Text accessibilityRole="header" style={styles.title}>
          Check your email
        </Text>
        <Text style={styles.lead}>
          We sent a 6-digit code to <Text style={styles.leadStrong}>{email.trim()}</Text>.
        </Text>
        {testCode && (
          <Text style={styles.testCode} accessibilityLabel={`Test code ${testCode}`}>
            Test build: your code is {testCode}
          </Text>
        )}
        <Text style={styles.label}>Code</Text>
        <TextInput
          ref={codeRef}
          style={styles.codeInput}
          value={code}
          onChangeText={(text) => {
            const next = tidyCode(text);
            setCode(next);
            if (next.length === 6 && code.length < 6) void signIn(next);
          }}
          keyboardType="number-pad"
          inputMode="numeric"
          textContentType="oneTimeCode"
          autoComplete="one-time-code"
          maxLength={6}
          placeholder="000000"
          placeholderTextColor={colors.placeholder}
          accessibilityLabel="6-digit code"
          returnKeyType="done"
          onSubmitEditing={() => signIn()}
        />
        <Problem text={problem} />
        <PrimaryButton
          label={busy ? 'SIGNING IN...' : 'SIGN IN'}
          disabled={busy || code.length !== 6}
          onPress={() => signIn()}
        />
        {notice && <Text style={styles.notice}>{notice}</Text>}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Send a new code"
          hitSlop={10}
          disabled={busy}
          onPress={() => sendCode(true)}
          style={styles.resend}
        >
          <Text style={styles.small}>
            No email? <Text style={styles.link}>Send a new code</Text>
          </Text>
        </Pressable>
        <Text style={[styles.small, styles.foot]}>
          The code works for 10 minutes. Check your spam folder if it doesn&apos;t arrive.
        </Text>
      </Screen>
    );
  }

  return (
    <Screen>
      <Image
        source={require('../../assets/images/logo.png')}
        style={styles.logo}
        contentFit="contain"
        accessibilityLabel="Flex Daddies"
      />
      <View style={styles.wordmark} accessible accessibilityRole="header" accessibilityLabel="Flex Daddies">
        <Text style={styles.wordText} allowFontScaling={false}>
          FLEX
        </Text>
        <View style={styles.wordGold}>
          <Text style={[styles.wordText, styles.wordOnGold]} allowFontScaling={false}>
            DADDIES
          </Text>
        </View>
      </View>
      <Text style={styles.tagline}>Your lifting log.</Text>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Continue with Apple"
        onPress={() => comingSoon('Apple')}
        style={({ pressed }) => [styles.apple, pressed && styles.pressed]}
      >
        <Icon name="apple" size={24} color="#000000" />
        <Text style={styles.appleText}>Continue with Apple</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Continue with Google"
        onPress={() => comingSoon('Google')}
        style={({ pressed }) => [styles.google, pressed && styles.pressed]}
      >
        <Icon name="google" size={22} color={colors.text} />
        <Text style={styles.googleText}>Continue with Google</Text>
      </Pressable>
      {notice && <Text style={styles.notice}>{notice}</Text>}

      <View style={styles.orRow}>
        <View style={styles.orLine} />
        <Text style={styles.small}>or</Text>
        <View style={styles.orLine} />
      </View>

      <Text style={styles.label}>Email</Text>
      <TextInput
        style={styles.input}
        value={email}
        onChangeText={(text) => {
          setEmail(text);
          if (problem) setProblem(null);
        }}
        placeholder="you@example.com"
        placeholderTextColor={colors.placeholder}
        keyboardType="email-address"
        inputMode="email"
        textContentType="emailAddress"
        autoComplete="email"
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="send"
        onSubmitEditing={() => sendCode()}
        accessibilityLabel="Email"
      />
      <Problem text={problem} />
      <PrimaryButton
        label={busy ? 'SENDING...' : 'EMAIL ME A CODE'}
        disabled={busy}
        onPress={() => sendCode()}
      />
      <Text style={[styles.small, styles.foot]}>No password needed.</Text>
    </Screen>
  );
}

/** Shown once, right after the first sign-in. */
export function FirstTimeSetup() {
  const { saveProfile, signOut, account } = useAuth();
  const { prefs, setPrefs } = useStore();
  const [name, setName] = useState('');
  const [unit, setUnit] = useState<'lbs' | 'kg'>(prefs.weightUnit);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const start = async () => {
    if (busy) return;
    if (!name.trim()) {
      setProblem('Type your first name.');
      return;
    }
    tapMedium();
    setBusy(true);
    setProblem(null);
    const r = await saveProfile({ name: name.trim(), weightUnit: unit });
    if (!r.ok) {
      setBusy(false);
      setProblem(r.message);
      return;
    }
    setPrefs({ weightUnit: unit });
    buzzSuccess();
  };

  return (
    <Screen>
      <Text accessibilityRole="header" style={styles.title}>
        Welcome!
      </Text>
      <Text style={styles.lead}>Two quick things, then you&apos;re ready to log.</Text>

      <Text style={[styles.label, styles.gapAbove]}>Your first name</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={(text) => {
          setName(text);
          if (problem) setProblem(null);
        }}
        placeholder="First name"
        placeholderTextColor={colors.placeholder}
        autoCapitalize="words"
        autoComplete="given-name"
        textContentType="givenName"
        maxLength={40}
        returnKeyType="done"
        accessibilityLabel="Your first name"
      />

      <Text style={[styles.label, styles.gapAbove]}>Body weight in</Text>
      <View style={styles.units} accessibilityRole="radiogroup" accessibilityLabel="Body weight in">
        {(['lbs', 'kg'] as const).map((u) => {
          const on = unit === u;
          return (
            <Pressable
              key={u}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              accessibilityLabel={u === 'lbs' ? 'Pounds' : 'Kilos'}
              onPress={() => {
                tapLight();
                setUnit(u);
              }}
              style={[styles.unit, on && styles.unitOn]}
            >
              <Text style={[styles.unitText, on && styles.unitTextOn]}>
                {u === 'lbs' ? 'Pounds (lbs)' : 'Kilos (kg)'}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Problem text={problem} />
      <PrimaryButton
        label={busy ? 'SAVING...' : 'START LOGGING'}
        disabled={busy}
        onPress={start}
        style={styles.gapAbove}
      />
      <Text style={[styles.small, styles.foot]}>You can change these any time in Settings.</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Use a different email"
        hitSlop={10}
        onPress={() => signOut()}
        style={styles.resend}
      >
        <Text style={styles.small}>
          Signed in as {account?.email}. <Text style={styles.link}>Use a different email</Text>
        </Text>
      </Pressable>
    </Screen>
  );
}

const styles = themed(() => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { flexGrow: 1, paddingHorizontal: 26, alignItems: 'center' },
  column: { width: '100%', maxWidth: 460, gap: 12 },
  logo: { width: 150, height: 150, borderRadius: 75, alignSelf: 'center', backgroundColor: colors.white },
  wordmark: { flexDirection: 'row', alignItems: 'center', alignSelf: 'center', gap: 8, marginTop: 12 },
  wordText: { fontFamily: fonts.headingBold, fontSize: 32, letterSpacing: 0.5, color: colors.text },
  wordGold: { backgroundColor: colors.gold, paddingHorizontal: 8 },
  wordOnGold: { color: colors.onGold },
  tagline: { fontSize: 20, color: colors.muted, textAlign: 'center', marginBottom: 20 },
  apple: {
    minHeight: 60,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#000000',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  appleText: { fontSize: 19, fontWeight: '600', color: '#000000' },
  google: {
    minHeight: 60,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.text,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  googleText: { fontSize: 19, fontWeight: '600', color: colors.text },
  pressed: { opacity: 0.7 },
  orRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 6 },
  orLine: { flex: 1, height: 1, backgroundColor: colors.line },
  label: { fontSize: 16, fontWeight: '600', color: colors.muted },
  gapAbove: { marginTop: 14 },
  input: {
    minHeight: 58,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.line,
    backgroundColor: colors.field,
    color: colors.text,
    fontSize: 19,
    paddingHorizontal: 16,
  },
  codeInput: {
    minHeight: 76,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.gold,
    backgroundColor: colors.field,
    color: colors.text,
    fontFamily: fonts.heading,
    fontSize: 34,
    letterSpacing: 8,
    textAlign: 'center',
  },
  title: { fontFamily: fonts.headingBold, fontSize: 30, color: colors.text, marginTop: 8 },
  lead: { fontSize: 19, lineHeight: 28, color: colors.muted },
  leadStrong: { color: colors.text, fontWeight: '600' },
  back: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', minHeight: 44 },
  backText: { fontSize: 18, fontWeight: '600', color: colors.goldDeep },
  testCode: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
    backgroundColor: colors.surface2,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    overflow: 'hidden',
  },
  problem: { fontSize: 16, fontWeight: '600', color: colors.danger },
  notice: { fontSize: 16, color: colors.text, textAlign: 'center' },
  small: { fontSize: 15, lineHeight: 22, color: colors.muted, textAlign: 'center' },
  link: { color: colors.goldDeep, fontWeight: '700' },
  resend: { minHeight: 44, justifyContent: 'center', marginTop: 4 },
  foot: { marginTop: 10 },
  units: { flexDirection: 'row', gap: 12 },
  unit: {
    flex: 1,
    minHeight: 60,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.strong,
    backgroundColor: colors.field,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unitOn: { backgroundColor: colors.strong },
  unitText: { fontFamily: fonts.heading, fontSize: 17, color: colors.text },
  unitTextOn: { color: colors.onStrong },
}));
