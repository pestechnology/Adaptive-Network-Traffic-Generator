import { useEffect, useState, useRef } from "react";
import { getJobs } from "@/lib/api";
import { ProfileProtocolMonitor } from "@/components/ProfileProtocolMonitor";
import {
  Activity, Pause, Package, Clock, Play, Square,
  ChevronDown, ChevronUp, Trash2, CheckCircle2, XCircle, AlertCircle, Download
} from "lucide-react";
import { pauseJob, resumeJob, stopJob, getProfiles, getProfile, getHeaders } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Search } from "lucide-react";
import type { Job } from "@/types/traffic";

// Extend Job with client-side tracking fields
interface JobWithTimestamps extends Job {
  started_at?: number;
  ended_at?: number;
  start_time?: number;
}

interface Props {
  refreshTrigger: number;
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function JobsDashboard({ refreshTrigger }: Props) {
  const [jobs, setJobs] = useState<Record<string, JobWithTimestamps>>({});
  const [profileTotals, setProfileTotals] = useState<Record<string, number>>({});
  const [showHistory, setShowHistory] = useState(false);
  const [selectedHeaders, setSelectedHeaders] = useState<any>(null);
  const [isHeaderDialogOpen, setIsHeaderDialogOpen] = useState(false);
  const [isFetchingHeaders, setIsFetchingHeaders] = useState(false);

  // Refs that survive re-renders and API polls
  const startTimes = useRef<Record<string, number>>({});
  const startedAtRef = useRef<Record<string, number>>({});  // wall-clock start
  const endedAtRef = useRef<Record<string, number>>({});    // wall-clock end
  const prevStates = useRef<Record<string, string>>({});
  const clearedJobIds = useRef<Set<string>>(new Set());     // jobs hidden by "Clear"

  const { toast } = useToast();

  // Queue for toasts that must be fired outside of setJobs updater (avoid setState-during-render)
  const pendingToasts = useRef<Array<Parameters<typeof toast>[0]>>([]);

  const fetchJobs = async () => {
    try {
      const data = await getJobs();
      console.log("JobsDashboard API response:", data);

      setJobs((prevJobs) => {
        const nextJobs = { ...prevJobs };
        const incomingIds = new Set();

        // Convert object entries to normalized data
        Object.entries(data).forEach(([key, rawJob]: [string, any]) => {
          const id = rawJob.job_id || rawJob.id || key;
          const profile = rawJob.profile ?? "Unknown";
          incomingIds.add(id);

          const job: JobWithTimestamps = {
            ...rawJob,
            job_id: id,
            profile: profile,
          };

          // Track animation start time (for time-based fallback in monitor)
          if (job.state === "RUNNING" && !startTimes.current[job.job_id]) {
            startTimes.current[job.job_id] = Date.now();
          }

          // Track wall-clock start time (first time we see RUNNING)
          if (job.state === "RUNNING" && !startedAtRef.current[job.job_id]) {
            startedAtRef.current[job.job_id] = Date.now();
          }

          // Track wall-clock end time (first time we see STOPPED)
          if (job.state === "STOPPED" && !endedAtRef.current[job.job_id]) {
            endedAtRef.current[job.job_id] = Date.now();
            delete startTimes.current[job.job_id];
          }

          job.start_time = startTimes.current[job.job_id];
          job.started_at = startedAtRef.current[job.job_id];
          job.ended_at = endedAtRef.current[job.job_id];

          // Detect completion: RUNNING/PAUSED → STOPPED
          const prev = prevStates.current[job.job_id];
          if ((prev === "RUNNING" || prev === "PAUSED") && job.state === "STOPPED") {
            const endedAt = endedAtRef.current[job.job_id];
            const startedAt = startedAtRef.current[job.job_id];
            const elapsed = startedAt && endedAt
              ? ((endedAt - startedAt) / 1000).toFixed(1)
              : null;

            // Success Mapping: successful > 0 → COMPLETED, successful == 0 → FAILED
            const isSuccess = (job.packets_successful || 0) > 0;

            // Queue toast to fire after render (avoid setState-during-render warning)
            pendingToasts.current.push({
              title: isSuccess ? "Transfer Completed" : "Job Failed",
              variant: isSuccess ? "default" : "destructive",
              description: (
                <div className="space-y-1 mt-1">
                  <div className={`flex items-center gap-2 ${isSuccess ? 'text-success' : 'text-destructive'}`}>
                    {isSuccess ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <XCircle className="h-4 w-4 shrink-0" />}
                    <span className="font-semibold">
                      {isSuccess ? "Transfer finished with successful packets" : "Execution failed - no packets were delivered"}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground space-y-0.5 pl-6">
                    <div>Job: <span className="font-mono text-foreground">{job.job_id}</span></div>
                    <div>Profile: <span className="font-medium text-foreground">{job.profile}</span></div>
                    <div>Destination: <span className="font-mono text-foreground">{job.destination}</span></div>
                    <div>Packets: <span className="font-bold text-primary">{(job.packets_successful || 0).toLocaleString()} / {(job.packets_attempted || 0).toLocaleString()}</span></div>
                    {elapsed && <div>Duration: <span className="font-medium text-foreground">{elapsed}s</span></div>}
                  </div>
                </div>
              ) as any,
              duration: 6000,
            });
          }

          prevStates.current[job.job_id] = job.state;
          nextJobs[job.job_id] = job;
        });

        // 2. Handle jobs that disappeared from API (Persistence)
        Object.keys(nextJobs).forEach((id) => {
          if (!incomingIds.has(id)) {
            const disappearingJob = nextJobs[id];
            if (disappearingJob.state === "RUNNING" || disappearingJob.state === "PAUSED") {
              disappearingJob.state = "STOPPED";
              if (!endedAtRef.current[id]) {
                endedAtRef.current[id] = Date.now();
              }
              disappearingJob.ended_at = endedAtRef.current[id];
              prevStates.current[id] = "STOPPED";
            }
          }
        });

        return { ...nextJobs }; // Spread to ensure new reference and trigger re-render
      });
    } catch (err) {
      console.error("Failed to fetch jobs:", err);
    }
  };

  // Flush any queued toasts after each render
  useEffect(() => {
    if (pendingToasts.current.length > 0) {
      const queued = pendingToasts.current.splice(0);
      queued.forEach((opts) => toast(opts));
    }
  });

  // Fetch profiles to calculate total packets for each
  useEffect(() => {
    const loadProfileTotals = async () => {
      try {
        const profileNames = await getProfiles();
        const totals: Record<string, number> = {};

        await Promise.all(profileNames.map(async (name: string) => {
          try {
            const profile = await getProfile(name);
            // Guard: some profiles may not have a traffic array
            const total = Array.isArray(profile?.traffic)
              ? profile.traffic.reduce((acc: number, rule: any) => acc + (rule.count || 0), 0)
              : 0;
            totals[name] = total;
          } catch (e) {
            console.error(`Failed to load profile ${name}`, e);
          }
        }));

        setProfileTotals(totals);
      } catch (err) {
        console.error("Failed to load profiles", err);
      }
    };

    loadProfileTotals();
  }, []);

  useEffect(() => {
    fetchJobs();
    const interval = setInterval(fetchJobs, 1000);
    return () => clearInterval(interval);
  }, [refreshTrigger]);

  // Sort all jobs by priority
  const allSorted = Object.values(jobs)
    .map((j) => ({
      ...j,
      started_at: startedAtRef.current[j.job_id],
      ended_at: endedAtRef.current[j.job_id],
    }))
    .sort((a, b) => {
      const priority: Record<string, number> = { RUNNING: 1, PAUSED: 2, STOPPED: 3, COMPLETED: 4, FAILED: 5 };
      if (priority[a.state] !== priority[b.state]) return (priority[a.state] ?? 9) - (priority[b.state] ?? 9);
      return b.job_id.localeCompare(a.job_id);
    });

  // Filter out cleared jobs for the stopped/completed/failed list
  const activeJobs = allSorted.filter((j) => j.state === "RUNNING" || j.state === "PAUSED");
  const stoppedJobs = allSorted.filter(
    (j) => (j.state === "STOPPED" || j.state === "COMPLETED" || j.state === "FAILED") && !clearedJobIds.current.has(j.job_id)
  );

  const runningCount = activeJobs.filter((j) => j.state === "RUNNING").length;
  const pausedCount = activeJobs.filter((j) => j.state === "PAUSED").length;

  const activeJobCount = activeJobs.length;

  const completedCount = allSorted.filter(j => j.state === "COMPLETED").length;

  const terminatedCount = allSorted.filter(j => j.state === "STOPPED" || j.state === "FAILED").length;

  const totalPackets = allSorted.reduce((acc, j) => acc + (j.packets_successful || 0), 0);
  const totalAttempted = allSorted.reduce((acc, j) => acc + (j.packets_attempted || 0), 0);
  const avgDuration =
    allSorted.length > 0
      ? (allSorted.reduce((acc, j) => acc + (j.duration_sec || 0), 0) / allSorted.length).toFixed(1)
      : "0";

  const clearStopped = () => {
    // Add all currently stopped/completed/failed job IDs to the cleared set
    allSorted.forEach((j) => {
      if (j.state === "STOPPED" || j.state === "COMPLETED" || j.state === "FAILED") {
        clearedJobIds.current.add(j.job_id);
      }
    });
    // Force re-render by toggling state
    setJobs((prev) => ({ ...prev }));
    setShowHistory(false);
  };

  const handleInspectHeaders = async (jobId: string) => {
    setIsFetchingHeaders(true);
    setIsHeaderDialogOpen(true);
    try {
      const data = await getHeaders(jobId);
      setSelectedHeaders(data);
    } catch (err) {
      toast({
        title: "Failed to fetch headers",
        description: "Could not retrieve protocol statistics.",
        variant: "destructive",
      });
      setIsHeaderDialogOpen(false);
    } finally {
      setIsFetchingHeaders(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header Inspection Modal */}
      <Dialog open={isHeaderDialogOpen} onOpenChange={setIsHeaderDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Search className="h-5 w-5 text-primary" />
              Protocol Analysis & Header Inspection
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto mt-4 rounded-xl bg-muted/30 p-4 border border-border/50">
            {isFetchingHeaders ? (
              <div className="flex flex-col items-center justify-center py-12 space-y-4">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-text-secondary">Analyzing packet headers...</p>
              </div>
            ) : selectedHeaders ? (
              <pre className="text-[11px] font-mono leading-relaxed text-foreground whitespace-pre-wrap">
                {JSON.stringify(selectedHeaders, null, 2)}
              </pre>
            ) : (
              <p className="text-sm text-text-secondary text-center py-8">No analysis data available.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Stats Strip ── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="metric-card hover-scale hover-glow-primary cursor-default">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 rounded-lg bg-success/15 border border-success/25 flex items-center justify-center">
              <Activity className="h-3.5 w-3.5 text-success" />
            </div>
            <p className="text-[10px] uppercase tracking-widest text-text-secondary font-medium">Running</p>
          </div>
          <p className="text-2xl font-display font-bold text-success">{runningCount}</p>
        </div>

        <div className="metric-card hover-scale hover-glow-primary cursor-default">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 rounded-lg bg-warning/15 border border-warning/25 flex items-center justify-center">
              <Pause className="h-3.5 w-3.5 text-warning" />
            </div>
            <p className="text-[10px] uppercase tracking-widest text-text-secondary font-medium">Paused</p>
          </div>
          <p className="text-2xl font-display font-bold text-warning">{pausedCount}</p>
        </div>

        {/* Successful Completions */}
        <div className="metric-card hover-scale hover-glow-success cursor-default">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 rounded-lg bg-success/15 border border-success/25 flex items-center justify-center">
              <CheckCircle2 className="h-3.5 w-3.5 text-success" />
            </div>
            <p className="text-[10px] uppercase tracking-widest text-text-secondary font-medium">Completed</p>
          </div>
          <p className="text-2xl font-display font-bold text-success">{completedCount}</p>
        </div>

        {/* Terminated / Failed */}
        <div className="metric-card hover-scale hover-glow-destructive cursor-default">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 rounded-lg bg-destructive/15 border border-destructive/25 flex items-center justify-center">
              <XCircle className="h-3.5 w-3.5 text-destructive" />
            </div>
            <p className="text-[10px] uppercase tracking-widest text-text-secondary font-medium">Terminated</p>
          </div>
          <p className="text-2xl font-display font-bold text-destructive">{terminatedCount}</p>
        </div>

        <div className="metric-card hover-scale hover-glow-primary cursor-default">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 rounded-lg bg-primary/15 border border-primary/25 flex items-center justify-center">
              <Package className="h-3.5 w-3.5 text-primary" />
            </div>
            <p className="text-[10px] uppercase tracking-widest text-text-secondary font-medium">Total Pkts</p>
          </div>
          <p className="text-2xl font-display font-bold text-primary">{totalPackets.toLocaleString()}</p>
        </div>
      </div>

      {/* ── Live Monitor ── */}
      {activeJobs.length > 0 && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex items-center gap-2">
            <span className="live-dot" />
            <h3 className="font-display text-lg font-semibold">Live Execution</h3>
          </div>
          <ProfileProtocolMonitor
            protocols={activeJobs.map((j) => ({
              id: j.job_id,
              protocol: j.profile,
              packets_successful: j.packets_successful || 0,
              packets_attempted: j.packets_attempted || 0,
              duration_sec: j.duration_sec || 10,
              state: j.state,
              start_time: j.start_time,
            }))}
          />
        </div>
      )}

      {/* ── Active Queue ── */}
      {activeJobs.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-[10px] font-semibold text-text-secondary uppercase tracking-widest">
            Active Queue
          </h3>
          <div className="space-y-3">
            {activeJobs.map((job) => (
              <JobCard
                key={job.job_id}
                job={job}
                profileTotals={profileTotals}
                onInspectHeaders={handleInspectHeaders}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Empty State ── */}
      {allSorted.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-surface border border-border flex items-center justify-center">
            <Activity className="h-6 w-6 text-text-secondary" />
          </div>
          <p className="text-text-secondary text-sm">No jobs yet. Launch an execution to get started.</p>
        </div>
      )}

      {/* ── Execution History ── */}
      {(stoppedJobs.length > 0 || clearedJobIds.current.size > 0) && (
        <div className="space-y-4 border-t border-border/40 pt-6">
          <div className="flex justify-between items-center">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="flex items-center gap-2 text-sm font-semibold text-foreground hover:text-primary transition-colors"
            >
              {showHistory ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              Execution History
              <span className="text-xs px-2 py-0.5 rounded-full bg-primary/15 border border-primary/30 text-primary font-bold">
                {stoppedJobs.length}
              </span>
            </button>

            {/* Prominent Clear All button */}
            <button
              onClick={clearStopped}
              disabled={stoppedJobs.length === 0}
              className="
                flex items-center gap-2 px-3.5 py-1.5 rounded-xl
                text-xs font-semibold
                border border-destructive/50 text-destructive
                bg-destructive/10
                hover:bg-destructive/20 hover:border-destructive
                active:scale-95
                disabled:opacity-30 disabled:cursor-not-allowed disabled:active:scale-100
                transition-all duration-150
              "
              style={{ boxShadow: stoppedJobs.length > 0 ? "0 0 12px hsl(var(--destructive) / 0.15)" : "none" }}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Clear History
            </button>
          </div>

          {showHistory && (
            <div className="space-y-3 animate-fade-in">
              {stoppedJobs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center space-y-2 rounded-xl border border-dashed border-border">
                  <CheckCircle2 className="h-6 w-6 text-success/60" />
                  <p className="text-sm text-text-secondary">History cleared</p>
                </div>
              ) : (
                stoppedJobs.map((job) => (
                  <JobCard
                    key={job.job_id}
                    job={job}
                    profileTotals={profileTotals}
                    onInspectHeaders={handleInspectHeaders}
                  />
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Reliability Badge ── */
function ReliabilityBadge({ score }: { score: number }) {
  let color = "bg-success text-success-foreground border-success/30";
  let label = "Excellent";

  if (score < 50) {
    color = "bg-destructive text-destructive-foreground border-destructive/30";
    label = "Unreliable";
  } else if (score < 80) {
    color = "bg-orange-500 text-white border-orange-600/30";
    label = "Degraded";
  } else if (score < 95) {
    color = "bg-warning text-warning-foreground border-warning/30";
    label = "Stable";
  }

  return (
    <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-bold border uppercase tracking-tighter ${color}`}>
      {score}% {label}
    </span>
  );
}

/* ── Job Card ── */
function JobCard({
  job,
  profileTotals,
  onInspectHeaders
}: {
  job: JobWithTimestamps,
  profileTotals: Record<string, number>,
  onInspectHeaders: (jobId: string) => void
}) {
  const isRunning = job.state === "RUNNING";
  const isPaused = job.state === "PAUSED";
  const isStopped = job.state === "STOPPED" || job.state === "COMPLETED" || job.state === "FAILED";

  // Use backend state directly
  const isFailed = job.state === "FAILED";
  const isCompleted = job.state === "COMPLETED";

  const profileName = job.profile;
  const totalExpected = profileTotals[profileName || ""] || 0;

  // 1) Transfer Progress Bar: packets_attempted / total_expected. Force 100% if STOPPED.
  const progress = isStopped
    ? 1
    : totalExpected > 0
      ? Math.min((job.packets_attempted || 0) / totalExpected, 1)
      : 0;

  const elapsed = job.duration_sec ? job.duration_sec.toFixed(1) : (
    job.started_at && job.ended_at
      ? ((job.ended_at - job.started_at) / 1000).toFixed(1)
      : job.started_at && isRunning
        ? ((Date.now() - job.started_at) / 1000).toFixed(1)
        : null
  );
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleControl = async (action: "pause" | "resume" | "stop") => {
    setIsLoading(true);
    try {
      if (action === "pause") await pauseJob(job.job_id);
      if (action === "resume") await resumeJob(job.job_id);
      if (action === "stop") await stopJob(job.job_id);

      toast({
        title: `Job ${action === "stop" ? "Stopped" : action + "d"}`,
        description: `Job ${job.job_id} has been ${action === "stop" ? "stopped" : action + "d"}.`,
      });
    } catch (err) {
      toast({
        title: "Action Failed",
        description: "Failed to update job state. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Conditions for PCAP download button - Aligning with backend status
  const isPcapReady = isStopped;
  const hasPcap = job.metrics?.pcap_file;

  return (
    <div
      className={`rounded-2xl border p-5 transition-all duration-300 hover-scale ${isRunning
        ? "border-success/30 bg-success/5 hover:bg-success/10 hover:shadow-[0_0_20px_-5px_hsl(var(--success)/0.3)]"
        : isPaused
          ? "border-warning/30 bg-warning/5 hover:bg-warning/10"
          : isFailed
            ? "border-destructive/30 bg-destructive/5 hover:bg-destructive/10"
            : isCompleted
              ? "border-success/30 bg-success/5 hover:bg-success/10"
              : "border-border bg-surface/60 hover:bg-surface-elevated hover:border-border/80"
        }`}
      style={{
        borderLeft: isRunning
          ? "3px solid hsl(var(--success))"
          : isPaused
            ? "3px solid hsl(var(--warning))"
            : isFailed
              ? "3px solid hsl(var(--destructive))"
              : isCompleted
                ? "3px solid hsl(var(--success))"
                : "3px solid hsl(var(--muted-foreground)/0.3)",
      }}
    >
      {/* Top row: Job ID + State badge */}
      <div className="flex justify-between items-start mb-4">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-text-secondary mb-1">Job ID</p>
          <p className="text-sm font-mono text-foreground">{job.job_id}</p>
        </div>

        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${isRunning
          ? "bg-success/15 text-success border border-success/30"
          : isPaused
            ? "bg-warning/15 text-warning border border-warning/30"
            : isFailed
              ? "bg-destructive/15 text-destructive border border-destructive/30"
              : "bg-success/10 text-success border border-success/25"
          }`}>
          {isRunning && <span className="live-dot w-1.5 h-1.5" />}
          {isRunning && <span className="live-dot w-1.5 h-1.5" />}
          {isStopped ? (
            isFailed ? (
              <span className="flex items-center gap-1">
                <XCircle className="h-3 w-3" />
                FAILED
              </span>
            ) : isCompleted ? (
              <span className="flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" />
                COMPLETED
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <Square className="h-3 w-3" />
                STOPPED
              </span>
            )
          ) : job.state}
        </div>
      </div>

      {/* Performance & Reliability Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 p-4 rounded-xl bg-background/40 border border-border/20">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-text-secondary mb-1">Delivery</p>
          <div className="flex items-center gap-2">
            <p className={`text-lg font-display font-bold ${(job.delivery_percent ?? 0) < 100 ? "text-warning" : "text-success"
              }`}>
              {job.delivery_percent ?? 0}%
            </p>
            <ReliabilityBadge score={job.reliability_score ?? 0} />
          </div>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-widest text-text-secondary mb-1">Latency</p>
          <div className="text-lg font-display font-bold text-foreground">
            {job.avg_latency_ms === 0
              ? <span className="text-[10px] text-text-secondary leading-tight block">No latency data</span>
              : <>{job.avg_latency_ms ?? 0}<span className="text-[10px] ml-0.5 text-text-secondary">ms</span></>}
          </div>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-widest text-text-secondary mb-1">Throughput</p>
          <p className={`text-lg font-display font-bold ${(job.throughput_mbps ?? 0) > 0 ? "text-success" : "text-text-secondary"
            }`}>
            {(job.throughput_mbps ?? 0).toFixed(3)}<span className="text-[10px] ml-0.5 font-normal">Mbps</span>
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-widest text-text-secondary mb-1">Reliability</p>
          <p className={`text-lg font-display font-bold ${(job.reliability_score ?? 0) < 95 ? "text-destructive" : "text-foreground"
            }`}>
            {job.reliability_score ?? 0}%
          </p>
        </div>

        {/* Error & Retry Counters */}
        <div className="md:col-span-4 border-t border-border/10 pt-3 mt-1 grid grid-cols-5 gap-2">
          <div className="flex flex-col items-center justify-center p-1 rounded-lg bg-surface/40 border border-border/10">
            <span className="text-[8px] uppercase tracking-wider text-text-secondary">Loss</span>
            <span className={`text-[10px] font-mono font-bold ${(job.packet_loss ?? 0) > 0 ? "text-destructive" : "text-text-secondary"}`}>
              {job.packet_loss ?? 0}%
            </span>
          </div>
          <div className="flex flex-col items-center justify-center p-1 rounded-lg bg-surface/40 border border-border/10">
            <span className="text-[8px] uppercase tracking-wider text-text-secondary">Retries</span>
            <span className={`text-[10px] font-mono font-bold ${(job.retransmissions ?? 0) > 0 ? "text-warning" : "text-text-secondary"}`}>
              {job.retransmissions ?? 0}
            </span>
          </div>
          <div className="flex flex-col items-center justify-center p-1 rounded-lg bg-surface/40 border border-border/10">
            <span className="text-[8px] uppercase tracking-wider text-text-secondary">Duplicates</span>
            <span className={`text-[10px] font-mono font-bold ${(job.duplicates ?? 0) > 0 ? "text-warning" : "text-text-secondary"}`}>
              {job.duplicates ?? 0}
            </span>
          </div>
          <div className="flex flex-col items-center justify-center p-1 rounded-lg bg-surface/40 border border-border/10">
            <span className="text-[8px] uppercase tracking-wider text-text-secondary">Corrupted</span>
            <span className={`text-[10px] font-mono font-bold ${(job.corrupted ?? 0) > 0 ? "text-destructive" : "text-text-secondary"}`}>
              {job.corrupted ?? 0}
            </span>
          </div>
          <div className="flex flex-col items-center justify-center p-1 rounded-lg bg-surface/40 border border-border/10">
            <span className="text-[8px] uppercase tracking-wider text-text-secondary">Errors</span>
            <span className={`text-[10px] font-mono font-bold ${(job.errors ?? 0) > 0 ? "text-destructive" : "text-text-secondary"}`}>
              {job.errors ?? 0}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-4">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-text-secondary mb-1">Profile</p>
          <p className="text-sm font-semibold truncate" title={job.profile}>{job.profile}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-widest text-text-secondary mb-1">Destination</p>
          <p className="text-sm font-mono truncate" title={job.destination}>{job.destination}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-widest text-text-secondary mb-1">Packets</p>
          <p className="text-sm font-display font-bold text-success">{(job.packets_successful || 0).toLocaleString()}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-widest text-text-secondary mb-1">Attempted</p>
          <p className="text-sm font-display font-bold text-text-secondary">{(job.packets_attempted || 0).toLocaleString()}</p>
        </div>
      </div>

      {/* Timestamps */}
      <div className="flex flex-wrap gap-x-6 gap-y-1 mb-4 text-[11px] text-text-secondary">
        {job.started_at && (
          <span className="flex items-center gap-1.5">
            <Clock className="h-3 w-3 text-primary/60" />
            <span>Started: <span className="text-foreground font-mono">{formatTime(job.started_at)}</span></span>
          </span>
        )}
        {job.ended_at && isStopped && (
          <span className="flex items-center gap-1.5">
            {isFailed ? <Clock className="h-3 w-3 text-muted-foreground" /> : <CheckCircle2 className="h-3 w-3 text-success/60" />}
            <span>Ended: <span className="text-foreground font-mono">{formatTime(job.ended_at)}</span></span>
          </span>
        )}
        {elapsed && (
          <span className="flex items-center gap-1.5">
            <Clock className="h-3 w-3 text-info/60" />
            <span>Duration: <span className="text-foreground font-mono">{elapsed}s</span></span>
          </span>
        )}
      </div>

      {/* Progress bar */}
      <div className="space-y-1 mb-4">
        <div className="flex justify-between text-[10px] text-text-secondary">
          <span>Transfer Progress</span>
          <span className={isCompleted ? "text-success font-medium" : isFailed ? "text-destructive font-medium" : ""}>
            {`${Math.round(progress * 100)}%`}
          </span>
        </div>
        <div className="w-full h-1.5 bg-background rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${progress * 100}%`,
              background: isCompleted
                ? "hsl(var(--success))"
                : isFailed
                  ? "hsl(var(--destructive))"
                  : isStopped
                    ? "hsl(var(--muted-foreground))"
                    : isRunning
                      ? "linear-gradient(90deg, hsl(var(--primary)), hsl(var(--accent)))"
                      : "hsl(var(--warning))",
              boxShadow: isCompleted
                ? "0 0 8px hsl(var(--success) / 0.5)"
                : isFailed
                  ? "0 0 8px hsl(var(--destructive) / 0.5)"
                  : isRunning
                    ? "0 0 8px hsl(var(--primary) / 0.5)"
                    : "none",
            }}
          />
        </div>
      </div>

      {/* Active Job Controls */}
      {!isStopped && (
        <div className="flex gap-2 justify-end pt-2 border-t border-border/10">
          {isRunning ? (
            <button
              onClick={() => handleControl("pause")}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-warning/10 text-warning hover:bg-warning/20 border border-warning/20 transition-all text-xs font-medium hover-scale active:scale-95 disabled:opacity-50"
            >
              <Pause className="h-3.5 w-3.5" />
              Pause
            </button>
          ) : (
            <button
              onClick={() => handleControl("resume")}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-success/10 text-success hover:bg-success/20 border border-success/20 transition-all text-xs font-medium hover-scale active:scale-95 disabled:opacity-50"
            >
              <Play className="h-3.5 w-3.5" />
              Resume
            </button>
          )}

          <button
            onClick={() => handleControl("stop")}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 border border-destructive/20 transition-all text-xs font-medium hover-scale active:scale-95 disabled:opacity-50"
          >
            <Square className="h-3.5 w-3.5 fill-current" />
            Stop
          </button>
        </div>
      )}

      {/* Completion/Failure message & PCAP Download */}
      {(isCompleted || isFailed) && (
        <div className="flex items-center justify-between mt-3">
          <p className={`text-[11px] font-medium flex items-center gap-1.5 ${isFailed ? "text-destructive" : "text-success"}`}>
            {isFailed ? <AlertCircle className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            {isFailed ? "Execution failed - no packets delivered" : "Transfer completed successfully"}
          </p>

          {isPcapReady && hasPcap && (
            <div className="flex gap-2">
              <button
                onClick={() => onInspectHeaders(job.job_id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary/10 text-secondary-foreground hover:bg-secondary/20 border border-secondary/20 transition-all text-xs font-medium hover-scale active:scale-95"
              >
                <Search className="h-3.5 w-3.5" />
                Inspect Headers
              </button>
              <button
                onClick={() => window.open(`http://localhost:8000/executions/${job.job_id}/pcap`)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 transition-all text-xs font-medium hover-scale active:scale-95"
              >
                <Download className="h-3.5 w-3.5" />
                Download PCAP
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
