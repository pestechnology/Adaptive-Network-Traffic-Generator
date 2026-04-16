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
import React, { useState } from "react";
import { createProfile } from "@/lib/api";
import { TrafficItem } from "@/types/traffic";
import { Plus, Layers, ShieldCheck, Trash2, ChevronDown } from "lucide-react";

const PROTOCOLS = ["ICMP", "HTTP", "HTTPS", "SSH"];

const PROTO_COLORS: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  ICMP: { bg: "bg-[#7C5CFF]/10", border: "border-l-[#7C5CFF]", text: "text-[#7C5CFF]", dot: "#7C5CFF" },
  HTTP: { bg: "bg-[#00C853]/10", border: "border-l-[#00C853]", text: "text-[#00C853]", dot: "#00C853" },
  HTTPS: { bg: "bg-[#AB47BC]/10", border: "border-l-[#AB47BC]", text: "text-[#AB47BC]", dot: "#AB47BC" },
  SSH: { bg: "bg-[#FF8F00]/10", border: "border-l-[#FF8F00]", text: "text-[#FF8F00]", dot: "#FF8F00" },
  TCP: { bg: "bg-[#00B8D9]/10", border: "border-l-[#00B8D9]", text: "text-[#00B8D9]", dot: "#00B8D9" },
};

const getProtoStyle = (protocol: string) =>
  PROTO_COLORS[protocol] || { bg: "bg-primary/10", border: "border-l-primary", text: "text-primary", dot: "#7C5CFF" };

