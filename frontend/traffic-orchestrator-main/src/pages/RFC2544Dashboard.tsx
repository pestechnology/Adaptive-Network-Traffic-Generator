import { useState } from "react";
import { BarChart3, Play, ChevronDown } from "lucide-react";
import { runRFC2544, getRFC2544Results, getRFC2544Result } from "@/lib/api";
import { RFC2544Result, RFC2544FrameResult } from "@/types/traffic";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { AtgBarChart } from "@/components/charts/AtgBarChart";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const FRAME_SIZES = [64, 128, 256, 512, 1024, 1280, 1518];

export default function RFC2544Dashboard() {
  // ── Form state ────────────────────────────────────────────────────────────
  const [destination, setDestination]     = useState("");
  const [protocol, setProtocol]           = useState("icmp");
  const [selectedSizes, setSelectedSizes] = useState<number[]>([64, 512, 1518]);
  const [trialDuration, setTrialDuration] = useState(5);
  const [maxRate, setMaxRate]             = useState(1000);
  const [fastMode, setFastMode]           = useState(false);
  const [running, setRunning]             = useState(false);
  const [destErr, setDestErr]             = useState("");

  // ── Results state ─────────────────────────────────────────────────────────
  const [selectedResult, setSelectedResult] = useState<RFC2544Result | null>(null);

  // IMPORTANT: default must be [] so .map() never runs on undefined/object
  const { data: results = [], refetch } = useQuery<RFC2544Result[]>({
    queryKey: ["rfc2544-results"],
    queryFn:  getRFC2544Results,
    // Ensure the return is always an array — belt-and-suspenders guard
    select: (data) => (Array.isArray(data) ? data : []),
    refetchInterval: 15000,
  });

  const toggleSize = (sz: number) =>
    setSelectedSizes((s) =>
      s.includes(sz) ? s.filter((x) => x !== sz) : [...s, sz]
    );

  const run = async () => {
    if (!destination.trim()) {
      setDestErr("Destination IP is required");
      return;
    }
    if (selectedSizes.length === 0) {
      toast.error("Select at least one frame size");
      return;
    }
    setDestErr("");
    setRunning(true);
    try {
      await runRFC2544({
        destination,
        protocol,
        frame_sizes:    selectedSizes.sort((a, b) => a - b),
        trial_duration: trialDuration,
        max_rate_mbps:  maxRate,
        fast_mode:      fastMode,
      });
      toast.success("RFC 2544 test started — results will appear in history once complete.");
      refetch();
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? "Test failed to start";
      toast.error(msg);
    } finally {
      setRunning(false);
    }
  };

  const loadResult = async (id: string) => {
    try {
      const r = await getRFC2544Result(id);
      setSelectedResult(r as RFC2544Result);
    } catch {
      toast.error("Failed to load result details");
    }
  };

  // ── Chart data derivations ────────────────────────────────────────────────
  // All guarded with ?. and ?? [] / ?? 0 so they never crash on missing data

  const frameResults: RFC2544FrameResult[] = Array.isArray(selectedResult?.results)
    ? selectedResult!.results
    : [];

  const throughputData = frameResults.map((r) => ({
    frame:      String(r.frame_size),
    Throughput: r.max_zero_loss_mbps ?? 0,
  }));

  const latencyData = frameResults.map((r) => ({
    frame: String(r.frame_size),
    Avg:   r.avg_latency_ms ?? 0,
    Min:   r.min_latency_ms ?? 0,
    Max:   r.max_latency_ms ?? 0,
  }));

  // Frame loss: one line per frame size, keyed by "<size>B"
  // Merge all points by load_pct so recharts gets one array with multiple keys
  const frameLossData = (() => {
    if (frameResults.length === 0) return [];
    const byLoad: Record<number, Record<string, number>> = {};
    for (const r of frameResults) {
      const key = `${r.frame_size}B`;
      for (const p of r.frame_loss_points ?? []) {
        if (!byLoad[p.load_pct]) byLoad[p.load_pct] = { load: p.load_pct };
        byLoad[p.load_pct][key] = p.loss_pct;
      }
    }
    return Object.values(byLoad).sort((a, b) => (a.load as number) - (b.load as number));
  })();

  // Keys for the frame-loss line chart (all "<size>B" keys)
  const frameLossKeys = frameResults.map((r) => `${r.frame_size}B`);
  const LOSS_COLORS   = ["#e91e8c", "#7c3aed", "#3b82f6", "#10b981", "#f59e0b", "#f97316", "#06b6d4"];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 animate-fade-up">

      {/* ── Run Form ─────────────────────────────────────────────────────── */}
      <div
        className="rounded-xl p-6"
        style={{ background: "#12121a", border: "1px solid rgba(255,255,255,0.08)" }}
      >
        <div className="flex items-center gap-2 mb-5">
          <BarChart3 size={18} style={{ color: "#7c3aed" }} />
          <h2 className="text-white font-semibold">RFC 2544 Test Configuration</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left column */}
          <div className="space-y-4">
            {/* Destination */}
            <div>
              <label className="text-xs text-[#94a3b8] mb-1 block">Destination IP</label>
              <input
                type="text"
                placeholder="192.168.1.1"
                className="w-full rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:ring-2 focus:ring-[#7c3aed]/50"
                style={{
                  background: "#0d0d14",
                  border: `1px solid ${destErr ? "#ef4444" : "rgba(255,255,255,0.1)"}`,
                }}
                value={destination}
                onChange={(e) => { setDestination(e.target.value); setDestErr(""); }}
              />
              {destErr && <p className="text-xs text-[#ef4444] mt-1">{destErr}</p>}
            </div>

            {/* Protocol */}
            <div>
              <label className="text-xs text-[#94a3b8] mb-1 block">Protocol</label>
              <select
                className="w-full rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
                style={{ background: "#0d0d14", border: "1px solid rgba(255,255,255,0.1)" }}
                value={protocol}
                onChange={(e) => setProtocol(e.target.value)}
              >
                {["icmp", "tcp", "udp"].map((p) => (
                  <option key={p} value={p}>{p.toUpperCase()}</option>
                ))}
              </select>
            </div>

            {/* Frame sizes */}
            <div>
              <label className="text-xs text-[#94a3b8] mb-2 block">Frame Sizes (bytes)</label>
              <div className="flex flex-wrap gap-2">
                {FRAME_SIZES.map((sz) => (
                  <button
                    key={sz}
                    onClick={() => toggleSize(sz)}
                    className="px-3 py-1 rounded-md text-xs font-mono transition-all"
                    style={
                      selectedSizes.includes(sz)
                        ? {
                            background: "rgba(124,58,237,0.2)",
                            color: "#7c3aed",
                            border: "1px solid rgba(124,58,237,0.5)",
                          }
                        : {
                            background: "#0d0d14",
                            color: "#64748b",
                            border: "1px solid rgba(255,255,255,0.08)",
                          }
                    }
                  >
                    {sz}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right column */}
          <div className="space-y-4">
            {/* Trial duration slider */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-[#94a3b8]">Trial Duration</span>
                <span className="text-white font-mono">{trialDuration}s</span>
              </div>
              <input
                type="range" min={1} max={120} step={1} value={trialDuration}
                onChange={(e) => setTrialDuration(Number(e.target.value))}
                className="w-full"
                style={{ accentColor: "#7c3aed" }}
              />
            </div>

            {/* Max rate slider */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-[#94a3b8]">Max Rate</span>
                <span className="text-white font-mono">{maxRate} Mbps</span>
              </div>
              <input
                type="range" min={10} max={10000} step={10} value={maxRate}
                onChange={(e) => setMaxRate(Number(e.target.value))}
                className="w-full"
                style={{ accentColor: "#7c3aed" }}
              />
            </div>

            {/* Fast mode */}
            <label className="flex items-center gap-2 text-sm text-[#94a3b8] cursor-pointer select-none">
              <input
                type="checkbox"
                checked={fastMode}
                onChange={(e) => setFastMode(e.target.checked)}
                className="rounded"
              />
              Fast mode (reduced iterations, ~10 s per frame)
            </label>
          </div>
        </div>

        <button
          onClick={run}
          disabled={running}
          className="mt-5 flex items-center gap-2 px-6 py-2.5 rounded-lg font-semibold text-sm transition-all hover:opacity-90 active:scale-95 disabled:opacity-50"
          style={{ background: "linear-gradient(135deg, #7c3aed, #3b82f6)", color: "#fff" }}
        >
          {running ? (
            "Queuing test…"
          ) : (
            <>
              <Play size={15} />
              Run RFC 2544
            </>
          )}
        </button>
      </div>

      {/* ── Results ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* History list */}
        <div
          className="rounded-xl overflow-hidden"
          style={{ background: "#12121a", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          <div className="px-4 py-3 border-b border-white/[0.06] text-white font-semibold text-sm">
            Test History
          </div>

          {results.length === 0 ? (
            <EmptyState
              icon={BarChart3}
              title="No results yet"
              description="Run your first RFC 2544 test above."
            />
          ) : (
            <div className="divide-y divide-white/[0.05]">
              {results.map((r) => (
                <button
                  key={r.id}
                  onClick={() => loadResult(r.id)}
                  className="w-full px-4 py-3 text-left hover:bg-white/[0.03] transition-colors flex items-center justify-between"
                  style={
                    selectedResult?.id === r.id
                      ? { borderLeft: "3px solid #7c3aed" }
                      : undefined
                  }
                >
                  <div>
                    <div className="text-white text-xs font-medium font-mono">
                      {r.destination}
                    </div>
                    <div className="text-[#64748b] text-[10px] mt-0.5">
                      {new Date(r.timestamp).toLocaleString()}
                    </div>
                    <div className="text-[#64748b] text-[10px]">
                      {r.protocol?.toUpperCase()} · {r.results?.length ?? 0} frame sizes
                    </div>
                  </div>
                  <ChevronDown size={14} className="text-[#64748b] flex-shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Charts panel */}
        <div className="lg:col-span-2 space-y-4">
          {!selectedResult ? (
            <div
              className="rounded-xl p-10 flex flex-col items-center justify-center text-center"
              style={{ background: "#12121a", border: "1px solid rgba(255,255,255,0.08)", minHeight: 240 }}
            >
              <BarChart3 size={32} className="text-[#64748b] mb-3" />
              <p className="text-[#64748b] text-sm">
                Select a result from the history to view charts.
              </p>
            </div>
          ) : (
            <>
              {/* Throughput chart */}
              {throughputData.length > 0 && (
                <div
                  className="rounded-xl p-5"
                  style={{ background: "#12121a", border: "1px solid rgba(255,255,255,0.08)" }}
                >
                  <h4 className="text-white text-sm font-semibold mb-4">
                    Throughput — max zero-loss rate per frame size
                  </h4>
                  <AtgBarChart
                    data={throughputData}
                    xKey="frame"
                    bars={[{ key: "Throughput", label: "Mbps", color: "#7c3aed" }]}
                    height={180}
                    showLegend={false}
                  />
                </div>
              )}

              {/* Latency chart */}
              {latencyData.length > 0 && (
                <div
                  className="rounded-xl p-5"
                  style={{ background: "#12121a", border: "1px solid rgba(255,255,255,0.08)" }}
                >
                  <h4 className="text-white text-sm font-semibold mb-4">
                    Latency per frame size (ms)
                  </h4>
                  <AtgBarChart
                    data={latencyData}
                    xKey="frame"
                    bars={[
                      { key: "Avg", label: "Avg ms", color: "#e91e8c" },
                      { key: "Min", label: "Min ms", color: "#10b981" },
                      { key: "Max", label: "Max ms", color: "#f59e0b" },
                    ]}
                    height={180}
                  />
                </div>
              )}

              {/* Frame loss curve */}
              {frameLossData.length > 0 && frameLossKeys.length > 0 && (
                <div
                  className="rounded-xl p-5"
                  style={{ background: "#12121a", border: "1px solid rgba(255,255,255,0.08)" }}
                >
                  <h4 className="text-white text-sm font-semibold mb-4">
                    Frame loss rate vs load
                  </h4>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={frameLossData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis
                        dataKey="load"
                        tick={{ fill: "#64748b", fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                        label={{ value: "Load %", position: "insideBottom", offset: -2, fill: "#64748b", fontSize: 10 }}
                      />
                      <YAxis
                        tick={{ fill: "#64748b", fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                        label={{ value: "Loss %", angle: -90, position: "insideLeft", fill: "#64748b", fontSize: 10 }}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "#1a1a28",
                          border: "1px solid rgba(255,255,255,0.1)",
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                        labelStyle={{ color: "#94a3b8" }}
                        itemStyle={{ color: "#fff" }}
                      />
                      {frameLossKeys.map((key, i) => (
                        <Line
                          key={key}
                          type="monotone"
                          dataKey={key}
                          stroke={LOSS_COLORS[i % LOSS_COLORS.length]}
                          strokeWidth={2}
                          dot={{ r: 3 }}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
