import axios from "axios";
import { ExecuteRequest, ExecuteResponse, Job } from "@/types/traffic";

const API_BASE = "http://127.0.0.1:8000";

// ── Profiles ──────────────────────────────────────────────────────────────────
export async function createProfile(data: unknown) {
  return axios.post(`${API_BASE}/profiles`, data);
}

export async function getProfiles(): Promise<string[]> {
  const res = await axios.get(`${API_BASE}/profiles`);
  return res.data.profiles;
}

export async function getProfile(profileName: string) {
  const res = await axios.get(`${API_BASE}/profiles/${profileName}`);
  return res.data.profile ?? res.data;
}

export async function updateProfile(name: string, data: unknown) {
  return axios.put(`${API_BASE}/profiles/${name}`, data);
}

export async function deleteProfile(name: string) {
  return axios.delete(`${API_BASE}/profiles/${name}`);
}

// ── Execute ───────────────────────────────────────────────────────────────────
export async function executeTraffic(data: ExecuteRequest): Promise<ExecuteResponse> {
  const res = await axios.post(`${API_BASE}/execute`, data);
  return res.data;
}

export async function pauseJob(jobId: string) {
  await axios.post(`${API_BASE}/execute/pause/${jobId}`);
}

export async function resumeJob(jobId: string) {
  await axios.post(`${API_BASE}/execute/resume/${jobId}`);
}

export async function stopJob(jobId: string) {
  await axios.post(`${API_BASE}/execute/stop/${jobId}`);
}

// ── Jobs ──────────────────────────────────────────────────────────────────────
export async function getJobs(): Promise<Record<string, Job>> {
  const res = await axios.get(`${API_BASE}/jobs`);
  return res.data;
}

export async function getJob(jobId: string): Promise<Job> {
  const res = await axios.get(`${API_BASE}/jobs/${jobId}`);
  return res.data;
}

// ── Executions ────────────────────────────────────────────────────────────────
export async function getExecutions() {
  const res = await axios.get(`${API_BASE}/executions`);
  return res.data;
}

export async function getExecution(jobId: string) {
  const res = await axios.get(`${API_BASE}/executions/${jobId}`);
  return res.data;
}

export async function getHeaders(jobId: string) {
  const res = await axios.get(`${API_BASE}/executions/${jobId}/headers`);
  return res.data;
}

export function getPcapUrl(jobId: string) {
  return `${API_BASE}/executions/${jobId}/pcap`;
}

// ── Level-2 ───────────────────────────────────────────────────────────────────
// Backend field: destination_ip (NOT destination)
// Backend field: duration_seconds (NOT duration)
export async function runLevel2(data: {
  destination: string;
  protocol: string;
  packet_size: number;
  duration: number;
  packets_per_second: number;
}) {
  const res = await axios.post(`${API_BASE}/level2/run`, {
    destination_ip:     data.destination,
    protocol:           data.protocol,
    packet_size:        data.packet_size,
    duration_seconds:   data.duration,
    packets_per_second: data.packets_per_second,
  });
  return res.data;
}

// ── RFC 2544 ──────────────────────────────────────────────────────────────────
// Backend field: destination_ip (NOT destination)
// Backend returns: { results: RFC2544Result[] }
// getRFC2544Results unwraps to RFC2544Result[]
// getRFC2544Result normalises result_id → id, created_at → timestamp
export async function runRFC2544(data: {
  destination: string;
  protocol: string;
  frame_sizes: number[];
  trial_duration: number;
  max_rate_mbps: number;
  fast_mode: boolean;
}) {
  const res = await axios.post(`${API_BASE}/rfc2544/run`, {
    destination_ip: data.destination,      // backend expects destination_ip
    protocol:       data.protocol,
    frame_sizes:    data.frame_sizes,
    trial_duration: data.trial_duration,
    max_rate_mbps:  data.max_rate_mbps,
    fast_mode:      data.fast_mode,
  });
  return res.data;
}

export async function getRFC2544Results() {
  const res = await axios.get(`${API_BASE}/rfc2544/results`);
  // Backend returns { results: [...] } — unwrap the array
  const raw: unknown[] = Array.isArray(res.data)
    ? res.data
    : Array.isArray(res.data?.results)
    ? res.data.results
    : [];
  // Normalise field names: result_id → id, created_at → timestamp
  return raw.map(normaliseRFC2544Result);
}

