import { useState } from "react";
import { ChevronDown, ChevronUp, Pause, Play, Square, Download, Briefcase } from "lucide-react";
import { useJobs } from "@/lib/hooks/useJobs";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { pauseJob, resumeJob, stopJob, getPcapUrl } from "@/lib/api";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Job } from "@/types/traffic";
import { cn } from "@/lib/utils";

const FILTERS = ["All", "RUNNING", "COMPLETED", "FAILED", "PAUSED"] as const;
type Filter = (typeof FILTERS)[number];

function MetricsRow({ j }: { j: Job }) {
  const items = [
    { label: "Packets Attempted", value: j.packets_attempted, unit: "" },
    { label: "Packets Successful", value: j.packets_successful, unit: "" },
    { label: "Delivery %", value: j.delivery_percent?.toFixed(2), unit: "%", color: j.delivery_percent >= 90 ? "#10b981" : j.delivery_percent >= 70 ? "#f59e0b" : "#ef4444" },
    { label: "Reliability Score", value: j.reliability_score?.toFixed(3), unit: "" },
    { label: "Avg Latency", value: j.avg_latency_ms?.toFixed(2), unit: "ms" },
    { label: "Throughput", value: j.throughput_mbps?.toFixed(2), unit: "Mbps" },
    { label: "Packet Loss", value: j.packet_loss, unit: "" },
    { label: "Out of Order", value: j.out_of_order, unit: "" },
    { label: "Duplicates", value: j.duplicates, unit: "" },
    { label: "Corrupted", value: j.corrupted, unit: "" },
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 p-4 border-t border-white/[0.05]"
      style={{ background: "#0d0d14" }}>
      {items.map((it) => (
        <div key={it.label}>
          <div className="text-[10px] text-[#64748b] mb-0.5">{it.label}</div>
          <div className="text-sm font-semibold" style={{ color: (it as { color?: string }).color ?? "#fff" }}>
            {it.value ?? "—"}{it.unit}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function JobsPage() {
  const qc = useQueryClient();
  const { jobs, isLoading } = useJobs(3000);
  const [filter, setFilter] = useState<Filter>("All");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [operating, setOperating] = useState<string | null>(null);

  const filtered = jobs.filter((j) => filter === "All" || j.state === filter);

  const toggle = (id: string) => {
    setExpanded((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const operate = async (jobId: string, fn: () => Promise<void>, label: string) => {
    setOperating(jobId);
    try {
      await fn();
      toast.success(`${label} successful`);
      qc.invalidateQueries({ queryKey: ["jobs"] });
    } catch {
      toast.error(`Failed to ${label.toLowerCase()}`);
    } finally {
      setOperating(null);
    }
  };

  const hasPcap = (j: Job) => !!(j.pcap_path || j.metrics?.pcap_path || j.metrics?.pcap_file);

  return (
    <div className="space-y-5 animate-fade-up">
      {/* Filter tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "px-4 py-1.5 rounded-full text-xs font-medium transition-all duration-200",
              filter === f ? "text-white" : "text-[#64748b] hover:text-white"
            )}
            style={
              filter === f
                ? { background: "linear-gradient(135deg, #e91e8c, #7c3aed)" }
                : { background: "#12121a", border: "1px solid rgba(255,255,255,0.08)" }
            }
          >
            {f}
            {f !== "All" && (
              <span className="ml-1.5 opacity-60">
                ({jobs.filter((j) => j.state === f).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-xl animate-pulse" style={{ background: "#12121a" }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={Briefcase} title="No jobs" description={`No ${filter === "All" ? "" : filter.toLowerCase() + " "}jobs found.`} />
      ) : (
        <div className="space-y-2">
          {filtered.map((j) => {
            const isExpanded = expanded.has(j.job_id);
            const busy = operating === j.job_id;
            return (
              <div
                key={j.job_id}
                className="rounded-xl overflow-hidden transition-all duration-200"
                style={{ background: "#12121a", border: "1px solid rgba(255,255,255,0.08)" }}
              >
                <div
                  className="flex items-center gap-3 px-5 py-4 cursor-pointer hover:bg-white/[0.02]"
                  onClick={() => toggle(j.job_id)}
                >
                  <div className="flex-1 min-w-0 grid grid-cols-2 md:grid-cols-5 gap-3 items-center">
                    <div>
                      <div className="font-mono text-xs text-[#94a3b8] truncate">{j.job_id.slice(0, 12)}…</div>
                      <div className="text-white text-xs font-medium truncate">{j.profile}</div>
                    </div>
                    <div className="font-mono text-xs text-[#94a3b8]">{j.destination}</div>
                    <StatusBadge state={j.state} />
                    <div className="text-xs text-[#94a3b8]">{j.duration_sec?.toFixed(1) ?? "—"}s</div>
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      {j.state === "RUNNING" && (
                        <>
                          <button
                            title="Pause"
                            disabled={busy}
                            onClick={() => operate(j.job_id, () => pauseJob(j.job_id), "Pause")}
                            className="p-1.5 rounded-lg hover:bg-[#f59e0b]/10 text-[#f59e0b] transition-colors disabled:opacity-50"
                          >
                            <Pause size={14} />
                          </button>
                          <button
                            title="Stop"
                            disabled={busy}
                            onClick={() => operate(j.job_id, () => stopJob(j.job_id), "Stop")}
                            className="p-1.5 rounded-lg hover:bg-[#ef4444]/10 text-[#ef4444] transition-colors disabled:opacity-50"
                          >
                            <Square size={14} />
                          </button>
                        </>
                      )}
                      {j.state === "PAUSED" && (
                        <button
                          title="Resume"
                          disabled={busy}
                          onClick={() => operate(j.job_id, () => resumeJob(j.job_id), "Resume")}
                          className="p-1.5 rounded-lg hover:bg-[#10b981]/10 text-[#10b981] transition-colors disabled:opacity-50"
                        >
                          <Play size={14} />
                        </button>
                      )}
                      {hasPcap(j) && (
                        <a
                          href={getPcapUrl(j.job_id)}
                          title="Download PCAP"
                          className="p-1.5 rounded-lg hover:bg-[#3b82f6]/10 text-[#3b82f6] transition-colors"
                        >
                          <Download size={14} />
                        </a>
                      )}
                    </div>
                  </div>
                  {isExpanded ? (
                    <ChevronUp size={16} className="text-[#64748b] flex-shrink-0" />
                  ) : (
                    <ChevronDown size={16} className="text-[#64748b] flex-shrink-0" />
                  )}
                </div>
                {isExpanded && <MetricsRow j={j} />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
