// Small building blocks shared by every screen.
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useId, type ComponentProps, type ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import Svg, { Circle, Defs, Pattern, Rect } from 'react-native-svg';

import { tapLight } from '../lib/haptics';
import { TAP, colors, fonts, radius, type } from '../theme';

export type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

export function Icon({
  name,
  size = 20,
  color = colors.text,
}: {
  name: IconName;
  size?: number;
  color?: string;
}) {
  // Icons are decoration: screen readers skip them and read the label next to them.
  return (
    <MaterialCommunityIcons
      name={name}
      size={size}
      color={color}
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no"
      aria-hidden
    />
  );
}

/** The round coloured badge with a letter in it (like a weight plate). */
export function Plate({
  size = 28,
  label,
  color,
}: {
  size?: number;
  label: string;
  color?: string;
}) {
  return (
    <View
      style={[
        styles.plate,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: color ?? '#2555c7' },
      ]}
    >
      <Text style={[styles.plateText, { fontSize: size * 0.4 }]} allowFontScaling={false}>
        {label}
      </Text>
    </View>
  );
}

export function FieldLabel({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<TextStyle>;
}) {
  return <Text style={[type.label, style]}>{children}</Text>;
}

export function SectionHeading({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<TextStyle>;
}) {
  return (
    <Text accessibilityRole="header" style={[type.heading, styles.sectionHeading, style]}>
      {children}
    </Text>
  );
}

