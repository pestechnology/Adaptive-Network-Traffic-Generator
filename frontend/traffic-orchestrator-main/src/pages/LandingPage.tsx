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
import { useNavigate } from "react-router-dom";
import {
  Zap,
  ArrowRight,
  FileText,
  Activity,
  Shield,
  Wifi,
  Server,
  Clock,
  CheckCircle2,
} from "lucide-react";

const features = [
  {
    icon: Zap,
    color: "#e91e8c",
    title: "Precision Traffic Generation",
    description:
      "ICMP, TCP, UDP, and custom profiles with packet-level control. Tune count, size, and rate per step.",
  },
  {
    icon: Activity,
    color: "#7c3aed",
    title: "RFC 2544 Benchmarking",
    description:
      "Industry-standard throughput, latency, frame loss, and back-to-back tests across multiple frame sizes.",
  },
  {
    icon: Shield,
    color: "#ef4444",
    title: "Threat Simulation",
    description:
      "Controlled flood testing (ICMP, TCP SYN, SSH, UDP) with approval-gated execution and audit logging.",
  },
  {
    icon: Wifi,
    color: "#3b82f6",
    title: "Real-time Capture",
    description:
      "PCAP capture, header inspection, per-packet analysis with protocol distribution statistics.",
  },
  {
    icon: Server,
    color: "#10b981",
    title: "Level-2 Agent",
    description:
      "Remote destination agent for end-to-end probe sessions. RTT, jitter, and delivery entropy metrics.",
  },
  {
    icon: Clock,
    color: "#f59e0b",
    title: "Enterprise Scheduler",
    description:
      "Cron-style recurring jobs and one-shot scheduling. Automated traffic testing on your schedule.",
  },
];

const stats = [
  { value: "10Gbps", label: "Max Throughput" },
  { value: "RFC 2544", label: "Compliant" },
  { value: "4", label: "Attack Vectors" },
  { value: "Real-time", label: "Analytics" },
];

