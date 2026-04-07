import { useState } from "react";
import { Search, Download, ChevronDown, ChevronUp } from "lucide-react";
import { getHeaders, getPcapUrl, getExecutions } from "@/lib/api";
import { PacketHeader } from "@/types/traffic";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { EmptyState } from "@/components/ui/EmptyState";
import { AtgPieChart } from "@/components/charts/AtgPieChart";

export default function HeaderInspectionPanel() {
  const [selectedJobId, setSelectedJobId] = useState<string>("");
  const [headers, setHeaders] = useState<PacketHeader[]>([]);
  const [loadingHeaders, setLoadingHeaders] = useState(false);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const { data: executions = [] } = useQuery<Array<{ job_id: string; state?: string; profile?: string }>>({
    queryKey: ["executions"],
    queryFn: getExecutions,
    refetchInterval: 10000,
  });

  const loadHeaders = async (jobId: string) => {
    setSelectedJobId(jobId);
    if (!jobId) { setHeaders([]); return; }
    setLoadingHeaders(true);
    try {
      const data = await getHeaders(jobId);
      setHeaders(Array.isArray(data) ? data : data.packets ?? data.headers ?? []);
    } catch {
      toast.error("Failed to load headers");
    } finally {
      setLoadingHeaders(false);
    }
  };

  const toggle = (i: number) => {
    setExpanded((s) => {
      const n = new Set(s);
      n.has(i) ? n.delete(i) : n.add(i);
      return n;
    });
  };

  // Stats
  const srcIPs = new Set(headers.map((h) => h.src_ip).filter(Boolean));
  const dstIPs = new Set(headers.map((h) => h.dst_ip).filter(Boolean));
  const protoCounts: Record<string, number> = {};
  headers.forEach((h) => {
    const p = h.protocol ?? "Unknown";
    protoCounts[p] = (protoCounts[p] ?? 0) + 1;
  });
  const pieData = Object.entries(protoCounts).map(([name, value]) => ({ name, value }));

  const fieldColor: Record<string, string> = {
    src_ip: "#e91e8c", dst_ip: "#3b82f6", protocol: "#7c3aed",
    ttl: "#f59e0b", length: "#10b981", src_port: "#e91e8c", dst_port: "#3b82f6",
  };

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Selector */}
      <div
        className="rounded-xl p-5"
        style={{ background: "#12121a", border: "1px solid rgba(255,255,255,0.08)" }}
      >
        <div className="flex items-center gap-2 mb-4">
          <Search size={18} style={{ color: "#3b82f6" }} />
          <h2 className="text-white font-semibold">Header Inspection</h2>
        </div>
        <div className="flex gap-3">
          <select
            className="flex-1 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#3b82f6]/40"
            style={{ background: "#0d0d14", border: "1px solid rgba(255,255,255,0.1)" }}
            value={selectedJobId}
            onChange={(e) => loadHeaders(e.target.value)}
          >
            <option value="">— Select an execution —</option>
            {executions.map((ex) => (
              <option key={ex.job_id} value={ex.job_id}>
                {ex.job_id} {ex.profile ? `(${ex.profile})` : ""} {ex.state ? `[${ex.state}]` : ""}
              </option>
            ))}
          </select>
          {selectedJobId && (
            <a
              href={getPcapUrl(selectedJobId)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all hover:opacity-90"
              style={{ background: "rgba(59,130,246,0.12)", color: "#3b82f6", border: "1px solid rgba(59,130,246,0.3)" }}
            >
              <Download size={14} /> PCAP
            </a>
          )}
        </div>
      </div>

      {selectedJobId && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Total Packets", value: headers.length },
              { label: "Unique Src IPs", value: srcIPs.size },
              { label: "Unique Dst IPs", value: dstIPs.size },
              { label: "Protocols", value: Object.keys(protoCounts).length },
            ].map((s) => (
              <div
                key={s.label}
                className="rounded-xl p-4"
                style={{ background: "#12121a", border: "1px solid rgba(255,255,255,0.08)" }}
              >
                <div className="text-[#64748b] text-xs mb-1">{s.label}</div>
                <div className="text-white font-bold text-2xl">{s.value}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Protocol Pie */}
            <div
              className="rounded-xl p-5"
              style={{ background: "#12121a", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              <h3 className="text-white font-semibold text-sm mb-3">Protocol Distribution</h3>
              {pieData.length === 0 ? (
                <p className="text-[#64748b] text-xs text-center py-8">No protocol data</p>
              ) : (
                <AtgPieChart data={pieData} height={200} />
              )}
            </div>

            {/* Packet Accordion */}
            <div
              className="lg:col-span-2 rounded-xl overflow-hidden"
              style={{ background: "#12121a", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              <div className="px-4 py-3 border-b border-white/[0.06] text-white font-semibold text-sm">
                Parsed Packets ({headers.length})
              </div>
              {loadingHeaders ? (
                <div className="p-6 space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-10 rounded animate-pulse" style={{ background: "#1a1a28" }} />
                  ))}
                </div>
              ) : headers.length === 0 ? (
                <EmptyState icon={Search} title="No packets" description="Select an execution with PCAP capture enabled." />
              ) : (
                <div className="max-h-96 overflow-y-auto divide-y divide-white/[0.04]">
                  {headers.slice(0, 200).map((h, i) => {
                    const isOpen = expanded.has(i);
                    const keys = Object.keys(h).filter((k) => k !== "index" && h[k] != null);
                    return (
                      <div key={i}>
                        <button
                          onClick={() => toggle(i)}
                          className="w-full flex items-center justify-between px-4 py-2.5 text-xs hover:bg-white/[0.02] transition-colors"
                        >
                          <span className="flex items-center gap-3">
                            <span className="text-[#64748b] font-mono w-8">{i + 1}</span>
                            <span className="text-white">{h.src_ip ?? "?"} → {h.dst_ip ?? "?"}</span>
                            <span className="text-[#7c3aed]">{h.protocol ?? "?"}</span>
                          </span>
                          {isOpen ? <ChevronUp size={13} className="text-[#64748b]" /> : <ChevronDown size={13} className="text-[#64748b]" />}
                        </button>
                        {isOpen && (
                          <div className="px-4 pb-3 grid grid-cols-2 md:grid-cols-3 gap-2">
                            {keys.map((k) => (
                              <div key={k} className="text-xs">
                                <span style={{ color: fieldColor[k] ?? "#94a3b8" }}>{k}</span>
                                <span className="text-white ml-1 font-mono">{String(h[k])}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {headers.length > 200 && (
                    <div className="px-4 py-2 text-xs text-[#64748b] text-center">
                      Showing first 200 of {headers.length} packets
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {!selectedJobId && (
        <EmptyState icon={Search} title="No execution selected" description="Select an execution from the dropdown above to inspect packet headers." />
      )}
    </div>
  );
}
