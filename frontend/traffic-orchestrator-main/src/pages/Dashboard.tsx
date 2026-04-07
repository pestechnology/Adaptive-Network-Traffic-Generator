import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Briefcase,
  Activity,
  CheckCircle2,
  XCircle,
  Plus,
  Copy,
  Check,
  Download,
} from "lucide-react";
import { useJobs } from "@/lib/hooks/useJobs";
import { useProfiles } from "@/lib/hooks/useProfiles";
import { MetricCard } from "@/components/ui/MetricCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { DualAxisChart } from "@/components/charts/DualAxisChart";
import { executeTraffic, getPcapUrl } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Job } from "@/types/traffic";

function truncateId(id: string) {
  return id.length > 12 ? `${id.slice(0, 8)}...${id.slice(-4)}` : id;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="ml-1 opacity-50 hover:opacity-100 transition-opacity"
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      {copied ? <Check size={12} className="text-[#10b981]" /> : <Copy size={12} />}
    </button>
  );
}

function SortableHeader({
  label,
  sortKey,
  currentSort,
  dir,
  onSort,
}: {
  label: string;
  sortKey: string;
  currentSort: string;
  dir: "asc" | "desc";
  onSort: (k: string) => void;
}) {
  const active = currentSort === sortKey;
  return (
    <th
      className="px-4 py-3 text-left text-xs font-medium text-[#64748b] cursor-pointer hover:text-white transition-colors select-none"
      onClick={() => onSort(sortKey)}
    >
      {label}{" "}
      <span className="opacity-40">{active ? (dir === "asc" ? "↑" : "↓") : "↕"}</span>
    </th>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { jobs, running, completed, failed, isLoading } = useJobs(3000);
  const { profileNames } = useProfiles();

  const [showNewJob, setShowNewJob] = useState(false);
  const [newProfile, setNewProfile] = useState("");
  const [newDest, setNewDest] = useState("");
  const [enableCap, setEnableCap] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [sortKey, setSortKey] = useState("job_id");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const handleSort = (k: string) => {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(k); setSortDir("asc"); }
  };

  const sorted = [...jobs].sort((a, b) => {
    const va = (a as Record<string, unknown>)[sortKey] ?? "";
    const vb = (b as Record<string, unknown>)[sortKey] ?? "";
    const cmp = typeof va === "number" && typeof vb === "number"
      ? va - vb
      : String(va).localeCompare(String(vb));
    return sortDir === "asc" ? cmp : -cmp;
  });

  // history chart — last 20 completed jobs
  const historyData = completed.slice(-20).map((j, i) => ({
    name: `#${i + 1}`,
    delivery: j.delivery_percent,
    throughput: j.throughput_mbps,
  }));

  const launchJob = async () => {
    if (!newProfile || !newDest) {
      toast.error("Profile and destination are required");
      return;
    }
    setLaunching(true);
    try {
      await executeTraffic({ profile_name: newProfile, destination: newDest, enable_capture: enableCap });
      toast.success("Job launched!");
      setShowNewJob(false);
      setNewProfile("");
      setNewDest("");
      qc.invalidateQueries({ queryKey: ["jobs"] });
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Failed to launch job");
    } finally {
      setLaunching(false);
    }
  };

  const hasPcap = (j: Job) => !!(j.pcap_path || j.metrics?.pcap_path || j.metrics?.pcap_file);

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Total Jobs"
          value={jobs.length}
          icon={Briefcase}
          iconColor="#7c3aed"
        />
        <MetricCard
          label="Running"
          value={running.length}
          icon={Activity}
          iconColor="#e91e8c"
        />
        <MetricCard
          label="Completed"
          value={completed.length}
          icon={CheckCircle2}
          iconColor="#10b981"
        />
        <MetricCard
          label="Failed"
          value={failed.length}
          icon={XCircle}
          iconColor="#ef4444"
        />
      </div>

      {/* Live Jobs Table */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ background: "#12121a", border: "1px solid rgba(255,255,255,0.08)" }}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#e91e8c] animate-pulse" />
            <span className="text-white font-semibold text-sm">Live Jobs</span>
            <span className="text-xs text-[#64748b]">auto-refreshes every 3s</span>
          </div>
          <button
            onClick={() => setShowNewJob(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-90 active:scale-95"
            style={{ background: "linear-gradient(135deg, #e91e8c, #7c3aed)", color: "#fff" }}
          >
            <Plus size={13} /> New Job
          </button>
        </div>

        {isLoading ? (
          <div className="p-8 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 rounded-lg animate-pulse" style={{ background: "#1a1a28" }} />
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <EmptyState
            icon={Briefcase}
            title="No jobs yet"
            description="Launch your first traffic job to see it appear here."
            actionLabel="New Job"
            onAction={() => setShowNewJob(true)}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.05]">
                  <SortableHeader label="Job ID" sortKey="job_id" currentSort={sortKey} dir={sortDir} onSort={handleSort} />
                  <SortableHeader label="Profile" sortKey="profile" currentSort={sortKey} dir={sortDir} onSort={handleSort} />
                  <SortableHeader label="Destination" sortKey="destination" currentSort={sortKey} dir={sortDir} onSort={handleSort} />
                  <SortableHeader label="State" sortKey="state" currentSort={sortKey} dir={sortDir} onSort={handleSort} />
                  <SortableHeader label="Duration (s)" sortKey="duration_sec" currentSort={sortKey} dir={sortDir} onSort={handleSort} />
                  <SortableHeader label="Delivery %" sortKey="delivery_percent" currentSort={sortKey} dir={sortDir} onSort={handleSort} />
                  <SortableHeader label="Throughput" sortKey="throughput_mbps" currentSort={sortKey} dir={sortDir} onSort={handleSort} />
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {sorted.map((j) => (
                  <tr
                    key={j.job_id}
                    className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors cursor-pointer"
                    onClick={() => navigate("/jobs")}
                  >
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-[#94a3b8]">{truncateId(j.job_id)}</span>
                      <CopyButton text={j.job_id} />
                    </td>
                    <td className="px-4 py-3 text-white text-xs">{j.profile}</td>
                    <td className="px-4 py-3 font-mono text-xs text-[#94a3b8]">{j.destination}</td>
                    <td className="px-4 py-3">
                      <StatusBadge state={j.state} />
                    </td>
                    <td className="px-4 py-3 text-[#94a3b8] text-xs text-right">{j.duration_sec?.toFixed(1) ?? "—"}</td>
                    <td className="px-4 py-3 text-right text-xs">
                      <span style={{ color: j.delivery_percent >= 90 ? "#10b981" : j.delivery_percent >= 70 ? "#f59e0b" : "#ef4444" }}>
                        {j.delivery_percent?.toFixed(1) ?? "—"}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-[#94a3b8]">
                      {j.throughput_mbps?.toFixed(2) ?? "—"} Mbps
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      {hasPcap(j) && (
                        <a
                          href={getPcapUrl(j.job_id)}
                          className="text-[#3b82f6] hover:text-blue-400 transition-colors"
                          title="Download PCAP"
                        >
                          <Download size={14} />
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* History Chart */}
      <div
        className="rounded-xl p-5"
        style={{ background: "#12121a", border: "1px solid rgba(255,255,255,0.08)" }}
      >
        <h3 className="text-white font-semibold text-sm mb-4">Execution History</h3>
        {historyData.length === 0 ? (
          <EmptyState icon={Activity} title="No history yet" description="Completed jobs will appear here." />
        ) : (
          <DualAxisChart
            data={historyData}
            xKey="name"
            leftKey="delivery"
            rightKey="throughput"
            leftLabel="Delivery %"
            rightLabel="Throughput Mbps"
            leftColor="#e91e8c"
            rightColor="#3b82f6"
          />
        )}
      </div>

      {/* New Job Modal */}
      <Dialog open={showNewJob} onOpenChange={setShowNewJob}>
        <DialogContent style={{ background: "#12121a", border: "1px solid rgba(255,255,255,0.1)" }}>
          <DialogHeader>
            <DialogTitle className="text-white">New Job</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <label className="text-xs text-[#94a3b8] mb-1 block">Profile</label>
              <select
                className="w-full rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#e91e8c]/50"
                style={{ background: "#0d0d14", border: "1px solid rgba(255,255,255,0.1)" }}
                value={newProfile}
                onChange={(e) => setNewProfile(e.target.value)}
              >
                <option value="">Select a profile…</option>
                {profileNames.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-[#94a3b8] mb-1 block">Destination IP</label>
              <input
                type="text"
                placeholder="192.168.1.1"
                className="w-full rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:ring-2 focus:ring-[#e91e8c]/50"
                style={{ background: "#0d0d14", border: "1px solid rgba(255,255,255,0.1)" }}
                value={newDest}
                onChange={(e) => setNewDest(e.target.value)}
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-[#94a3b8] cursor-pointer">
              <input
                type="checkbox"
                checked={enableCap}
                onChange={(e) => setEnableCap(e.target.checked)}
                className="rounded"
              />
              Enable packet capture (PCAP)
            </label>
            <button
              onClick={launchJob}
              disabled={launching}
              className="w-full py-2.5 rounded-lg font-semibold text-sm transition-all hover:opacity-90 active:scale-95 disabled:opacity-50"
              style={{ background: "linear-gradient(135deg, #e91e8c, #7c3aed)", color: "#fff" }}
            >
              {launching ? "Launching…" : "Launch Job"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
