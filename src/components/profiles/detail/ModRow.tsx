import type { CSSProperties, ReactNode } from "react";
import type { Mod } from "../../../types/profile";

interface ModRowProps {
  mod: Mod;
  style?: CSSProperties;
  isSelected?: boolean;
  onSelect?: () => void;
  onToggle?: () => void;
  onDelete?: () => void;
  onUpdate?: (mod: Mod, version: any) => void;
  updateVersion?: any;
  checkingUpdates?: boolean;
  modrinthIconUrl?: string | null;
}

export function ModRow({
  mod,
  style,
  isSelected = false,
  onSelect,
  onToggle,
  onDelete,
  updateVersion,
  modrinthIconUrl,
}: ModRowProps) {
  return (
    <div
      style={style}
      className={[
        "flex items-center gap-3 border-b border-white/10 bg-black/10 px-3 py-2",
        isSelected ? "bg-white/10" : "",
      ].join(" ")}
    >
      <input
        type="checkbox"
        checked={isSelected}
        onChange={() => onSelect?.()}
        className="h-4 w-4"
      />

      <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-md border border-white/10 bg-white/5">
        {modrinthIconUrl ? (
          <img
            src={modrinthIconUrl}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="text-lg">📦</span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="truncate font-medium text-white">
          {mod.display_name || mod.id}
        </div>
        <div className="text-xs text-white/50">{mod.version || "unknown"}</div>
      </div>

      <div className="w-24 text-center text-xs text-white/70">
        {mod.enabled ? "enabled" : "disabled"}
      </div>

      <div className="flex w-24 items-center justify-center gap-2">
        {updateVersion && (
          <button
            type="button"
            onClick={() => onUpdate?.(mod, updateVersion)}
            className="rounded border border-emerald-400/60 bg-emerald-500/20 px-2 py-1 text-[10px] uppercase tracking-wide text-emerald-200"
          >
            update
          </button>
        )}
        <button
          type="button"
          onClick={onToggle}
          className="rounded border border-white/20 bg-white/5 px-2 py-1 text-[10px] uppercase tracking-wide text-white"
        >
          {mod.enabled ? "disable" : "enable"}
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="rounded border border-red-400/50 bg-red-500/10 px-2 py-1 text-[10px] uppercase tracking-wide text-red-200"
        >
          delete
        </button>
      </div>
    </div>
  );
}
