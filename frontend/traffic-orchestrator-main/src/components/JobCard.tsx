/*
 * Authors:
 *   Anikait Nair - anikaitm752@gmail.com
 *   Dr. Swetha P - swethap@pes.edu
 *   Dr. Prasad B Honnavalli - prasadbh@pes.edu
 *
 * Contributors:
 *   ISFCR - office.isfcr@pes.edu
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * SPDX-License-Identifier: Apache-2.0
 */
/**
 * Copyright 2026 PES University
 * SPDX-License-Identifier: Apache-2.0
 *
 * JobCard.tsx
 * ===========
 * Displays one ATG job. Live-polls while active, stops gracefully on terminal state.
 *
 * Field contract — must match execution_manager._build_snapshot() exactly:
 *   job.job_id              string
 *   job.profile_name        string   ← backend key fixed from "profile" to "profile_name"
 *   job.destination         string
 *   job.state               JobState
 *   job.packets_successful  number
 *   job.packets_attempted   number
 *   job.delivery_percent    number
 *   job.reliability_score   number
 *   job.throughput_mbps     number
 *   job.avg_latency_ms      number
 *   job.packet_loss         number
 *   job.out_of_order        number
 *   job.duplicates          number
 *   job.corrupted           number
 *   job.start_time          string | number | null
 *   job.end_time            string | number | null
 *   job.pcap_path           string | null
 */

import { useQuery } from "@tanstack/react-query";
import { getJob, stopJob, pauseJob, resumeJob, getPcapDownloadUrl } from "@/lib/api";
import type { Job, JobState } from "@/lib/api";

// ── Constants ─────────────────────────────────────────────────────────────────

const TERMINAL: JobState[] = ["COMPLETED", "FAILED", "STOPPED"];
const POLL_MS = 3_000;

// ── Sub-components ────────────────────────────────────────────────────────────

const STATE_CLS: Record<JobState, string> = {
  RUNNING:   "bg-cyan-500/10 text-cyan-400 border border-cyan-500/30",
  PAUSED:    "bg-amber-500/10 text-amber-400 border border-amber-500/30",
  STOPPING:  "bg-orange-500/10 text-orange-400 border border-orange-500/30",
  STOPPED:   "bg-gray-500/10 text-gray-400 border border-gray-500/30",
  COMPLETED: "bg-green-500/10 text-green-400 border border-green-500/30",
  FAILED:    "bg-red-500/10 text-red-400 border border-red-500/30",
};

