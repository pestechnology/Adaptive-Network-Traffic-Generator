import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-16 px-4 text-center",
        className
      )}
    >
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
        style={{ background: "rgba(233,30,140,0.08)", border: "1px solid rgba(233,30,140,0.15)" }}
      >
        <Icon size={28} style={{ color: "#e91e8c", opacity: 0.6 }} />
      </div>
      <h3 className="text-white font-semibold text-lg mb-2">{title}</h3>
      <p className="text-[#64748b] text-sm max-w-xs mb-6">{description}</p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="px-5 py-2 rounded-lg text-sm font-medium text-white transition-all duration-200 hover:opacity-90 active:scale-95"
          style={{ background: "linear-gradient(135deg, #e91e8c, #7c3aed)" }}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
