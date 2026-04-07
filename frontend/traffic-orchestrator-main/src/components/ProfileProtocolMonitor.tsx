import { useEffect, useRef } from "react";

interface Protocol {
  id: string;
  protocol: string;
  duration_sec: number;
  state: string;
  start_time?: number;
  // Real-time packet data
  packets_successful: number;
  packets_attempted: number;
}

interface Props {
  protocols: Protocol[];
}

const PROTO_COLORS: Record<string, string> = {
  ICMP: "#7C5CFF",
  TCP: "#00B8D9",
  HTTP: "#00C853",
  HTTPS: "#AB47BC",
  SSH: "#FF8F00",
  UDP: "#F06292",
};

export function ProfileProtocolMonitor({ protocols }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const offsetRef = useRef<number[]>([]);
  const prevPacketsRef = useRef<Record<string, number>>({});
  const ppsRef = useRef<Record<string, number>>({});
  const lastPpsUpdateRef = useRef<Record<string, number>>({});

  useEffect(() => {
    if (protocols.length === 0) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const LANE_HEIGHT = 110;
    const TOP_PAD = 16;
    const width = canvas.offsetWidth;
    const height = TOP_PAD + protocols.length * LANE_HEIGHT + 16;

    canvas.width = width;
    canvas.height = height;

    offsetRef.current = protocols.map(() => 0);

    const draw = () => {
      const now = Date.now();

      // Dark trail
      ctx.fillStyle = "rgba(6, 8, 18, 0.25)";
      ctx.fillRect(0, 0, width, height);

      protocols.forEach((p, index) => {
        const laneY = TOP_PAD + index * LANE_HEIGHT + LANE_HEIGHT / 2;
        const color = PROTO_COLORS[p.protocol] || "#7C5CFF";

        // ── Real progress from actual packets ──
        const progress = p.packets_attempted > 0 ? p.packets_successful / p.packets_attempted : 0;

        // ── Compute live PPS (packets per second) ──
        const prevPkts = prevPacketsRef.current[p.id] ?? p.packets_successful;
        const lastUpdate = lastPpsUpdateRef.current[p.id] ?? now;
        const dtSec = (now - lastUpdate) / 1000;

        if (dtSec >= 0.5) {
          // Update PPS every 500ms
          const delta = p.packets_successful - prevPkts;
          ppsRef.current[p.id] = delta > 0 ? delta / dtSec : 0;
          prevPacketsRef.current[p.id] = p.packets_successful;
          lastPpsUpdateRef.current[p.id] = now;
        }

        const pps = ppsRef.current[p.id] ?? 0;

        // ── Wave speed and amplitude driven by PPS ──
        // Normalize: assume max ~1000 pps → full amplitude
        const normalizedRate = p.state === "PAUSED" ? 0 : Math.min(pps / 200, 1);
        const baseAmp = 4 + normalizedRate * 14;   // 4–18px amplitude
        const waveSpeed = 0.08 + normalizedRate * 0.5; // faster scroll at higher rate
        const frequency = 0.012;

        offsetRef.current[index] += waveSpeed;

        // Baseline
        ctx.strokeStyle = "rgba(255,255,255,0.04)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, laneY);
        ctx.lineTo(width, laneY);
        ctx.stroke();

        // Wave — only draw if active
        if (p.state !== "PAUSED" || normalizedRate > 0) {
          ctx.strokeStyle = color;
          ctx.shadowBlur = 10 + normalizedRate * 8;
          ctx.shadowColor = color;
          ctx.lineWidth = 2 + normalizedRate * 1.5;
          ctx.beginPath();

          for (let x = 0; x < width; x++) {
            const smooth = Math.sin((x + offsetRef.current[index]) * frequency) * baseAmp;
            const harmonic = Math.sin((x + offsetRef.current[index]) * frequency * 1.8) * (baseAmp * 0.25);
            const y = laneY + smooth + harmonic;
            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();
          ctx.shadowBlur = 0;
        } else {
          // Flat line for paused
          ctx.strokeStyle = color + "44";
          ctx.lineWidth = 1;
          ctx.setLineDash([6, 8]);
          ctx.beginPath();
          ctx.moveTo(0, laneY);
          ctx.lineTo(width, laneY);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        // ── Progress bar ──
        const barW = width - 48;
        const barX = 24;
        const barY = laneY + 30;

        // Track bg
        ctx.fillStyle = "rgba(255,255,255,0.05)";
        ctx.beginPath();
        (ctx as any).roundRect(barX, barY, barW, 5, 2.5);
        ctx.fill();

        // Fill
        const fillColor = progress >= 1 ? "#00C853" : color;
        ctx.fillStyle = fillColor;
        ctx.shadowBlur = 6;
        ctx.shadowColor = fillColor;
        ctx.beginPath();
        (ctx as any).roundRect(barX, barY, barW * progress, 5, 2.5);
        ctx.fill();
        ctx.shadowBlur = 0;

        // ── Labels ──
        // Left: protocol name + state
        ctx.fillStyle = "rgba(200, 210, 230, 0.9)";
        ctx.font = "600 12px 'JetBrains Mono', monospace";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(p.protocol, barX, laneY - 26);

        // State badge
        const stateLabel = p.state === "PAUSED" ? "⏸ PAUSED" : progress >= 1 ? "✓ DONE" : "● LIVE";
        ctx.fillStyle =
          p.state === "PAUSED"
            ? "#FF8F00"
            : progress >= 1
              ? "#00C853"
              : color;
        ctx.font = "500 10px 'JetBrains Mono', monospace";
        ctx.fillText(stateLabel, barX + 60, laneY - 26);

        // Right: PPS + progress %
        ctx.textAlign = "right";
        ctx.fillStyle = color;
        ctx.font = "600 12px 'JetBrains Mono', monospace";
        ctx.fillText(`${Math.round(progress * 100)}%`, barX + barW, laneY - 26);

        // PPS below protocol name
        if (pps > 0 && p.state !== "PAUSED") {
          ctx.textAlign = "left";
          ctx.fillStyle = "rgba(150, 160, 180, 0.7)";
          ctx.font = "400 10px 'JetBrains Mono', monospace";
          ctx.fillText(`${Math.round(pps)} pkt/s`, barX, barY + 16);
        }

        // Packets sent / total
        if (p.packets_attempted > 0) {
          ctx.textAlign = "right";
          ctx.fillStyle = "rgba(150, 160, 180, 0.7)";
          ctx.font = "400 10px 'JetBrains Mono', monospace";
          ctx.fillText(
            `${(p.packets_successful / 1000).toFixed(1)}k / ${(p.packets_attempted / 1000).toFixed(1)}k pkts`,
            barX + barW,
            barY + 16
          );
        }

        ctx.textAlign = "left";
      });

      animationRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [protocols]);

  return (
    <div
      className="rounded-2xl border border-border overflow-hidden"
      style={{ background: "rgba(6, 8, 18, 0.75)", backdropFilter: "blur(20px)" }}
    >
      {/* Header */}
      <div className="px-5 py-3 border-b border-border/40 flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-widest text-text-secondary font-medium">
          Protocol Signal Monitor
        </p>
        <div className="flex items-center gap-4">
          {protocols.map((p) => {
            const color = PROTO_COLORS[p.protocol] || "#7C5CFF";
            const progress =
              p.packets_attempted > 0
                ? Math.min(p.packets_successful / p.packets_attempted, 1)
                : 0;
            return (
              <div key={p.id} className="flex items-center gap-1.5">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{
                    backgroundColor: color,
                    boxShadow: `0 0 5px ${color}`,
                  }}
                />
                <span className="text-[10px] font-mono text-text-secondary">
                  {p.protocol}
                </span>
                {p.packets_attempted > 0 && (
                  <span className="text-[10px] font-mono text-text-secondary opacity-60">
                    {Math.round(progress * 100)}%
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Canvas */}
      <div className="p-2">
        <canvas ref={canvasRef} className="w-full" />
      </div>

      {/* Footer legend */}
      <div className="px-5 py-2.5 border-t border-border/30 flex items-center gap-6 text-[10px] text-text-secondary font-mono">
        <span className="flex items-center gap-1.5">
          <span className="text-primary">●</span> LIVE — wave speed &amp; amplitude scale with packet rate
        </span>
        <span className="flex items-center gap-1.5">
          <span className="text-success">✓</span> DONE — transfer complete
        </span>
      </div>
    </div>
  );
}
