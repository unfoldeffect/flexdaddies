// Log tab: how far through the workout you are. One gold ring ("3 of 6") that
// fills as exercises are finished, the exercise you are on, and what is next.
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { colors, fonts, themed } from '../theme';

const SIZE = 84;
const STROKE = 8;

export function ProgressStrip({
  done,
  total,
  current,
  next,
}: {
  done: number;
  total: number;
  current: string | null;
  next: string | null;
}) {
  const r = (SIZE - STROKE) / 2;
  const around = 2 * Math.PI * r;
  const share = total ? done / total : 0;
  const finished = done >= total;
  return (
    <View
      style={styles.strip}
      accessible
      accessibilityLabel={`${done} of ${total} exercises done.${current ? ` Now: ${current}.` : ''}${next ? ` Next: ${next}.` : ''}`}
    >
      <View style={styles.ring}>
        <Svg width={SIZE} height={SIZE}>
          <Circle cx={SIZE / 2} cy={SIZE / 2} r={r} stroke={colors.line} strokeWidth={STROKE} fill="none" />
          <Circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={r}
            stroke={colors.gold}
            strokeWidth={STROKE}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${around * share} ${around}`}
            transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
          />
        </Svg>
        <View style={styles.ringText}>
          <Text style={styles.count} allowFontScaling={false}>
            {done}
          </Text>
          <Text style={styles.of} allowFontScaling={false}>
            of {total}
          </Text>
        </View>
      </View>
      <View style={styles.words}>
        {finished ? (
          <Text style={styles.current}>All done. Log it below.</Text>
        ) : (
          <>
            <Text style={styles.label}>NOW</Text>
            <Text style={styles.current} numberOfLines={2}>
              {current}
            </Text>
          </>
        )}
        {next && (
          <View style={styles.nextBox}>
            <Text style={styles.nextLabel}>
              NEXT, {Math.min(done + 2, total)} OF {total}
            </Text>
            <Text style={styles.next} numberOfLines={1}>
              {next}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.line,
    borderRadius: 20,
    padding: 14,
    marginBottom: 16,
  },
  ring: { width: SIZE, height: SIZE },
  ringText: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  count: { fontFamily: fonts.headingBold, fontSize: 28, lineHeight: 30, color: colors.text },
  of: { fontSize: 13, fontWeight: '700', color: colors.text },
  words: { flex: 1, gap: 4 },
  label: { fontSize: 12, fontWeight: '800', letterSpacing: 0.8, color: colors.muted },
  current: { fontFamily: fonts.heading, fontSize: 20, color: colors.text },
  nextBox: {
    marginTop: 4,
    borderRadius: 12,
    backgroundColor: colors.field,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  nextLabel: { fontSize: 12, fontWeight: '800', letterSpacing: 0.8, color: colors.goldNote },
  next: { fontSize: 16, fontWeight: '700', color: colors.text },
}));
