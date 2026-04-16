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
import { useState, useEffect } from "react";
import { Plus, X, Zap, Loader2, Server, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { executeTraffic, getProfiles } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface StartExecutionFormProps {
  onExecutionStarted: () => void;
}

export function StartExecutionForm({ onExecutionStarted }: StartExecutionFormProps) {
  const [profileName, setProfileName] = useState("");
  const [profiles, setProfiles] = useState<string[]>([]);
  const [destinations, setDestinations] = useState<string[]>([""]);
  const [enableCapture, setEnableCapture] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const loadProfiles = async () => {
      try {
        const data = await getProfiles();
        setProfiles(data);
      } catch {
        toast({ title: "Failed to load profiles", variant: "destructive" });
      }
    };
    loadProfiles();
  }, []);

  const addDestination = () => setDestinations([...destinations, ""]);

  const removeDestination = (index: number) => {
    if (destinations.length > 1) {
      setDestinations(destinations.filter((_, i) => i !== index));
    }
  };

  const updateDestination = (index: number, value: string) => {
    const updated = [...destinations];
    updated[index] = value;
    setDestinations(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validDestinations = destinations.filter((d) => d.trim() !== "");

    if (!profileName) {
      toast({ title: "Select Profile", description: "Please select a traffic profile", variant: "destructive" });
      return;
    }
    if (validDestinations.length === 0) {
      toast({ title: "No Destination", description: "Add at least one destination", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    const jobIds: string[] = [];
    const errors: string[] = [];

    for (const destination of validDestinations) {
      try {
        const response = await executeTraffic({ profile_name: profileName, destination: destination.trim(), enable_capture: enableCapture });
        jobIds.push(response.job_id);
      } catch {
        errors.push(destination);
      }
    }

    setIsLoading(false);

    if (jobIds.length > 0) {
      toast({ title: "Execution Started", description: `${jobIds.length} job(s) launched` });
      setDestinations([""]);
      onExecutionStarted();
    }
    if (errors.length > 0) {
      toast({ title: "Some Destinations Failed", description: errors.join(", "), variant: "destructive" });
    }
  };

  return (
    <div className="space-y-8">

      {/* Panel Header */}
      <div className="space-y-3">
        <div className="section-label">
          <div className="w-6 h-6 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center">
            <Zap className="h-3.5 w-3.5" />
          </div>
          Execution Command
        </div>
        <h3 className="font-display text-2xl font-bold tracking-tight">
          Launch Traffic Scenario
        </h3>
        <p className="text-sm text-text-secondary leading-relaxed">
          Select a profile and define target systems to initiate transport-layer execution.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-7">

        {/* Profile Selector */}
        <div className="space-y-2.5">
          <label className="text-xs uppercase tracking-widest text-text-secondary font-medium">
            Traffic Profile
          </label>
          <div className="relative">
            <select
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
              className="premium-input w-full appearance-none pr-10 cursor-pointer"
              style={{ fontFamily: "var(--font-sans)" }}
            >
              <option value="">— Select a profile —</option>
              {profiles.map((profile) => (
                <option key={profile} value={profile}>{profile}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary pointer-events-none" />
          </div>
        </div>

        {/* Destinations */}
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <label className="text-xs uppercase tracking-widest text-text-secondary font-medium">
              Target Systems
            </label>
            <button
              type="button"
              onClick={addDestination}
              className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors px-2.5 py-1.5 rounded-lg border border-primary/25 hover:border-primary/50 hover:bg-primary/5"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Target
            </button>
          </div>

          <div className="space-y-2.5">
            {destinations.map((dest, index) => (
              <div key={index} className="flex gap-2.5 items-center group">
                <div className="flex items-center gap-2 flex-1 relative">
                  <Server className="absolute left-3 h-4 w-4 text-text-secondary pointer-events-none" />
                  <input
                    placeholder="192.168.0.10"
                    value={dest}
                    onChange={(e) => updateDestination(index, e.target.value)}
                    className="premium-input pl-10 flex-1"
                  />
                </div>
                {destinations.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeDestination(index)}
                    className="w-9 h-9 flex items-center justify-center rounded-lg border border-border hover:border-destructive/50 hover:bg-destructive/10 text-text-secondary hover:text-destructive transition-all"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Packet Capture Toggle */}
        <div className="space-y-2.5">
          <label className="flex items-center gap-3 cursor-pointer group">
            <div className="relative">
              <input
                type="checkbox"
                checked={enableCapture}
                onChange={(e) => setEnableCapture(e.target.checked)}
                className="peer sr-only"
              />
              <div className="w-10 h-5 rounded-full bg-border/60 peer-checked:bg-primary/80 transition-colors duration-200" />
              <div className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 peer-checked:translate-x-5" />
            </div>
            <div>
              <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                Enable Packet Capture
              </span>
              <p className="text-[11px] text-text-secondary leading-tight mt-0.5">
                Record raw packets for post-execution analysis (.pcap)
              </p>
            </div>
          </label>
        </div>

        {/* Execution Summary */}
        {profileName && (
          <div className="rounded-xl glass border border-border/50 p-4 space-y-2 animate-fade-in">
            <p className="text-xs uppercase tracking-widest text-text-secondary font-medium mb-3">
              Execution Summary
            </p>
            <div className="flex justify-between text-sm">
              <span className="text-text-secondary">Profile</span>
              <span className="font-medium text-primary">{profileName}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-text-secondary">Targets</span>
              <span className="font-medium">{destinations.filter(d => d.trim()).length || destinations.length}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-text-secondary">Packet Capture</span>
              <span className={`font-medium ${enableCapture ? 'text-primary' : 'text-text-secondary'}`}>
                {enableCapture ? 'Enabled' : 'Disabled'}
              </span>
            </div>
          </div>
        )}

        {/* Launch Button */}
        <button
          type="submit"
          disabled={isLoading}
          className="shimmer-btn w-full py-4 rounded-xl font-semibold text-sm transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
          style={{
            background: isLoading
              ? "hsl(var(--primary) / 0.6)"
              : "linear-gradient(135deg, hsl(258 92% 68%), hsl(258 92% 58%))",
            color: "hsl(var(--primary-foreground))",
            boxShadow: isLoading ? "none" : "0 4px 24px hsl(258 92% 68% / 0.35), 0 1px 0 rgba(255,255,255,0.1) inset",
          }}
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Launching Execution...
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <Zap className="h-4 w-4" />
              Launch Execution
            </span>
          )}
        </button>

      </form>
    </div>
  );
}
