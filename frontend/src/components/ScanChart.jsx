import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { format, parseISO } from 'date-fns';
import styles from './ScanChart.module.css';

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className={styles.tooltip}>
      <p className={styles.tooltipDate}>
        {format(parseISO(label), 'MMM d, yyyy')}
      </p>
      {payload.map((p) => (
        <p key={p.dataKey} className={styles.tooltipRow} style={{ color: p.color }}>
          <span>{p.name}</span>
          <span className={styles.tooltipVal}>{p.value}</span>
        </p>
      ))}
    </div>
  );
}

export default function ScanChart({ data = [], days, onDaysChange }) {
  const DAY_OPTIONS = [7, 30, 90];

  const formatted = data.map((d) => ({
    ...d,
    label: format(parseISO(d.date), days === 7 ? 'EEE' : 'MMM d'),
  }));

  const maxVal = Math.max(...data.map((d) => d.total), 1);

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <h3 className={styles.title}>Scan Activity</h3>
        <div className={styles.toggle}>
          {DAY_OPTIONS.map((d) => (
            <button
              key={d}
              className={`${styles.toggleBtn} ${days === d ? styles.toggleActive : ''}`}
              onClick={() => onDaysChange(d)}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      <div className={styles.chart}>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={formatted} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="totalGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#a3ff4d" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#a3ff4d" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="uniqueGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#4da6ff" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#4da6ff" stopOpacity={0} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="#1f2535" vertical={false} />

            <XAxis
              dataKey="label"
              tick={{ fill: '#4a5166', fontSize: 11, fontFamily: 'DM Mono' }}
              axisLine={false}
              tickLine={false}
              interval={days === 90 ? 6 : days === 30 ? 3 : 0}
            />
            <YAxis
              tick={{ fill: '#4a5166', fontSize: 11, fontFamily: 'DM Mono' }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
              domain={[0, Math.ceil(maxVal * 1.2) || 5]}
            />

            <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#2d3548', strokeWidth: 1 }} />

            <Area
              type="monotone"
              dataKey="total"
              name="Total"
              stroke="#a3ff4d"
              strokeWidth={2}
              fill="url(#totalGrad)"
              dot={false}
              activeDot={{ r: 4, fill: '#a3ff4d', strokeWidth: 0 }}
            />
            <Area
              type="monotone"
              dataKey="unique_count"
              name="Unique"
              stroke="#4da6ff"
              strokeWidth={2}
              fill="url(#uniqueGrad)"
              dot={false}
              activeDot={{ r: 4, fill: '#4da6ff', strokeWidth: 0 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className={styles.legend}>
        <span className={styles.legendItem}>
          <span className={styles.dot} style={{ background: '#a3ff4d' }} />
          Total scans
        </span>
        <span className={styles.legendItem}>
          <span className={styles.dot} style={{ background: '#4da6ff' }} />
          Unique visitors
        </span>
      </div>
    </div>
  );
}
