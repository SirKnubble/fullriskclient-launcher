"use client";

import { TabHeader } from "../ui/TabHeader";
import { TabContent } from "../ui/TabContent";
// import { EmptyState } from "../ui/EmptyState"; // Replaced by CapeBrowser
import { CapeBrowser } from '../capes/CapeBrowser';

export function StoreTab() {
  return (
    <CapeBrowser />
  );
}
