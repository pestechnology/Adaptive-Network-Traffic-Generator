import { Pause, Play, Square, Loader2, Server, Activity, Search, Download, Clock, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { Job } from '@/types/traffic';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { pauseJob, resumeJob, stopJob } from '@/lib/api';

interface JobCardProps {
  job: Job;
  profileTotals: Record<string, number>;
  onInspectHeaders: (jobId: string) => void;
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function ReliabilityBadge({ score }: { score: number }) {
  let color = 'bg-success text-success-foreground border-success/30';
  let label = 'Excellent';

  if (score < 50) {
    color = 'bg-destructive text-destructive-foreground border-destructive/30';
    label = 'Unreliable';
  } else if (score < 80) {
    color = 'bg-orange-500 text-white border-orange-600/30';
    label = 'Degraded';
  } else if (score < 95) {
    color = 'bg-warning text-warning-foreground border-warning/30';
    label = 'Stable';
  }

  return (
    <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-bold border uppercase tracking-tighter ${color}`}>
      {score}% {label}
    </span>
  );
}

export function JobCard({ job, profileTotals, onInspectHeaders }: JobCardProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const isRunning = job.state === 'RUNNING';
  const isPaused = job.state === 'PAUSED';
  const isStopped = job.state === 'STOPPED' || job.state === 'COMPLETED' || job.state === 'FAILED';
  const isFailed = job.state === 'FAILED' || (isStopped && (job.packets_successful ?? 0) === 0);
  const isCompleted = job.state === 'COMPLETED' || (isStopped && (job.packets_successful ?? 0) > 0);

  const profileName = job.profile;
  const totalExpected = profileTotals[profileName ?? ''] ?? 0;

  const progress = isStopped
    ? 1
    : totalExpected > 0
    ? Math.min((job.packets_attempted ?? 0) / totalExpected, 1)
    : 0;

  const hasPcap = !!(job.pcap_path ?? job.metrics?.pcap_path ?? job.metrics?.pcap_file);

  const handleControl = async (action: 'pause' | 'resume' | 'stop') => {
    setIsLoading(true);
    try {
      if (action === 'pause') await pauseJob(job.job_id);
      if (action === 'resume') await resumeJob(job.job_id);
      if (action === 'stop') await stopJob(job.job_id);
      toast({
        title: `Job ${action === 'stop' ? 'stopped' : action + 'd'}`,
        description: `Job ${job.job_id} has been ${action === 'stop' ? 'stopped' : action + 'd'}.`,
      });
    } catch {
      toast({
        title: 'Action failed',
        description: 'Could not update job state. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className={`rounded-2xl border p-5 transition-all duration-300 ${
        isRunning
          ? 'border-success/30 bg-success/5 hover:bg-success/10'
          : isPaused
          ? 'border-warning/30 bg-warning/5 hover:bg-warning/10'
          : isFailed
          ? 'border-destructive/30 bg-destructive/5 hover:bg-destructive/10'
          : isCompleted
          ? 'border-success/30 bg-success/5 hover:bg-success/10'
          : 'border-border bg-surface/60'
      }`}
      style={{
        borderLeft: isRunning
          ? '3px solid hsl(var(--success))'
          : isPaused
          ? '3px solid hsl(var(--warning))'
          : isFailed
          ? '3px solid hsl(var(--destructive))'
          : isCompleted
          ? '3px solid hsl(var(--success))'
          : '3px solid hsl(var(--muted-foreground)/0.3)',
      }}
    >
      {/* Top row */}
      <div className="flex justify-between items-start mb-4">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-text-secondary mb-1">Job ID</p>
          <p className="text-sm font-mono text-foreground">{job.job_id}</p>
        </div>
        <div
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
            isRunning
              ? 'bg-success/15 text-success border border-success/30'
              : isPaused
              ? 'bg-warning/15 text-warning border border-warning/30'
              : isFailed
              ? 'bg-destructive/15 text-destructive border border-destructive/30'
              : 'bg-success/10 text-success border border-success/25'
          }`}
        >
          {isRunning && <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />}
          {isStopped ? (
            isFailed ? (
              <span className="flex items-center gap-1"><XCircle className="h-3 w-3" />FAILED</span>
            ) : (
              <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3" />COMPLETED</span>
            )
          ) : (
            job.state
          )}
        </div>
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 p-4 rounded-xl bg-background/40 border border-border/20">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-text-secondary mb-1">Delivery</p>
          <div className="flex items-center gap-2">
            <p className={`text-lg font-bold ${(job.delivery_percent ?? 0) < 100 ? 'text-warning' : 'text-success'}`}>
              {job.delivery_percent ?? 0}%
            </p>
            <ReliabilityBadge score={job.reliability_score ?? 0} />
          </div>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-widest text-text-secondary mb-1">Latency</p>
          <p className="text-lg font-bold text-foreground">
            {job.avg_latency_ms ?? 0}
            <span className="text-[10px] ml-0.5 text-text-secondary">ms</span>
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-widest text-text-secondary mb-1">Throughput</p>
          <p className={`text-lg font-bold ${(job.throughput_mbps ?? 0) > 0 ? 'text-success' : 'text-text-secondary'}`}>
            {(job.throughput_mbps ?? 0).toFixed(3)}
            <span className="text-[10px] ml-0.5 font-normal">Mbps</span>
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-widest text-text-secondary mb-1">Reliability</p>
          <p className={`text-lg font-bold ${(job.reliability_score ?? 0) < 95 ? 'text-destructive' : 'text-foreground'}`}>
            {job.reliability_score ?? 0}%
          </p>
        </div>

        <div className="md:col-span-4 border-t border-border/10 pt-3 mt-1 grid grid-cols-5 gap-2">
          {[
            { label: 'Loss', value: job.packet_loss ?? 0, warn: (v: number) => v > 0 },
            { label: 'Retries', value: job.retransmissions ?? 0, warn: (v: number) => v > 0 },
            { label: 'Dupes', value: job.duplicates ?? 0, warn: (v: number) => v > 0 },
            { label: 'Corrupt', value: job.corrupted ?? 0, warn: (v: number) => v > 0 },
            { label: 'Errors', value: job.errors ?? 0, warn: (v: number) => v > 0 },
          ].map(({ label, value, warn }) => (
            <div key={label} className="flex flex-col items-center justify-center p-1 rounded-lg bg-surface/40 border border-border/10">
              <span className="text-[8px] uppercase tracking-wider text-text-secondary">{label}</span>
              <span className={`text-[10px] font-mono font-bold ${warn(value) ? 'text-destructive' : 'text-text-secondary'}`}>
                {value}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Info row */}
      <div className="grid grid-cols-4 gap-4 mb-4">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-text-secondary mb-1">Profile</p>
          <p className="text-sm font-semibold truncate">{job.profile}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-widest text-text-secondary mb-1">Destination</p>
          <p className="text-sm font-mono truncate">{job.destination}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-widest text-text-secondary mb-1">Packets</p>
          <p className="text-sm font-bold text-success">{(job.packets_successful ?? 0).toLocaleString()}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-widest text-text-secondary mb-1">Attempted</p>
          <p className="text-sm font-bold text-text-secondary">{(job.packets_attempted ?? 0).toLocaleString()}</p>
        </div>
      </div>

      {/* Duration */}
      {job.duration_sec != null && job.duration_sec > 0 && (
        <div className="flex items-center gap-1.5 mb-4 text-[11px] text-text-secondary">
          <Clock className="h-3 w-3 text-primary/60" />
          <span>Duration: <span className="text-foreground font-mono">{job.duration_sec.toFixed(1)}s</span></span>
        </div>
      )}

      {/* Progress bar */}
      <div className="space-y-1 mb-4">
        <div className="flex justify-between text-[10px] text-text-secondary">
          <span>Transfer progress</span>
          <span className={isCompleted ? 'text-success font-medium' : isFailed ? 'text-destructive font-medium' : ''}>
            {Math.round(progress * 100)}%
          </span>
        </div>
        <div className="w-full h-1.5 bg-background rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${progress * 100}%`,
              background: isCompleted
                ? 'hsl(var(--success))'
                : isFailed
                ? 'hsl(var(--destructive))'
                : isRunning
                ? 'linear-gradient(90deg, hsl(var(--primary)), hsl(var(--accent)))'
                : 'hsl(var(--warning))',
            }}
          />
        </div>
      </div>

      {/* Controls */}
      {!isStopped && (
        <div className="flex gap-2 justify-end pt-2 border-t border-border/10">
          {isRunning ? (
            <button
              onClick={() => handleControl('pause')}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-warning/10 text-warning hover:bg-warning/20 border border-warning/20 text-xs font-medium disabled:opacity-50"
            >
              <Pause className="h-3.5 w-3.5" />
              Pause
            </button>
          ) : (
            <button
              onClick={() => handleControl('resume')}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-success/10 text-success hover:bg-success/20 border border-success/20 text-xs font-medium disabled:opacity-50"
            >
              <Play className="h-3.5 w-3.5" />
              Resume
            </button>
          )}
          <button
            onClick={() => handleControl('stop')}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 border border-destructive/20 text-xs font-medium disabled:opacity-50"
          >
            {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Square className="h-3.5 w-3.5 fill-current" />}
            Stop
          </button>
        </div>
      )}

      {/* Completed / failed footer */}
      {isStopped && (
        <div className="flex items-center justify-between mt-3">
          <p className={`text-[11px] font-medium flex items-center gap-1.5 ${isFailed ? 'text-destructive' : 'text-success'}`}>
            {isFailed
              ? <><AlertCircle className="h-3.5 w-3.5" />Execution failed</>
              : <><CheckCircle2 className="h-3.5 w-3.5" />Transfer completed</>
            }
          </p>
          {hasPcap && (
            <div className="flex gap-2">
              <button
                onClick={() => onInspectHeaders(job.job_id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary/10 text-secondary-foreground hover:bg-secondary/20 border border-secondary/20 text-xs font-medium"
              >
                <Search className="h-3.5 w-3.5" />
                Inspect headers
              </button>
              <button
                onClick={() => window.open(`http://localhost:8000/executions/${job.job_id}/pcap`)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 text-xs font-medium"
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