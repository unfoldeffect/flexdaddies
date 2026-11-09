// A simple trend line with a dot on each entry (the same chart the website draws).
import { useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Polyline } from 'react-native-svg';

export type ChartSeries = { values: number[]; color: string };

export function chartPoints(values: number[], width: number, height: number): [number, number][] {
  if (values.length < 2 || width <= 0) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pad = 6;
  const stepX = (width - pad * 2) / (values.length - 1);
  return values.map((v, i) => [
    pad + i * stepX,
    height - pad - ((v - min) / range) * (height - pad * 2),
  ]);
}

/** Each line is scaled to its own highs and lows, so two people can share one chart. */
export function LineChart({
  series,
  height = 60,
  label,
}: {
  series: ChartSeries[];
  height?: number;
  /** Read out by screen readers in place of the picture. */
  label: string;
}) {
  const [width, setWidth] = useState(0);
  const usable = series.filter((s) => s.values.length >= 2);
  if (usable.length === 0) return null;
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  return (
    <View
      onLayout={onLayout}
      style={{ height, width: '100%' }}
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
    >
      {width > 0 && (
        <Svg width={width} height={height}>
          {usable.map((s, si) => {
            const pts = chartPoints(s.values, width, height);
            return [
              <Polyline
                key={`line-${si}`}
                points={pts.map((p) => p.join(',')).join(' ')}
                fill="none"
                stroke={s.color}
                strokeWidth={2.5}
                strokeLinejoin="round"
                strokeLinecap="round"
              />,
              ...pts.map(([x, y], i) => (
                <Circle key={`dot-${si}-${i}`} cx={x} cy={y} r={3.5} fill={s.color} />
              )),
            ];
          })}
        </Svg>
      )}
    </View>
  );
}

/** Words for a chart, e.g. "from 205 to 201 lbs over 6 entries". */
export function describeTrend(values: number[], unit: string): string {
  if (values.length < 2) return 'not enough entries yet';
  const first = Number(values[0].toFixed(1));
  const last = Number(values[values.length - 1].toFixed(1));
  return `from ${first} to ${last} ${unit} over ${values.length} entries`;
}
