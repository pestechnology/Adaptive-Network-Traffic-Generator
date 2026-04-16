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
import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Layers,
  Briefcase,
  Radio,
  BarChart3,
  ShieldAlert,
  Search,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { path: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { path: "/profiles", icon: Layers, label: "Profiles" },
  { path: "/jobs", icon: Briefcase, label: "Jobs" },
  { path: "/level2", icon: Radio, label: "Level-2 Probe" },
  { path: "/rfc2544", icon: BarChart3, label: "RFC 2544" },
  { path: "/malicious", icon: ShieldAlert, label: "Threat Sim" },
  { path: "/headers", icon: Search, label: "Header Inspector" },
  { path: "/scheduler", icon: CalendarClock, label: "Scheduler" },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const location = useLocation();

  return (
    <aside
      className={cn(
        "flex flex-col h-screen sticky top-0 transition-all duration-300 ease-in-out z-30",
        "border-r border-white/[0.06]",
        collapsed ? "w-16" : "w-64"
      )}
      style={{ background: "#0d0d14" }}
    >
      {/* Logo */}
      <div className="flex items-center h-16 px-4 border-b border-white/[0.06] flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{
              background: "linear-gradient(135deg, #e91e8c, #7c3aed)",
              boxShadow: "0 0 20px rgba(233,30,140,0.4)",
            }}
          >
            <Zap size={16} className="text-white" />
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <div className="text-white font-bold text-sm leading-tight font-display">ATG</div>
              <div
                className="text-[10px] font-medium px-1.5 py-0.5 rounded-full inline-block"
                style={{
                  background: "rgba(233,30,140,0.15)",
                  color: "#e91e8c",
                  border: "1px solid rgba(233,30,140,0.3)",
                }}
              >
                v2.0
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
        {navItems.map(({ path, icon: Icon, label }) => {
          const isActive = location.pathname === path ||
            (path !== "/" && location.pathname.startsWith(path));
          return (
            <NavLink
              key={path}
              to={path}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group relative",
                isActive
                  ? "text-white"
                  : "text-[#94a3b8] hover:text-white hover:bg-white/[0.05]"
              )}
              style={
                isActive
                  ? {
                      background: "rgba(233,30,140,0.1)",
                      borderLeft: "2px solid #e91e8c",
                      color: "#e91e8c",
                    }
                  : { borderLeft: "2px solid transparent" }
              }
              title={collapsed ? label : undefined}
            >
              <Icon size={18} className="flex-shrink-0" />
              {!collapsed && <span className="truncate">{label}</span>}
              {collapsed && (
                <div
                  className="absolute left-full ml-2 px-2 py-1 rounded-md text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50"
                  style={{ background: "#1a1a28", border: "1px solid rgba(255,255,255,0.1)", color: "#fff" }}
                >
                  {label}
                </div>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Toggle Btn */}
      <div className="p-3 border-t border-white/[0.06] flex-shrink-0">
        <button
          onClick={onToggle}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-[#94a3b8] hover:text-white hover:bg-white/[0.05] transition-all duration-200 text-xs"
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  );
}
