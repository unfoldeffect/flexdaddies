// A box for typing a number. Opens the phone's number pad (with a decimal
// point for weights). On iPhone the number pad gets a "Next" / "Done" button
// above it, since number pads have no return key of their own.
import type { ComponentProps } from 'react';
import { StyleSheet, TextInput } from 'react-native';

import { colors, fonts } from '../theme';

export type NumberFieldProps = Omit<
  ComponentProps<typeof TextInput>,
  'keyboardType' | 'onChange'
> & {
  /** Allow a decimal point (weights and measurements). */
  decimal?: boolean;
  /** Bigger headline-style digits (Body screen). */
  big?: boolean;
};

export function NumberField({
  decimal,
  big,
  style,
  returnKeyType = 'done',
  placeholder = '0',
  ...rest
}: NumberFieldProps) {
  return (
    <TextInput
      keyboardType={decimal ? 'decimal-pad' : 'number-pad'}
      inputMode={decimal ? 'decimal' : 'numeric'}
      returnKeyType={returnKeyType}
      placeholder={placeholder}
      placeholderTextColor="#a3a59a"
      selectTextOnFocus
      autoCorrect={false}
      autoComplete="off"
      maxLength={7}
      style={[styles.input, big && styles.big, style]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    minHeight: 52,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.line,
    backgroundColor: colors.white,
    color: colors.text,
    fontSize: 19,
    textAlign: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  big: { fontFamily: fonts.heading, fontSize: 22, textAlign: 'left', paddingHorizontal: 12 },
});
