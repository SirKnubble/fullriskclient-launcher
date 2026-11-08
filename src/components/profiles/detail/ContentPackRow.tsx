import type { CSSProperties } from "react";

interface ContentPackRowProps {
  contentPack?: any;
  isSelected?: boolean;
  onSelect?: () => void;
  onToggle?: () => void;
  onDelete?: () => void;
  onOpenDirectory?: () => void;
  onUpdate?: (pack: any) => void;
  updateVersion?: any;
  checkingUpdates?: boolean;
  iconType?: string;
  formatFileSize?: (size: number) => string;
  onCheckForUpdates?: () => void;
  style?: CSSProperties;
}

export function ContentPackRow({
  contentPack,
  isSelected = false,
  onSelect,
  onToggle,
  onDelete,
  onOpenDirectory,
  onUpdate,
  updateVersion,
  checkingUpdates,
  formatFileSize,
  style,
}: ContentPackRowProps) {
  const fileName = contentPack?.file_name || contentPack?.filename || "unknown";
  const fileSize = contentPack?.file_size ?? 0;

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

      <div className="flex h-10 w-10 items-center justify-center rounded-md border border-white/10 bg-white/5 text-lg">
        📁
      </div>

      <div className="min-w-0 flex-1">
        <div className="truncate font-medium text-white">{fileName}</div>
        <div className="text-xs text-white/50">
          {formatFileSize ? formatFileSize(fileSize) : `${fileSize} bytes`}
        </div>
      </div>

      <div className="w-16 text-center text-xs text-white/70">
        {contentPack?.enabled === false ? "disabled" : "enabled"}
      </div>

      <div className="flex w-24 items-center justify-center gap-2">
        {updateVersion && (
          <button
            type="button"
            onClick={() => onUpdate?.(contentPack)}
            className="rounded border border-emerald-400/60 bg-emerald-500/20 px-2 py-1 text-[10px] uppercase tracking-wide text-emerald-200"
          >
            {checkingUpdates ? "..." : "update"}
          </button>
        )}
        <button
          type="button"
          onClick={onToggle}
          className="rounded border border-white/20 bg-white/5 px-2 py-1 text-[10px] uppercase tracking-wide text-white"
        >
          {contentPack?.enabled === false ? "enable" : "disable"}
        </button>
        {onOpenDirectory && (
          <button
            type="button"
            onClick={onOpenDirectory}
            className="rounded border border-white/20 bg-white/5 px-2 py-1 text-[10px] uppercase tracking-wide text-white"
          >
            open
          </button>
        )}
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
