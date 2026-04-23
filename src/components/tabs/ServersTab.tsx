"use client";

import { EmptyState } from "../ui/EmptyState";

export function ServersTab() {
  return (
    <div className="h-full w-full">
      <EmptyState
        icon="solar:server-bold"
        message="servers"
        description="coming soon"
      />
    </div>
  );
}
