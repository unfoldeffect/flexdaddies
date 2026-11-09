// Floating rest timer, on every tab. Tap to start (or restart) the countdown
// between sets. When time is up the phone buzzes and chimes, then the timer
// resets ready for the next set.
import { setAudioModeAsync, useAudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { AppState, Platform, Pressable, StyleSheet, Text, Vibration, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';

import { useStore } from '../data/store';
import { tapMedium } from '../lib/haptics';
import { colors, fonts, shadow } from '../theme';

const SIZE = 84;
const RING = 5;
const R = (SIZE - RING) / 2;
const CIRCUMFERENCE = 2 * Math.PI * R;

/** Seconds left until `endAt` (never below zero). */
export function secondsLeft(endAt: number, now: number): number {
  return Math.max(0, Math.ceil((endAt - now) / 1000));
}

function buzzDone() {
  if (Platform.OS === 'web') return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  // A longer pattern as well, so it is hard to miss with the phone on the floor.
  Vibration.vibrate(Platform.OS === 'android' ? [0, 200, 100, 200, 100, 200] : [0, 300, 300]);
}

export function RestTimer() {
  const { prefs } = useStore();
  const restSeconds = prefs.restSeconds;
  const insets = useSafeAreaInsets();
  const player = useAudioPlayer(require('../../assets/sounds/rest-done.wav'));

  // The countdown is based on the finish time, not on counting ticks, so it
  // stays right even if the phone pauses the app for a moment.
  const [endAt, setEndAt] = useState<number | null>(null);
  const [remaining, setRemaining] = useState(restSeconds);
  const [justFinished, setJustFinished] = useState(false);
  const soundOn = useRef(prefs.restSound);
  useEffect(() => {
    soundOn.current = prefs.restSound;
  }, [prefs.restSound]);

  useEffect(() => {
    // Let the chime play even with the ring/silent switch off, mixed with any music.
    setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'mixWithOthers' }).catch(() => {});
  }, []);

  useEffect(() => {
    if (endAt === null) return;
    const finish = () => {
      setEndAt(null);
      setJustFinished(true);
      buzzDone();
      if (soundOn.current) {
        try {
          player.seekTo(0);
          player.play();
        } catch {
          // Sound is a nice-to-have; the buzz still happened.
        }
      }
    };
    const tick = () => {
      const left = secondsLeft(endAt, Date.now());
      if (left > 0) setRemaining(left);
      else finish();
    };
    const interval = setInterval(tick, 250);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') tick();
    });
    return () => {
      clearInterval(interval);
      sub.remove();
    };
  }, [endAt, player]);

  // Clear the "GO!" flash a couple of seconds after the timer finishes.
  useEffect(() => {
    if (!justFinished) return;
    const t = setTimeout(() => setJustFinished(false), 2500);
    return () => clearTimeout(t);
  }, [justFinished]);

  const running = endAt !== null;
  const start = () => {
    tapMedium();
    setJustFinished(false);
    setRemaining(restSeconds);
    setEndAt(Date.now() + restSeconds * 1000);
  };

  const progress = running ? remaining / restSeconds : 0;
  const shown = running ? remaining : restSeconds;
  const bottom = insets.bottom + (Platform.OS === 'android' ? 96 : Platform.OS === 'ios' ? 74 : 84);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        running
          ? `Rest timer, ${remaining} seconds left. Tap to restart.`
          : `Start ${restSeconds} second rest timer`
      }
      onPress={start}
      style={({ pressed }) => [styles.button, shadow, { bottom }, pressed && styles.pressed]}>
      <Svg width={SIZE} height={SIZE} style={StyleSheet.absoluteFill}>
        <Circle cx={SIZE / 2} cy={SIZE / 2} r={R} stroke={colors.gold} strokeWidth={RING} fill={colors.ink} />
        {running && (
          <Circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            stroke="rgba(11,37,69,0.75)"
            strokeWidth={RING}
            fill="none"
            strokeDasharray={`${CIRCUMFERENCE * (1 - progress)} ${CIRCUMFERENCE}`}
            transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
          />
        )}
      </Svg>
      <View style={styles.face} pointerEvents="none">
        {justFinished ? (
          <Text style={styles.go} allowFontScaling={false}>
            GO!
          </Text>
        ) : (
          <>
            <Text style={styles.number} allowFontScaling={false}>
              {shown}
            </Text>
            <Text style={styles.caption} allowFontScaling={false}>
              {running ? 'REST' : 'TAP'}
            </Text>
          </>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    right: 16,
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { transform: [{ scale: 0.95 }] },
  face: { alignItems: 'center', justifyContent: 'center' },
  number: { fontFamily: fonts.headingBold, fontSize: 26, lineHeight: 30, color: colors.white },
  caption: { fontFamily: fonts.heading, fontSize: 12, letterSpacing: 0.8, color: colors.gold },
  go: { fontFamily: fonts.headingBold, fontSize: 22, color: colors.white },
});
