"use client";

import { Icon } from "@iconify/react";
import { useThemeStore } from "../../store/useThemeStore";

export interface GroupTab {
  /** Unique identifier for the group */
  id: string;
  /** Display name of the group */
  name: string;
  /** Number of items in this group */
  count: number;
  /** Optional icon for the group */
  icon?: string;
}

export interface GroupTabsProps {
  /** Array of group tabs to display */
  groups: GroupTab[];
  /** Currently active group ID */
  activeGroup: string;
  /** Callback when a group is selected */
  onGroupChange: (groupId: string) => void;
  /** Whether to show the "Add Group" button */
  showAddButton?: boolean;
  /** Callback when the "Add Group" button is clicked */
  onAddGroup?: () => void;
  /** Additional CSS classes */
  className?: string;
  /** Custom add button text */
  addButtonText?: string;
  /** Custom add button icon */
  addButtonIcon?: string;
  /** Force compact styling regardless of global UI style preset */
  forceCompact?: boolean;
}

export function GroupTabs({
  groups,
  activeGroup,
  onGroupChange,
  showAddButton = true,
  onAddGroup,
  className = "",
  addButtonText = "ADD GROUP",
  addButtonIcon = "solar:add-circle-bold",
  forceCompact = false,
}: GroupTabsProps) {
  const accentColor = useThemeStore((state) => state.accentColor);
  const uiStylePreset = useThemeStore((state) => state.uiStylePreset);
  const isFullRiskStyle = uiStylePreset === "fullrisk" && !forceCompact;
  const isCompact = forceCompact;

  const handleGroupClick = (groupId: string) => {
    onGroupChange(groupId);
  };

  const handleAddGroupClick = () => {
    onAddGroup?.();
  };

  return (
    <div className={`mb-4 ${className}`}>
      <div
        className={
          isCompact
            ? "flex flex-col gap-1"
            : isFullRiskStyle
              ? "flex items-center gap-0 flex-wrap"
              : "flex items-center gap-2 flex-wrap"
        }
      >
        {groups.map((group) => (
          <div key={group.id} className="flex items-center">
            <button
              onClick={() => handleGroupClick(group.id)}
              className={
                isCompact
                  ? `w-full border-l-2 px-4 py-1.5 text-left font-smallcaps text-base tracking-[0.14em] uppercase ${
                      activeGroup === group.id
                        ? "border-white text-white"
                        : "border-transparent text-white/40 hover:text-white/75"
                    }`
                  : isFullRiskStyle
                    ? "px-4 py-1 font-smallcaps text-[20px] transition-all duration-150 lowercase"
                    : `px-3 py-1 rounded-lg font-smallcaps text-lg transition-all duration-200 flex items-center gap-2 border-2 ${
                        activeGroup === group.id
                          ? "text-white"
                          : "text-white/70 bg-black/30 hover:bg-black/40 border-white/10 hover:border-white/20"
                      }`
              }
              style={
                isCompact
                  ? {
                      borderColor:
                        activeGroup === group.id
                          ? accentColor.value
                          : undefined,
                    }
                  : isFullRiskStyle
                    ? {
                        color:
                          activeGroup === group.id
                            ? accentColor.value
                            : "rgba(255,255,255,0.75)",
                        textShadow:
                          activeGroup === group.id
                            ? "2px 2px rgba(0,0,0,0.9)"
                            : undefined,
                        transform:
                          activeGroup === group.id ? "scaleX(1.12)" : undefined,
                      }
                    : {
                        backgroundColor:
                          activeGroup === group.id
                            ? `${accentColor.value}20`
                            : undefined,
                        borderColor:
                          activeGroup === group.id
                            ? accentColor.value
                            : undefined,
                      }
              }
            >
              {!isCompact && !isFullRiskStyle && group.icon && (
                <Icon icon={group.icon} className="w-4 h-4" />
              )}
              <span className={isCompact ? "uppercase" : "lowercase"}>
                {group.name}
              </span>
            </button>
            {!isCompact && isFullRiskStyle && (
              <span className="font-minecraft text-[20px] text-white/70 px-1">
                |
              </span>
            )}
          </div>
        ))}

        {/* Add Group Button */}
        {showAddButton && (
          <button
            onClick={handleAddGroupClick}
            className="px-3 py-1 rounded-lg border border-dashed border-white/30 hover:border-white/50 text-white/50 hover:text-white/70 transition-all duration-200 flex items-center gap-2"
          >
            <Icon icon={addButtonIcon} className="w-4 h-4" />
            <span className="font-smallcaps text-lg transform -translate-y-0.5">{addButtonText}</span>
          </button>
        )}
      </div>
    </div>
  );
}
