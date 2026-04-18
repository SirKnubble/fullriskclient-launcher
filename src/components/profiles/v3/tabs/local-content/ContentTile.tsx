"use client";

import type React from "react";
import { Icon } from "@iconify/react";
import { useThemeStore } from "../../../../../store/useThemeStore";
import type { LocalContentItem } from "../../../../../hooks/useLocalContentManager";
import type { UnifiedVersion } from "../../../../../types/unified";
import { formatFileSize } from "../../../../../utils/format-file-size";
import { Tooltip } from "../../../../ui/Tooltip";
import { ModUpdateText } from "../../../../ui/ModUpdateText";
import { ThemedDropdown, ThemedDropdownItem, ThemedDropdownDivider, ThemedDropdownHeader } from "../../shared/ThemedDropdown";

export interface ContentTileProps {
  item: LocalContentItem;
  displayName: string;
  iconUrl: string | null;
  platformLabel: string;
  busy: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onOpenFolder: () => void;
  onNameClick?: () => void;
  menuOpen: boolean;
  onMenuToggle: (open: boolean) => void;
  // Selection
  selectMode: boolean;
  isSelected: boolean;
  onToggleSelection: () => void;
  // Update-Checks pausieren
  onToggleUpdateChecks?: () => void;
  // Quick-Update: immer sichtbar wenn Update da, evtl. disabled
  onQuickUpdate?: () => void;
  quickUpdateDisabled?: boolean;
  quickUpdateTooltip?: React.ReactNode;
  isQuickUpdating?: boolean;
  // NoRisk Compatibility-Status (null wenn Config nicht geladen oder ok)
  noRiskStatus?: "blocked" | "warning" | null;
  // Version switching
  versionDropdownOpen: boolean;
  availableVersions: UnifiedVersion[] | null;
  isLoadingVersions: boolean;
  versionError: string | null;
  onVersionClick: () => void;
  onSwitchVersion: (v: UnifiedVersion) => void;
  updateAvailable: UnifiedVersion | null;
  isSwitchingVersion?: boolean;
}

