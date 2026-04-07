import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface AtgPieChartProps {
  data: Array<{ name: string; value: number }>;
  colors?: string[];
  height?: number;
  showLegend?: boolean;
}

const DEFAULT_COLORS = ["#e91e8c", "#7c3aed", "#3b82f6", "#10b981", "#f59e0b", "#ef4444"];

export function AtgPieChart({
  data,
  colors = DEFAULT_COLORS,
  height = 200,
  showLegend = true,
}: AtgPieChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={showLegend ? 45 : 30}
          outerRadius={showLegend ? 75 : 60}
          paddingAngle={3}
          dataKey="value"
        >
          {data.map((_, index) => (
            <Cell key={index} fill={colors[index % colors.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            background: "#1a1a28",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 8,
            fontSize: 12,
            color: "#fff",
          }}
          formatter={(val: number) => [`${val}`, ""]}
        />
        {showLegend && (
          <Legend
            wrapperStyle={{ fontSize: "12px", color: "#94a3b8" }}
            iconType="circle"
            iconSize={8}
          />
        )}
      </PieChart>
    </ResponsiveContainer>
  );
}
