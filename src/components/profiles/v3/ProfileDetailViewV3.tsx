"use client";

/**
 * ProfileDetailViewV3 — Redesign des Profile-Detail-Views.
 *
 * Struktur: Top-Bar (Breadcrumb + 4 Icon-Actions) · Hero (Icon + Chips + Play)
 * · Stats-Strip · Left-Rail Navigation · Main-Content (V3 Content-Tabs +
 * noch-V2 Worlds/Screenshots/Logs bis zur Migration).
 *
 * Wrapper-Toggle in `ProfileDetailViewV2Wrapper.tsx` (USE_V3) schaltet
 * zwischen altem V2 und V3 um.
 */

import { useEffect, useState, useCallback, useRef } from "react";
import type React from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "@iconify/react";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";

import type { Profile } from "../../../types/profile";
import { setDiscordState } from "../../../utils/discordRpc";
import { formatRelativeTime, formatPlaytime, formatBytes } from "../../../utils/format-relative-time";
import { parseMotdToHtml } from "../../../utils/motd-utils";
import { useThemeStore } from "../../../store/useThemeStore";
import { useProfileStore } from "../../../store/profile-store";
import { useGlobalModal } from "../../../hooks/useGlobalModal";
import * as ProfileService from "../../../services/profile-service";
import UnifiedService from "../../../services/unified-service";
import type { UnifiedModpackVersionsResponse } from "../../../types/unified";
import { useProfileDuplicateStore } from "../../../store/profile-duplicate-store";
import { useProfileLaunch } from "../../../hooks/useProfileLaunch.tsx";
import { useAppDragDropStore } from "../../../store/appStore";
import { useMinecraftAuthStore } from "../../../store/minecraft-auth-store";
import { useCrafatarAvatar } from "../../../hooks/useCrafatarAvatar";
import { useResolvedLoaderVersion } from "../../../hooks/useResolvedLoaderVersion";

import { ProfileIconV2 } from "../ProfileIconV2";
import { ExportProfileModal } from "../ExportProfileModal";
import { ModpackVersionsModal } from "../../modals/ModpackVersionsModal";
import { ConfirmDeleteDialog } from "../../modals/ConfirmDeleteDialog";
import { SettingsContextMenu, type ContextMenuItem } from "../../ui/SettingsContextMenu";
import { Tooltip } from "../../ui/Tooltip";

import { ProfileLeftRailV3, type NavKey, CONTENT_NAV_KEYS } from "./ProfileLeftRailV3";
import { LocalContentTabV3 } from "./tabs/LocalContentTabV3";
import { WorldsTabV3 } from "./tabs/WorldsTabV3";
import { ScreenshotsTabV3 } from "./tabs/ScreenshotsTabV3";
import { LogsTab } from "../detail/LogsTab";
import type { LocalContentItem } from "../../../hooks/useLocalContentManager";

const mainTabFor = (k: NavKey): string =>
  CONTENT_NAV_KEYS.includes(k) ? "content" : k;

const getLoaderIcon = (loader?: string | null): string => {
  switch (loader) {
    case "fabric":   return "/icons/fabric.png";
    case "forge":    return "/icons/forge.png";
    case "quilt":    return "/icons/quilt.png";
    case "neoforge": return "/icons/neoforge.png";
    default:         return "/icons/minecraft.png";
  }
};

interface ProfileDetailViewV3Props {
  profile: Profile;
  onClose: () => void;
  onEdit: () => void;
}

// ─── Atoms ─────────────────────────────────────────────────────────────────
const Chip: React.FC<{ icon?: string; children: React.ReactNode }> = ({ icon, children }) => (
  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-xs text-white/70 font-minecraft-ten">
    {icon && <Icon icon={icon} className="w-3.5 h-3.5" />}
    {children}
  </span>
);

const Stat: React.FC<{ icon: string; label: string; value: string; muted?: boolean }> = ({ icon, label, value, muted }) => (
  <div className="flex items-center gap-2.5 px-3 py-2 rounded-md bg-white/[0.03] border border-white/10 min-w-[140px]">
    <Icon icon={icon} className={`w-4 h-4 ${muted ? "text-white/25" : "text-white/50"}`} />
    <div className="flex flex-col leading-tight">
      <span className="text-[10px] uppercase tracking-wider text-white/40 font-minecraft-ten">{label}</span>
      <span className={`text-sm font-minecraft-ten ${muted ? "text-white/40" : "text-white/90"}`}>{value}</span>
    </div>
  </div>
);

