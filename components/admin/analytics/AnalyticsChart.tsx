'use client';

import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

const BRAND_COLORS = ['#EC67A1', '#5DC3F8', '#F774B9', '#E1518E', '#a78bfa', '#34d399'];

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card/95 backdrop-blur-md border border-border rounded-lg px-3 py-2 shadow-xl">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} className="text-sm font-semibold" style={{ color: entry.color }}>
          {entry.name}: {entry.value.toLocaleString()}
        </p>
      ))}
    </div>
  );
}

// Loading skeleton for charts
function ChartSkeleton() {
  return (
    <div className="w-full h-full flex items-end gap-1 px-8 pb-6 animate-pulse">
      {Array.from({ length: 12 }).map((_, i) => (
        <div
          key={i}
          className="flex-1 bg-foreground/5 rounded-t"
          style={{ height: `${20 + Math.random() * 60}%` }}
        />
      ))}
    </div>
  );
}

// Area Chart
interface AnalyticsAreaChartProps {
  data: Array<Record<string, string | number>>;
  xKey: string;
  yKey: string;
  title: string;
  color?: string;
  loading?: boolean;
}

export function AnalyticsAreaChart({
  data,
  xKey,
  yKey,
  title,
  color = '#EC67A1',
  loading = false,
}: AnalyticsAreaChartProps) {
  return (
    <div className="bg-card/50 backdrop-blur-sm border border-border rounded-xl p-4">
      <h4 className="text-sm font-semibold text-foreground mb-4">{title}</h4>
      <div className="h-[250px]">
        {loading ? (
          <ChartSkeleton />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id={`gradient-${yKey}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.5} />
              <XAxis
                dataKey={xKey}
                tick={{ fontSize: 10, fill: 'var(--color-muted-foreground)' }}
                tickFormatter={(v: string) => {
                  const d = new Date(v);
                  return `${d.getMonth() + 1}/${d.getDate()}`;
                }}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 10, fill: 'var(--color-muted-foreground)' }}
                allowDecimals={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey={yKey}
                stroke={color}
                strokeWidth={2}
                fill={`url(#gradient-${yKey})`}
                name={title}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

// Bar Chart
interface AnalyticsBarChartProps {
  data: Array<{ name: string; value: number }>;
  title: string;
  loading?: boolean;
}

export function AnalyticsBarChart({ data, title, loading = false }: AnalyticsBarChartProps) {
  return (
    <div className="bg-card/50 backdrop-blur-sm border border-border rounded-xl p-4">
      <h4 className="text-sm font-semibold text-foreground mb-4">{title}</h4>
      <div className="h-[250px]">
        {loading ? (
          <ChartSkeleton />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.5} />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 10, fill: 'var(--color-muted-foreground)' }}
              />
              <YAxis
                tick={{ fontSize: 10, fill: 'var(--color-muted-foreground)' }}
                allowDecimals={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" name="Count" radius={[4, 4, 0, 0]}>
                {data.map((_, index) => (
                  <Cell key={index} fill={BRAND_COLORS[index % BRAND_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

// Pie Chart
interface AnalyticsPieChartProps {
  data: Array<{ name: string; value: number }>;
  title: string;
  loading?: boolean;
}

export function AnalyticsPieChart({ data, title, loading = false }: AnalyticsPieChartProps) {
  return (
    <div className="bg-card/50 backdrop-blur-sm border border-border rounded-xl p-4">
      <h4 className="text-sm font-semibold text-foreground mb-4">{title}</h4>
      <div className="h-[250px]">
        {loading ? (
          <div className="w-full h-full flex items-center justify-center animate-pulse">
            <div className="w-40 h-40 rounded-full bg-foreground/5" />
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={4}
                dataKey="value"
                nameKey="name"
              >
                {data.map((_, index) => (
                  <Cell key={index} fill={BRAND_COLORS[index % BRAND_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend
                formatter={(value: string) => (
                  <span className="text-xs text-muted-foreground">{value}</span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
