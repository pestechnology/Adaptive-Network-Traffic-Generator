import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface MetricCardProps {
  label: string;
  value: number;
  unit?: string;
  icon: LucideIcon;
  iconColor?: string;
  trend?: "up" | "down" | "neutral";
  className?: string;
  decimals?: number;
}

function useCountUp(target: number, duration = 750) {
  const [display, setDisplay] = useState(0);
  const frame = useRef<number | null>(null);
  const start = useRef<number | null>(null);
  const prev = useRef(0);

  useEffect(() => {
    const from = prev.current;
    prev.current = target;
    start.current = null;

    const step = (ts: number) => {
      if (!start.current) start.current = ts;
      const progress = Math.min((ts - start.current) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(from + (target - from) * eased);
      if (progress < 1) {
        frame.current = requestAnimationFrame(step);
      } else {
        setDisplay(target);
      }
    };
    frame.current = requestAnimationFrame(step);
    return () => {
      if (frame.current) cancelAnimationFrame(frame.current);
    };
  }, [target, duration]);

  return display;
}

export function MetricCard({
  label,
  value,
  unit,
  icon: Icon,
  iconColor = "#e91e8c",
  className,
  decimals = 0,
}: MetricCardProps) {
  const animated = useCountUp(value);

  return (
    <div
      className={cn(
        "rounded-xl p-5 flex items-start gap-4 cursor-default transition-all duration-200 group",
        className
      )}
      style={{
        background: "#12121a",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.transform = "scale(1.01)";
        (e.currentTarget as HTMLDivElement).style.borderColor =
          "rgba(255,255,255,0.2)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.transform = "scale(1)";
        (e.currentTarget as HTMLDivElement).style.borderColor =
          "rgba(255,255,255,0.08)";
      }}
    >
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: `${iconColor}20` }}
      >
        <Icon size={20} style={{ color: iconColor }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[#94a3b8] text-xs font-medium mb-1">{label}</div>
        <div className="text-white text-2xl font-bold tabular-nums leading-none">
          {animated.toFixed(decimals)}
          {unit && (
            <span className="text-sm font-medium text-[#64748b] ml-1">{unit}</span>
          )}
        </div>
      </div>
    </div>
  );
}
