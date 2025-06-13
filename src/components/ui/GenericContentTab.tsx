"use client";

import { ReactNode, useState, useEffect } from "react";
import { Icon } from "@iconify/react";
import { Button } from "./buttons/Button";
// import { SearchInput } from "./SearchInput"; // No longer using internal SearchInput
import { GenericList } from "./GenericList";
import { useThemeStore } from "../../store/useThemeStore"; // Assuming path
import { preloadIcons } from "../../lib/icon-utils"; // Assuming path

const GENERIC_CONTENT_TAB_DEFAULT_ICONS = [
  "solar:refresh-circle-bold-duotone", // For loading state in refresh button
  "solar:refresh-outline", // Icon for normal state (added)
];

interface GenericContentTabProps<T> {
  items: T[];
  renderListItem: (item: T, index: number) => ReactNode;
  isLoading?: boolean;
  error?: string | null;
  onRefreshData?: () => void;
  searchQuery?: string; // For GenericList to filter based on external search
  
  primaryLeftActions?: ReactNode;
  primaryRightActions?: ReactNode;
  secondaryLeftActions?: ReactNode;
  secondaryRightActions?: ReactNode;
  showSecondaryActionsBar?: boolean;

  emptyStateIcon?: string;
  emptyStateMessage?: string;
  emptyStateDescription?: string;
  loadingItemCount?: number;
  showSkeletons?: boolean;
  accentColorOverride?: string; 
}

export function GenericContentTab<T>({
  items,
  renderListItem,
  isLoading = false,
  error = null,
  onRefreshData,
  searchQuery, // Keep this for passing to GenericList
  primaryLeftActions,
  primaryRightActions,
  secondaryLeftActions,
  secondaryRightActions,
  showSecondaryActionsBar = false,
  emptyStateIcon,
  emptyStateMessage,
  emptyStateDescription,
  loadingItemCount,
  showSkeletons = true,
  accentColorOverride,
}: GenericContentTabProps<T>) {
  const themeAccentColor = useThemeStore((state) => state.accentColor.value);
  const accentColor = accentColorOverride || themeAccentColor;

  useEffect(() => {
    if (GENERIC_CONTENT_TAB_DEFAULT_ICONS.length > 0 && onRefreshData) { 
        preloadIcons([GENERIC_CONTENT_TAB_DEFAULT_ICONS[0]]);
    }
  }, [onRefreshData]);

  // Determine the effective loading item count based on showSkeletons
  const effectiveLoadingItemCount = showSkeletons ? loadingItemCount : 0;

  return (
    <div className="h-full flex flex-col select-none p-4">
      {/* Primary Action Bar */}
      <div
        className="flex items-center justify-between mb-3 p-3 rounded-lg border backdrop-blur-sm flex-wrap gap-y-2 gap-x-4"
        style={{
          backgroundColor: `${accentColor}10`,
          borderColor: `${accentColor}30`,
        }}
      >
        <div className="flex items-center gap-3 flex-grow min-w-0"> {/* Ensure flex-grow and min-w-0 for left content */}
          {primaryLeftActions}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0"> {/* Ensure flex-shrink-0 for right content*/}
          {primaryRightActions}
          {/* Default refresh button if onRefreshData is provided AND no primaryRightActions are given (or primaryRightActions doesn't seem to include a refresh) */}
          {!primaryRightActions && onRefreshData && (
            <Button
              onClick={onRefreshData}
              disabled={isLoading}
              variant="secondary"
              size="sm"
              icon={isLoading ? <Icon icon={GENERIC_CONTENT_TAB_DEFAULT_ICONS[0]} className="w-4 h-4 animate-spin" /> : <Icon icon="solar:refresh-outline" className="w-4 h-4" />}
              title="Refresh"
            />
          )}
        </div>
      </div>

      {/* Secondary Action Bar & Divider - Conditionally render based on actions OR explicit prop */}
      {(showSecondaryActionsBar || secondaryLeftActions || secondaryRightActions) && showSecondaryActionsBar !== false && (
        <>
          <div 
            className="h-px my-2"
            style={{ backgroundColor: `${accentColor}30` }}
          />
          <div
            className="flex items-center justify-between mb-4 p-3 rounded-lg border backdrop-blur-sm flex-wrap gap-y-2 gap-x-4"
            style={{
              backgroundColor: `${accentColor}08`, // Slightly different background for secondary bar
              borderColor: `${accentColor}20`,
            }}
          >
            <div className="flex items-center gap-3 flex-grow min-w-0"> {/* Ensure flex-grow and min-w-0 for left content */}
              {secondaryLeftActions}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0"> {/* Ensure flex-shrink-0 for right content*/}
              {secondaryRightActions}
            </div>
          </div>
        </>
      )}

      <GenericList<T>
        items={items}
        renderItem={renderListItem}
        isLoading={isLoading}
        error={error}
        searchQuery={searchQuery} // Pass the main search query for filtering in GenericList
        accentColor={accentColor}
        emptyStateIcon={emptyStateIcon}
        emptyStateMessage={emptyStateMessage}
        emptyStateDescription={emptyStateDescription}
        loadingItemCount={effectiveLoadingItemCount}
      />
    </div>
  );
} 