export function CreateProfileForm() {
  const [profileName, setProfileName] = useState("");
  const [traffic, setTraffic] = useState<TrafficItem[]>([
    { protocol: "ICMP", count: 100, duration_sec: 10, packet_size: 128 },
  ]);
  const [status, setStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const updateTraffic = (index: number, field: keyof TrafficItem, value: any) => {
    const updated = [...traffic];
    updated[index] = { ...updated[index], [field]: value };
    setTraffic(updated);
  };

  const addTrafficRule = () => {
    setTraffic([...traffic, { protocol: "ICMP", count: 100, duration_sec: 10, packet_size: 128 }]);
  };

  const removeTrafficRule = (index: number) => {
    if (traffic.length > 1) setTraffic(traffic.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!profileName.trim()) {
      setStatus({ type: "error", msg: "Profile name is required" });
      return;
    }
    try {
      await createProfile({ profile_name: profileName.trim(), traffic });
      setStatus({ type: "success", msg: "Profile created successfully!" });
      setProfileName("");
    } catch {
      setStatus({ type: "error", msg: "Failed to create profile" });
    }
  };

  const totalPackets = traffic.reduce((acc, item) => acc + (item.count ?? 0), 0);

  return (
    <div className="space-y-8">

      {/* Header */}
      <div className="space-y-3">
        <div className="section-label">
          <div className="w-6 h-6 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center">
            <Layers className="h-3.5 w-3.5" />
          </div>
          Traffic Profile Designer
        </div>
        <h3 className="font-display text-2xl font-bold tracking-tight">
          Build Custom Traffic Blueprint
        </h3>
        <p className="text-sm text-text-secondary leading-relaxed">
          Configure protocol behavior, packet characteristics, and rate control.
        </p>
      </div>

      {/* Profile Name */}
      <div className="space-y-2.5">
        <label className="text-xs uppercase tracking-widest text-text-secondary font-medium">
          Profile Name
        </label>
        <input
          className="premium-input"
          placeholder="e.g. mixed-load-test"
          value={profileName}
          onChange={(e) => setProfileName(e.target.value)}
          style={{ fontFamily: "var(--font-sans)" }}
        />
      </div>

      {/* Summary Strip */}
      <div className="grid grid-cols-3 gap-4">
        <div className="metric-card text-center hover-scale hover-glow-primary cursor-default">
          <p className="text-[10px] uppercase tracking-widest text-text-secondary mb-1">Rules</p>
          <p className="text-2xl font-display font-bold">{traffic.length}</p>
        </div>
        <div className="metric-card text-center hover-scale hover-glow-primary cursor-default">
          <p className="text-[10px] uppercase tracking-widest text-text-secondary mb-1">Total Packets</p>
          <p className="text-2xl font-display font-bold text-primary">{totalPackets.toLocaleString()}</p>
        </div>
        <div className="metric-card hover-scale hover-glow-primary cursor-default">
          <p className="text-[10px] uppercase tracking-widest text-text-secondary mb-2">Protocol Mix</p>
          <div className="flex h-2 w-full rounded-full overflow-hidden gap-px">
            {traffic.map((item, i) => {
              const pct = totalPackets === 0 ? 0 : ((item.count ?? 0) / totalPackets) * 100;
              const style = getProtoStyle(item.protocol);
              return (
                <div
                  key={i}
                  className="transition-all duration-500"
                  style={{ width: `${pct}%`, backgroundColor: style.dot }}
                />
              );
            })}
          </div>
          {/* Legend */}
          <div className="flex flex-wrap gap-2 mt-2">
            {traffic.map((item, i) => {
              const style = getProtoStyle(item.protocol);
              return (
                <div key={i} className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: style.dot }} />
                  <span className="text-[10px] text-text-secondary">{item.protocol}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Traffic Rules */}
      <div className="space-y-4">
        {traffic.map((item, idx) => {
          const rateMode = item.packets_per_second !== undefined ? "PPS" : "DURATION";
          const style = getProtoStyle(item.protocol);

          return (
            <div
              key={idx}
              className={`rounded-2xl border border-border border-l-4 ${style.border} ${style.bg} p-6 space-y-5 transition-all duration-200 hover-scale`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className={`w-2 h-2 rounded-full`} style={{ backgroundColor: style.dot }} />
                  <h4 className={`font-semibold text-sm ${style.text}`}>
                    Rule {idx + 1} · {item.protocol}
                  </h4>
                </div>
                {traffic.length > 1 && (
                  <button
                    onClick={() => removeTrafficRule(idx)}
                    className="text-text-secondary hover:text-destructive transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Core Controls */}
              <div className="grid md:grid-cols-4 gap-4">

                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest text-text-secondary font-medium">Protocol</label>
                  <div className="relative">
                    <select
                      className="premium-input w-full appearance-none pr-8"
                      style={{ fontFamily: "var(--font-sans)" }}
                      value={item.protocol}
                      onChange={(e) => updateTraffic(idx, "protocol", e.target.value)}
                    >
                      {PROTOCOLS.map((p) => <option key={p}>{p}</option>)}
                    </select>
                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-secondary pointer-events-none" />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest text-text-secondary font-medium">Packet Count</label>
                  <input
                    type="number" min={1}
                    className="premium-input"
                    value={item.count ?? ""}
                    onChange={(e) => updateTraffic(idx, "count", e.target.value === "" ? undefined : Number(e.target.value))}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest text-text-secondary font-medium">Packet Size (B)</label>
                  <input
                    type="number" min={28}
                    className="premium-input"
                    value={item.packet_size ?? ""}
                    onChange={(e) => updateTraffic(idx, "packet_size", e.target.value === "" ? undefined : Number(e.target.value))}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest text-text-secondary font-medium">Rate Mode</label>
                  <div className="relative">
                    <select
                      className="premium-input w-full appearance-none pr-8"
                      style={{ fontFamily: "var(--font-sans)" }}
                      value={rateMode}
                      onChange={(e) => {
                        if (e.target.value === "PPS") {
                          updateTraffic(idx, "duration_sec", undefined);
                          updateTraffic(idx, "packets_per_second", 10);
                        } else {
                          updateTraffic(idx, "packets_per_second", undefined);
                          updateTraffic(idx, "duration_sec", 10);
                        }
                      }}
                    >
                      <option value="DURATION">Duration Based</option>
                      <option value="PPS">Packets Per Second</option>
                    </select>
                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-secondary pointer-events-none" />
                  </div>
                </div>

              </div>

              {/* Rate Config */}
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-widest text-text-secondary font-medium">
                  {rateMode === "DURATION" ? "Duration (Seconds)" : "Packets Per Second (PPS)"}
                </label>
                <input
                  type="number" min={1}
                  className="premium-input"
                  value={rateMode === "DURATION" ? (item.duration_sec ?? "") : (item.packets_per_second ?? "")}
                  onChange={(e) => {
                    const field = rateMode === "DURATION" ? "duration_sec" : "packets_per_second";
                    updateTraffic(idx, field, e.target.value === "" ? undefined : Number(e.target.value));
                  }}
                />
              </div>

            </div>
          );
        })}
      </div>

      {/* Add Rule */}
      <button
        onClick={addTrafficRule}
        className="w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl border border-dashed border-border hover:border-primary/50 hover:bg-primary/5 text-text-secondary hover:text-primary transition-all duration-200 text-sm font-medium click-press"
      >
        <Plus className="h-4 w-4" />
        Add Traffic Rule
      </button>

      {/* Save Button */}
      <button
        onClick={handleSubmit}
        className="shimmer-btn click-press w-full py-4 rounded-xl font-semibold text-sm transition-all duration-200 hover:scale-[1.01] active:scale-[0.98]"
        style={{
          background: "linear-gradient(135deg, hsl(258 92% 68%), hsl(258 92% 58%))",
          color: "hsl(var(--primary-foreground))",
          boxShadow: "0 4px 24px hsl(258 92% 68% / 0.35), 0 1px 0 rgba(255,255,255,0.1) inset",
        }}
      >
        <span className="flex items-center justify-center gap-2">
          <ShieldCheck className="h-4 w-4" />
          Save Profile
        </span>
      </button>

      {/* Status */}
      {status && (
        <div className={`rounded-xl px-4 py-3 text-sm font-medium animate-fade-in ${status.type === "success"
          ? "bg-success/10 border border-success/30 text-success"
          : "bg-destructive/10 border border-destructive/30 text-destructive"
          }`}>
          {status.msg}
        </div>
      )}
    </div>
  );
}
