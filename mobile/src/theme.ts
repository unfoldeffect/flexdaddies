// Colours and type for Version 2 of the design, in two modes: dark (the
// default) and light, switched in Settings.
//
// How switching works: `colors` and every `themed(...)` style sheet look up
// the current mode each time they are read. When the mode changes, the root
// layout redraws the whole screen tree (see app/_layout.tsx), so nothing has
// to subscribe to anything.
import { Appearance, Platform, type TextStyle } from 'react-native';

export type ThemeMode = 'dark' | 'light';

const dark = {
  /** Page background. */
  bg: '#0a1f3d',
  /** Cards. */
  surface: '#0e2749',
  surface2: '#12305a',
  line: '#35527f',
  /** Text boxes and number boxes. */
  field: '#12305a',
  text: '#ffffff',
  muted: '#c9d6ea',
  placeholder: '#8fa6c6',
  gold: '#f5b800',
  /** Gold used as text or small icons. */
  goldDeep: '#f5b800',
  /** "Last time" line. */
  goldNote: '#c6e0f7',
  goldTint: 'rgba(245,184,0,0.14)',
  /** Text on gold or baby blue. */
  onGold: '#0a1f3d',
  blue: '#c6e0f7',
  /** Dark panels with white text: tab bar, rest timer, headline cards. */
  panel: '#1a3a6b',
  /** Selected choices and main buttons. */
  strong: '#f5b800',
  onStrong: '#0a1f3d',
  /** A faint wash behind a selected card. */
  tint: 'rgba(198,224,247,0.08)',
  danger: '#ff8a80',
  dangerBg: 'rgba(255,138,128,0.14)',
  white: '#ffffff',
  up: '#fca5a5',
  down: '#86efac',
  upOnDark: '#fca5a5',
  downOnDark: '#86efac',
  /** Navy, the same in both modes (shadows, text on gold). */
  ink: '#0b2545',
};

const light: typeof dark = {
  bg: '#f4f1ea',
  surface: '#ffffff',
  surface2: '#eef3fa',
  line: '#c9d3e2',
  field: '#ffffff',
  text: '#0b2545',
  muted: '#4b4f58',
  placeholder: '#8a8f99',
  gold: '#f5b800',
  goldDeep: '#7a5f00',
  goldNote: '#6b5300',
  goldTint: 'rgba(245,184,0,0.16)',
  onGold: '#0b2545',
  blue: '#c6e0f7',
  panel: '#0b2545',
  strong: '#0b2545',
  onStrong: '#ffffff',
  tint: 'rgba(11,37,69,0.05)',
  danger: '#b3261e',
  dangerBg: '#fdecea',
  white: '#ffffff',
  up: '#b91c1c',
  down: '#15803d',
  upOnDark: '#fca5a5',
  downOnDark: '#86efac',
  ink: '#0b2545',
};

export type Palette = typeof dark;
const palettes: Record<ThemeMode, Palette> = { dark, light };

let mode: ThemeMode = 'dark';

export function themeMode(): ThemeMode {
  return mode;
}

/** Called by the root layout before it draws; also tells the phone, so its own parts (tab bar, date picker, keyboard) match. */
export function setThemeMode(next: ThemeMode): void {
  if (next === mode) return;
  mode = next;
  if (Platform.OS !== 'web') {
    try {
      Appearance.setColorScheme(next);
    } catch {
      // Older phones: the app's own colours still switch.
    }
  }
}

export const colors: Palette = new Proxy({} as Palette, {
  get: (_target, key: string) => palettes[mode][key as keyof Palette],
});

/**
 * A style sheet (or any object built from `colors`) that follows the mode.
 * Use it exactly like the object it wraps: `styles.card`.
 */
export function themed<T extends object>(make: () => T): T {
  const cache: Partial<Record<ThemeMode, T>> = {};
  const current = () => (cache[mode] ??= make());
  return new Proxy({} as T, {
    get: (_target, key) => current()[key as keyof T],
    has: (_target, key) => key in current(),
    ownKeys: () => Reflect.ownKeys(current()),
    getOwnPropertyDescriptor: (_target, key) => {
      const d = Reflect.getOwnPropertyDescriptor(current(), key);
      return d ? { ...d, configurable: true } : undefined;
    },
  });
}

/** Category and person colours are picked for white paper; on navy they need to be lighter. */
const ON_DARK: Record<string, string> = {
  '#2563eb': '#7fa8ff', // Chest
  '#7c3aed': '#b79bff', // Back
  '#0d9488': '#4fd1c5', // Shoulders
  '#dc2626': '#ff8f8f', // Biceps
  '#c2410c': '#ffa46b', // Triceps
  '#b45309': '#f5b56a', // Legs
  '#16a34a': '#6fdc8c', // Core
  '#db2777': '#ff8fc0', // Cardio
  '#6b7280': '#c9d6ea', // Other
  '#2555c7': '#5b8cff', // Diego
  '#b5651d': '#ff9a52', // Kevin
};

export function tone(hex: string): string {
  return mode === 'dark' ? (ON_DARK[hex.toLowerCase()] ?? hex) : hex;
}

/** Headline font (bundled with the app). */
export const fonts = {
  heading: 'Sora_700Bold',
  headingBold: 'Sora_800ExtraBold',
} as const;

export const radius = { sm: 10, md: 14, lg: 20, xl: 26, pill: 999 } as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 18, xl: 24 } as const;

/** Smallest comfortable tap target (Apple and Google both ask for about this). */
export const TAP = 44;

export const type = themed(() => ({
  body: { fontSize: 16, color: colors.text } as TextStyle,
  small: { fontSize: 14, color: colors.muted } as TextStyle,
  label: {
    fontFamily: fonts.heading,
    fontSize: 13,
    letterSpacing: 0.4,
    color: colors.muted,
  } as TextStyle,
  heading: { fontFamily: fonts.heading, fontSize: 19, color: colors.text } as TextStyle,
}));

export const shadow = Platform.select({
  ios: {
    shadowColor: '#000000',
    shadowOpacity: 0.28,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
  },
  android: { elevation: 10 },
  default: { boxShadow: '0 14px 30px rgba(0, 0, 0, 0.28)' },
}) as object;

export function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const n = parseInt(h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}
