import { useState } from "react";
import { CalendarClock, Trash2, RefreshCw } from "lucide-react";
import { scheduleOnce, scheduleInterval, getScheduledJobs, deleteScheduledJob } from "@/lib/api";
import { ScheduledJob } from "@/types/traffic";
import { toast } from "sonner";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useProfiles } from "@/lib/hooks/useProfiles";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { cn } from "@/lib/utils";

function formatDate(d: string | null): string {
  if (!d) return "N/A";
  try {
    return new Date(d).toLocaleString(undefined, {
      year: "numeric", month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
  } catch {
    return "N/A";
  }
}

function InputField({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs text-[#94a3b8] mb-1 block">{label}</label>
      {children}
      {error && <p className="text-xs text-[#ef4444] mt-1">{error}</p>}
    </div>
  );
}

export default function SchedulerPage() {
  const qc = useQueryClient();
  const { profileNames } = useProfiles();

  const { data: scheduled = [], isLoading } = useQuery<ScheduledJob[]>({
    queryKey: ["schedule"],
    queryFn: getScheduledJobs,
    refetchInterval: 10000,
    select: (d) => (Array.isArray(d) ? d : d.jobs ?? []),
  });

  // Once form
  const [onceProfile, setOnceProfile] = useState("");
  const [onceDest, setOnceDest] = useState("");
  const [onceTime, setOnceTime] = useState("");
  const [onceErrors, setOnceErrors] = useState<Record<string, string>>({});
  const [submittingOnce, setSubmittingOnce] = useState(false);

  // Interval form
  const [intProfile, setIntProfile] = useState("");
  const [intDest, setIntDest] = useState("");
  const [intSeconds, setIntSeconds] = useState(60);
  const [intErrors, setIntErrors] = useState<Record<string, string>>({});
  const [submittingInt, setSubmittingInt] = useState(false);

  // Delete confirm
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const validateOnce = () => {
    const errs: Record<string, string> = {};
    if (!onceProfile) errs.profile = "Profile required";
    if (!onceDest.trim()) errs.dest = "Destination required";
    if (!onceTime) errs.time = "Run time required";
    setOnceErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const validateInterval = () => {
    const errs: Record<string, string> = {};
    if (!intProfile) errs.profile = "Profile required";
    if (!intDest.trim()) errs.dest = "Destination required";
    if (intSeconds < 1) errs.secs = "Must be ≥ 1 second";
    setIntErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleOnce = async () => {
    if (!validateOnce()) return;
    setSubmittingOnce(true);
    try {
      await scheduleOnce(onceProfile, onceDest.trim(), new Date(onceTime).toISOString());
      toast.success("Job scheduled!");
      setOnceProfile(""); setOnceDest(""); setOnceTime("");
      qc.invalidateQueries({ queryKey: ["schedule"] });
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Failed to schedule");
    } finally {
      setSubmittingOnce(false);
    }
  };

  const handleInterval = async () => {
    if (!validateInterval()) return;
    setSubmittingInt(true);
    try {
      await scheduleInterval(intProfile, intDest.trim(), intSeconds);
      toast.success("Interval job scheduled!");
      setIntProfile(""); setIntDest(""); setIntSeconds(60);
      qc.invalidateQueries({ queryKey: ["schedule"] });
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Failed to schedule");
    } finally {
      setSubmittingInt(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteScheduledJob(deleteId);
      toast.success("Schedule cancelled");
      qc.invalidateQueries({ queryKey: ["schedule"] });
    } catch {
      toast.error("Failed to cancel");
    } finally {
      setDeleteId(null);
    }
  };

  const inputStyle = (err?: string) => ({
    background: "#0d0d14",
    border: `1px solid ${err ? "#ef4444" : "rgba(255,255,255,0.1)"}`,
    color: "#fff",
  });

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Forms row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Once */}
        <div className="rounded-xl p-6" style={{ background: "#12121a", border: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="flex items-center gap-2 mb-5">
            <CalendarClock size={18} style={{ color: "#e91e8c" }} />
            <h2 className="text-white font-semibold">Schedule Once</h2>
          </div>
          <div className="space-y-3">
            <InputField label="Profile" error={onceErrors.profile}>
              <select
                className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#e91e8c]/40"
                style={inputStyle(onceErrors.profile)}
                value={onceProfile} onChange={(e) => setOnceProfile(e.target.value)}
              >
                <option value="">Select profile…</option>
                {profileNames.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </InputField>
            <InputField label="Destination IP" error={onceErrors.dest}>
              <input
                type="text" placeholder="192.168.1.1"
                className="w-full rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#e91e8c]/40"
                style={inputStyle(onceErrors.dest)}
                value={onceDest} onChange={(e) => setOnceDest(e.target.value)}
              />
            </InputField>
            <InputField label="Run At" error={onceErrors.time}>
              <input
                type="datetime-local"
                className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#e91e8c]/40"
                style={{ ...inputStyle(onceErrors.time), colorScheme: "dark" }}
                value={onceTime} onChange={(e) => setOnceTime(e.target.value)}
              />
            </InputField>
            <button
              onClick={handleOnce} disabled={submittingOnce}
              className="w-full py-2.5 rounded-lg font-semibold text-sm transition-all hover:opacity-90 active:scale-95 disabled:opacity-50"
              style={{ background: "linear-gradient(135deg, #e91e8c, #7c3aed)", color: "#fff" }}
            >
              {submittingOnce ? "Scheduling…" : "Schedule Once"}
            </button>
          </div>
        </div>

        {/* Interval */}
        <div className="rounded-xl p-6" style={{ background: "#12121a", border: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="flex items-center gap-2 mb-5">
            <RefreshCw size={18} style={{ color: "#7c3aed" }} />
            <h2 className="text-white font-semibold">Schedule Interval</h2>
          </div>
          <div className="space-y-3">
            <InputField label="Profile" error={intErrors.profile}>
              <select
                className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#7c3aed]/40"
                style={inputStyle(intErrors.profile)}
                value={intProfile} onChange={(e) => setIntProfile(e.target.value)}
              >
                <option value="">Select profile…</option>
                {profileNames.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </InputField>
            <InputField label="Destination IP" error={intErrors.dest}>
              <input
                type="text" placeholder="192.168.1.1"
                className="w-full rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#7c3aed]/40"
                style={inputStyle(intErrors.dest)}
                value={intDest} onChange={(e) => setIntDest(e.target.value)}
              />
            </InputField>
            <InputField label="Interval (seconds)" error={intErrors.secs}>
              <div className="flex items-center gap-3">
                <input
                  type="range" min={1} max={3600} step={1} value={intSeconds}
                  onChange={(e) => setIntSeconds(Number(e.target.value))}
                  className="flex-1" style={{ accentColor: "#7c3aed" }}
                />
                <input
                  type="number" min={1} value={intSeconds}
                  onChange={(e) => setIntSeconds(Number(e.target.value))}
                  className="w-20 rounded-lg px-2 py-1.5 text-sm font-mono text-center focus:outline-none"
                  style={inputStyle(intErrors.secs)}
                />
              </div>
            </InputField>
            <button
              onClick={handleInterval} disabled={submittingInt}
              className="w-full py-2.5 rounded-lg font-semibold text-sm transition-all hover:opacity-90 active:scale-95 disabled:opacity-50"
              style={{ background: "linear-gradient(135deg, #7c3aed, #3b82f6)", color: "#fff" }}
            >
              {submittingInt ? "Scheduling…" : "Schedule Interval"}
            </button>
          </div>
        </div>
      </div>

      {/* Scheduled Jobs */}
      <div className="rounded-xl overflow-hidden" style={{ background: "#12121a", border: "1px solid rgba(255,255,255,0.08)" }}>
        <div className="px-5 py-4 border-b border-white/[0.06] text-white font-semibold text-sm flex items-center justify-between">
          <span>Scheduled Jobs</span>
          <span className="text-[#64748b] text-xs font-normal">{scheduled.length} job{scheduled.length !== 1 ? "s" : ""}</span>
        </div>

        {isLoading ? (
          <div className="p-6 space-y-2">
            {[1, 2, 3].map((i) => <div key={i} className="h-12 rounded-lg animate-pulse" style={{ background: "#1a1a28" }} />)}
          </div>
        ) : scheduled.length === 0 ? (
          <EmptyState icon={CalendarClock} title="No scheduled jobs" description="Use the forms above to schedule once or recurring jobs." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.05]">
                  {["Profile", "Destination", "Type", "Run Time / Interval", "Next Run", "Status", ""].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs text-[#64748b] font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {scheduled.map((job) => (
                  <tr key={job.scheduled_id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3 text-white text-xs">{job.profile_name}</td>
                    <td className="px-4 py-3 font-mono text-xs text-[#94a3b8]">{job.destination}</td>
                    <td className="px-4 py-3">
                      <span
                        className="px-2 py-0.5 rounded-full text-xs font-medium"
                        style={
                          job.type === "once"
                            ? { background: "rgba(233,30,140,0.12)", color: "#e91e8c" }
                            : { background: "rgba(124,58,237,0.12)", color: "#7c3aed" }
                        }
                      >
                        {job.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-[#94a3b8]">
                      {job.type === "once" ? formatDate(job.run_time) : `Every ${job.interval_seconds}s`}
                    </td>
                    <td className="px-4 py-3 text-xs text-[#94a3b8]">{formatDate(job.next_run_time)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={cn("px-2 py-0.5 rounded-full text-xs font-medium", job.error ? "text-[#ef4444]" : "text-[#10b981]")}
                        style={{ background: job.error ? "rgba(239,68,68,0.12)" : "rgba(16,185,129,0.12)" }}
                      >
                        {job.error ? "Error" : job.status || "Active"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setDeleteId(job.scheduled_id)}
                        className="text-[#94a3b8] hover:text-[#ef4444] transition-colors"
                        title="Cancel"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmModal
        open={!!deleteId}
        title="Cancel Scheduled Job"
        description="Are you sure you want to cancel this scheduled job?"
        confirmLabel="Cancel Job"
        destructive
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
