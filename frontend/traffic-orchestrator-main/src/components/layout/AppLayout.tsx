import { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { cn } from "@/lib/utils";

// Bottom nav items for mobile
import {
  LayoutDashboard,
  Layers,
  Briefcase,
  Radio,
  BarChart3,
  ShieldAlert,
  Search,
  CalendarClock,
} from "lucide-react";
import { NavLink } from "react-router-dom";

const mobileNavItems = [
  { path: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { path: "/profiles", icon: Layers, label: "Profiles" },
  { path: "/jobs", icon: Briefcase, label: "Jobs" },
  { path: "/level2", icon: Radio, label: "L2" },
  { path: "/rfc2544", icon: BarChart3, label: "RFC" },
  { path: "/malicious", icon: ShieldAlert, label: "Threat" },
  { path: "/headers", icon: Search, label: "Headers" },
  { path: "/scheduler", icon: CalendarClock, label: "Schedule" },
];

export function AppLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const location = useLocation();

  return (
    <div className="flex h-screen overflow-hidden bg-[#0a0a0f]">
      {/* Sidebar — hidden on mobile */}
      <div className="hidden md:block">
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed((c) => !c)}
        />
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
          <div className="p-6">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav
        className="fixed bottom-0 left-0 right-0 flex md:hidden border-t border-white/[0.06] z-40"
        style={{ background: "#0d0d14" }}
      >
        {mobileNavItems.map(({ path, icon: Icon, label }) => {
          const isActive = location.pathname === path ||
            (path !== "/" && location.pathname.startsWith(path));
          return (
            <NavLink
              key={path}
              to={path}
              className={cn(
                "flex-1 flex flex-col items-center gap-1 py-2 text-[10px] transition-colors",
                isActive ? "text-[#e91e8c]" : "text-[#64748b]"
              )}
            >
              <Icon size={18} />
              <span>{label}</span>
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}
