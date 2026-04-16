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
import { useState } from "react";
import { Radio, Send } from "lucide-react";
import { runLevel2 } from "@/lib/api";
import { Level2Result } from "@/types/traffic";
import { toast } from "sonner";
import { SimpleBarChart } from "@/components/charts/AtgBarChart";

function Slider({
  label,
  min,
  max,
  step = 1,
  value,
  onChange,
  unit,
}: {
  label: string;
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (v: number) => void;
  unit?: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="text-[#94a3b8]">{label}</span>
        <span className="text-white font-medium font-mono">{value}{unit ? ` ${unit}` : ""}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
        style={{
          background: `linear-gradient(to right, #e91e8c ${((value - min) / (max - min)) * 100}%, rgba(255,255,255,0.1) 0%)`,
          accentColor: "#e91e8c",
        }}
      />
      <div className="flex justify-between text-[10px] text-[#64748b]">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}

function MetricItem({ label, value, unit }: { label: string; value?: number | string; unit?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] text-[#64748b] uppercase tracking-wide">{label}</span>
      <span className="text-white font-semibold text-sm">
        {value != null ? `${typeof value === "number" ? value.toFixed(3) : value}${unit ? ` ${unit}` : ""}` : "—"}
      </span>
    </div>
  );
}

export default function Level2Panel() {
  const [destination, setDestination] = useState("");
  const [protocol, setProtocol] = useState<"tcp" | "udp" | "icmp">("icmp");
  const [packetSize, setPacketSize] = useState(512);
  const [duration, setDuration] = useState(10);
  const [pps, setPps] = useState(1000);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Level2Result | null>(null);
  const [destErr, setDestErr] = useState("");

  const run = async () => {
    if (!destination.trim()) { setDestErr("Destination IP is required"); return; }
    setDestErr("");
    setLoading(true);
    try {
      const res = await runLevel2({
        destination: destination.trim(),
        protocol,
        packet_size: packetSize,
        duration,
        packets_per_second: pps,
      });
      setResult(res);
      toast.success("Probe completed!");
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Probe failed");
    } finally {
      setLoading(false);
    }
  };

  const rttBuckets = result?.rtt_buckets
    ? Object.entries(result.rtt_buckets).map(([label, value]) => ({ label, value: Number(value) }))
    : [];

  return (
    <div className="max-w-4xl space-y-6 animate-fade-up">
      <div
        className="rounded-xl p-6"
        style={{ background: "#12121a", border: "1px solid rgba(255,255,255,0.08)" }}
      >
        <div className="flex items-center gap-2 mb-5">
          <Radio size={18} style={{ color: "#e91e8c" }} />
          <h2 className="text-white font-semibold">Level-2 Probe Configuration</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left */}
          <div className="space-y-4">
            <div>
              <label className="text-xs text-[#94a3b8] mb-1 block">Destination IP</label>
              <input
                type="text"
                placeholder="192.168.1.1"
                className="w-full rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:ring-2 focus:ring-[#e91e8c]/50"
                style={{
                  background: "#0d0d14",
                  border: `1px solid ${destErr ? "#ef4444" : "rgba(255,255,255,0.1)"}`,
                }}
                value={destination}
                onChange={(e) => { setDestination(e.target.value); setDestErr(""); }}
              />
              {destErr && <p className="text-xs text-[#ef4444] mt-1">{destErr}</p>}
            </div>
            <div>
              <label className="text-xs text-[#94a3b8] mb-1 block">Protocol</label>
              <div className="flex gap-2">
                {(["tcp", "udp", "icmp"] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setProtocol(p)}
                    className="flex-1 py-2 rounded-lg text-xs font-medium uppercase transition-all"
                    style={
                      protocol === p
                        ? { background: "rgba(233,30,140,0.15)", color: "#e91e8c", border: "1px solid rgba(233,30,140,0.4)" }
                        : { background: "#0d0d14", color: "#94a3b8", border: "1px solid rgba(255,255,255,0.1)" }
                    }
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {/* Right — sliders */}
          <div className="space-y-5">
            <Slider label="Packet Size" min={64} max={9000} step={64} value={packetSize} onChange={setPacketSize} unit="bytes" />
            <Slider label="Duration" min={1} max={300} value={duration} onChange={setDuration} unit="s" />
            <Slider label="Packets / Second" min={1} max={10000} step={50} value={pps} onChange={setPps} unit="pps" />
          </div>
        </div>
        <button
          onClick={run}
          disabled={loading}
          className="mt-6 flex items-center gap-2 px-6 py-2.5 rounded-lg font-semibold text-sm transition-all hover:opacity-90 active:scale-95 disabled:opacity-50"
          style={{ background: "linear-gradient(135deg, #e91e8c, #7c3aed)", color: "#fff" }}
        >
          {loading ? "Running Probe…" : <><Send size={15} /> Run Probe</>}
        </button>
      </div>

      {/* Results */}
      {loading && (
        <div
          className="rounded-xl p-6 space-y-4 animate-pulse"
          style={{ background: "#12121a", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          <div className="h-4 w-32 rounded bg-white/10" />
          <div className="grid grid-cols-3 md:grid-cols-5 gap-4">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="h-12 rounded bg-white/10" />
            ))}
          </div>
        </div>
      )}

      {result && !loading && (
        <div
          className="rounded-xl p-6 space-y-5"
          style={{ background: "#12121a", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#10b981]" />
            <h3 className="text-white font-semibold text-sm">Probe Results</h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
            <MetricItem label="TX Packets" value={result.tx_packets} />
            <MetricItem label="Delivered" value={result.delivered} />
            <MetricItem label="Lost" value={result.lost} />
            <MetricItem label="Delivery %" value={result.delivery_pct?.toFixed(2)} unit="%" />
            <MetricItem label="Throughput" value={result.throughput_mbps?.toFixed(3)} unit="Mbps" />
            <MetricItem label="Avg RTT" value={result.avg_rtt_ms?.toFixed(3)} unit="ms" />
            <MetricItem label="Min RTT" value={result.min_rtt_ms?.toFixed(3)} unit="ms" />
            <MetricItem label="Max RTT" value={result.max_rtt_ms?.toFixed(3)} unit="ms" />
            <MetricItem label="Jitter" value={result.jitter_ms?.toFixed(3)} unit="ms" />
            <MetricItem label="Delivery Entropy" value={result.delivery_entropy?.toFixed(4)} />
          </div>

          {rttBuckets.length > 0 && (
            <div>
              <h4 className="text-[#94a3b8] text-xs mb-3">RTT Distribution</h4>
              <SimpleBarChart data={rttBuckets} color="#e91e8c" height={160} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