export async function getRFC2544Result(id: string) {
  const res = await axios.get(`${API_BASE}/rfc2544/results/${id}`);
  return normaliseRFC2544Result(res.data);
}

// Normalise the backend document shape to the frontend RFC2544Result type.
// Backend uses: result_id, created_at, destination_ip, results[].throughput / latency / frame_loss
// Frontend expects: id, timestamp, destination, results[].max_zero_loss_mbps etc.
function normaliseRFC2544Result(raw: unknown) {
  const r = raw as Record<string, unknown>;

  // Normalise top-level fields
  const normalised: Record<string, unknown> = {
    id:          r.result_id ?? r.id ?? "",
    timestamp:   r.created_at ?? r.timestamp ?? new Date().toISOString(),
    destination: r.destination_ip ?? r.destination ?? "",
    protocol:    r.protocol ?? "tcp",
    results:     [],
  };

  // Normalise per-frame results
  const rawResults = Array.isArray(r.results) ? r.results : [];
  normalised.results = rawResults.map((fr: unknown) => {
    const f = fr as Record<string, unknown>;

    // Backend shape per frame:
    // { frame_size, throughput: { max_zero_loss_mbps }, latency: { avg_rtt_ms, min_rtt_ms, max_rtt_ms },
    //   frame_loss: { points: [{ load_pct, loss_pct }] } }
    const throughput = (f.throughput ?? {}) as Record<string, unknown>;
    const latency    = (f.latency    ?? {}) as Record<string, unknown>;
    const frameLoss  = (f.frame_loss ?? {}) as Record<string, unknown>;

    return {
      frame_size:         f.frame_size ?? 0,
      max_zero_loss_mbps: throughput.max_zero_loss_mbps ?? f.max_zero_loss_mbps ?? 0,
      avg_latency_ms:     latency.avg_rtt_ms  ?? f.avg_latency_ms  ?? 0,
      min_latency_ms:     latency.min_rtt_ms  ?? f.min_latency_ms  ?? 0,
      max_latency_ms:     latency.max_rtt_ms  ?? f.max_latency_ms  ?? 0,
      frame_loss_points:  Array.isArray(frameLoss.points)
                            ? frameLoss.points
                            : Array.isArray(f.frame_loss_points)
                            ? f.frame_loss_points
                            : [],
    };
  });

  return normalised;
}

// ── Malicious ─────────────────────────────────────────────────────────────────
export async function getMaliciousRegistry() {
  const res = await axios.get(`${API_BASE}/malicious/registry`);
  return res.data;
}

export async function requestApproval(data: {
  attack_type: string;
  justification: string;
}) {
  const res = await axios.post(`${API_BASE}/malicious/approve`, data);
  return res.data;
}

// Backend fields: approval_token, attack_type, target_ip, duration_seconds, intensity
export async function runMalicious(data: {
  attack_type: string;
  target: string;
  duration: number;
  intensity: string;
  token: string;
}) {
  const res = await axios.post(`${API_BASE}/malicious/run`, {
    approval_token:   data.token,
    attack_type:      data.attack_type,
    target_ip:        data.target,
    duration_seconds: data.duration,
    intensity:        data.intensity,
  });
  return res.data;
}

// ── Scheduler ─────────────────────────────────────────────────────────────────
export async function scheduleOnce(
  profile_name: string,
  destination: string,
  run_time: string
) {
  const res = await axios.post(`${API_BASE}/schedule/once`, {
    profile_name,
    destination,
    run_time,
  });
  return res.data;
}

export async function scheduleInterval(
  profile_name: string,
  destination: string,
  interval_seconds: number
) {
  const res = await axios.post(`${API_BASE}/schedule/interval`, {
    profile_name,
    destination,
    seconds: interval_seconds,
  });
  return res.data;
}

export async function getScheduledJobs() {
  const res = await axios.get(`${API_BASE}/schedule`);
  return res.data;
}

export async function deleteScheduledJob(scheduledId: string) {
  const res = await axios.delete(`${API_BASE}/schedule/${scheduledId}`);
  return res.data;
}

// ── Health Check ──────────────────────────────────────────────────────────────
export async function checkApiHealth(): Promise<boolean> {
  try {
    await axios.get(`${API_BASE}/profiles`, { timeout: 3000 });
    return true;
  } catch {
    return false;
  }
}