function StateBadge({ state }: { state: JobState }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full
        text-xs font-medium ${STATE_CLS[state] ?? STATE_CLS.STOPPED}`}
    >
      {state === "RUNNING" && (
        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
      )}
      {state}
    </span>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="text-sm font-medium tabular-nums text-cyan-400">{value}</span>
    </div>
  );
}

function fmt(n: unknown, decimals = 2): string {
  return Number(n ?? 0).toFixed(decimals);
}

// ── JobCard ───────────────────────────────────────────────────────────────────

interface Props {
  job: Job;
  onStopped?: (jobId: string) => void;
}

export function JobCard({ job: initialJob, onStopped }: Props) {
  const isTerminal = TERMINAL.includes(initialJob.state);

  const { data: liveJob } = useQuery({
    queryKey: ["job", initialJob.job_id],
    queryFn:  () => getJob(initialJob.job_id),

    // Stop polling when job is null (404) or has reached a terminal state
    refetchInterval: (query) => {
      const d = query.state.data;
      if (d === null) return false;
      if (!d) return 3000;
      if (TERMINAL.includes(d.state)) return false;
      if (d.state === "PAUSED") return 5000;
      return 3000;
    },

    enabled:         !isTerminal,
    placeholderData: initialJob,

    // getJob() returns null on 404 — never retry 404s
    retry: (count, err) => {
      if ((err as Error)?.message?.includes("404")) return false;
      return count < 2;
    },
  });

  const job: Job = liveJob === null
    ? { ...initialJob, state: "Expired" as any }
    : (liveJob ?? initialJob);

  const canStop   = !TERMINAL.includes(job.state) && job.state !== "STOPPING";
  const canPause  = job.state === "RUNNING";
  const canResume = job.state === "PAUSED";

  return (
    <div className="rounded-xl border border-white/[0.06] bg-[#111118] p-4
      hover:-translate-y-0.5 transition-transform duration-150">

      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-gray-400">
            {job.job_id.slice(0, 8)}
          </span>
          <StateBadge state={job.state} />
        </div>
        {/* profile_name — reads the corrected backend key */}
        <span className="text-xs text-gray-500">{job.profile_name}</span>
      </div>

      {/* Destination */}
      <p className="text-sm font-mono text-gray-300 mb-3">→ {job.destination}</p>

      {/* 6 core metric cells */}
      <div className="grid grid-cols-3 gap-3 mb-3">
        <Metric label="Delivery"    value={`${fmt(job.delivery_percent)}%`} />
        <Metric label="Throughput"  value={`${fmt(job.throughput_mbps, 3)} Mbps`} />
        <Metric label="Latency"     value={`${fmt(job.avg_latency_ms, 1)} ms`} />
        <Metric label="Packets OK"  value={Number(job.packets_successful ?? 0).toLocaleString()} />
        <Metric label="Loss"        value={(job.packets_attempted ?? 0) > 0 ? `${fmt(job.packet_loss)}%` : "—"} />
        <Metric label="Reliability" value={`${fmt(job.reliability_score)}%`} />
      </div>

      {/* Packet counter summary */}
      <p className="text-xs text-gray-600 mb-3">
        {Number(job.packets_successful ?? 0).toLocaleString()} /{" "}
        {Number(job.packets_attempted ?? 0).toLocaleString()} packets delivered
      </p>

      {/* Anomaly flags — only shown when non-zero */}
      {((job.out_of_order ?? 0) > 0 ||
        (job.duplicates   ?? 0) > 0 ||
        (job.corrupted    ?? 0) > 0) && (
        <div className="flex gap-4 mb-3 text-xs text-amber-400">
          {(job.out_of_order ?? 0) > 0 && <span>OOO: {job.out_of_order}</span>}
          {(job.duplicates   ?? 0) > 0 && <span>DUP: {job.duplicates}</span>}
          {(job.corrupted    ?? 0) > 0 && <span>CRP: {job.corrupted}</span>}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2 flex-wrap">
        {canStop && (
          <button
            onClick={async () => { await stopJob(job.job_id); onStopped?.(job.job_id); }}
            className="px-3 py-1 text-xs rounded-md border border-red-500/30
              text-red-400 hover:bg-red-500/10 transition-colors"
          >
            Stop
          </button>
        )}
        {canPause && (
          <button
            onClick={() => pauseJob(job.job_id)}
            className="px-3 py-1 text-xs rounded-md border border-amber-500/30
              text-amber-400 hover:bg-amber-500/10 transition-colors"
          >
            Pause
          </button>
        )}
        {canResume && (
          <button
            onClick={() => resumeJob(job.job_id)}
            className="px-3 py-1 text-xs rounded-md border border-cyan-500/30
              text-cyan-400 hover:bg-cyan-500/10 transition-colors"
          >
            Resume
          </button>
        )}
        {job.pcap_path && (
          <a
            href={getPcapDownloadUrl(job.job_id)}
            download
            className="px-3 py-1 text-xs rounded-md border border-white/10
              text-gray-400 hover:bg-white/5 transition-colors"
          >
            PCAP
          </a>
        )}
      </div>

      {/* Timestamps */}
      {job.start_time && (
        <p className="text-xs text-gray-600 mt-3">
          Started{" "}
          {new Date(
            typeof job.start_time === "number"
              ? job.start_time * 1000
              : job.start_time
          ).toLocaleString()}
          {job.end_time && (
            <>
              {" · Ended "}
              {new Date(
                typeof job.end_time === "number"
                  ? job.end_time * 1000
                  : job.end_time
              ).toLocaleString()}
            </>
          )}
        </p>
      )}
    </div>
  );
}

export default JobCard;