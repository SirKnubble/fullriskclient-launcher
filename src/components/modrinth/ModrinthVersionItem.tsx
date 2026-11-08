import type { ReactNode } from "react";

interface ModrinthVersionItemProps {
  version?: any;
  file?: any;
  installState?: any;
  onInstall?: () => void;
  isModpack?: boolean;
}

export function ModrinthVersionItem({
  version,
  file,
  installState,
  onInstall,
  isModpack,
}: ModrinthVersionItemProps) {
  return (
    <div className="rounded border border-white/10 bg-black/20 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-white">
            {version?.version_number || version?.name || "Version"}
          </div>
          {file?.filename && (
            <div className="mt-1 truncate text-xs text-white/50">
              {file.filename}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={onInstall}
          className="rounded border border-emerald-400/60 bg-emerald-500/20 px-2 py-1 text-xs text-emerald-100"
        >
          {isModpack
            ? "Install modpack"
            : installState === "success"
              ? "Installed"
              : "Install"}
        </button>
      </div>
    </div>
  );
}