// ─── Main ──────────────────────────────────────────────────────────────────
export function ProfileDetailViewV3({
  profile,
  onClose,
  onEdit,
}: ProfileDetailViewV3Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [currentProfile, setCurrentProfile] = useState<Profile>(profile);
  const [activeNavItem, setActiveNavItem] = useState<NavKey>("mods");

  useEffect(() => { setDiscordState("Editing a Profile"); }, []);

  // Context menu state
  const [isContextMenuOpen, setIsContextMenuOpen] = useState(false);
  const contextMenuId = `profile-detail-v3-${profile.id}`;
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const moreButtonRef = useRef<HTMLButtonElement>(null);

  // Delete modal state
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Modpack versions state
  const [modpackVersions, setModpackVersions] = useState<UnifiedModpackVersionsResponse | null>(null);

  const { showModal, hideModal } = useGlobalModal();
  const { openContextMenuId, setOpenContextMenuId } = useThemeStore();
  const { fetchProfiles } = useProfileStore();
  const { setActiveMainTab: setDragDropMainTab } = useAppDragDropStore();
  const { openModal: openDuplicateModal } = useProfileDuplicateStore();

  const accounts = useMinecraftAuthStore((state) => state.accounts);
  const preferredAccount = currentProfile.preferred_account_id
    ? accounts.find(acc => acc.id === currentProfile.preferred_account_id)
    : null;
  const preferredAccountAvatarUrl = useCrafatarAvatar({
    uuid: preferredAccount?.id,
    overlay: true,
  });

  const { isLaunching, statusMessage, handleLaunch, handleQuickPlayLaunch } = useProfileLaunch({
    profileId: profile.id,
    onLaunchSuccess: () => {},
    onLaunchError: (error) => console.error("[V3] Profile launch error:", error),
  });

  // ── Handlers ──────────────────────────────────────────────────────────────
  const getGenericDisplayFileName = useCallback((item: LocalContentItem) => item.filename, []);

  // Stub — tabs handle their own refresh; mirrors V2's handleRefresh noop.
  const handleRefresh = useCallback(() => {}, []);

  const handleBrowseContent = useCallback((contentType: string) => {
    navigate(`/profilesv2/${profile.id}/browse/${contentType}`);
  }, [navigate, profile.id]);

  const handleLaunchRequest = useCallback(async (params: {
    profileId: string;
    quickPlaySingleplayer?: string;
    quickPlayMultiplayer?: string;
  }) => {
    if (params.quickPlaySingleplayer) {
      toast.success(t('profiles.toast.launching_world', { name: params.quickPlaySingleplayer }));
      handleQuickPlayLaunch(params.quickPlaySingleplayer, undefined);
    } else if (params.quickPlayMultiplayer) {
      toast.success(t('profiles.toast.joining_server', { name: params.quickPlayMultiplayer }));
      handleQuickPlayLaunch(undefined, params.quickPlayMultiplayer);
    } else {
      handleQuickPlayLaunch(undefined, undefined);
    }
  }, [handleQuickPlayLaunch, t]);

  const handleDeleteProfile = useCallback(() => {
    if (currentProfile.is_standard_version) {
      toast.error(t('profiles.cannotDeleteStandard'));
      return;
    }
    setIsDeleteModalOpen(true);
  }, [currentProfile, t]);

  const handleConfirmDelete = useCallback(async () => {
    setIsDeleting(true);
    try {
      const deletePromise = useProfileStore.getState().deleteProfile(currentProfile.id);
      await toast.promise(deletePromise, {
        loading: t('profiles.deletingProfile', { name: currentProfile.name }),
        success: () => {
          fetchProfiles();
          navigate("/profiles");
          setIsDeleteModalOpen(false);
          return t('profiles.deleteSuccess', { name: currentProfile.name });
        },
        error: (err) =>
          t('profiles.deleteError', { error: err instanceof Error ? err.message : String(err.message) }),
      });
    } catch (error) {
      console.error("[V3] Delete failed:", error);
    } finally {
      setIsDeleting(false);
    }
  }, [currentProfile, fetchProfiles, navigate, t]);

  const handleCancelDelete = useCallback(() => {
    setIsDeleteModalOpen(false);
  }, []);

  const handleOpenExportModal = useCallback(() => {
    showModal(`export-profile-${currentProfile.id}`, (
      <ExportProfileModal
        profile={currentProfile}
        isOpen={true}
        onClose={() => hideModal(`export-profile-${currentProfile.id}`)}
      />
    ));
  }, [currentProfile, showModal, hideModal]);

  const handleOpenFolder = useCallback(async () => {
    const openPromise = ProfileService.openProfileFolder(currentProfile.id);
    toast.promise(openPromise, {
      loading: t('profiles.openingFolder', { name: currentProfile.name }),
      success: t('profiles.openFolderSuccess', { name: currentProfile.name }),
      error: (err) => {
        const message = err instanceof Error ? err.message : String(err.message);
        return t('profiles.openFolderError', { error: message });
      },
    });
  }, [currentProfile, t]);

  const handleDuplicateProfile = useCallback(() => {
    openDuplicateModal(currentProfile);
  }, [currentProfile, openDuplicateModal]);

  const handleOpenModpackVersionsModal = useCallback(() => {
    showModal(`modpack-versions-${currentProfile.id}`, (
      <ModpackVersionsModal
        isOpen={true}
        onClose={() => hideModal(`modpack-versions-${currentProfile.id}`)}
        versions={modpackVersions}
        modpackName={currentProfile.name}
        profileId={currentProfile.id}
        onSwitchComplete={async () => {
          try {
            await fetchProfiles();
            const updatedProfiles = useProfileStore.getState().profiles;
            const updatedProfile = updatedProfiles.find(p => p.id === currentProfile.id);
            if (updatedProfile) setCurrentProfile(updatedProfile);
          } catch (err) {
            console.error("[V3] Failed to refresh profile data after modpack switch:", err);
          }
        }}
      />
    ));
  }, [currentProfile, showModal, hideModal, modpackVersions, fetchProfiles]);

  // ── Context menu items ────────────────────────────────────────────────────
  const contextMenuItems: ContextMenuItem[] = [
    {
      id: "edit",
      label: t('profiles.editProfile'),
      icon: "solar:settings-bold",
      onClick: () => onEdit(),
    },
    {
      id: "duplicate",
      label: t('profiles.duplicate'),
      icon: "solar:copy-bold",
      onClick: () => handleDuplicateProfile(),
    },
    {
      id: "export",
      label: t('profiles.export'),
      icon: "solar:download-bold",
      onClick: () => handleOpenExportModal(),
    },
    ...(currentProfile.modpack_info && modpackVersions ? [{
      id: "modpack-versions",
      label: t('profiles.modpackVersions'),
      icon: "solar:archive-bold",
      onClick: () => handleOpenModpackVersionsModal(),
    }] : []),
    {
      id: "open-folder",
      label: t('profiles.openFolder'),
      icon: "solar:folder-bold",
      onClick: () => handleOpenFolder(),
    },
    {
      id: "delete",
      label: t('profiles.delete'),
      icon: "solar:trash-bin-trash-bold",
      destructive: true,
      separator: true,
      onClick: () => handleDeleteProfile(),
    },
  ];

  const toggleContextMenu = useCallback((event?: React.MouseEvent<HTMLButtonElement>) => {
    event?.preventDefault();
    event?.stopPropagation();

    if (openContextMenuId && openContextMenuId !== contextMenuId) {
      setOpenContextMenuId(null);
    }

    const newState = !isContextMenuOpen;
    setIsContextMenuOpen(newState);
    setOpenContextMenuId(newState ? contextMenuId : null);

    if (!isContextMenuOpen && event?.currentTarget) {
      const buttonRect = event.currentTarget.getBoundingClientRect();
      const containerRect = event.currentTarget.closest('.relative')?.getBoundingClientRect();
      if (containerRect) {
        setContextMenuPosition({
          x: buttonRect.right - containerRect.left - 200,
          y: buttonRect.bottom - containerRect.top + 4,
        });
      }
    }
  }, [openContextMenuId, contextMenuId, isContextMenuOpen, setOpenContextMenuId]);

  // ── Effects ───────────────────────────────────────────────────────────────
  useEffect(() => { setCurrentProfile(profile); }, [profile]);

  useEffect(() => {
    setDragDropMainTab(mainTabFor(activeNavItem));
    return () => { setDragDropMainTab(null); };
  }, [activeNavItem, setDragDropMainTab]);

  // Modpack-Versions beim Mount laden bzw. wenn sich die Modpack-Quelle aendert.
  // Deps sind serialisiert statt Objekt-Identitaet, damit der Effect nicht bei
  // jedem `setCurrentProfile(profile)` aus dem Store erneut feuert.
  const modpackSource = currentProfile.modpack_info?.source;
  const modpackSourceKey = modpackSource ? JSON.stringify(modpackSource) : null;
  useEffect(() => {
    if (!modpackSource) {
      setModpackVersions(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const versions = await UnifiedService.getModpackVersions(modpackSource);
        if (!cancelled) setModpackVersions(versions);
      } catch (err) {
        console.error("[V3] Failed to refresh modpack versions:", err);
        if (!cancelled) setModpackVersions(null);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modpackSourceKey]);

  useEffect(() => {
    if (openContextMenuId && openContextMenuId !== contextMenuId && isContextMenuOpen) {
      setIsContextMenuOpen(false);
    }
  }, [openContextMenuId, contextMenuId, isContextMenuOpen]);

  // Disk usage: fetch once per profile, also refetch when a session ends
  // (Playtime-Wert hat sich dann geändert, plausibel dass sich auch Dateien änderten).
  const [diskSize, setDiskSize] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    setDiskSize(null);
    ProfileService.getProfileDiskSize(currentProfile.id)
      .then((size) => { if (!cancelled) setDiskSize(size); })
      .catch((err) => {
        console.warn("[V3] Failed to fetch disk size:", err);
        if (!cancelled) setDiskSize(null);
      });
    return () => { cancelled = true; };
  }, [currentProfile.id, currentProfile.playtime_seconds]);

  const resolvedLoaderVersion = useResolvedLoaderVersion(currentProfile);

  // ── Render ────────────────────────────────────────────────────────────────
  const hasModpack = !!currentProfile.modpack_info;
  const isVanillaLoader = !currentProfile.loader || currentProfile.loader === "vanilla";
  const modpackLabel = modpackVersions?.installed_version
    ? `${modpackVersions.installed_version.name ?? t("profiles.v3.stats.modpack")}`
    : hasModpack ? t("profiles.v3.stats.modpack") : t("profiles.v3.time.placeholder");
  const modpackVersionNumber = modpackVersions?.installed_version?.version_number ?? null;

  return (
    <div className="h-full flex flex-col overflow-hidden relative">
      {/* ── Top Bar ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 h-11 border-b border-white/5 flex-shrink-0">
        <button
          onClick={onClose}
          className="flex items-center gap-2 text-white/60 hover:text-white transition-colors"
        >
          <Icon icon="solar:arrow-left-linear" className="w-4 h-4" />
          <span className="text-xs font-minecraft-ten uppercase tracking-wider">{t('profiles.back')}</span>
          <span className="text-white/30">/</span>
          <span
            className="text-xs font-minecraft-ten text-white/80 normal-case max-w-[240px] truncate"
            dangerouslySetInnerHTML={{ __html: parseMotdToHtml(currentProfile.name || currentProfile.id) }}
          />
        </button>

        <div className="flex items-center gap-1 relative">
          <Tooltip content={t('profiles.openFolder')}>
            <button
              onClick={handleOpenFolder}
              className="p-2 rounded hover:bg-white/5 text-white/50 hover:text-white transition-colors"
            >
              <Icon icon="solar:folder-linear" className="w-4 h-4" />
            </button>
          </Tooltip>
          <Tooltip content={t('profiles.duplicate')}>
            <button
              onClick={handleDuplicateProfile}
              className="p-2 rounded hover:bg-white/5 text-white/50 hover:text-white transition-colors"
            >
              <Icon icon="solar:copy-linear" className="w-4 h-4" />
            </button>
          </Tooltip>
          <Tooltip content={t('profiles.export')}>
            <button
              onClick={handleOpenExportModal}
              className="p-2 rounded hover:bg-white/5 text-white/50 hover:text-white transition-colors"
            >
              <Icon icon="solar:upload-linear" className="w-4 h-4" />
            </button>
          </Tooltip>
          <div className="w-px h-5 bg-white/10 mx-1" />
          <Tooltip content={t('profiles.moreOptions')}>
            <button
              ref={moreButtonRef}
              onClick={toggleContextMenu}
              className="p-2 rounded hover:bg-white/5 text-white/50 hover:text-white transition-colors"
            >
              <Icon icon="solar:menu-dots-bold" className="w-4 h-4" />
            </button>
          </Tooltip>

          <SettingsContextMenu
            profile={currentProfile}
            isOpen={isContextMenuOpen}
            position={contextMenuPosition}
            items={contextMenuItems}
            onClose={() => {
              setIsContextMenuOpen(false);
              setOpenContextMenuId(null);
            }}
            triggerButtonRef={moreButtonRef}
          />
        </div>
      </div>

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <div className="px-5 pt-5 pb-4 flex-shrink-0">
        <div className="flex items-start gap-5">
          {/* Icon + loader overlay */}
          <div className="relative flex-shrink-0">
            <ProfileIconV2 profile={currentProfile} size="lg" className="w-24 h-24 rounded-lg ring-1 ring-white/10" />
            <div className="absolute -bottom-1.5 -right-1.5 w-7 h-7 rounded-md bg-black/80 ring-1 ring-white/15 flex items-center justify-center">
              <img src={getLoaderIcon(currentProfile.loader)} alt={currentProfile.loader ?? "vanilla"} className="w-4 h-4" />
            </div>
          </div>

          {/* Identity + chips */}
          <div className="flex-1 min-w-0 pt-1">
            <h1
              className="font-minecraft-ten text-3xl text-white normal-case truncate"
              dangerouslySetInnerHTML={{ __html: parseMotdToHtml(currentProfile.name || currentProfile.id) }}
            />
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              <Chip icon="solar:gamepad-bold">{currentProfile.game_version}</Chip>
              {!isVanillaLoader && (() => {
                const loaderVersion = resolvedLoaderVersion?.version || currentProfile.loader_version;
                return (
                  <Chip icon="solar:box-bold">
                    {currentProfile.loader}
                    {loaderVersion ? ` ${loaderVersion}` : ""}
                  </Chip>
                );
              })()}
              {hasModpack && (
                <Chip icon="solar:widget-bold">
                  {modpackLabel}
                  {modpackVersionNumber && <span className="text-white/40 ml-1">· {modpackVersionNumber}</span>}
                </Chip>
              )}
              {currentProfile.group && <Chip icon="solar:folder-bold">{currentProfile.group}</Chip>}
              {preferredAccount && (
                <Tooltip content={t('profiles.launchWith', { username: preferredAccount.username })}>
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-xs text-white/70 font-minecraft-ten">
                    {preferredAccountAvatarUrl ? (
                      <img
                        src={preferredAccountAvatarUrl}
                        alt={preferredAccount.username}
                        className="w-3.5 h-3.5 rounded-sm"
                        style={{ imageRendering: 'pixelated' }}
                      />
                    ) : (
                      <Icon icon="solar:user-bold" className="w-3.5 h-3.5" />
                    )}
                    <span className="normal-case">{preferredAccount.username}</span>
                  </span>
                </Tooltip>
              )}
            </div>
          </div>

          {/* Primary CTA cluster */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={handleLaunch}
              className={`group relative h-14 min-w-[180px] px-6 rounded-lg font-minecraft-ten text-xl uppercase tracking-wider text-white transition-all
                ${isLaunching
                  ? "bg-gradient-to-b from-rose-500/90 to-rose-600/90 hover:from-rose-400 hover:to-rose-500 ring-1 ring-rose-300/30 shadow-[0_8px_24px_-8px_rgba(244,63,94,0.6)]"
                  : "bg-gradient-to-b from-emerald-500/90 to-emerald-600/90 hover:from-emerald-400 hover:to-emerald-500 ring-1 ring-emerald-300/30 shadow-[0_8px_24px_-8px_rgba(16,185,129,0.6)]"}`}
            >
              <span className="flex items-center justify-center gap-2.5">
                <Icon icon={isLaunching ? "solar:stop-bold" : "solar:play-bold"} className="w-6 h-6" />
                {isLaunching ? t('profiles.stop') : t('profiles.play')}
              </span>
            </button>
            <Tooltip content={t('profiles.editProfile')}>
              <button
                onClick={onEdit}
                className="h-14 w-12 rounded-lg bg-white/[0.03] hover:bg-white/10 border border-white/10 text-white/60 hover:text-white flex items-center justify-center transition-colors"
              >
                <Icon icon="solar:settings-bold" className="w-5 h-5" />
              </button>
            </Tooltip>
          </div>
        </div>

        {/* Stats-Strip — waehrend Launch durch Status-Card ersetzt. IDENTISCHER
            Wrapper (flex + gap-2 + flex-wrap) damit die Row-Hoehe stabil bleibt
            auch wenn die Stats auf schmalen Viewports wrappen. Launch-Card
            nutzt EXAKT das Stat-Padding/-Struktur (px-3 py-2 + gap-2.5 +
            leading-tight) damit 1:1 gleiche Pixel. */}
        <div className="flex items-center gap-2 flex-wrap mt-5">
          {isLaunching && statusMessage ? (
            <div className="flex-1 flex items-center gap-2.5 px-3 py-2 rounded-md bg-emerald-500/10 border border-emerald-400/25 min-w-[140px] animate-in fade-in duration-200">
              <Icon icon="solar:refresh-bold" className="w-4 h-4 text-emerald-300 animate-spin flex-shrink-0" />
              <div className="flex flex-col leading-tight min-w-0">
                <span className="text-[10px] uppercase tracking-wider text-emerald-300/70 font-minecraft-ten">
                  {t("profiles.card.starting")}
                </span>
                <span className="text-sm text-emerald-100/95 font-minecraft-ten truncate" title={statusMessage}>
                  {statusMessage}
                </span>
              </div>
            </div>
          ) : (
            <>
              <Stat
                icon="solar:clock-circle-bold"
                label={t('profiles.sort.lastPlayed')}
                value={formatRelativeTime(currentProfile.last_played)}
              />
              <Stat
                icon="solar:archive-bold"
                label={t("profiles.v3.stats.modpack")}
                value={hasModpack ? (modpackVersionNumber ? `${modpackLabel} ${modpackVersionNumber}` : modpackLabel) : "—"}
                muted={!hasModpack}
              />
              <Stat
                icon="solar:hourglass-bold"
                label={t("profiles.v3.stats.playtime")}
                value={formatPlaytime(currentProfile.playtime_seconds)}
                muted={!currentProfile.playtime_seconds}
              />
              <Stat
                icon="solar:hard-drive-bold"
                label={t("profiles.v3.stats.disk")}
                value={diskSize == null ? "…" : formatBytes(diskSize)}
                muted={diskSize == null || diskSize === 0}
              />
            </>
          )}
        </div>
      </div>

      {/* ── Body: Left-Rail + Main ──────────────────────────────────────── */}
      <div className={`flex-1 min-h-0 flex border-t border-white/5 ${activeNavItem === "logs" ? "" : "overflow-hidden"}`}>
        <ProfileLeftRailV3
          profile={currentProfile}
          activeNavItem={activeNavItem}
          onNavChange={setActiveNavItem}
        />

        <main className="flex-1 min-w-0 flex flex-col min-h-0">
          {activeNavItem === "mods" && (
            <LocalContentTabV3<LocalContentItem>
              profile={currentProfile}
              contentType="Mod"
              getDisplayFileName={getGenericDisplayFileName}
              itemTypeName={t('profiles.content.mod')}
              itemTypeNamePlural={t('profiles.content.mods')}
              addContentButtonText={t('profiles.content.addMods')}
              emptyStateIconOverride="solar:bolt-bold-duotone"
              onRefreshRequired={handleRefresh}
              onBrowseContentRequest={handleBrowseContent}
            />
          )}

          {activeNavItem === "resourcepacks" && (
            <LocalContentTabV3<LocalContentItem>
              profile={currentProfile}
              contentType="ResourcePack"
              getDisplayFileName={getGenericDisplayFileName}
              itemTypeName={t('profiles.content.resourcePack')}
              itemTypeNamePlural={t('profiles.content.resourcePacks')}
              addContentButtonText={t('profiles.content.addResourcePacks')}
              emptyStateIconOverride="solar:gallery-bold-duotone"
              onRefreshRequired={handleRefresh}
              onBrowseContentRequest={handleBrowseContent}
            />
          )}

          {activeNavItem === "shaderpacks" && (
            <LocalContentTabV3<LocalContentItem>
              profile={currentProfile}
              contentType="ShaderPack"
              getDisplayFileName={getGenericDisplayFileName}
              itemTypeName={t('profiles.content.shaderPack')}
              itemTypeNamePlural={t('profiles.content.shaderPacks')}
              addContentButtonText={t('profiles.content.addShaderPacks')}
              emptyStateIconOverride="solar:sun-bold-duotone"
              onRefreshRequired={handleRefresh}
              onBrowseContentRequest={handleBrowseContent}
            />
          )}

          {activeNavItem === "datapacks" && (
            <LocalContentTabV3<LocalContentItem>
              profile={currentProfile}
              contentType="DataPack"
              getDisplayFileName={getGenericDisplayFileName}
              itemTypeName={t('profiles.content.dataPack')}
              itemTypeNamePlural={t('profiles.content.dataPacks')}
              addContentButtonText={t('profiles.content.addDataPacks')}
              emptyStateIconOverride="solar:database-bold-duotone"
              onRefreshRequired={handleRefresh}
              onBrowseContentRequest={handleBrowseContent}
            />
          )}

          {activeNavItem === "nrc" && (
            <LocalContentTabV3<LocalContentItem>
              profile={currentProfile}
              contentType="NoRiskMod"
              getDisplayFileName={getGenericDisplayFileName}
              itemTypeName={t('profiles.content.noriskMod')}
              itemTypeNamePlural={t('profiles.content.noriskMods')}
              addContentButtonText={t('profiles.content.addNoriskMods')}
              emptyStateIconOverride="solar:shield-check-bold-duotone"
              onRefreshRequired={async () => {
                try {
                  await fetchProfiles();
                  setCurrentProfile(prev => ({ ...prev }));
                } catch (err) {
                  console.error("[V3] Failed to refresh profile data:", err);
                }
                handleRefresh();
              }}
              /* Kein Add-CTA: NoRisk-Mods kommen ueber den Pack-Selector, nicht via Browse. */
            />
          )}

          {activeNavItem === "worlds" && (
            <WorldsTabV3
              profile={currentProfile}
              isActive={true}
              onRefresh={handleRefresh}
              onLaunchRequest={handleLaunchRequest}
            />
          )}

          {activeNavItem === "screenshots" && (
            <ScreenshotsTabV3 profile={currentProfile} isActive={true} />
          )}

          {activeNavItem === "logs" && (
            <LogsTab
              profile={currentProfile}
              isActive={true}
              onRefresh={handleRefresh}
            />
          )}
        </main>
      </div>

      {/* ── Modals ──────────────────────────────────────────────────────── */}
      <ConfirmDeleteDialog
        isOpen={isDeleteModalOpen}
        itemName={currentProfile.name}
        onClose={handleCancelDelete}
        onConfirm={handleConfirmDelete}
        isDeleting={isDeleting}
        title={t('profiles.deleteProfileTitle')}
        message={
          <p className="text-white/80 font-minecraft-ten">
            {t('profiles.deleteConfirmMessage', { name: currentProfile.name })}
          </p>
        }
      />

    </div>
  );
}
