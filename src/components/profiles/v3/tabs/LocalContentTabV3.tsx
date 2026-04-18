"use client";

/**
 * LocalContentTabV3 — Konzept-stilisierter Content-Tab fuer Mods, ResourcePacks,
 * Shaders, DataPacks, NoRisk. Wiederverwendet useLocalContentManager (identische
 * Datenlogik wie V2), rendert aber im V3-Konzept-Look:
 *
 *  - Sticky Toolbar: Search + Filter + Sort + Refresh + Add-CTA
 *  - Grid aus Mod-Tiles mit Icon, Name, Version, Toggle, Hover-Menu
 *
 * Bewusst vereinfacht ggn. V2: keine Batch-Selection, keine Update-Check-Bar,
 * kein NoRisk-Pack-Selector. Komplexere Operationen bleiben im V2-Tab
 * verfuegbar (Toggle `USE_V3 = false`).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import { Icon } from "@iconify/react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";
import type { Profile } from "../../../../types/profile";
import { ModPlatform, type UnifiedVersion } from "../../../../types/unified";
import {
  type LocalContentItem,
  type LocalContentType,
  useLocalContentManager,
} from "../../../../hooks/useLocalContentManager";
import { getUpdateIdentifier } from "../../../../utils/update-identifier-utils";
import * as FlagsmithService from "../../../../services/flagsmith-service";
import UnifiedService from "../../../../services/unified-service";
import { useThemeStore } from "../../../../store/useThemeStore";
import { useAppDragDropStore } from "../../../../store/appStore";
import { ContentType as BackendContentType } from "../../../../types/content";
import { Tooltip } from "../../../ui/Tooltip";
import { ModUpdateText } from "../../../ui/ModUpdateText";
import { preloadIcons } from "../../../../lib/icon-utils";
import { EmptyStateV3 } from "../shared/EmptyStateV3";
import { FloatingActionBar, type FABActionConfig } from "../shared/FloatingActionBar";
import { ThemedDropdown, ThemedDropdownItem, ThemedDropdownDivider } from "../shared/ThemedDropdown";
import { ContentTile } from "./local-content/ContentTile";
import { NoriskPackSelector } from "./local-content/NoriskPackSelector";

// Pre-load der haeufig genutzten Iconify-Icons fuer schnelleres First-Paint
preloadIcons([
  "solar:magnifer-linear", "solar:filter-bold", "solar:sort-vertical-bold",
  "solar:alt-arrow-down-linear", "solar:refresh-bold", "solar:refresh-circle-bold",
  "solar:add-circle-bold", "solar:shield-check-bold", "solar:close-circle-linear",
  "solar:bolt-bold-duotone", "solar:menu-dots-bold", "solar:folder-linear",
  "solar:trash-bin-trash-linear", "solar:trash-bin-trash-bold", "solar:tag-linear",
  "solar:check-circle-bold", "solar:check-read-linear", "solar:arrow-up-bold",
  "solar:play-bold", "solar:pause-bold", "solar:volume-cross-bold",
  "solar:volume-cross-linear", "solar:volume-loud-linear", "solar:volume-loud-bold",
  "solar:box-bold", "solar:danger-triangle-bold", "solar:close-circle-bold",
  // Sort/Filter icons
  "solar:sort-from-top-to-bottom-bold", "solar:ruler-bold", "solar:list-bold",
  "solar:hand-stars-bold",
]);

type SortKey = "name" | "size" | "type" | "updates";
type FilterKey =
  | "all" | "enabled" | "disabled"
  | "hasUpdate" | "fromModpack" | "manuallyAdded" | "updatesPaused" | "noriskIssues";

interface LocalContentTabV3Props<T extends LocalContentItem> {
  profile: Profile;
  contentType: LocalContentType;
  getDisplayFileName: (item: T) => string;
  itemTypeName: string;
  itemTypeNamePlural: string;
  addContentButtonText: string;
  emptyStateIconOverride?: string;
  onRefreshRequired?: () => void;
  onBrowseContentRequest?: (browseContentType: string) => void;
}

const SORT_OPTIONS: { value: SortKey; label: string; icon: string }[] = [
  { value: "name",    label: "Name",          icon: "solar:sort-from-top-to-bottom-bold" },
  { value: "updates", label: "Updates first", icon: "solar:arrow-up-bold" },
  { value: "size",    label: "Size",          icon: "solar:ruler-bold" },
  { value: "type",    label: "Source",        icon: "solar:box-bold" },
];

interface FilterOption {
  value: FilterKey;
  label: string;
  icon: string;
  /** Gruppen-Trennlinie VOR diesem Item einfuegen. */
  separator?: boolean;
  /** Wenn true, nur zeigen wenn NRC-Pack aktiv. */
  nrcOnly?: boolean;
}

