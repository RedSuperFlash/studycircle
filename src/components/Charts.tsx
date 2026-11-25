import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Row } from '../types';
import { dateLabel, isoDay } from '../lib/format';
export function weekSeries(activity: Row[]) {
  return Array.from({ length: 7 }, (_, i) => {
    const day = isoDay(i - 6);
    return {
      name: dateLabel(day, { weekday: 'short' }),
      value: activity.filter((a) => a.day === day).reduce((sum, a) => sum + Number(a.minutes), 0),
    };
  });
}
export function MetricChart({
  data,
  label = 'Minutes',
  height = 174,
}: {
  data: { name: string; value: number }[];
  label?: string;
  height?: number;
}) {
  return (
    <div
      className="chart"
      role="img"
      aria-label={data.map((d) => d.name + ' ' + d.value + ' ' + label).join(', ')}
      style={{ height }}
    >
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <BarChart data={data} margin={{ top: 12, bottom: 0, left: -28, right: 1 }}>
          <CartesianGrid stroke="var(--line)" vertical={false} strokeDasharray="4 4" />
          <XAxis
            dataKey="name"
            tickLine={false}
            axisLine={false}
            tick={{ fill: 'var(--muted)', fontSize: 11 }}
            dy={5}
          />
          <YAxis
            allowDecimals={false}
            tickLine={false}
            axisLine={false}
            tick={{ fill: 'var(--muted)', fontSize: 11 }}
          />
          <Tooltip
            cursor={{ fill: 'var(--accent-soft)' }}
            contentStyle={{
              border: '1px solid var(--line)',
              borderRadius: 9,
              background: 'var(--panel)',
              color: 'var(--ink)',
            }}
          />
          <Bar
            name={label}
            dataKey="value"
            fill="var(--chart)"
            radius={[5, 5, 0, 0]}
            maxBarSize={30}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
