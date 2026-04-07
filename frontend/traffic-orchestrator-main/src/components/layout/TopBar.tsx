import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { Wifi, WifiOff } from "lucide-react";
import { checkApiHealth } from "@/lib/api";

const titles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/profiles": "Profiles",
  "/jobs": "Jobs",
  "/level2": "Level-2 Probe",
  "/rfc2544": "RFC 2544 Benchmarking",
  "/malicious": "Threat Simulation",
  "/headers": "Header Inspection",
  "/scheduler": "Scheduler",
};

export function TopBar() {
  const location = useLocation();
  const [apiConnected, setApiConnected] = useState<boolean | null>(null);

  const pageTitle = titles[location.pathname] ?? "ATG";

  useEffect(() => {
    let active = true;
    const check = async () => {
      const ok = await checkApiHealth();
      if (active) setApiConnected(ok);
    };
    check();
    const interval = setInterval(check, 10000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <header
      className="h-16 flex items-center justify-between px-6 border-b border-white/[0.06] flex-shrink-0"
      style={{ background: "rgba(10,10,15,0.8)", backdropFilter: "blur(12px)" }}
    >
      <h1 className="text-white font-semibold text-lg">{pageTitle}</h1>

      <div className="flex items-center gap-3">
        {/* API Status */}
        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium"
          style={{
            background:
              apiConnected === null
                ? "rgba(100,116,139,0.1)"
                : apiConnected
                ? "rgba(16,185,129,0.1)"
                : "rgba(239,68,68,0.1)",
            border:
              apiConnected === null
                ? "1px solid rgba(100,116,139,0.3)"
                : apiConnected
                ? "1px solid rgba(16,185,129,0.3)"
                : "1px solid rgba(239,68,68,0.3)",
            color:
              apiConnected === null
                ? "#64748b"
                : apiConnected
                ? "#10b981"
                : "#ef4444",
          }}
        >
          {apiConnected === null ? (
            <div className="w-2 h-2 rounded-full bg-[#64748b] animate-pulse" />
          ) : apiConnected ? (
            <>
              <Wifi size={12} />
              <span>API: Connected</span>
            </>
          ) : (
            <>
              <WifiOff size={12} />
              <span>API: Offline</span>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
