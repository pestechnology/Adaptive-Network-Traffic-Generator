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
export type JobState = "RUNNING" | "PAUSED" | "STOPPED" | "COMPLETED" | "FAILED";

export interface Job {
  job_id: string;
  profile_name: string;
  destination: string;
  state: JobState;

  packets_successful: number;
  packets_attempted: number;
  packet_loss: number;
  retransmissions: number;
  errors: number;
  delivery_percent: number;
  duplicates: number;
  out_of_order: number;
  corrupted: number;
  reliability_score: number;
  avg_latency_ms: number;
  throughput_mbps: number;
  duration_sec: number;

  pcap_path?: string;
  metrics?: {
    pcap_path?: string;
    pcap_file?: string;
  };
}

export interface ExecuteRequest {
  profile_name: string;
  destination: string;
  enable_capture?: boolean;
}

export interface ExecuteResponse {
  job_id: string;
  status?: string;
}

export interface TrafficItem {
  protocol: "ICMP" | "TCP" | "UDP" | "HTTP" | "HTTPS" | "SSH";
  count: number;
  duration_sec?: number;
  packets_per_second?: number;
  packet_size?: number;
  port?: number;
}

export interface Profile {
  name: string;
  traffic: TrafficItem[];
}

export type TriggerType = "once" | "interval";

export interface ScheduledJob {
  scheduled_id: string;
  profile_name: string;
  destination: string;
  type: TriggerType;
  interval_seconds: number | null;
  run_time: string | null;
  created_at: string;
  next_run_time: string | null;
  status: string;
  last_execution_job_id: string | null;
  error: string | null;
}

export interface ScheduleOnceRequest {
  profile_name: string;
  destination: string;
  run_time: string;
}

export interface ScheduleIntervalRequest {
  profile_name: string;
  destination: string;
  seconds: number;
}

// Level-2
export interface Level2Request {
  destination: string;
  protocol: "tcp" | "udp" | "icmp";
  packet_size: number;
  duration: number;
  packets_per_second: number;
}

export interface Level2Result {
  tx_packets: number;
  delivered: number;
  lost: number;
  delivery_pct: number;
  avg_rtt_ms: number;
  min_rtt_ms: number;
  max_rtt_ms: number;
  jitter_ms: number;
  throughput_mbps: number;
  delivery_entropy: number;
  rtt_buckets?: Record<string, number>;
}

// RFC 2544
export interface RFC2544Request {
  destination: string;
  protocol: string;
  frame_sizes: number[];
  trial_duration: number;
  max_rate_mbps: number;
  fast_mode: boolean;
}

export interface RFC2544FrameResult {
  frame_size: number;
  max_zero_loss_mbps: number;
  avg_latency_ms: number;
  min_latency_ms: number;
  max_latency_ms: number;
  frame_loss_points?: Array<{ load_pct: number; loss_pct: number }>;
}

export interface RFC2544Result {
  id: string;
  timestamp: string;
  destination: string;
  protocol: string;
  results: RFC2544FrameResult[];
}

// Malicious
export interface AttackInfo {
  type: string;
  name: string;
  description: string;
  icon?: string;
}

export interface ApprovalResponse {
  token: string;
  expires_at: string;
}

export interface MaliciousRunRequest {
  attack_type: string;
  target: string;
  duration: number;
  intensity: string;
  token: string;
}

export interface MaliciousRunResult {
  job_id: string;
  attack_type: string;
  target: string;
  duration: number;
  intensity: string;
  timestamp: string;
}

// Header Inspection
export interface PacketHeader {
  index: number;
  src_ip?: string;
  dst_ip?: string;
  protocol?: string;
  src_port?: number;
  dst_port?: number;
  length?: number;
  ttl?: number;
  flags?: string;
  seq?: number;
  ack?: number;
  [key: string]: unknown;
}