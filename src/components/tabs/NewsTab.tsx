"use client";

import { EmptyState } from "../ui/EmptyState";
import { TabLayout } from "../ui/TabLayout";

export function NewsTab() {
  return (
    <TabLayout title="News" icon="pixel:newspaper">
      <EmptyState message="News Coming Soon" icon="pixel:newspaper" />
    </TabLayout>
  );
}
