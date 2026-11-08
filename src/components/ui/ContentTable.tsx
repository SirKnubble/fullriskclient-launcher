import type { ReactNode } from "react";

export interface ContentTableHeader {
  key: string;
  label: string;
  sortable?: boolean;
  width?: string;
  className?: string;
}

export interface ContentTableProps {
  headers: ContentTableHeader[];
  sortKey?: string;
  sortDirection?: "asc" | "desc";
  onSort?: (criteria: string) => void;
  selectedCount?: number;
  totalCount?: number;
  filteredCount?: number;
  enabledCount?: number;
  onSelectAll?: () => void;
  contentType?: string;
  searchQuery?: string;
  children?: ReactNode;
}

export function ContentTable({
  headers,
  children,
  selectedCount = 0,
  totalCount = 0,
  filteredCount = 0,
  enabledCount = 0,
  searchQuery,
  contentType = "content",
}: ContentTableProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-2 text-sm text-white/60">
        <div className="flex items-center gap-2">
          <span>{selectedCount} selected</span>
          <span className="text-white/30">•</span>
          <span>
            {filteredCount} / {totalCount} {contentType}
          </span>
          {enabledCount > 0 && (
            <>
              <span className="text-white/30">•</span>
              <span>{enabledCount} enabled</span>
            </>
          )}
        </div>
        {searchQuery && (
          <span className="text-white/40">Search: {searchQuery}</span>
        )}
      </div>

      <div className="grid grid-cols-[auto_1fr_auto_auto] gap-2 border-b border-white/10 px-3 py-2 text-xs uppercase tracking-wide text-white/50">
        {headers.map((header) => (
          <div
            key={header.key}
            className={header.className ?? ""}
            style={{ width: header.width }}
          >
            {header.label}
          </div>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-auto">{children}</div>
    </div>
  );
}