const FILTER_OPTIONS: FilterOption[] = [
  { value: "all",           label: "All",            icon: "solar:list-bold" },
  { value: "enabled",       label: "Enabled",        icon: "solar:check-circle-bold" },
  { value: "disabled",      label: "Disabled",       icon: "solar:close-circle-bold" },
  { value: "hasUpdate",     label: "Has updates",    icon: "solar:arrow-up-bold",        separator: true },
  { value: "updatesPaused", label: "Updates paused", icon: "solar:volume-cross-bold" },
  { value: "fromModpack",   label: "From modpack",   icon: "solar:box-bold",             separator: true },
  { value: "manuallyAdded", label: "Manually added", icon: "solar:hand-stars-bold" },
  { value: "noriskIssues",  label: "NoRisk issues",  icon: "solar:danger-triangle-bold", separator: true, nrcOnly: true },
];

export function LocalContentTabV3<T extends LocalContentItem>({
  profile,
  contentType,
  getDisplayFileName,
  itemTypeName,
  itemTypeNamePlural,
  addContentButtonText,
  emptyStateIconOverride,
  onRefreshRequired,
  onBrowseContentRequest,
}: LocalContentTabV3Props<T>) {
  const { t } = useTranslation();

  const manager = useLocalContentManager<T>({
    profile,
    contentType,
    getDisplayFileName,
    onRefreshRequired,
  });

  const accentColor = useThemeStore((s) => s.accentColor);
  const navigate = useNavigate();
  const { setActiveDropContext, registerRefreshCallback, unregisterRefreshCallback } = useAppDragDropStore();

  // Map LocalContentType → BackendContentType fuer den Drag-Drop-Store
  const backendContentType = contentType as BackendContentType;

  // Drag-Drop-Context registrieren: damit Dateien die auf das Fenster gezogen
  // werden als Import fuer DIESEN Tab erkannt werden. Unregister bei Unmount.
  // WICHTIG: `manager` nicht in Deps — das Objekt ist jede Render neu
  // (returnt vom Hook), sonst Endlos-Loop.
  const fetchDataRef = useRef(manager.fetchData);
  fetchDataRef.current = manager.fetchData;
  useEffect(() => {
    if (!profile?.id) return;
    setActiveDropContext(profile.id, backendContentType);
    const refresh = () => fetchDataRef.current(true);
    registerRefreshCallback(backendContentType, refresh);
    return () => {
      setActiveDropContext(null, null);
      unregisterRefreshCallback(backendContentType);
    };
  }, [profile?.id, backendContentType, setActiveDropContext, registerRefreshCallback, unregisterRefreshCallback]);

  // Navigation zur Mod-Detail-Page wenn Modrinth/CurseForge-Projekt
  const navigateToModDetail = useCallback((item: LocalContentItem) => {
    if (item.modrinth_info?.project_id) {
      navigate(`/mods/modrinth/${item.modrinth_info.project_id}`);
    } else if (item.curseforge_info?.project_id) {
      navigate(`/mods/curseforge/${item.curseforge_info.project_id}`);
    }
  }, [navigate]);

  const [sortBy, setSortBy] = useState<SortKey>("name");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const [hoverMenuId, setHoverMenuId] = useState<string | null>(null);

  // ── Version-Switcher-State (pro Item) ─────────────────────────────────────
  const [openVersionKey, setOpenVersionKey] = useState<string | null>(null);
  const [versionCache, setVersionCache] = useState<Record<string, UnifiedVersion[]>>({});
  const [loadingVersionsFor, setLoadingVersionsFor] = useState<Record<string, boolean>>({});
  const [versionErrorFor, setVersionErrorFor] = useState<Record<string, string | null>>({});
  const [switchingVersionFor, setSwitchingVersionFor] = useState<string | null>(null);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(null);

  const tileKey = useCallback((item: LocalContentItem): string => item.path_str || item.filename, []);

  const getItemPlatformAndProjectId = useCallback((item: LocalContentItem): { platform: ModPlatform | null; projectId: string | null } => {
    const plat = item.platform;
    if (plat === ModPlatform.Modrinth) return { platform: plat, projectId: item.modrinth_info?.project_id ?? null };
    if (plat === ModPlatform.CurseForge) return { platform: plat, projectId: item.curseforge_info?.project_id ?? null };
    // Fallback
    if (item.modrinth_info?.project_id)  return { platform: ModPlatform.Modrinth,   projectId: item.modrinth_info.project_id };
    if (item.curseforge_info?.project_id) return { platform: ModPlatform.CurseForge, projectId: item.curseforge_info.project_id };
    return { platform: null, projectId: null };
  }, []);

  const handleOpenVersionDropdown = useCallback(async (item: LocalContentItem) => {
    const key = tileKey(item);
    const willOpen = openVersionKey !== key;
    setOpenVersionKey(willOpen ? key : null);
    if (!willOpen) return;
    if (versionCache[key]) return;

    const { platform, projectId } = getItemPlatformAndProjectId(item);
    if (!platform || !projectId) {
      setVersionErrorFor(prev => ({ ...prev, [key]: "This item has no linked project — can't switch versions." }));
      return;
    }
    setLoadingVersionsFor(prev => ({ ...prev, [key]: true }));
    setVersionErrorFor(prev => ({ ...prev, [key]: null }));
    try {
      const response = await UnifiedService.getModVersions({
        source: platform,
        project_id: projectId,
        loaders: contentType === "Mod" && profile?.loader ? [profile.loader] : undefined,
        game_versions: profile?.game_version ? [profile.game_version] : undefined,
      });
      setVersionCache(prev => ({ ...prev, [key]: response.versions }));
    } catch (err) {
      console.error("[V3] Failed to load versions:", err);
      setVersionErrorFor(prev => ({ ...prev, [key]: "Failed to load versions" }));
    } finally {
      setLoadingVersionsFor(prev => ({ ...prev, [key]: false }));
    }
  }, [openVersionKey, versionCache, getItemPlatformAndProjectId, contentType, profile, tileKey]);

  const handleSwitchVersion = useCallback(async (item: LocalContentItem, newVersion: UnifiedVersion) => {
    setOpenVersionKey(null);
    setSwitchingVersionFor(item.filename);
    try {
      await manager.handleSwitchContentVersion(item as T, newVersion);
    } catch (err) {
      console.error("[V3] Failed to switch version:", err);
      toast.error(t('content.version_switch_failed') || "Failed to switch version");
    } finally {
      setSwitchingVersionFor(null);
    }
  }, [manager, t]);

  // Batch Enable/Disable — iteriert Selection und toggelt nur die Mods,
  // deren aktueller State vom Ziel abweicht.
  const handleBatchEnable = useCallback(async () => {
    const targets: T[] = [];
    for (const id of manager.selectedItemIds) {
      const item = manager.items.find(i => i.filename === id);
      if (item && item.is_disabled) targets.push(item);
    }
    if (targets.length === 0) {
      manager.handleSelectAllToggle(false);
      return;
    }
    setBatchProgress({ current: 0, total: targets.length });
    try {
      for (let i = 0; i < targets.length; i++) {
        await manager.handleToggleItemEnabled(targets[i]);
        setBatchProgress({ current: i + 1, total: targets.length });
      }
    } finally {
      setBatchProgress(null);
      manager.handleSelectAllToggle(false);
    }
  }, [manager]);

  const handleBatchDisable = useCallback(async () => {
    const targets: T[] = [];
    for (const id of manager.selectedItemIds) {
      const item = manager.items.find(i => i.filename === id);
      if (item && !item.is_disabled) targets.push(item);
    }
    if (targets.length === 0) {
      manager.handleSelectAllToggle(false);
      return;
    }
    setBatchProgress({ current: 0, total: targets.length });
    try {
      for (let i = 0; i < targets.length; i++) {
        await manager.handleToggleItemEnabled(targets[i]);
        setBatchProgress({ current: i + 1, total: targets.length });
      }
    } finally {
      setBatchProgress(null);
      manager.handleSelectAllToggle(false);
    }
  }, [manager]);

  // Batch Pause/Resume Update-Checks — zielt auf Mehrheits-Zustand:
  // Wenn >= die Haelfte aktiv, wird pausiert. Sonst wieder aktiviert.
  const batchUpdateChecksConfig = useMemo(() => {
    const selectedItems = Array.from(manager.selectedItemIds)
      .map(id => manager.items.find(i => i.filename === id))
      .filter((i): i is T => !!i && !!i.id);
    if (selectedItems.length === 0) return null;
    const activeCount = selectedItems.filter(i => (i.updates_enabled ?? true)).length;
    const pausedCount = selectedItems.length - activeCount;
    const shouldEnable = pausedCount >= activeCount;
    return { shouldEnable, count: selectedItems.length };
  }, [manager.selectedItemIds, manager.items]);

  const handleBatchToggleUpdateChecks = useCallback(async () => {
    if (!batchUpdateChecksConfig) return;
    await manager.handleBatchToggleSelectedUpdatesEnabled(batchUpdateChecksConfig.shouldEnable);
    manager.handleSelectAllToggle(false);
  }, [manager, batchUpdateChecksConfig]);

  const isNrc = contentType === "NoRiskMod";
  const selectedPackId = profile?.selected_norisk_pack_id ?? null;

  // Flagsmith blocked-mods Config laden wenn ein NRC-Pack aktiv ist.
  // Beeinflusst die Warn-Overlays auf Mods die mit NoRisk inkompatibel sind.
  const [isBlockedConfigLoaded, setIsBlockedConfigLoaded] = useState(false);
  useEffect(() => {
    if (profile?.selected_norisk_pack_id) {
      FlagsmithService.getBlockedModsConfig()
        .then(() => setIsBlockedConfigLoaded(true))
        .catch((err) => {
          console.error("[V3] Failed to load NoRisk blocked mods config:", err);
          setIsBlockedConfigLoaded(false);
        });
    } else {
      setIsBlockedConfigLoaded(false);
    }
  }, [profile?.selected_norisk_pack_id]);

  // Helper: hat ein Item ein verfuegbares Update? Matched die Logik aus dem
  // Render-Loop (siehe `updateAvailable` unten) — manager.contentUpdates wird
  // per `update-identifier` indiziert.
  const hasUpdate = useCallback((item: LocalContentItem) => {
    const key = getUpdateIdentifier(item);
    return !!(key && manager.contentUpdates[key]);
  }, [manager.contentUpdates]);

  const visibleItems = useMemo(() => {
    let list = manager.filteredItems;

    switch (filter) {
      case "enabled":       list = list.filter(i => !i.is_disabled); break;
      case "disabled":      list = list.filter(i =>  i.is_disabled); break;
      case "hasUpdate":     list = list.filter(hasUpdate); break;
      case "fromModpack":   list = list.filter(i => !!i.modpack_origin); break;
      case "manuallyAdded": list = list.filter(i => !i.modpack_origin && !i.norisk_info); break;
      case "updatesPaused": list = list.filter(i => i.updates_enabled === false); break;
      case "noriskIssues":  list = list.filter(i => {
        if (!isBlockedConfigLoaded) return false;
        const status = FlagsmithService.getModNoRiskStatus(
          i.filename,
          i.modrinth_info?.project_id || i.curseforge_info?.project_id,
          i.modrinth_info?.version_id || (i.curseforge_info as any)?.file_id,
        );
        return status === "blocked" || status === "warning";
      }); break;
    }

    const sorted = [...list];
    switch (sortBy) {
      case "name":
        sorted.sort((a, b) => getDisplayFileName(a).localeCompare(getDisplayFileName(b)));
        break;
      case "size":
        sorted.sort((a, b) => (b.file_size ?? 0) - (a.file_size ?? 0));
        break;
      case "type":
        sorted.sort((a, b) => manager.getItemPlatformDisplayName(a).localeCompare(manager.getItemPlatformDisplayName(b)));
        break;
      case "updates":
        // Mods mit Update zuerst, danach alphabetisch.
        sorted.sort((a, b) => {
          const ua = hasUpdate(a) ? 1 : 0;
          const ub = hasUpdate(b) ? 1 : 0;
          if (ua !== ub) return ub - ua;
          return getDisplayFileName(a).localeCompare(getDisplayFileName(b));
        });
        break;
    }
    return sorted;
  }, [manager.filteredItems, filter, sortBy, getDisplayFileName, manager, hasUpdate, isBlockedConfigLoaded]);

  const handleAddClick = useCallback(() => {
    onBrowseContentRequest?.(contentType);
  }, [onBrowseContentRequest, contentType]);

  const activeSortLabel = SORT_OPTIONS.find(o => o.value === sortBy)?.label ?? "Sort";
  const activeFilterLabel = FILTER_OPTIONS.find(o => o.value === filter)?.label ?? "Filter";

  // Esc-Key clear'd Selection — `manager` nicht in Deps (neu per Render).
  const selectAllToggleRef = useRef(manager.handleSelectAllToggle);
  selectAllToggleRef.current = manager.handleSelectAllToggle;
  const hasSelection = manager.selectedItemIds.size > 0;
  useEffect(() => {
    if (!hasSelection) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") selectAllToggleRef.current(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hasSelection]);

  // FAB-Actions: Enable / Disable / (optional) Update-Check-Toggle / Delete.
  const batchBusy = manager.isBatchToggling || !!batchProgress;
  const fabActions: FABActionConfig[] = [
    { icon: "solar:play-bold",  label: "Enable",  onClick: handleBatchEnable,  disabled: batchBusy },
    { icon: "solar:pause-bold", label: "Disable", onClick: handleBatchDisable, disabled: batchBusy },
    ...(batchUpdateChecksConfig ? [{
      icon: batchUpdateChecksConfig.shouldEnable ? "solar:volume-loud-bold" : "solar:volume-cross-bold",
      label: batchUpdateChecksConfig.shouldEnable ? "Resume checks" : "Mute checks",
      onClick: handleBatchToggleUpdateChecks,
    } as FABActionConfig] : []),
    {
      icon: "solar:trash-bin-trash-bold",
      label: manager.isBatchDeleting ? "…" : "Delete",
      tone: "danger",
      onClick: manager.handleBatchDeleteSelected,
      disabled: manager.isBatchDeleting,
    },
  ];

  return (
    <div className="flex flex-col min-h-0 flex-1 relative">
      {/* ── Sticky Toolbar ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-5 h-12 border-b border-white/5 flex-shrink-0 bg-black/20 sticky top-0 z-10">
        <div className="relative flex-1 max-w-sm">
          <Icon icon="solar:magnifer-linear" className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
          <input
            value={manager.searchQuery}
            onChange={(e) => manager.setSearchQuery(e.target.value)}
            placeholder={`Search ${itemTypeNamePlural.toLowerCase()}…`}
            className="w-full h-8 pl-8 pr-3 rounded-md bg-white/5 border border-white/10 focus:border-white/25 outline-none text-sm text-white placeholder:text-white/30 font-minecraft-ten"
          />
        </div>

        {/* NoRisk pack selector (only for NRC) */}
        {isNrc && (
          <NoriskPackSelector profile={profile} onChanged={onRefreshRequired} />
        )}

        {/* Filter dropdown */}
        <div className="relative">
          <button
            onClick={() => { setFilterMenuOpen(v => !v); setSortMenuOpen(false); }}
            className="h-8 px-2.5 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-minecraft-ten text-white/70 flex items-center gap-1.5"
          >
            <Icon icon="solar:filter-bold" className="w-3.5 h-3.5" />
            {activeFilterLabel}
            <Icon icon="solar:alt-arrow-down-linear" className="w-3 h-3 opacity-60" />
          </button>
          <ThemedDropdown open={filterMenuOpen} onClose={() => setFilterMenuOpen(false)} width="w-44">
            {FILTER_OPTIONS.filter(opt => !opt.nrcOnly || isBlockedConfigLoaded).map(opt => (
              <div key={opt.value}>
                {opt.separator && <ThemedDropdownDivider />}
                <ThemedDropdownItem
                  icon={opt.icon}
                  selected={filter === opt.value}
                  onClick={() => { setFilter(opt.value); setFilterMenuOpen(false); }}
                >
                  {opt.label}
                </ThemedDropdownItem>
              </div>
            ))}
          </ThemedDropdown>
        </div>

        {/* Sort dropdown */}
        <div className="relative">
          <button
            onClick={() => { setSortMenuOpen(v => !v); setFilterMenuOpen(false); }}
            className="h-8 px-2.5 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-minecraft-ten text-white/70 flex items-center gap-1.5"
          >
            <Icon icon="solar:sort-vertical-bold" className="w-3.5 h-3.5" />
            {activeSortLabel}
            <Icon icon="solar:alt-arrow-down-linear" className="w-3 h-3 opacity-60" />
          </button>
          <ThemedDropdown open={sortMenuOpen} onClose={() => setSortMenuOpen(false)} width="w-40">
            {SORT_OPTIONS.map(opt => (
              <ThemedDropdownItem
                key={opt.value}
                icon={opt.icon}
                selected={sortBy === opt.value}
                onClick={() => { setSortBy(opt.value); setSortMenuOpen(false); }}
              >
                {opt.label}
              </ThemedDropdownItem>
            ))}
          </ThemedDropdown>
        </div>

        <div className="flex-1" />

        {/* Update-Check-Status + Update-all */}
        {manager.isCheckingUpdates && manager.updatableContentCount === 0 && (
          <Tooltip content="Checking for updates…">
            <div className="h-8 px-2.5 rounded-md bg-white/5 border border-white/10 text-white/55 flex items-center gap-1.5 text-xs font-minecraft-ten">
              <Icon icon="solar:refresh-bold" className="w-3.5 h-3.5 animate-spin" />
              Checking
            </div>
          </Tooltip>
        )}
        {manager.contentUpdateError && (
          <Tooltip content={manager.contentUpdateError}>
            <div className="h-8 px-2.5 rounded-md bg-rose-500/10 border border-rose-400/30 text-rose-200 flex items-center gap-1.5 text-xs font-minecraft-ten">
              <Icon icon="solar:danger-triangle-bold" className="w-3.5 h-3.5" />
              Check failed
            </div>
          </Tooltip>
        )}
        {manager.updatableContentCount > 0 && (
          <button
            onClick={manager.handleUpdateAllAvailableContent}
            disabled={manager.isUpdatingAll}
            className="h-8 px-3 rounded-md bg-amber-400/10 hover:bg-amber-400/20 border border-amber-400/30 text-xs font-minecraft-ten text-amber-100 flex items-center gap-1.5 disabled:opacity-50 transition-colors"
            title={`Update ${manager.updatableContentCount} mod${manager.updatableContentCount === 1 ? "" : "s"}`}
          >
            <Icon
              icon={manager.isUpdatingAll ? "solar:refresh-bold" : "solar:refresh-circle-bold"}
              className={`w-4 h-4 ${manager.isUpdatingAll || manager.isCheckingUpdates ? "animate-spin" : ""}`}
            />
            Update all
            <span className="px-1.5 rounded bg-amber-400/30 text-amber-50 text-[10px] tabular-nums">{manager.updatableContentCount}</span>
          </button>
        )}

        <button
          onClick={() => manager.fetchData(false)}
          disabled={manager.isAnyTaskRunning}
          className="h-8 px-2.5 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 hover:text-white disabled:opacity-50 flex items-center transition-colors"
          title="Refresh"
        >
          <Icon icon="solar:refresh-bold" className={`w-4 h-4 ${manager.isLoading ? "animate-spin" : ""}`} />
        </button>

        {onBrowseContentRequest && (
          <button
            onClick={handleAddClick}
            className="h-8 px-3 rounded-md bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/30 text-emerald-100 text-xs font-minecraft-ten uppercase tracking-wider flex items-center gap-1.5"
          >
            <Icon icon="solar:add-circle-bold" className="w-4 h-4" />
            {addContentButtonText}
          </button>
        )}
      </div>

      {/* ── Content area ───────────────────────────────────────────────── */}
      <div className={`flex-1 min-h-0 overflow-y-auto p-5 ${manager.selectedItemIds.size > 0 ? "pb-24" : ""}`}>
        {manager.error && (
          <div className="mb-4 flex items-start gap-3 p-3 rounded-lg border border-rose-400/30 bg-rose-500/10">
            <Icon icon="solar:danger-triangle-bold" className="w-5 h-5 text-rose-300 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0 text-xs font-minecraft-ten text-rose-100 break-words">
              {manager.error}
            </div>
            <button
              onClick={() => manager.fetchData(true)}
              className="flex-shrink-0 h-7 px-2 rounded-md text-[10px] font-minecraft-ten uppercase tracking-wider text-rose-100 hover:bg-rose-500/20 transition-colors"
              title="Retry"
            >
              Retry
            </button>
          </div>
        )}
        {isNrc && !selectedPackId ? (
          <EmptyStateV3
            icon="solar:shield-check-bold-duotone"
            title="No NoRisk pack selected"
            hint="Choose a pack from the selector above to see its mods."
          />
        ) : manager.isLoading && visibleItems.length === 0 ? (
          <div className="flex items-center justify-center h-40 text-white/40 font-minecraft-ten text-sm">
            <Icon icon="solar:refresh-bold" className="w-4 h-4 mr-2 animate-spin" />
            Loading…
          </div>
        ) : visibleItems.length === 0 ? (
          <EmptyStateV3
            icon={emptyStateIconOverride ?? "solar:widget-bold-duotone"}
            title={manager.searchQuery ? `No ${itemTypeNamePlural.toLowerCase()} match "${manager.searchQuery}"` : `No ${itemTypeNamePlural.toLowerCase()} yet`}
            hint={onBrowseContentRequest ? `Click "${addContentButtonText}" to add ${itemTypeNamePlural.toLowerCase()}.` : undefined}
          />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {visibleItems.map((item) => {
              const key = tileKey(item);
              const updateKey = getUpdateIdentifier(item);
              const updateAvailable = updateKey ? manager.contentUpdates[updateKey] ?? null : null;
              const noRiskStatus = isBlockedConfigLoaded
                ? FlagsmithService.getModNoRiskStatus(
                    item.filename,
                    item.modrinth_info?.project_id || item.curseforge_info?.project_id,
                    item.modrinth_info?.version_id || (item.curseforge_info as any)?.file_id,
                  )
                : null;
              return (
                <ContentTile
                  key={key}
                  item={item}
                  displayName={getDisplayFileName(item)}
                  iconUrl={manager.getItemIcon(item)}
                  platformLabel={manager.getItemPlatformDisplayName(item)}
                  busy={manager.itemBeingToggled === item.filename || manager.itemBeingDeleted === item.filename}
                  onToggle={() => manager.handleToggleItemEnabled(item)}
                  onDelete={() => manager.handleDeleteItem(item)}
                  onOpenFolder={() => manager.handleOpenItemFolder(item)}
                  onNameClick={(item.modrinth_info?.project_id || item.curseforge_info?.project_id) ? () => navigateToModDetail(item) : undefined}
                  menuOpen={hoverMenuId === item.filename}
                  onMenuToggle={(open) => setHoverMenuId(open ? item.filename : null)}
                  selectMode={manager.selectedItemIds.size > 0}
                  isSelected={manager.selectedItemIds.has(item.filename)}
                  onToggleSelection={() => manager.handleItemSelectionChange(item.filename, !manager.selectedItemIds.has(item.filename))}
                  onToggleUpdateChecks={item.id ? () => manager.handleToggleItemUpdatesEnabled(item) : undefined}
                  onQuickUpdate={updateAvailable
                    ? () => manager.handleUpdateContentItem(item, updateAvailable)
                    : undefined}
                  quickUpdateDisabled={!!updateAvailable && (() => {
                    const isFromModPack = !!item.modpack_origin;
                    return isFromModPack
                      ? item.updates_enabled !== true
                      : item.updates_enabled === false;
                  })()}
                  quickUpdateTooltip={updateAvailable
                    ? (
                      <div className="max-w-xs text-left">
                        <ModUpdateText
                          isFromModPack={!!item.modpack_origin}
                          updateVersion={updateAvailable}
                          currentVersion={(item.modrinth_info as any)?.version_number || (item.curseforge_info as any)?.version_number}
                          modpackOrigin={item.modpack_origin}
                          updatesEnabled={item.updates_enabled}
                        />
                      </div>
                    )
                    : undefined}
                  isQuickUpdating={manager.itemsBeingUpdated.has(item.filename)}
                  noRiskStatus={noRiskStatus}
                  versionDropdownOpen={openVersionKey === key}
                  availableVersions={versionCache[key] ?? null}
                  isLoadingVersions={!!loadingVersionsFor[key]}
                  versionError={versionErrorFor[key] ?? null}
                  onVersionClick={() => handleOpenVersionDropdown(item)}
                  onSwitchVersion={(v) => handleSwitchVersion(item, v)}
                  updateAvailable={updateAvailable}
                  isSwitchingVersion={switchingVersionFor === item.filename}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* ── Floating Action Bar ─────────────────────────────────────────── */}
      <FloatingActionBar
        visible={manager.selectedItemIds.size > 0 || !!batchProgress}
        count={manager.selectedItemIds.size}
        totalCount={visibleItems.length}
        accent={accentColor.value}
        allSelected={manager.areAllFilteredSelected}
        onSelectAll={() => manager.handleSelectAllToggle(true)}
        onClear={() => manager.handleSelectAllToggle(false)}
        batchProgress={batchProgress}
        actions={fabActions}
      />
    </div>
  );
}
