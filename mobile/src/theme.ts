// Brand colours and type, matching the website (app/src/styles.css).
import { Platform, type TextStyle } from 'react-native';

export const colors = {
  bg: '#ffffff',
  surface: '#f6f7f1',
  surface2: '#eef0e6',
  line: '#e2e4d8',
  ink: '#0b2545',
  gold: '#c9a227',
  goldDeep: '#a9860f',
  goldNote: '#8a6d00',
  text: '#0b2545',
  muted: '#5b5d52',
  danger: '#b3261e',
  white: '#ffffff',
  up: '#b91c1c',
  down: '#15803d',
  upOnDark: '#fca5a5',
  downOnDark: '#86efac',
} as const;

/** Headline font (bundled with the app). */
export const fonts = {
  heading: 'Oswald_600SemiBold',
  headingBold: 'Oswald_700Bold',
} as const;

export const radius = { sm: 10, md: 14, lg: 20, xl: 26, pill: 999 } as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 18, xl: 24 } as const;

/** Smallest comfortable tap target (Apple and Google both ask for about this). */
export const TAP = 44;

export const type = {
  body: { fontSize: 16, color: colors.text } as TextStyle,
  small: { fontSize: 14, color: colors.muted } as TextStyle,
  label: {
    fontFamily: fonts.heading,
    fontSize: 14,
    letterSpacing: 0.6,
    color: colors.muted,
  } as TextStyle,
  heading: { fontFamily: fonts.heading, fontSize: 19, color: colors.text } as TextStyle,
};

export const shadow = Platform.select({
  ios: {
    shadowColor: colors.ink,
    shadowOpacity: 0.28,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
  },
  android: { elevation: 10 },
  default: { boxShadow: '0 14px 30px rgba(11, 37, 69, 0.28)' },
}) as object;

export function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const n = parseInt(h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}
