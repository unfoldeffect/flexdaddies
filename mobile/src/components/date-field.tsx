// Picks a day using each phone's own date picker: the calendar pop-up on
// iPhone, the Material date dialog on Android.
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { fromISODate, isValidISODate, toISODate } from '../lib/stats';
import { formatDate } from '../lib/workout-data';
import { colors } from '../theme';
import { Icon } from './ui';

type Props = {
  /** "YYYY-MM-DD" */
  value: string;
  onChange: (iso: string) => void;
  label: string;
  /** White background (inside a tinted panel). */
  onWhite?: boolean;
};

export function DateField({ value, onChange, label, onWhite }: Props) {
  const date = fromISODate(value);
  const box = [styles.box, onWhite && { backgroundColor: colors.white }];

  if (Platform.OS === 'ios') {
    return (
      <View style={[box, styles.iosBox]}>
        <DateTimePicker
          value={date}
          mode="date"
          display="compact"
          themeVariant="light"
          accentColor={colors.ink}
          accessibilityLabel={label}
          onValueChange={(_event, picked) => onChange(toISODate(picked))}
        />
      </View>
    );
  }

  if (Platform.OS === 'android') {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${formatDate(value)}. Tap to change.`}
        style={({ pressed }) => [box, styles.row, pressed && { opacity: 0.7 }]}
        onPress={() =>
          DateTimePickerAndroid.open({
            value: date,
            mode: 'date',
            onValueChange: (_event, picked) => onChange(toISODate(picked)),
          })
        }
      >
        <Text style={styles.text}>{formatDate(value)}</Text>
        <Icon name="calendar-blank-outline" color={colors.muted} />
      </Pressable>
    );
  }

  return <TypedDateField value={value} onChange={onChange} label={label} boxStyle={box} />;
}

/** Browser preview only: type the date as YYYY-MM-DD. */
function TypedDateField({
  value,
  onChange,
  label,
  boxStyle,
}: Omit<Props, 'onWhite'> & { boxStyle: object }) {
  // Only holds text while it is being typed; otherwise the saved date shows.
  const [typing, setTyping] = useState<string | null>(null);
  return (
    <TextInput
      accessibilityLabel={label}
      value={typing ?? value}
      placeholder="YYYY-MM-DD"
      onFocus={() => setTyping(value)}
      onChangeText={(next) => {
        setTyping(next);
        if (isValidISODate(next)) onChange(next);
      }}
      onBlur={() => setTyping(null)}
      style={[boxStyle, styles.text, styles.typed]}
    />
  );
}

const styles = StyleSheet.create({
  box: {
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    justifyContent: 'center',
  },
  iosBox: { alignItems: 'flex-start', paddingHorizontal: 6 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
  },
  text: { fontSize: 17, color: colors.text },
  typed: { paddingHorizontal: 14 },
});
