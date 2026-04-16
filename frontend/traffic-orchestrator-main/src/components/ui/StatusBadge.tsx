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
import { cn } from "@/lib/utils";
import { JobState } from "@/types/traffic";

interface StatusBadgeProps {
  state: JobState | string;
  className?: string;
}

const config: Record<string, { bg: string; text: string; border: string; pulse?: boolean; dot?: string }> = {
  RUNNING: {
    bg: "rgba(233,30,140,0.12)",
    text: "#e91e8c",
    border: "rgba(233,30,140,0.3)",
    pulse: true,
    dot: "#e91e8c",
  },
  PAUSED: {
    bg: "rgba(245,158,11,0.12)",
    text: "#f59e0b",
    border: "rgba(245,158,11,0.3)",
  },
  COMPLETED: {
    bg: "rgba(16,185,129,0.12)",
    text: "#10b981",
    border: "rgba(16,185,129,0.3)",
  },
  FAILED: {
    bg: "rgba(239,68,68,0.12)",
    text: "#ef4444",
    border: "rgba(239,68,68,0.3)",
  },
  STOPPED: {
    bg: "rgba(100,116,139,0.12)",
    text: "#94a3b8",
    border: "rgba(100,116,139,0.3)",
  },
};

export function StatusBadge({ state, className }: StatusBadgeProps) {
  const c = config[state] ?? config.STOPPED;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold",
        className
      )}
      style={{
        background: c.bg,
        color: c.text,
        border: `1px solid ${c.border}`,
      }}
    >
      <span
        className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", c.pulse ? "animate-pulse" : "")}
        style={{ background: c.text }}
      />
      {state}
    </span>
  );
}
