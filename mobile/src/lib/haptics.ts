// Small taps you feel (the phone's haptic engine). Quietly does nothing where
// there is none (older phones, the browser preview).
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

const enabled = Platform.OS === 'ios' || Platform.OS === 'android';

const run = (fn: () => Promise<void>) => {
  if (!enabled) return;
  fn().catch(() => {});
};

/** A light tick: switching a toggle, picking from a list. */
export const tapLight = () => run(() => Haptics.selectionAsync());

/** A firmer bump: picking up a card to drag, starting the timer. */
export const tapMedium = () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));

/** A soft click each time a dragged card passes another. */
export const tapStep = () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));

/** Something was saved. */
export const buzzSuccess = () =>
  run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));

/** A delete or other "are you sure" moment. */
export const buzzWarning = () =>
  run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