type ButtonProps = Omit<PressableProps, 'style' | 'children'> & {
  label: string;
  icon?: IconName;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** The big gold button. */
export function PrimaryButton({ label, icon, compact, disabled, style, ...rest }: ButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      style={({ pressed }) => [
        styles.primary,
        compact && styles.primaryCompact,
        disabled && styles.primaryDisabled,
        pressed && styles.pressed,
        style,
      ]}
      {...rest}
    >
      {icon && <Icon name={icon} size={20} color={disabled ? colors.muted : colors.ink} />}
      <Text
        style={[
          styles.primaryText,
          compact && styles.primaryTextCompact,
          disabled && { color: colors.muted },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** An outlined, quieter button (Cancel, Start fresh, Restore). */
export function OutlineButton({ label, icon, compact, disabled, style, ...rest }: ButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      hitSlop={compact ? 8 : 0}
      style={({ pressed }) => [
        styles.outline,
        compact && styles.outlineCompact,
        disabled && styles.dim,
        pressed && styles.pressed,
        style,
      ]}
      {...rest}
    >
      {icon && <Icon name={icon} size={16} color={colors.muted} />}
      <Text style={[styles.outlineText, compact && styles.outlineTextCompact]}>{label}</Text>
    </Pressable>
  );
}

/** A small solid button (navy by default, gold when `gold`). */
export function SmallButton({
  label,
  icon,
  gold,
  disabled,
  style,
  ...rest
}: ButtonProps & { gold?: boolean }) {
  const fg = gold ? colors.ink : colors.white;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      hitSlop={6}
      style={({ pressed }) => [
        styles.small,
        { backgroundColor: gold ? colors.gold : colors.ink },
        disabled && styles.dim,
        pressed && styles.pressed,
        style,
      ]}
      {...rest}
    >
      {icon && <Icon name={icon} size={16} color={fg} />}
      <Text style={[styles.smallText, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

/** A text-only action (Repeat, Edit, Delete). */
export function LinkButton({
  label,
  icon,
  color = colors.ink,
  style,
  ...rest
}: ButtonProps & { color?: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      style={({ pressed }) => [styles.link, pressed && styles.pressed, style]}
      {...rest}
    >
      {icon && <Icon name={icon} size={17} color={color} />}
      <Text style={[styles.linkText, { color }]}>{label}</Text>
    </Pressable>
  );
}

/** A round icon-only button. Always needs a spoken label for screen readers. */
export function IconButton({
  icon,
  label,
  size = TAP,
  iconSize = 20,
  color = colors.muted,
  disabled,
  style,
  ...rest
}: Omit<PressableProps, 'style' | 'children'> & {
  icon: IconName;
  label: string;
  size?: number;
  iconSize?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      hitSlop={Math.max(0, (TAP - size) / 2)}
      style={({ pressed }) => [
        styles.iconBtn,
        { width: size, height: size },
        disabled && { opacity: 0.3 },
        pressed && styles.pressed,
        style,
      ]}
      {...rest}
    >
      <Icon name={icon} size={iconSize} color={color} />
    </Pressable>
  );
}

/** A rounded filter or choice chip. */
export function Chip({
  label,
  active,
  activeColor = colors.ink,
  onPress,
  style,
}: {
  label: string;
  active: boolean;
  activeColor?: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={() => {
        tapLight();
        onPress();
      }}
      style={({ pressed }) => [
        styles.chip,
        active && { backgroundColor: activeColor, borderColor: activeColor },
        pressed && styles.pressed,
        style,
      ]}
    >
      <Text style={[styles.chipText, active && { color: colors.white }]}>{label}</Text>
    </Pressable>
  );
}

/** Two-way switch for units (lbs / kg, in / cm). */
export function UnitToggle<T extends string>({
  options,
  value,
  onChange,
  vertical,
}: {
  options: readonly T[];
  value: T;
  onChange: (next: T) => void;
  vertical?: boolean;
}) {
  return (
    <View
      style={[styles.unitToggle, vertical && { flexDirection: 'column' }]}
      accessibilityRole="radiogroup"
    >
      {options.map((o) => {
        const on = value === o;
        return (
          <Pressable
            key={o}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            accessibilityLabel={`Show in ${o}`}
            onPress={() => {
              if (!on) tapLight();
              onChange(o);
            }}
            style={[styles.unitBtn, vertical && styles.unitBtnVertical, on && styles.unitBtnOn]}
          >
            <Text style={[styles.unitText, on && { color: colors.gold }]}>{o}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** The navy card with the faint gold dot pattern. */
export function DotCard({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  // Each card needs its own pattern name, or two cards on screen can clash.
  const patternId = `fd-dots-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <View style={[styles.dotCard, style]}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Svg width="100%" height="100%">
          <Defs>
            <Pattern id={patternId} width={20} height={20} patternUnits="userSpaceOnUse">
              <Circle cx={10} cy={10} r={1.5} fill="rgba(201,162,39,0.18)" />
            </Pattern>
          </Defs>
          <Rect width="100%" height="100%" fill={`url(#${patternId})`} />
        </Svg>
      </View>
      {children}
    </View>
  );
}

export function ErrorBanner({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <Pressable
      accessibilityRole="alert"
      accessibilityHint="Tap to dismiss"
      onPress={onDismiss}
      style={styles.error}
    >
      <Icon name="alert-circle-outline" color={colors.danger} />
      <Text style={styles.errorText}>{message}</Text>
    </Pressable>
  );
}

export function EmptyState({
  plateLabel,
  title,
  sub,
  compact,
}: {
  plateLabel?: string;
  title?: string;
  sub: string;
  compact?: boolean;
}) {
  return (
    <View style={[styles.empty, compact && { paddingVertical: 24 }]}>
      {plateLabel && <Plate size={54} label={plateLabel} color="#6b7280" />}
      {title && <Text style={styles.emptyTitle}>{title}</Text>}
      <Text style={styles.emptySub}>{sub}</Text>
    </View>
  );
}

/** A small coloured dot (category or person colour). */
export function Dot({ color, size = 8 }: { color: string; size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }} />
  );
}

const styles = StyleSheet.create({
  plate: { alignItems: 'center', justifyContent: 'center' },
  plateText: { color: colors.white, fontFamily: fonts.headingBold },
  sectionHeading: { marginBottom: 14 },
  pressed: { opacity: 0.7 },
  dim: { opacity: 0.45 },
  primary: {
    minHeight: 60,
    borderRadius: radius.pill,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20,
  },
  primaryCompact: { minHeight: 50 },
  primaryDisabled: { backgroundColor: colors.surface2 },
  primaryText: {
    fontFamily: fonts.headingBold,
    fontSize: 19,
    letterSpacing: 0.6,
    color: colors.ink,
  },
  primaryTextCompact: { fontSize: 17 },
  outline: {
    minHeight: 50,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 20,
    backgroundColor: colors.white,
  },
  outlineCompact: { minHeight: 34, paddingHorizontal: 14 },
  outlineText: { fontWeight: '600', fontSize: 16, color: colors.muted },
  outlineTextCompact: { fontSize: 14 },
  small: {
    minHeight: 36,
    borderRadius: radius.pill,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    alignSelf: 'flex-start',
  },
  smallText: { fontWeight: '700', fontSize: 14 },
  link: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 36 },
  linkText: { fontWeight: '600', fontSize: 15 },
  iconBtn: {
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.line,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chip: {
    minHeight: TAP,
    paddingHorizontal: 18,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: { fontWeight: '600', fontSize: 15, color: colors.text },
  unitToggle: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.line,
    backgroundColor: colors.surface2,
    overflow: 'hidden',
  },
  unitBtn: {
    minWidth: 46,
    minHeight: 40,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unitBtnVertical: { minHeight: 24, flex: 1 },
  unitBtnOn: { backgroundColor: colors.ink },
  unitText: { fontFamily: fonts.heading, fontSize: 14, color: colors.muted },
  dotCard: { backgroundColor: colors.ink, borderRadius: radius.xl, overflow: 'hidden' },
  error: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fdecea',
    borderWidth: 2,
    borderColor: colors.danger,
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
  },
  errorText: { flex: 1, color: colors.danger, fontWeight: '600', fontSize: 15 },
  empty: { alignItems: 'center', gap: 10, paddingVertical: 56 },
  emptyTitle: { fontSize: 17, color: colors.muted },
  emptySub: { fontSize: 15, color: colors.muted, textAlign: 'center' },
});
