import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface DualAxisChartProps {
  data: Array<Record<string, unknown>>;
  xKey: string;
  leftKey: string;
  rightKey: string;
  leftLabel?: string;
  rightLabel?: string;
  leftUnit?: string;
  rightUnit?: string;
  leftColor?: string;
  rightColor?: string;
}

const CustomTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string; unit?: string }>;
  label?: string;
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-lg px-3 py-2 text-xs"
      style={{ background: "#1a1a28", border: "1px solid rgba(255,255,255,0.1)", color: "#fff" }}
    >
      <div className="text-[#94a3b8] mb-1">{label}</div>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span>{p.name}: </span>
          <span className="font-semibold">{typeof p.value === "number" ? p.value.toFixed(2) : p.value}</span>
        </div>
      ))}
    </div>
  );
};

export function DualAxisChart({
  data,
  xKey,
  leftKey,
  rightKey,
  leftLabel = leftKey,
  rightLabel = rightKey,
  leftColor = "#e91e8c",
  rightColor = "#3b82f6",
}: DualAxisChartProps) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <ComposedChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
        <XAxis
          dataKey={xKey}
          tick={{ fill: "#64748b", fontSize: 11 }}
          axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
          tickLine={false}
        />
        <YAxis
          yAxisId="left"
          tick={{ fill: "#64748b", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          tick={{ fill: "#64748b", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          wrapperStyle={{ fontSize: "12px", color: "#94a3b8" }}
        />
        <Line
          yAxisId="left"
          type="monotone"
          dataKey={leftKey}
          name={leftLabel}
          stroke={leftColor}
          strokeWidth={2}
          dot={{ fill: leftColor, r: 3 }}
          activeDot={{ r: 5 }}
        />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey={rightKey}
          name={rightLabel}
          stroke={rightColor}
          strokeWidth={2}
          dot={{ fill: rightColor, r: 3 }}
          activeDot={{ r: 5 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