export function ContentTile({
  item,
  displayName,
  iconUrl,
  busy,
  onToggle,
  onDelete,
  onOpenFolder,
  onNameClick,
  menuOpen,
  onMenuToggle,
  versionDropdownOpen,
  availableVersions,
  isLoadingVersions,
  versionError,
  onVersionClick,
  onSwitchVersion,
  updateAvailable,
  isSwitchingVersion,
  selectMode,
  isSelected,
  onToggleSelection,
  onToggleUpdateChecks,
  onQuickUpdate,
  quickUpdateDisabled,
  quickUpdateTooltip,
  isQuickUpdating,
  noRiskStatus,
}: ContentTileProps) {
  const accentColor = useThemeStore((s) => s.accentColor);
  const enabled = !item.is_disabled;
  const versionText =
    (item.modrinth_info as any)?.version_number ||
    (item.curseforge_info as any)?.file_name ||
    item.fallback_version ||
    "";

  const isSwitchable =
    !!(item.modrinth_info?.project_id || item.curseforge_info?.project_id);

  const currentVersionId =
    (item.modrinth_info as any)?.version_id ||
    (item.modrinth_info as any)?.id ||
    (item.curseforge_info as any)?.file_id ||
    null;

  return (
    <div
      style={isSelected ? { backgroundColor: `${accentColor.value}1a`, borderColor: `${accentColor.value}66` } : undefined}
      className={`group relative flex items-center gap-3 p-3 rounded-lg border transition-colors ${
        isSelected
          ? ""
          : `bg-white/[0.03] border-white/10 hover:border-white/20 hover:bg-white/[0.06] ${!enabled ? "opacity-55" : ""}`
      }`}
    >
      {/* Selection checkbox (on-hover, or permanent when selectMode aktiv) */}
      <button
        onClick={(e) => { e.stopPropagation(); onToggleSelection(); }}
        className={`flex-shrink-0 transition-opacity ${selectMode || isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
        title={isSelected ? "Deselect" : "Select"}
      >
        <div
          style={isSelected ? { backgroundColor: accentColor.value, borderColor: accentColor.value } : undefined}
          className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
            isSelected ? "" : "border-white/30 hover:border-white/60"
          }`}
        >
          {isSelected && <Icon icon="solar:check-read-linear" className="w-3 h-3 text-black" />}
        </div>
      </button>

      {/* Icon + optionales NoRisk-Warn-Icon */}
      <div className="relative w-12 h-12 flex-shrink-0">
        <div className="w-full h-full rounded-md bg-white/10 ring-1 ring-white/10 flex items-center justify-center overflow-hidden">
          {iconUrl ? (
            <img src={iconUrl} alt="" className="w-full h-full object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
          ) : (
            <Icon icon="solar:bolt-bold-duotone" className="w-6 h-6 text-white/50" />
          )}
        </div>
        {noRiskStatus === "blocked" && (
          <div className="absolute top-0.5 left-0.5 z-10">
            <Tooltip content="Blocked by NoRisk — incompatible, may cause issues or a ban.">
              <Icon icon="solar:danger-triangle-bold" className="w-4 h-4 text-red-500 drop-shadow-lg" />
            </Tooltip>
          </div>
        )}
        {noRiskStatus === "warning" && (
          <div className="absolute top-0.5 left-0.5 z-10">
            <Tooltip content="May have compatibility issues with NoRisk.">
              <Icon icon="solar:danger-triangle-bold" className="w-4 h-4 text-yellow-500 drop-shadow-lg" />
            </Tooltip>
          </div>
        )}
      </div>

      {/* Identity */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          {onNameClick ? (
            <button
              onClick={(e) => { e.stopPropagation(); onNameClick(); }}
              className="text-sm text-white font-minecraft-ten truncate normal-case hover:underline decoration-white/40 underline-offset-2 text-left"
              title={displayName}
            >
              {displayName}
            </button>
          ) : (
            <div
              className="text-sm text-white font-minecraft-ten truncate normal-case"
              title={displayName}
            >
              {displayName}
            </div>
          )}
          {item.updates_enabled === false && (
            <Tooltip content="Update checks paused — resume in the three-dots menu">
              <Icon icon="solar:volume-cross-bold" className="w-3 h-3 text-white/30 flex-shrink-0" />
            </Tooltip>
          )}
          {item.modpack_origin && (
            <Tooltip content={`From modpack · ${item.modpack_origin.split(":")[0]}`}>
              <Icon
                icon="solar:box-bold"
                className="w-3 h-3 text-violet-300/70 flex-shrink-0"
              />
            </Tooltip>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1 text-xs font-minecraft-ten">
          <div className="relative min-w-0">
            <button
              onClick={(e) => { e.stopPropagation(); if (isSwitchable && !isSwitchingVersion) onVersionClick(); }}
              disabled={!isSwitchable || isSwitchingVersion}
              className={`inline-flex items-center gap-1 max-w-full truncate px-1.5 py-0.5 rounded transition-colors ${
                isSwitchingVersion
                  ? "text-amber-200 bg-amber-400/10 cursor-wait"
                  : isSwitchable
                    ? "text-white/70 hover:text-white hover:bg-white/5 cursor-pointer"
                    : "text-white/45 cursor-default"
              }`}
            >
              {isSwitchingVersion && (
                <Icon icon="solar:refresh-bold" className="w-3 h-3 flex-shrink-0 animate-spin" />
              )}
              {!isSwitchingVersion && updateAvailable && (() => {
                const isFromModPack = !!item.modpack_origin;
                const active = isFromModPack
                  ? item.updates_enabled === true
                  : item.updates_enabled !== false;
                return (
                  <Tooltip
                    content={
                      <div className="max-w-xs text-left">
                        <ModUpdateText
                          isFromModPack={isFromModPack}
                          updateVersion={updateAvailable}
                          currentVersion={(item.modrinth_info as any)?.version_number || (item.curseforge_info as any)?.version_number}
                          modpackOrigin={item.modpack_origin}
                          updatesEnabled={item.updates_enabled}
                        />
                      </div>
                    }
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                        active ? "bg-amber-400 animate-pulse" : "bg-white/30"
                      }`}
                    />
                  </Tooltip>
                );
              })()}
              <span className="truncate">{isSwitchingVersion ? "Switching…" : (versionText || "—")}</span>
              {isSwitchable && !isSwitchingVersion && <Icon icon="solar:alt-arrow-down-linear" className="w-3 h-3 flex-shrink-0 opacity-60" />}
            </button>

            <ThemedDropdown
              open={versionDropdownOpen}
              onClose={() => onVersionClick()}
              width="w-72"
              align="left"
              scrollable
            >
              <ThemedDropdownHeader>Select version</ThemedDropdownHeader>
              {isLoadingVersions && (
                <div className="flex items-center justify-center py-6 text-white/50 text-xs font-minecraft-ten gap-2">
                  <Icon icon="solar:refresh-bold" className="w-3.5 h-3.5 animate-spin" />
                  Loading versions…
                </div>
              )}
              {!isLoadingVersions && versionError && (
                <div className="px-3 py-4 text-xs text-rose-300 font-minecraft-ten">{versionError}</div>
              )}
              {!isLoadingVersions && !versionError && availableVersions && availableVersions.length === 0 && (
                <div className="px-3 py-4 text-xs text-white/40 font-minecraft-ten">No matching versions available.</div>
              )}
              {!isLoadingVersions && !versionError && availableVersions && availableVersions.map((v) => {
                const isCurrent = v.id === currentVersionId;
                return (
                  <button
                    key={v.id}
                    onClick={(e) => { e.stopPropagation(); if (!isCurrent) onSwitchVersion(v); }}
                    disabled={isCurrent}
                    onMouseEnter={(e) => { if (!isCurrent) e.currentTarget.style.backgroundColor = `${accentColor.value}40`; }}
                    onMouseLeave={(e) => { if (!isCurrent) e.currentTarget.style.backgroundColor = "transparent"; }}
                    className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs font-minecraft-ten text-left transition-colors ${
                      isCurrent ? "text-white/40 cursor-default" : "text-white/85 hover:text-white cursor-pointer"
                    }`}
                  >
                    {isCurrent ? (
                      <Icon icon="solar:check-circle-bold" className="w-3.5 h-3.5 flex-shrink-0" style={{ color: accentColor.value }} />
                    ) : (
                      <Icon icon="solar:tag-linear" className="w-3.5 h-3.5 flex-shrink-0 text-white/40" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="truncate">{v.version_number}</div>
                      <div className="text-[10px] text-white/35 truncate normal-case">{v.name}</div>
                    </div>
                    {v.release_type !== "release" && (
                      <span className={`text-[9px] uppercase px-1 py-0.5 rounded flex-shrink-0 ${
                        v.release_type === "beta"  ? "bg-amber-400/15 text-amber-200 border border-amber-400/25" :
                        v.release_type === "alpha" ? "bg-rose-400/15  text-rose-200  border border-rose-400/25" :
                        "bg-white/10 text-white/60 border border-white/15"
                      }`}>
                        {v.release_type}
                      </span>
                    )}
                  </button>
                );
              })}
            </ThemedDropdown>
          </div>

          {item.file_size > 0 && (
            <span className="text-white/30 flex-shrink-0">{formatFileSize(item.file_size)}</span>
          )}
        </div>
      </div>

      {/* Quick-Update */}
      {onQuickUpdate && (
        <Tooltip content={isQuickUpdating ? "Updating…" : (quickUpdateTooltip ?? "Update to latest")}>
          <button
            onClick={(e) => { e.stopPropagation(); if (!quickUpdateDisabled && !isQuickUpdating) onQuickUpdate(); }}
            disabled={quickUpdateDisabled || isQuickUpdating}
            className={`h-8 w-8 rounded-md border flex items-center justify-center flex-shrink-0 transition-colors ${
              isQuickUpdating
                ? "bg-amber-400/20 border-amber-400/40 text-amber-200 cursor-wait"
                : quickUpdateDisabled
                  ? "bg-white/5 border-white/10 text-white/30 cursor-not-allowed grayscale"
                  : "bg-amber-400/15 hover:bg-amber-400/30 border-amber-400/30 text-amber-200 hover:text-amber-100"
            }`}
          >
            <Icon
              icon={isQuickUpdating ? "solar:refresh-bold" : "solar:arrow-up-bold"}
              className={`w-4 h-4 ${isQuickUpdating ? "animate-spin" : ""}`}
            />
          </button>
        </Tooltip>
      )}

      {/* Toggle switch */}
      <button
        onClick={onToggle}
        disabled={busy}
        className="flex-shrink-0 disabled:opacity-40"
        title={enabled ? "Disable" : "Enable"}
      >
        <div className={`relative w-9 h-5 rounded-full transition-colors ${enabled ? "bg-emerald-500/70" : "bg-white/10"}`}>
          <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${enabled ? "translate-x-4" : ""}`} />
        </div>
      </button>

      {/* Menu */}
      <div className="relative flex-shrink-0">
        <button
          onClick={(e) => { e.stopPropagation(); onMenuToggle(!menuOpen); }}
          className="p-1.5 rounded text-white/40 hover:text-white hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <Icon icon="solar:menu-dots-bold" className="w-4 h-4" />
        </button>
        <ThemedDropdown open={menuOpen} onClose={() => onMenuToggle(false)} width="w-52">
          <ThemedDropdownItem
            icon="solar:folder-linear"
            onClick={() => { onOpenFolder(); onMenuToggle(false); }}
          >
            Open folder
          </ThemedDropdownItem>
          {onToggleUpdateChecks && (
            <>
              <ThemedDropdownDivider />
              <ThemedDropdownItem
                icon={(item.updates_enabled ?? true) ? "solar:volume-cross-linear" : "solar:volume-loud-linear"}
                onClick={() => { onToggleUpdateChecks(); onMenuToggle(false); }}
              >
                {(item.updates_enabled ?? true) ? "Pause update checks" : "Resume update checks"}
              </ThemedDropdownItem>
            </>
          )}
          {!item.norisk_info && (
            <>
              <ThemedDropdownDivider />
              <ThemedDropdownItem
                icon="solar:trash-bin-trash-linear"
                tone="danger"
                onClick={() => { onDelete(); onMenuToggle(false); }}
              >
                Delete
              </ThemedDropdownItem>
            </>
          )}
        </ThemedDropdown>
      </div>
    </div>
  );
}
