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
import { useState, useEffect, useRef } from "react";
import { Play, Database, Wifi, Activity, ChevronRight, Calendar } from "lucide-react";

import { StartExecutionForm } from "@/components/StartExecutionForm";
import { JobsDashboard } from "@/components/JobsDashboard";
import { CreateProfileForm } from "@/components/CreateProfileForm";
import { ProfilesList } from "@/components/ProfilesList";
import { ProfileViewer } from "@/components/ProfileViewer";
import { Scheduler } from "@/components/Scheduler";
import { getProfile } from "@/lib/api";

type Tab = "EXECUTION" | "SCHEDULER" | "PROFILES";

/* ── Protocol colors for canvas ── */
const NODE_COLORS = ["#7C5CFF", "#00B8D9", "#00C853", "#AB47BC", "#FF8F00", "#F06292"];

const Index = () => {
  const [activeTab, setActiveTab] = useState<Tab>("EXECUTION");
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [selectedProfile, setSelectedProfile] = useState<any>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const [tabChanging, setTabChanging] = useState(false);

  const handleExecutionStarted = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  const handleProfileSelect = async (profileName: string) => {
    try {
      const profile = await getProfile(profileName);
      // Normalize: ensure traffic is always an array regardless of backend shape
      setSelectedProfile({
        ...profile,
        traffic: Array.isArray(profile?.traffic) ? profile.traffic : [],
      });
    } catch (error) {
      console.error("Failed to load profile", error);
    }
  };

  const handleTabChange = (tab: Tab) => {
    if (tab === activeTab) return;
    setTabChanging(true);
    setTimeout(() => {
      setActiveTab(tab);
      setTabChanging(false);
    }, 150);
  };

  /* ── Parallax ── */
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 16;
      const y = (e.clientY / window.innerHeight - 0.5) * 16;
      setMouse({ x, y });
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  /* ── Hero Canvas ── */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const width = () => canvas.width;
    const height = () => canvas.height;
    const center = () => ({ x: width() / 2, y: height() / 2 });

    const deviceCount = 8;
    const getDevices = () => {
      const c = center();
      return Array.from({ length: deviceCount }, (_, i) => {
        const angle = (i / deviceCount) * Math.PI * 2 - Math.PI / 2;
        const rx = Math.min(width() * 0.38, 300);
        const ry = Math.min(height() * 0.38, 170);
        return {
          x: c.x + Math.cos(angle) * rx,
          y: c.y + Math.sin(angle) * ry,
          color: NODE_COLORS[i % NODE_COLORS.length],
          angle,
        };
      });
    };

    const pulses: any[] = [];
    const createPulse = (devices: any[]) => {
      const from = devices[Math.floor(Math.random() * devices.length)];
      const toCenter = Math.random() > 0.3;
      const to = toCenter ? center() : devices[Math.floor(Math.random() * devices.length)];
      pulses.push({
        from: { ...from },
        to,
        progress: Math.random(),
        speed: 0.003 + Math.random() * 0.003,
        color: from.color,
        size: 2.5 + Math.random() * 1.5,
      });
    };

    let devices = getDevices();
    for (let i = 0; i < 16; i++) createPulse(devices);

    let ringRotation = 0;
    let innerRingRotation = 0;
    let t = 0;

    const animate = () => {
      t += 0.008;
      devices = getDevices();
      const c = center();
      const w = width();
      const h = height();

      ctx.clearRect(0, 0, w, h);

      /* Background radial glow */
      const bg = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, Math.max(w, h) * 0.6);
      bg.addColorStop(0, "rgba(124,92,255,0.12)");
      bg.addColorStop(0.5, "rgba(0,184,217,0.04)");
      bg.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      /* Connection lines */
      devices.forEach((device) => {
        const grad = ctx.createLinearGradient(device.x, device.y, c.x, c.y);
        grad.addColorStop(0, device.color + "22");
        grad.addColorStop(1, "rgba(124,92,255,0.18)");
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(device.x, device.y);
        ctx.lineTo(c.x, c.y);
        ctx.stroke();
      });

      /* Device nodes */
      devices.forEach((device) => {
        /* Outer ring */
        ctx.beginPath();
        ctx.arc(device.x, device.y, 14, 0, Math.PI * 2);
        ctx.fillStyle = device.color + "18";
        ctx.fill();
        ctx.strokeStyle = device.color + "55";
        ctx.lineWidth = 1;
        ctx.stroke();

        /* Inner dot */
        ctx.beginPath();
        ctx.arc(device.x, device.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = device.color;
        ctx.shadowBlur = 12;
        ctx.shadowColor = device.color;
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      /* Pulses */
      pulses.forEach((pulse) => {
        pulse.progress += pulse.speed;
        if (pulse.progress >= 1) {
          pulse.progress = 0;
          const from = devices[Math.floor(Math.random() * devices.length)];
          pulse.from = { ...from };
          pulse.color = from.color;
          const toCenter = Math.random() > 0.3;
          pulse.to = toCenter ? center() : devices[Math.floor(Math.random() * devices.length)];
        }

        const x = pulse.from.x + (pulse.to.x - pulse.from.x) * pulse.progress;
        const y = pulse.from.y + (pulse.to.y - pulse.from.y) * pulse.progress;

        ctx.beginPath();
        ctx.arc(x, y, pulse.size, 0, Math.PI * 2);
        ctx.fillStyle = pulse.color;
        ctx.shadowBlur = 18;
        ctx.shadowColor = pulse.color;
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      /* Core hub */
      const coreRadius = 52;

      /* Core glow */
      const coreGlow = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, coreRadius * 2.5);
      coreGlow.addColorStop(0, "rgba(124,92,255,0.25)");
      coreGlow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = coreGlow;
      ctx.beginPath();
      ctx.arc(c.x, c.y, coreRadius * 2.5, 0, Math.PI * 2);
      ctx.fill();

      /* Core body */
      ctx.beginPath();
      ctx.arc(c.x, c.y, coreRadius, 0, Math.PI * 2);
      const coreGrad = ctx.createRadialGradient(c.x, c.y - 10, 0, c.x, c.y, coreRadius);
      coreGrad.addColorStop(0, "#1a1040");
      coreGrad.addColorStop(1, "#0d0a1e");
      ctx.fillStyle = coreGrad;
      ctx.fill();
      ctx.strokeStyle = "rgba(124,92,255,0.7)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      /* Outer rotating ring */
      ringRotation += 0.004;
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(ringRotation);
      ctx.strokeStyle = "rgba(124,92,255,0.35)";
      ctx.lineWidth = 1;
      ctx.setLineDash([6, 10]);
      ctx.beginPath();
      ctx.arc(0, 0, coreRadius + 22, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      /* Inner counter-rotating ring */
      innerRingRotation -= 0.007;
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(innerRingRotation);
      ctx.strokeStyle = "rgba(0,184,217,0.25)";
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 14]);
      ctx.beginPath();
      ctx.arc(0, 0, coreRadius + 10, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      /* Core center icon — WiFi symbol */
      ctx.fillStyle = "rgba(124,92,255,0.9)";
      ctx.font = "bold 22px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.shadowBlur = 10;
      ctx.shadowColor = "#7C5CFF";
      ctx.fillText("ATG", c.x, c.y);
      ctx.shadowBlur = 0;

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener("resize", resize);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, []);

  return (
    <div className="relative flex flex-col min-h-screen">

      {/* ── HEADER ── */}
      <header className="sticky top-0 z-30 glass-strong border-b border-border/40">
        <div className="container flex items-center justify-between py-4">

          {/* Logo + Name */}
          <div className="flex items-center gap-3">
            {/* Hex logo mark */}
            <div className="relative w-9 h-9 flex items-center justify-center">
              <svg viewBox="0 0 36 36" className="w-9 h-9" fill="none">
                <polygon
                  points="18,2 32,10 32,26 18,34 4,26 4,10"
                  stroke="hsl(258 92% 68%)"
                  strokeWidth="1.5"
                  fill="hsl(258 92% 68% / 0.12)"
                />
                <polygon
                  points="18,8 27,13 27,23 18,28 9,23 9,13"
                  fill="hsl(258 92% 68% / 0.2)"
                />
                <circle cx="18" cy="18" r="4" fill="hsl(258 92% 68%)" />
              </svg>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="font-display font-bold text-lg tracking-tight gradient-text">
                  ATG
                </span>
                <span className="text-xs px-1.5 py-0.5 rounded-md bg-primary/15 text-primary border border-primary/25 font-mono font-medium">
                  v2.0
                </span>
              </div>
              <p className="text-[10px] text-text-secondary tracking-widest uppercase leading-none">
                Adaptive Traffic Generator
              </p>
            </div>
          </div>

          {/* Right side status */}
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full glass border border-success/20 text-success text-xs font-medium">
              <span className="live-dot" />
              System Online
            </div>
            <div className="flex items-center gap-1 text-text-secondary text-xs">
              <Activity className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Live Monitor</span>
            </div>
          </div>
        </div>
      </header>

      {/* ── HERO ── */}
      <section className="relative h-[420px] overflow-hidden">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full"
          style={{ transform: `translate(${mouse.x * 0.25}px, ${mouse.y * 0.25}px) scale(1.04)` }}
        />

        {/* Hero text overlay */}
        <div className="absolute inset-0 flex flex-col items-center justify-end pb-12 pointer-events-none">
          <div className="text-center space-y-2 animate-fade-up">
            <p className="text-xs uppercase tracking-[0.25em] text-text-secondary font-medium">
              Network Intelligence Platform
            </p>
            <h2 className="font-display text-3xl font-bold gradient-text">
              Orchestrate. Simulate. Analyze.
            </h2>
          </div>
        </div>

        {/* Bottom fade */}
        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-background to-transparent pointer-events-none" />
      </section>

      {/* ── TAB NAVIGATION ── */}
      <div className="relative z-20 flex justify-center py-8">
        <div className="relative flex glass border border-border/50 rounded-full p-1.5 shadow-glass gap-1">

          {/* Sliding indicator */}
          <div
            className="absolute top-1.5 bottom-1.5 rounded-full transition-all duration-300 ease-out"
            style={{
              width: "calc(33.33% - 6px)",
              left: activeTab === "EXECUTION"
                ? "6px"
                : activeTab === "SCHEDULER"
                  ? "calc(33.33% + 3px)"
                  : "calc(66.66% + 3px)",
              background: "linear-gradient(135deg, hsl(258 92% 68% / 0.25), hsl(190 95% 55% / 0.1))",
              boxShadow: "0 0 20px hsl(258 92% 68% / 0.2)",
              border: "1px solid hsl(258 92% 68% / 0.3)",
            }}
          />

          <button
            onClick={() => handleTabChange("EXECUTION")}
            className={`relative z-10 flex items-center gap-2.5 px-8 py-3 rounded-full text-sm font-medium transition-all duration-200 ${activeTab === "EXECUTION"
              ? "text-primary"
              : "text-text-secondary hover:text-foreground"
              }`}
          >
            <Play className="h-4 w-4" />
            Execution
          </button>

          <button
            onClick={() => handleTabChange("SCHEDULER")}
            className={`relative z-10 flex items-center gap-2.5 px-8 py-3 rounded-full text-sm font-medium transition-all duration-200 ${activeTab === "SCHEDULER"
              ? "text-primary"
              : "text-text-secondary hover:text-foreground"
              }`}
          >
            <Calendar className="h-4 w-4" />
            Scheduler
          </button>

          <button
            onClick={() => handleTabChange("PROFILES")}
            className={`relative z-10 flex items-center gap-2.5 px-8 py-3 rounded-full text-sm font-medium transition-all duration-200 ${activeTab === "PROFILES"
              ? "text-primary"
              : "text-text-secondary hover:text-foreground"
              }`}
          >
            <Database className="h-4 w-4" />
            Profiles
          </button>
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <main className="container flex-1 pb-20">

        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-xs text-text-secondary mb-8">
          <span>Dashboard</span>
          <ChevronRight className="h-3 w-3" />
          <span className="text-foreground font-medium">
            {activeTab === "EXECUTION" ? "Execution Control" : activeTab === "SCHEDULER" ? "Job Scheduler" : "Profile Manager"}
          </span>
        </div>

        <div
          className={`transition-all duration-150 ${tabChanging ? "opacity-0 translate-y-2" : "opacity-100 translate-y-0"
            }`}
        >
          {activeTab === "EXECUTION" && (
            <div className="grid gap-8 lg:grid-cols-[440px_1fr]">
              <div className="panel-card gradient-border p-8">
                <StartExecutionForm onExecutionStarted={handleExecutionStarted} />
              </div>
              <div className="panel-card p-8">
                <JobsDashboard refreshTrigger={refreshTrigger} />
              </div>
            </div>
          )}

          {activeTab === "SCHEDULER" && (
            <div className="animate-fade-in">
              <Scheduler />
            </div>
          )}

          {activeTab === "PROFILES" && (
            <div className="space-y-8">
              <div className="panel-card gradient-border p-8">
                <CreateProfileForm />
              </div>

              <div className="grid md:grid-cols-2 gap-8">
                <div className="panel-card p-8">
                  <ProfilesList onSelect={handleProfileSelect} />
                </div>
                <div className="panel-card p-8">
                  <ProfileViewer profile={selectedProfile} />
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* ── FOOTER ── */}
      <footer className="border-t border-border/30 py-4">
        <div className="container flex items-center justify-between text-xs text-text-secondary">
          <span>© 2026 ATG Platform · All rights reserved</span>
          <span className="font-mono">v2.0.0</span>
        </div>
      </footer>
    </div>
  );
};

export default Index;
