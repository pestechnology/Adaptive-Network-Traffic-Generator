import { useEffect, useState } from "react";
import { Search, Layers, FileText } from "lucide-react";
import { getProfiles } from "@/lib/api";

interface ProfilesListProps {
  onSelect: (profileName: string) => void;
}

export function ProfilesList({ onSelect }: ProfilesListProps) {
  const [profiles, setProfiles] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    getProfiles().then(setProfiles).catch(console.error);
  }, []);

  const filteredProfiles = profiles.filter((p) =>
    p.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="space-y-2">
        <div className="section-label">
          <div className="w-6 h-6 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center">
            <Layers className="h-3.5 w-3.5" />
          </div>
          Profile Registry
        </div>
        <h3 className="font-display text-xl font-bold tracking-tight">Saved Traffic Profiles</h3>
        <p className="text-sm text-text-secondary">Select a profile to inspect configuration parameters.</p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary pointer-events-none" />
        <input
          type="text"
          placeholder="Search profiles..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="premium-input pl-10"
          style={{ fontFamily: "var(--font-sans)" }}
        />
      </div>

      {/* Count */}
      {profiles.length > 0 && (
        <p className="text-xs text-text-secondary">
          {filteredProfiles.length} of {profiles.length} profiles
        </p>
      )}

      {/* List */}
      <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">

        {filteredProfiles.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center space-y-3 rounded-2xl border border-dashed border-border">
            <div className="w-10 h-10 rounded-xl bg-surface flex items-center justify-center">
              <FileText className="h-5 w-5 text-text-secondary" />
            </div>
            <p className="text-sm text-text-secondary">
              {search ? "No profiles match your search." : "No profiles yet. Create one above."}
            </p>
          </div>
        )}

        {filteredProfiles.map((profile) => {
          const isActive = selected === profile;
          return (
            <div
              key={profile}
              onClick={() => { setSelected(profile); onSelect(profile); }}
              className={`cursor-pointer rounded-xl border px-4 py-3.5 text-sm transition-all duration-200 ${isActive
                  ? "border-primary/50 bg-primary/8 glow-primary"
                  : "border-border bg-surface/60 hover:bg-surface-elevated hover:border-border"
                }`}
              style={isActive ? { borderLeft: "3px solid hsl(var(--primary))" } : {}}
            >
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2.5">
                  <div className={`w-2 h-2 rounded-full transition-all ${isActive ? "bg-primary shadow-[0_0_6px_hsl(var(--primary))]" : "bg-border"
                    }`} />
                  <span className={`font-medium ${isActive ? "text-primary" : "text-foreground"}`}>
                    {profile}
                  </span>
                </div>
                {isActive && (
                  <span className="text-[10px] text-primary uppercase tracking-widest font-medium">
                    Selected ✓
                  </span>
                )}
              </div>
            </div>
          );
        })}

      </div>
    </div>
  );
}