const steps = [
  {
    num: "01",
    icon: FileText,
    title: "Create Profile",
    description: "Define traffic steps with protocol, packet size, rate, and count.",
  },
  {
    num: "02",
    icon: Server,
    title: "Configure Target",
    description: "Set destination IP, enable capture, and choose execution mode.",
  },
  {
    num: "03",
    icon: Activity,
    title: "Analyze Results",
    description: "Review delivery %, latency, throughput, and download PCAP files.",
  },
];

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div
      className="min-h-screen overflow-x-hidden"
      style={{ background: "#0a0a0f", color: "#fff", fontFamily: "Inter, system-ui, sans-serif" }}
    >
      {/* ── Animated gradient orbs ── */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div
          className="absolute"
          style={{
            top: "-20%",
            left: "10%",
            width: 800,
            height: 800,
            background: "radial-gradient(circle, rgba(233,30,140,0.15) 0%, transparent 70%)",
            filter: "blur(60px)",
            animation: "blob-drift 12s ease-in-out infinite",
          }}
        />
        <div
          className="absolute"
          style={{
            top: "30%",
            right: "-10%",
            width: 600,
            height: 600,
            background: "radial-gradient(circle, rgba(124,58,237,0.12) 0%, transparent 70%)",
            filter: "blur(80px)",
            animation: "blob-drift 16s ease-in-out infinite reverse",
          }}
        />
        <div
          className="absolute"
          style={{
            bottom: "-10%",
            left: "30%",
            width: 700,
            height: 700,
            background: "radial-gradient(circle, rgba(59,130,246,0.1) 0%, transparent 70%)",
            filter: "blur(100px)",
            animation: "blob-drift 20s ease-in-out infinite 5s",
          }}
        />
        {/* Grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />
      </div>

      {/* ── Navbar ── */}
      <nav className="flex items-center justify-between px-8 py-5 border-b border-white/[0.05]">
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #e91e8c, #7c3aed)", boxShadow: "0 0 20px rgba(233,30,140,0.4)" }}
          >
            <Zap size={16} className="text-white" />
          </div>
          <span className="font-bold text-white text-lg" style={{ fontFamily: "Outfit, system-ui, sans-serif" }}>
            ATG
          </span>
          <span
            className="text-[10px] font-medium px-2 py-0.5 rounded-full"
            style={{ background: "rgba(233,30,140,0.15)", color: "#e91e8c", border: "1px solid rgba(233,30,140,0.3)" }}
          >
            v2.0
          </span>
        </div>
        <button
          onClick={() => navigate("/dashboard")}
          className="px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 hover:opacity-90 active:scale-95"
          style={{ background: "linear-gradient(135deg, #e91e8c, #7c3aed)", color: "#fff" }}
        >
          Launch Dashboard
        </button>
      </nav>

      {/* ── Hero ── */}
      <section className="flex flex-col items-center text-center px-6 pt-24 pb-20 max-w-5xl mx-auto animate-fade-up">
        <div
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium mb-8"
          style={{ background: "rgba(233,30,140,0.1)", border: "1px solid rgba(233,30,140,0.25)", color: "#e91e8c" }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[#e91e8c] animate-pulse" />
          Enterprise Network Intelligence Platform
        </div>

        <h1
          className="text-5xl md:text-7xl font-bold leading-tight mb-6"
          style={{ fontFamily: "Outfit, system-ui, sans-serif" }}
        >
          Take control of your{" "}
          <span
            style={{
              background: "linear-gradient(135deg, #e91e8c, #7c3aed, #3b82f6)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            Network Operations
          </span>
        </h1>

        <p className="text-[#94a3b8] text-lg md:text-xl max-w-2xl mb-10 leading-relaxed">
          Enterprise-grade traffic generation, RFC 2544 benchmarking, and threat simulation —
          unified in one platform.
        </p>

        <div className="flex items-center gap-4 flex-wrap justify-center">
          <button
            onClick={() => navigate("/dashboard")}
            className="flex items-center gap-2 px-7 py-3.5 rounded-xl text-sm font-semibold transition-all duration-200 hover:opacity-90 active:scale-95 shimmer-btn"
            style={{ background: "linear-gradient(135deg, #e91e8c, #7c3aed)", color: "#fff", boxShadow: "0 0 30px rgba(233,30,140,0.3)" }}
          >
            Launch Dashboard <ArrowRight size={16} />
          </button>
          <button
            className="px-7 py-3.5 rounded-xl text-sm font-semibold transition-all duration-200 hover:bg-white/[0.08]"
            style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.15)", color: "#fff" }}
          >
            View Documentation
          </button>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-0 mt-16 w-full max-w-3xl border border-white/[0.08] rounded-2xl overflow-hidden">
          {stats.map((s, i) => (
            <div
              key={i}
              className="flex flex-col items-center py-6 px-4 border-r border-white/[0.08] last:border-r-0 hover:bg-white/[0.03] transition-colors"
            >
              <div
                className="text-2xl font-bold"
                style={{ fontFamily: "Outfit, system-ui, sans-serif", color: "#e91e8c" }}
              >
                {s.value}
              </div>
              <div className="text-[#94a3b8] text-xs mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features Grid ── */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <h2
            className="text-3xl font-bold text-white mb-3"
            style={{ fontFamily: "Outfit, system-ui, sans-serif" }}
          >
            Everything you need
          </h2>
          <p className="text-[#94a3b8]">Complete network testing suite in one platform.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((f, i) => (
            <div
              key={i}
              className="rounded-xl p-6 transition-all duration-200 cursor-default group"
              style={{
                background: "#12121a",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(255,255,255,0.18)";
                (e.currentTarget as HTMLDivElement).style.transform = "scale(1.01)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(255,255,255,0.08)";
                (e.currentTarget as HTMLDivElement).style.transform = "scale(1)";
              }}
            >
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center mb-4"
                style={{ background: `${f.color}20` }}
              >
                <f.icon size={20} style={{ color: f.color }} />
              </div>
              <h3 className="text-white font-semibold text-base mb-2">{f.title}</h3>
              <p className="text-[#94a3b8] text-sm leading-relaxed">{f.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Architecture Diagram ── */}
      <section className="max-w-5xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <h2
            className="text-3xl font-bold text-white mb-3"
            style={{ fontFamily: "Outfit, system-ui, sans-serif" }}
          >
            System Architecture
          </h2>
          <p className="text-[#94a3b8]">Purpose-built components working in concert.</p>
        </div>
        <div
          className="rounded-2xl p-8"
          style={{ background: "#12121a", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          <div className="flex flex-col md:flex-row items-center justify-center gap-4">
            {/* Frontend */}
            <div
              className="rounded-xl px-6 py-4 text-center min-w-[140px]"
              style={{ background: "rgba(233,30,140,0.1)", border: "1px solid rgba(233,30,140,0.3)" }}
            >
              <div className="text-[#e91e8c] font-semibold text-sm">React Frontend</div>
              <div className="text-[#64748b] text-xs mt-1">ATG Dashboard</div>
            </div>

            <div className="flex items-center gap-1 text-[#7c3aed]">
              <div className="w-8 h-0.5 bg-[#7c3aed]" />
              <ArrowRight size={14} />
            </div>

            {/* Backend */}
            <div
              className="rounded-xl px-6 py-4 text-center min-w-[140px]"
              style={{ background: "rgba(124,58,237,0.1)", border: "1px solid rgba(124,58,237,0.3)" }}
            >
              <div className="text-[#7c3aed] font-semibold text-sm">FastAPI Backend</div>
              <div className="text-[#64748b] text-xs mt-1">Port 8000</div>
            </div>

            <div className="flex items-center gap-1 text-[#3b82f6]">
              <div className="w-8 h-0.5 bg-[#3b82f6]" />
              <ArrowRight size={14} />
            </div>

            {/* Backends */}
            <div className="flex flex-col gap-3">
              {[
                { label: "MongoDB", sub: "Persistence", color: "#10b981" },
                { label: "Scapy Engine", sub: "Packet Forge", color: "#e91e8c" },
                { label: "Level-2 Agent", sub: "Remote Probe", color: "#3b82f6" },
              ].map((b, i) => (
                <div
                  key={i}
                  className="rounded-lg px-4 py-2 text-center"
                  style={{ background: `${b.color}12`, border: `1px solid ${b.color}30` }}
                >
                  <div className="font-medium text-xs" style={{ color: b.color }}>
                    {b.label}
                  </div>
                  <div className="text-[#64748b] text-[10px]">{b.sub}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── How it Works ── */}
      <section className="max-w-5xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <h2
            className="text-3xl font-bold text-white mb-3"
            style={{ fontFamily: "Outfit, system-ui, sans-serif" }}
          >
            How it Works
          </h2>
          <p className="text-[#94a3b8]">Three simple steps to network intelligence.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {steps.map((s, i) => (
            <div key={i} className="flex flex-col items-center text-center">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5 relative"
                style={{ background: "linear-gradient(135deg, rgba(233,30,140,0.2), rgba(124,58,237,0.2))", border: "1px solid rgba(233,30,140,0.3)" }}
              >
                <s.icon size={24} style={{ color: "#e91e8c" }} />
                <div
                  className="absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold"
                  style={{ background: "linear-gradient(135deg, #e91e8c, #7c3aed)", color: "#fff" }}
                >
                  {i + 1}
                </div>
              </div>
              <h3 className="text-white font-semibold mb-2">{s.title}</h3>
              <p className="text-[#94a3b8] text-sm">{s.description}</p>
              {i < steps.length - 1 && (
                <div className="hidden md:flex items-center absolute translate-x-[180px] translate-y-[-60px]">
                  <div className="w-12 h-0.5 bg-gradient-to-r from-[#e91e8c] to-[#7c3aed]" />
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-center mt-10">
          <button
            onClick={() => navigate("/dashboard")}
            className="flex items-center gap-2 px-8 py-4 rounded-xl font-semibold transition-all duration-200 hover:opacity-90 active:scale-95"
            style={{ background: "linear-gradient(135deg, #e91e8c, #7c3aed)", color: "#fff", boxShadow: "0 0 30px rgba(233,30,140,0.25)" }}
          >
            Get Started <ArrowRight size={18} />
          </button>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-white/[0.06] py-10 text-center">
        <div className="flex items-center justify-center gap-3 mb-3">
          <div
            className="w-6 h-6 rounded-md flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #e91e8c, #7c3aed)" }}
          >
            <Zap size={12} className="text-white" />
          </div>
          <span className="text-white font-semibold text-sm">ATG v2.0</span>
        </div>
        <p className="text-[#64748b] text-xs">
          Enterprise Network Intelligence Platform · Built with{" "}
          <CheckCircle2 size={11} className="inline text-[#10b981]" /> React + FastAPI
        </p>
      </footer>
    </div>
  );
}
