import { useState } from "react";
import { getMaliciousRegistry, requestApproval, runMalicious } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

type Attack = {
  type: string;
  name: string;
  description: string;
};

export default function MaliciousPanel() {
  const { data, isLoading } = useQuery({
    queryKey: ["malicious-registry"],
    queryFn: getMaliciousRegistry,
  });

  // 🔥 ABSOLUTE SAFE NORMALIZATION (NO CRASH POSSIBLE)
  let attacks: Attack[] = [];

  if (Array.isArray(data)) {
    attacks = data;
  } else if (data && typeof data === "object") {
    attacks = Object.keys(data).map((key) => ({
      type: key,
      name: key.replace(/_/g, " ").toUpperCase(),
      description: `${key.replace(/_/g, " ")} attack`,
    }));
  }

  const [selectedAttack, setSelectedAttack] = useState("");
  const [token, setToken] = useState("");
  const [target, setTarget] = useState("");
  const [duration, setDuration] = useState(10);
  const [intensity, setIntensity] = useState("medium");

  // ✅ FIXED APPROVAL
  const handleApprove = async () => {
    if (!selectedAttack) {
      toast.error("Select attack");
      return;
    }

    try {
      const res = await requestApproval({
        attack_type: selectedAttack,
        justification: "Authorized security testing for project validation",
      });

      setToken(res.token);
      toast.success("Approval token granted");
    } catch (err: any) {
      console.error(err);
      toast.error(err?.response?.data?.detail || "Approval failed");
    }
  };

  // ✅ EXECUTION
  const handleExecute = async () => {
    if (!token) {
      toast.error("No approval token");
      return;
    }

    if (!target) {
      toast.error("Enter target IP");
      return;
    }

    try {
      const res = await runMalicious({
        attack_type: selectedAttack,
        target,
        duration,
        intensity,
        token,
      });

      toast.success(`Attack started: ${res.job_id}`);
      setToken("");
    } catch (err: any) {
      console.error(err);
      toast.error(err?.response?.data?.detail || "Execution failed");
    }
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-bold text-red-500">
        Malicious Traffic Simulation
      </h1>

      {/* Attack List */}
      <div className="grid grid-cols-2 gap-3">
        {isLoading && <p>Loading attacks...</p>}

        {!isLoading && attacks.length === 0 && (
          <p className="text-gray-400">No attacks available</p>
        )}

        {attacks.length > 0 &&
          attacks.map((a) => (
            <button
              key={a.type}
              onClick={() => setSelectedAttack(a.type)}
              className={`p-3 border rounded ${
                selectedAttack === a.type
                  ? "border-red-500"
                  : "border-gray-600"
              }`}
            >
              <div className="font-semibold">{a.name}</div>
              <div className="text-xs text-gray-400">
                {a.description}
              </div>
            </button>
          ))}
      </div>

      {/* Approval */}
      <div className="space-y-2">
        <button
          onClick={handleApprove}
          className="bg-red-600 px-4 py-2 rounded"
        >
          Get Approval Token
        </button>

        {token && (
          <p className="text-green-400 text-sm font-mono break-all">
            {token}
          </p>
        )}
      </div>

      {/* Execution */}
      <div className="space-y-3">
        <input
          placeholder="Target IP (e.g., 192.168.1.1)"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          className="w-full p-2 bg-black border border-gray-700"
        />

        <input
          type="number"
          value={duration}
          onChange={(e) => setDuration(Number(e.target.value))}
          className="w-full p-2 bg-black border border-gray-700"
        />

        <select
          value={intensity}
          onChange={(e) => setIntensity(e.target.value)}
          className="w-full p-2 bg-black border border-gray-700"
        >
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>

        <button
          onClick={handleExecute}
          className="bg-red-500 px-4 py-2 rounded w-full"
        >
          Execute Attack
        </button>
      </div>
    </div>
  );
}