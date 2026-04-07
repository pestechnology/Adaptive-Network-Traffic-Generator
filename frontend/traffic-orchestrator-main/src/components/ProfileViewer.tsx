import { Shield, BarChart3, Activity, FileText } from "lucide-react";
import { useEffect, useState } from "react";
import { getJobs } from "@/lib/api";

interface TrafficItem {
  protocol: string;
  count: number;
  duration_sec: number;
}

interface ProfileViewerProps {
  profile: {
    profile_name: string;
    traffic: TrafficItem[];
  } | null;
}

const PROTO_COLORS: Record<string, string> = {
  ICMP: "#7C5CFF", TCP: "#00B8D9", HTTP: "#00C853", HTTPS: "#AB47BC", SSH: "#FF8F00", UDP: "#F06292",
};

const getProtoColor = (protocol: string) => PROTO_COLORS[protocol] || "#7C5CFF";

export function ProfileViewer({ profile }: ProfileViewerProps) {
  const [activeProfiles, setActiveProfiles] = useState<string[]>([]);

  useEffect(() => {
    const fetchJobs = async () => {
      try {
        const jobs = await getJobs();
        const profiles = Object.values(jobs).map((job: any) => job.profile);
        setActiveProfiles(profiles);
      } catch {
        setActiveProfiles([]);
      }
    };
    fetchJobs();
  }, [profile]);

  if (!profile) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-surface border border-border flex items-center justify-center">
          <FileText className="h-6 w-6 text-text-secondary" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">No Profile Selected</p>
          <p className="text-xs text-text-secondary">Select a profile from the list to inspect its configuration.</p>
        </div>
      </div>
    );
  }

  // Guard: backend may return profiles without a traffic array
  const traffic = Array.isArray(profile.traffic) ? profile.traffic : [];
  const totalPackets = traffic.reduce((acc, item) => acc + item.count, 0);
  const totalDuration = traffic.reduce((acc, item) => acc + item.duration_sec, 0);
  const isActive = activeProfiles.includes(profile.profile_name);

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Header */}
      <div className="space-y-3">
        <div className="section-label">
          <div className="w-6 h-6 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center">
            <Shield className="h-3.5 w-3.5" />
          </div>
          Configuration Blueprint
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <h3 className="font-display text-2xl font-bold gradient-text">
            {profile.profile_name}
          </h3>
          {isActive && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-success/15 border border-success/30 text-success text-xs font-medium">
              <span className="live-dot" />
              Live Execution
            </div>
          )}
        </div>

        <p className="text-sm text-text-secondary">Traffic composition and execution parameters.</p>
      </div>

      {traffic.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center space-y-2 rounded-xl border border-dashed border-border">
          <Activity className="h-6 w-6 text-text-secondary/50" />
          <p className="text-sm text-text-secondary">No traffic rules defined for this profile.</p>
        </div>
      ) : (
        <>
          {/* Summary Metrics */}
          <div className="grid grid-cols-3 gap-3">
            <div className="metric-card text-center hover-scale hover-glow-primary cursor-default">
              <p className="text-[10px] uppercase tracking-widest text-text-secondary mb-1">Protocols</p>
              <p className="text-2xl font-display font-bold">{traffic.length}</p>
            </div>
            <div className="metric-card text-center hover-scale hover-glow-primary cursor-default">
              <p className="text-[10px] uppercase tracking-widest text-text-secondary mb-1">Packets</p>
              <p className="text-2xl font-display font-bold text-primary">{totalPackets.toLocaleString()}</p>
            </div>
            <div className="metric-card text-center hover-scale hover-glow-primary cursor-default">
              <p className="text-[10px] uppercase tracking-widest text-text-secondary mb-1">Duration</p>
              <p className="text-2xl font-display font-bold">{totalDuration}<span className="text-sm font-normal text-text-secondary">s</span></p>
            </div>
          </div>

          {/* Distribution Strip */}
          <div className="rounded-xl glass border border-border/50 p-4 space-y-3">
            <div className="flex items-center gap-2 text-text-secondary text-xs uppercase tracking-widest font-medium">
              <BarChart3 className="h-3.5 w-3.5 text-primary" />
              Traffic Distribution
            </div>

            {/* Multi-color bar */}
            <div className="flex h-2.5 w-full rounded-full overflow-hidden gap-px">
              {traffic.map((item, i) => {
                const pct = totalPackets === 0 ? 0 : (item.count / totalPackets) * 100;
                return (
                  <div
                    key={i}
                    className="transition-all duration-700"
                    style={{ width: `${pct}%`, backgroundColor: getProtoColor(item.protocol) }}
                  />
                );
              })}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-3">
              {traffic.map((item, i) => {
                const pct = totalPackets === 0 ? 0 : ((item.count / totalPackets) * 100).toFixed(0);
                return (
                  <div key={i} className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: getProtoColor(item.protocol) }} />
                    <span className="text-xs text-text-secondary">{item.protocol}</span>
                    <span className="text-xs font-medium">{pct}%</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Detailed Breakdown */}
          <div className="rounded-2xl border border-border overflow-hidden">
            <div className="px-5 py-3 border-b border-border bg-surface/60">
              <p className="text-[10px] uppercase tracking-widest text-text-secondary font-medium">Traffic Breakdown</p>
            </div>

            <div className="divide-y divide-border">
              {traffic.map((item, i) => {
                const pct = totalPackets === 0 ? 0 : (item.count / totalPackets) * 100;
                const color = getProtoColor(item.protocol);

                return (
                  <div key={i} className="px-5 py-4 space-y-2.5 hover:bg-surface-elevated transition-colors hover-scale cursor-default">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                        <span className="text-sm font-semibold">{item.protocol}</span>
                      </div>
                      <span className="text-xs font-mono text-text-secondary">{pct.toFixed(1)}%</span>
                    </div>

                    {/* Animated bar */}
                    <div className="w-full h-1.5 bg-background rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${pct}%`, backgroundColor: color, boxShadow: `0 0 8px ${color}60` }}
                      />
                    </div>

                    <div className="flex justify-between text-xs text-text-secondary">
                      <span>Packets: <span className="text-foreground font-medium">{item.count.toLocaleString()}</span></span>
                      <span>Duration: <span className="text-foreground font-medium">{item.duration_sec}s</span></span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

    </div>
  );
}
