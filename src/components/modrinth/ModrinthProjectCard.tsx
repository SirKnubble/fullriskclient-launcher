import type { ReactNode } from "react";

interface ModrinthProjectCardProps {
  project?: any;
  isExpanded?: boolean;
  isLoading?: boolean;
  onToggleExpand?: () => void;
  installStatus?: any;
  children?: ReactNode;
}

export function ModrinthProjectCard({
  project,
  isExpanded,
  isLoading,
  onToggleExpand,
  installStatus,
  children,
}: ModrinthProjectCardProps) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium text-white">
            {project?.title || project?.slug || "Project"}
          </div>
          {project?.description && (
            <div className="mt-1 line-clamp-2 text-xs text-white/60">
              {project.description}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={onToggleExpand}
          className="rounded border border-white/20 bg-white/5 px-2 py-1 text-xs text-white"
        >
          {isExpanded ? "Hide" : isLoading ? "Loading..." : "Show"}
        </button>
      </div>
      {children}
      {installStatus && (
        <div className="mt-2 text-xs text-white/50">
          Install status: {String(installStatus)}
        </div>
      )}
    </div>
  );
}
