import { useState, useEffect } from "react";
import { Plus, Edit2, Trash2, Play, Layers } from "lucide-react";
import { useProfiles } from "@/lib/hooks/useProfiles";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { executeTraffic } from "@/lib/api";
import { TrafficItem, Profile } from "@/types/traffic";

const PROTOCOLS = ["ICMP", "TCP", "UDP", "HTTP", "HTTPS", "SSH"] as const;

function StepRow({
  step,
  index,
  onChange,
  onRemove,
}: {
  step: TrafficItem;
  index: number;
  onChange: (i: number, val: TrafficItem) => void;
  onRemove: (i: number) => void;
}) {
  const update = (field: keyof TrafficItem, val: unknown) =>
    onChange(index, { ...step, [field]: val });

  return (
    <div
      className="grid grid-cols-2 md:grid-cols-5 gap-2 p-3 rounded-lg"
      style={{ background: "#0d0d14", border: "1px solid rgba(255,255,255,0.06)" }}
    >
      <select
        className="rounded-md px-2 py-1.5 text-xs text-white focus:outline-none"
        style={{ background: "#151520", border: "1px solid rgba(255,255,255,0.1)" }}
        value={step.protocol}
        onChange={(e) => update("protocol", e.target.value)}
      >
        {PROTOCOLS.map((p) => <option key={p} value={p}>{p}</option>)}
      </select>
      <input
        type="number"
        placeholder="Count"
        className="rounded-md px-2 py-1.5 text-xs text-white focus:outline-none"
        style={{ background: "#151520", border: "1px solid rgba(255,255,255,0.1)" }}
        value={step.count}
        onChange={(e) => update("count", parseInt(e.target.value) || 0)}
      />
      <input
        type="number"
        placeholder="Pkt Size"
        className="rounded-md px-2 py-1.5 text-xs text-white focus:outline-none"
        style={{ background: "#151520", border: "1px solid rgba(255,255,255,0.1)" }}
        value={step.packet_size ?? ""}
        onChange={(e) => update("packet_size", parseInt(e.target.value) || undefined)}
      />
      <input
        type="number"
        placeholder="Pkts/sec"
        className="rounded-md px-2 py-1.5 text-xs text-white focus:outline-none"
        style={{ background: "#151520", border: "1px solid rgba(255,255,255,0.1)" }}
        value={step.packets_per_second ?? ""}
        onChange={(e) => update("packets_per_second", parseInt(e.target.value) || undefined)}
      />
      <button
        onClick={() => onRemove(index)}
        className="flex items-center justify-center text-[#ef4444] hover:bg-[#ef4444]/10 rounded-md transition-colors py-1.5"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}

function ProfileModal({
  open,
  editingName,
  initialProfile,
  onClose,
  onSave,
}: {
  open: boolean;
  editingName: string | null;
  initialProfile?: Profile;
  onClose: () => void;
  onSave: (name: string, traffic: TrafficItem[]) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [steps, setSteps] = useState<TrafficItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [nameErr, setNameErr] = useState("");

  useEffect(() => {
    if (open) {
      setName(initialProfile?.name ?? "");
      setSteps(initialProfile?.traffic ?? []);
      setNameErr("");
    }
  }, [open, initialProfile]);

  const addStep = () =>
    setSteps((s) => [...s, { protocol: "ICMP", count: 100, packet_size: 64, packets_per_second: 100 }]);

  const handleSave = async () => {
    if (!name.trim()) { setNameErr("Name is required"); return; }
    setSaving(true);
    try {
      await onSave(name.trim(), steps);
      onClose();
    } catch {
      toast.error("Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="max-w-2xl max-h-[90vh] overflow-y-auto"
        style={{ background: "#12121a", border: "1px solid rgba(255,255,255,0.1)" }}
      >
        <DialogHeader>
          <DialogTitle className="text-white">
            {editingName ? "Edit Profile" : "Create Profile"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div>
            <label className="text-xs text-[#94a3b8] mb-1 block">Profile Name</label>
            <input
              type="text"
              className="w-full rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#e91e8c]/50"
              style={{ background: "#0d0d14", border: `1px solid ${nameErr ? "#ef4444" : "rgba(255,255,255,0.1)"}` }}
              value={name}
              onChange={(e) => { setName(e.target.value); setNameErr(""); }}
              placeholder="my-profile"
              disabled={!!editingName}
            />
            {nameErr && <p className="text-xs text-[#ef4444] mt-1">{nameErr}</p>}
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-[#94a3b8]">Traffic Steps</label>
              <button
                onClick={addStep}
                className="flex items-center gap-1 text-xs px-2 py-1 rounded-md transition-colors hover:bg-white/[0.05] text-[#e91e8c]"
              >
                <Plus size={12} /> Add Step
              </button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-2 px-3 text-[10px] text-[#64748b] uppercase tracking-wider">
              <span>Protocol</span>
              <span>Count</span>
              <span>Pkt Size</span>
              <span>Pkts/sec</span>
              <span />
            </div>
            <div className="space-y-2">
              {steps.map((step, i) => (
                <StepRow
                  key={i}
                  step={step}
                  index={i}
                  onChange={(idx, val) => setSteps((s) => s.map((x, j) => j === idx ? val : x))}
                  onRemove={(idx) => setSteps((s) => s.filter((_, j) => j !== idx))}
                />
              ))}
              {steps.length === 0 && (
                <p className="text-[#64748b] text-xs text-center py-4">No steps yet. Click "Add Step" to begin.</p>
              )}
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-2.5 rounded-lg font-semibold text-sm transition-all hover:opacity-90 active:scale-95 disabled:opacity-50"
            style={{ background: "linear-gradient(135deg, #e91e8c, #7c3aed)", color: "#fff" }}
          >
            {saving ? "Saving…" : editingName ? "Update Profile" : "Create Profile"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function ProfilesPage() {
  const { profileNames, isLoading, getProfile, createProfile, updateProfile, deleteProfile } =
    useProfiles();

  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<{ name: string; profile?: Profile } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [runTarget, setRunTarget] = useState<string | null>(null);
  const [runDest, setRunDest] = useState("");
  const [running, setRunning] = useState(false);

  const handleCreate = async (name: string, traffic: TrafficItem[]) => {
    await createProfile({ name, traffic });
    toast.success("Profile created!");
  };

  const handleEdit = async (profileName: string) => {
    const p = await getProfile(profileName);
    setEditTarget({ name: profileName, profile: p });
  };

  const handleUpdate = async (name: string, traffic: TrafficItem[]) => {
    await updateProfile({ name, data: { name, traffic } });
    toast.success("Profile updated!");
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteProfile(deleteTarget);
    toast.success("Profile deleted");
    setDeleteTarget(null);
  };

  const handleRun = async () => {
    if (!runTarget || !runDest) { toast.error("Enter a destination IP"); return; }
    setRunning(true);
    try {
      await executeTraffic({ profile_name: runTarget, destination: runDest });
      toast.success("Job launched!");
      setRunTarget(null);
    } catch {
      toast.error("Failed to launch");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-white font-semibold text-lg">Traffic Profiles</h2>
          <p className="text-[#64748b] text-sm mt-1">
            {profileNames.length} profile{profileNames.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all hover:opacity-90 active:scale-95"
          style={{ background: "linear-gradient(135deg, #e91e8c, #7c3aed)", color: "#fff" }}
        >
          <Plus size={15} /> New Profile
        </button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-36 rounded-xl animate-pulse" style={{ background: "#12121a" }} />
          ))}
        </div>
      ) : profileNames.length === 0 ? (
        <EmptyState
          icon={Layers}
          title="No profiles yet"
          description="Create your first traffic profile to start generating network traffic."
          actionLabel="Create Profile"
          onAction={() => setShowCreate(true)}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {profileNames.map((name) => (
            <div
              key={name}
              className="rounded-xl p-5 transition-all duration-200 group"
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
              <div className="flex items-start justify-between mb-4">
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center"
                  style={{ background: "rgba(233,30,140,0.12)" }}
                >
                  <Layers size={18} style={{ color: "#e91e8c" }} />
                </div>
              </div>
              <h3 className="text-white font-semibold mb-4 truncate">{name}</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setRunTarget(name)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-90 active:scale-95"
                  style={{ background: "rgba(233,30,140,0.12)", color: "#e91e8c", border: "1px solid rgba(233,30,140,0.25)" }}
                >
                  <Play size={12} /> Run
                </button>
                <button
                  onClick={() => handleEdit(name)}
                  className="flex items-center justify-center p-1.5 rounded-lg text-[#94a3b8] hover:text-white hover:bg-white/[0.05] transition-colors"
                >
                  <Edit2 size={14} />
                </button>
                <button
                  onClick={() => setDeleteTarget(name)}
                  className="flex items-center justify-center p-1.5 rounded-lg text-[#94a3b8] hover:text-[#ef4444] hover:bg-[#ef4444]/10 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      <ProfileModal
        open={showCreate}
        editingName={null}
        onClose={() => setShowCreate(false)}
        onSave={handleCreate}
      />

      {/* Edit Modal */}
      {editTarget && (
        <ProfileModal
          open
          editingName={editTarget.name}
          initialProfile={editTarget.profile}
          onClose={() => setEditTarget(null)}
          onSave={handleUpdate}
        />
      )}

      {/* Delete Confirm */}
      <ConfirmModal
        open={!!deleteTarget}
        title="Delete Profile"
        description={`Are you sure you want to delete "${deleteTarget}"? This cannot be undone.`}
        confirmLabel="Delete"
        destructive
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* Run Dialog */}
      <Dialog open={!!runTarget} onOpenChange={(o) => !o && setRunTarget(null)}>
        <DialogContent style={{ background: "#12121a", border: "1px solid rgba(255,255,255,0.1)" }}>
          <DialogHeader>
            <DialogTitle className="text-white">Run "{runTarget}"</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <label className="text-xs text-[#94a3b8] mb-1 block">Destination IP</label>
              <input
                type="text"
                placeholder="192.168.1.1"
                className="w-full rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:ring-2 focus:ring-[#e91e8c]/50"
                style={{ background: "#0d0d14", border: "1px solid rgba(255,255,255,0.1)" }}
                value={runDest}
                onChange={(e) => setRunDest(e.target.value)}
              />
            </div>
            <button
              onClick={handleRun}
              disabled={running}
              className="w-full py-2.5 rounded-lg font-semibold text-sm transition-all hover:opacity-90 active:scale-95 disabled:opacity-50"
              style={{ background: "linear-gradient(135deg, #e91e8c, #7c3aed)", color: "#fff" }}
            >
              {running ? "Launching…" : "Launch Job"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
