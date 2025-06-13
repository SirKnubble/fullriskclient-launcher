"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { Icon } from "@iconify/react";
import motdParser from "@sfirew/minecraft-motd-parser";
import { Button } from "../../ui/buttons/Button";
import { IconButton } from "../../ui/buttons/IconButton";
import { useThemeStore } from "../../../store/useThemeStore";
import { useProfileStore } from "../../../store/profile-store";
import { SearchInput } from "../../ui/SearchInput";
import { gsap } from "gsap";
import { TagBadge } from "../../ui/TagBadge";
import { CopyWorldDialog } from "../../modals/CopyWorldDialog";
import { ConfirmDeleteDialog } from "../../modals/ConfirmDeleteDialog";
import { toast } from "react-hot-toast";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { LaunchButton } from "../../ui/buttons/LaunchButton";
import { GenericList } from "../../ui/GenericList";
import { GenericListItem } from "../../ui/GenericListItem";
import { preloadIcons } from "../../../lib/icon-utils";
// --- Import Real Types ---
import type {
  ServerInfo,
  ServerPingInfo,
  WorldInfo,
} from "../../../types/minecraft";
import type { CopyWorldParams, Profile } from "../../../types/profile";
import { timeAgo } from "../../../utils/time-utils";
import * as WorldService from "../../../services/world-service";
import {
  getDifficultyString,
  getGameModeString,
} from "../../../services/world-service";

// --- Icons to preload for WorldsTab ---
const WORLDS_TAB_ICONS_TO_PRELOAD = [
  // Placeholders
  "solar:planet-bold",
  "solar:server-bold",
  // Tag Badges (World)
  "solar:gamepad-bold-duotone",
  "solar:tuning-square-bold-duotone",
  "solar:skull-bold",
  "solar:lock-bold",
  "solar:tag-bold", // Also used for server version
  // Tag Badges (Server)
  "solar:users-group-rounded-bold",
  "solar:wifi-bold",
  // Action Buttons (World)
  "solar:copy-bold",
  "solar:folder-open-bold-duotone",
  "solar:trash-bin-trash-bold",
  // Common / Dynamic states
  "solar:refresh-circle-bold-duotone", // For loading states in buttons
  // Note: LaunchButton icons are internal to it. GenericList preloads its own defaults.
];

const notificationStore = {
  success: (msg: string) => console.log(`[SUCCESS] ${msg}`),
  error: (msg: string) => console.error(`[ERROR] ${msg}`),
};

interface WorldsTabProps {
  profile: Profile;
  onRefresh?: () => void;
  isActive?: boolean;
  searchQuery?: string;
  onLaunchRequest?: (params: {
    profileId: string;
    quickPlaySingleplayer?: string;
    quickPlayMultiplayer?: string;
  }) => void;
}

export type DisplayItem =
  | (WorldInfo & { type: "world" })
  | (ServerInfo & { type: "server" });

export function WorldsTab({
  profile,
  onRefresh,
  isActive = false,
  searchQuery = "",
  onLaunchRequest,
}: WorldsTabProps) {
  const allProfilesFromStore = useProfileStore((state) => state.profiles);
  const isLoadingProfilesFromStore = useProfileStore((state) => state.loading);

  // --- State ---
  const [worlds, setWorlds] = useState<WorldInfo[]>([]);
  const [servers, setServers] = useState<ServerInfo[]>([]);
  const [displayItems, setDisplayItems] = useState<DisplayItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [serverPings, setServerPings] = useState<
    Record<string, ServerPingInfo>
  >({});
  const [pingingServers, setPingingServers] = useState<Set<string>>(new Set());

  // --- Config ---
  // const MIN_LOADING_TIME_MS = 300; // Removed

  // --- Copy Dialog State ---
  const [isCopyWorldDialogOpen, setIsCopyWorldDialogOpen] = useState(false);
  const [worldToCopy, setWorldToCopy] = useState<WorldInfo | null>(null);
  const [isCopyingWorld, setIsCopyingWorld] = useState(false);
  const [copyWorldError, setCopyWorldError] = useState<string | null>(null);
  // --- End Copy Dialog State ---

  // --- Delete Dialog State ---
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [worldToDelete, setWorldToDelete] = useState<WorldInfo | null>(null);
  const [isActuallyDeleting, setIsActuallyDeleting] = useState(false);
  // --- End Delete Dialog State ---

  const [deleteLoading, setDeleteLoading] = useState<Record<string, boolean>>(
    {},
  );
  const [localSearchQuery, setLocalSearchQuery] = useState("");
  const accentColor = useThemeStore((state) => state.accentColor);
  const isBackgroundAnimationEnabled = useThemeStore(
    (state) => state.isBackgroundAnimationEnabled,
  );

  const containerRef = useRef<HTMLDivElement>(null);

  // Preload icons when component mounts
  useEffect(() => {
    preloadIcons(WORLDS_TAB_ICONS_TO_PRELOAD);
  }, []);

  // Use parent's search query if provided
  useEffect(() => {
    if (searchQuery !== undefined) {
      setLocalSearchQuery(searchQuery);
    }
  }, [searchQuery]);

  useEffect(() => {
    if (containerRef.current && isActive && isBackgroundAnimationEnabled) {
      gsap.fromTo(
        containerRef.current,
        { opacity: 0, y: 20 },
        {
          opacity: 1,
          y: 0,
          duration: 0.4,
          ease: "power2.out",
        },
      );
    } else if (
      containerRef.current &&
      isActive &&
      !isBackgroundAnimationEnabled
    ) {
      gsap.set(containerRef.current, { opacity: 1, y: 0 });
    }
  }, [isActive, isBackgroundAnimationEnabled]);

  const getWorldDisplayName = useCallback((world: WorldInfo): string => {
    return world.display_name || world.folder_name;
  }, []);

  const getWorldIconSrc = useCallback((world: WorldInfo): string | null => {
    if (world.icon_path) {
      try {
        return convertFileSrc(world.icon_path);
      } catch (err) {
        console.error(`Failed to convert icon path ${world.icon_path}:`, err);
        return null;
      }
    }
    return null;
  }, []);

  const getServerDisplayName = useCallback((server: ServerInfo): string => {
    return server.name || server.address || "Unnamed Server";
  }, []);

  const getServerIconSrc = useCallback(
    (server: ServerInfo): string | null => {
      const pingInfo = server.address ? serverPings[server.address] : null;
      const iconData = pingInfo?.favicon_base64 || server.icon_base64;
      if (iconData) {
        return iconData.startsWith("data:image")
          ? iconData
          : `data:image/png;base64,${iconData}`;
      }
      return null;
    },
    [serverPings],
  );

  const parseMotdToHtml = useCallback((motd: any): string => {
    if (!motd) return '<span class="text-white/50">No description</span>';
    try {
      const html = motdParser.autoToHTML(motd);
      return html || '<span class="text-white/50">No description</span>';
    } catch (err) {
      console.error("Failed to parse MOTD:", err);
      if (typeof motd === "string") {
        const cleaned = motdParser.cleanCodes(motd);
        // Basic HTML escape
        return cleaned
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#039;");
      }
      try {
        return JSON.stringify(motd);
      } catch (e) {}
      return '<span class="text-red-400">Invalid MOTD format</span>';
    }
  }, []);

  const updateDisplayItems = useCallback(
    (currentWorlds: WorldInfo[], currentServers: ServerInfo[]) => {
      const typedWorlds: DisplayItem[] = currentWorlds.map((w) => ({
        ...w,
        type: "world",
      }));
      const typedServers: DisplayItem[] = currentServers.map((s) => ({
        ...s,
        type: "server",
      }));

      let filteredItems: DisplayItem[] = [];

      filteredItems = [...typedWorlds, ...typedServers];

      // Apply search filter
      const effectiveSearchQuery = searchQuery || localSearchQuery;
      if (effectiveSearchQuery) {
        filteredItems = filteredItems.filter((item) => {
          const name =
            item.type === "world"
              ? getWorldDisplayName(item).toLowerCase()
              : getServerDisplayName(item).toLowerCase();
          return name.includes(effectiveSearchQuery.toLowerCase());
        });
      }

      filteredItems.sort((a, b) => {
        if (a.type === "world" && b.type === "world") {
          return (b.last_played ?? 0) - (a.last_played ?? 0);
        } else if (a.type === "world" && b.type === "server") {
          return -1;
        } else if (a.type === "server" && b.type === "world") {
          return 1;
        } else if (a.type === "server" && b.type === "server") {
          const nameA_server = getServerDisplayName(a).toLowerCase();
          const nameB_server = getServerDisplayName(b).toLowerCase();
          return nameA_server.localeCompare(nameB_server);
        }

        const nameA =
          a.type === "world"
            ? getWorldDisplayName(a).toLowerCase()
            : getServerDisplayName(a).toLowerCase();
        const nameB =
          b.type === "world"
            ? getWorldDisplayName(b).toLowerCase()
            : getServerDisplayName(b).toLowerCase();
        return nameA.localeCompare(nameB);
      });

      setDisplayItems(filteredItems);
    },
    [getServerDisplayName, getWorldDisplayName, searchQuery, localSearchQuery],
  );

  const pingAllServers = useCallback(async (serversToPing: ServerInfo[]) => {
    const relevantServers = serversToPing.filter((s) => s.address);
    if (relevantServers.length === 0) return;

    console.log(`[WorldsTab] Pinging ${relevantServers.length} servers...`);
    const currentPinging = new Set<string>(
      relevantServers.map((s) => s.address!),
    );
    setPingingServers(currentPinging);
    setServerPings((prev) => {
      const next = { ...prev };
      relevantServers.forEach((s) => {
        if (s.address) delete next[s.address];
      });
      return next;
    });

    const promises = relevantServers.map(async (server) => {
      const address = server.address!;
      try {
        const pingResult = await WorldService.pingMinecraftServer(address);
        setServerPings((prev) => ({ ...prev, [address]: pingResult }));
      } catch (err) {
        console.error(`[WorldsTab] Failed to ping ${address}:`, err);
        const errorMsg = err instanceof Error ? err.message : String(err);
        const errorResult: ServerPingInfo = {
          error: errorMsg,
          description: null,
          description_json: null,
          version_name: null,
          version_protocol: null,
          players_online: null,
          players_max: null,
          favicon_base64: null,
          latency_ms: null,
        };
        setServerPings((prev) => ({ ...prev, [address]: errorResult }));
      } finally {
        setPingingServers((prev) => {
          const next = new Set(prev);
          next.delete(address);
          return next;
        });
      }
    });

    await Promise.allSettled(promises);
    console.log("[WorldsTab] All server pings finished.");
  }, []);

  const loadData = useCallback(async () => {
    const currentProfileId = profile?.id;
    if (!currentProfileId) {
      setWorlds([]);
      setServers([]);
      setDisplayItems([]);
      setError(null);
      setServerPings({});
      setPingingServers(new Set());
      setLoading(false);
      return;
    }

    console.log(`[WorldsTab] Loading data for profile: ${currentProfileId}`);
    setLoading(true);
    setError(null);

    try {
      setServerPings({});
      setPingingServers(new Set());

      const [worldsResult, serversResult] = await Promise.allSettled([
        WorldService.getWorldsForProfile(currentProfileId),
        WorldService.getServersForProfile(currentProfileId),
      ]);

      let currentWorlds: WorldInfo[] = [];
      let currentServers: ServerInfo[] = [];
      let loadError = false;
      const errorMessages: string[] = [];

      if (worldsResult.status === "fulfilled") {
        currentWorlds = worldsResult.value;
        // setWorlds(currentWorlds); // Defer state update slightly
      } else {
        console.error("Worlds Error:", worldsResult.reason);
        errorMessages.push(`Worlds: ${worldsResult.reason}`);
        loadError = true;
      }

      if (serversResult.status === "fulfilled") {
        currentServers = serversResult.value;
        // setServers(currentServers); // Defer state update slightly
      } else {
        console.error("Servers Error:", serversResult.reason);
        errorMessages.push(`Servers: ${serversResult.reason}`);
        loadError = true;
      }

      if (loadError) {
        setError(errorMessages.join("; "));
        setWorlds([]); // Ensure worlds state is cleared on error
        setServers([]); // Ensure servers state is cleared on error
        // setDisplayItems([]); // updateDisplayItems will handle this based on empty worlds/servers
      } else {
        // Set raw data state first
        setWorlds(currentWorlds);
        setServers(currentServers);
        // Then ping. updateDisplayItems will be triggered by the useEffect that watches worlds/servers.
        pingAllServers(currentServers);
      }
    } catch (err) {
      console.error("Unexpected load error:", err);
      setError(`Unexpected error: ${err}`);
      setWorlds([]);
      setServers([]);
      // setDisplayItems([]);
    } finally {
      setLoading(false); // Set loading to false directly
    }
  }, [profile?.id, pingAllServers]); // Removed MIN_LOADING_TIME_MS from dependencies

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (profile?.id) {
      updateDisplayItems(worlds, servers);
    }
  }, [
    profile?.id,
    updateDisplayItems,
    worlds,
    servers,
    searchQuery,
    localSearchQuery,
  ]);

  const handleOpenCopyDialog = useCallback(async (world: WorldInfo) => {
    setWorldToCopy(world);
    setCopyWorldError(null);
    setIsCopyWorldDialogOpen(true);
  }, []);

  const handleCloseCopyDialog = useCallback(() => {
    setIsCopyWorldDialogOpen(false);
    setWorldToCopy(null);
  }, []);

  const handleConfirmCopyWorld = useCallback(
    async (params: { targetProfileId: string; targetWorldName: string }) => {
      if (!worldToCopy || !profile?.id) return;

      setIsCopyingWorld(true);
      setCopyWorldError(null);

      const copyParams: CopyWorldParams = {
        source_profile_id: profile.id,
        source_world_folder: worldToCopy.folder_name,
        target_profile_id: params.targetProfileId,
        target_world_name: params.targetWorldName,
      };

      try {
        await WorldService.copyWorld(copyParams);
        toast.success(
          `World '${getWorldDisplayName(worldToCopy)}' copied successfully as '${params.targetWorldName}'!`,
        );
        if (params.targetProfileId === profile.id) {
          await loadData();
        }
      } catch (err) {
        console.error("Failed to copy world:", err);
        const errorMsg = err instanceof Error ? err.message : String(err);
        setCopyWorldError(`Copy failed: ${errorMsg}`);
        toast.error(`Failed to copy world: ${errorMsg}`);
      } finally {
        setIsCopyingWorld(false);
      }
    },
    [
      worldToCopy,
      profile?.id,
      getWorldDisplayName,
      loadData,
      handleCloseCopyDialog,
    ],
  );

  const handleDeleteRequest = useCallback((world: WorldInfo) => {
    setWorldToDelete(world);
    setIsDeleteConfirmOpen(true);
  }, []);

  const handleCloseDeleteConfirmDialog = useCallback(() => {
    setIsDeleteConfirmOpen(false);
    setWorldToDelete(null);
  }, []);

  const handleConfirmActualDelete = useCallback(async () => {
    if (!worldToDelete || !profile?.id) return;

    setIsActuallyDeleting(true);
    try {
      await WorldService.deleteWorld(profile.id, worldToDelete.folder_name);
      toast.success(`World "${getWorldDisplayName(worldToDelete)}" deleted.`);
      handleCloseDeleteConfirmDialog();
      await loadData();
    } catch (err) {
      console.error("Delete failed:", err);
      toast.error(
        `Delete failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setIsActuallyDeleting(false);
    }
  }, [
    worldToDelete,
    profile?.id,
    getWorldDisplayName,
    loadData,
    handleCloseDeleteConfirmDialog,
  ]);

  const handleOpenWorldFolder = useCallback(
    async (world: WorldInfo) => {
      if (!world?.icon_path) {
        toast.error("World path is not available.");
        console.error(
          "Cannot open world folder: Profile path is missing.",
          profile,
        );
        return;
      }
      // Basic path joining, consider using a library for robust path construction if complex scenarios arise
      const worldFolderPath = `${world.icon_path}`;
      try {
        console.log(`Attempting to open folder: ${worldFolderPath}`);
        await revealItemInDir(worldFolderPath);
        toast.success(`Opened folder for '${getWorldDisplayName(world)}'`);
      } catch (err) {
        console.error(`Failed to open folder ${worldFolderPath}:`, err);
        toast.error(
          `Failed to open folder: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    },
    [profile?.path, getWorldDisplayName],
  );

  const handleRefresh = () => {
    loadData();
    if (onRefresh) {
      onRefresh();
    }
  };

  const effectiveSearchQuery = searchQuery || localSearchQuery;

  // --- Render Item Function for GenericList ---
  const renderDisplayItem = useCallback(
    (item: DisplayItem) => {
      const isWorld = item.type === "world";
      const key = isWorld
        ? item.folder_name
        : item.address || item.name || Math.random().toString();
      const pingInfo =
        !isWorld && item.address ? serverPings[item.address] : null;
      const isPinging =
        !isWorld && item.address ? pingingServers.has(item.address) : false;
      const hasPingError = !!pingInfo?.error;
      const worldIconSrc = isWorld ? getWorldIconSrc(item) : null;
      const serverIconSrc = !isWorld ? getServerIconSrc(item) : null;
      const itemDisplayName = isWorld
        ? getWorldDisplayName(item)
        : getServerDisplayName(item);

      const iconNode = (
        <div
          className="absolute inset-0 border-2 border-b-4 overflow-hidden rounded-md"
          style={{
            backgroundColor: `${accentColor.value}15`,
            borderColor: `${accentColor.value}30`,
            borderBottomColor: `${accentColor.value}50`,
            boxShadow: `0 2px 4px rgba(0,0,0,0.2), inset 0 1px 0 ${accentColor.value}20`,
          }}
        >
          {isWorld ? (
            worldIconSrc ? (
              <img
                src={worldIconSrc || "/placeholder.svg"}
                alt={`${itemDisplayName} icon`}
                className="w-full h-full object-cover image-pixelated"
                loading="lazy"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Icon
                  icon="solar:planet-bold"
                  className="w-10 h-10 text-white/50"
                />
              </div>
            )
          ) : serverIconSrc ? (
            <img
              src={serverIconSrc || "/placeholder.svg"}
              alt={`${itemDisplayName} icon`}
              className="w-full h-full object-cover image-pixelated"
              loading="lazy"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Icon
                icon="solar:server-bold"
                className="w-10 h-10 text-white/50"
              />
            </div>
          )}
        </div>
      );

      const contentNode = (
        <>
          {/* Top: Title */}
          <h3
            className="font-minecraft-ten text-base tracking-wide truncate flex-shrink-0"
            title={itemDisplayName}
          >
            {itemDisplayName}
          </h3>

          {/* Middle: Subtitle (Last Played / MOTD) - vertically centered */}
          <div className="flex-grow flex items-center my-1 overflow-hidden">
            {isWorld ? (
              <p className="text-white/60 text-xs truncate font-minecraft-ten">
                {item.last_played
                  ? `Last played: ${timeAgo(item.last_played)}`
                  : "Never played"}
              </p>
            ) : (
              <div
                className="text-white/70 text-xs motd-container overflow-hidden truncate font-minecraft-ten text-center"
                title={pingInfo?.description || item.address || ""}
              >
                {isPinging ? (
                  <span className="italic text-white/50">Pinging...</span>
                ) : hasPingError ? (
                  <span className="text-red-400 italic">
                    Error: {pingInfo?.error}
                  </span>
                ) : pingInfo ? (
                  <span
                    dangerouslySetInnerHTML={{
                      __html: parseMotdToHtml(
                        pingInfo?.description_json || pingInfo?.description,
                      ),
                    }}
                  />
                ) : (
                  <span className="italic text-white/50">
                    {item.address || "Address missing"}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Bottom: Tag Badges */}
          <div className="flex flex-wrap items-center gap-1 flex-shrink-0">
            {isWorld ? (
              <>
                <TagBadge
                  size="sm"
                  variant="info"
                  iconElement={<Icon icon="solar:gamepad-bold-duotone" />}
                >
                  {getGameModeString(item.game_mode)}
                </TagBadge>
                <TagBadge
                  size="sm"
                  variant="default"
                  iconElement={<Icon icon="solar:tuning-square-bold-duotone" />}
                >
                  {getDifficultyString(item.difficulty)}
                </TagBadge>
                {item.is_hardcore && (
                  <TagBadge
                    variant="destructive"
                    size="sm"
                    iconElement={<Icon icon="solar:skull-bold" />}
                  >
                    Hardcore
                  </TagBadge>
                )}
                {item.difficulty_locked && (
                  <TagBadge
                    size="sm"
                    iconElement={<Icon icon="solar:lock-bold" />}
                  >
                    Locked
                  </TagBadge>
                )}
                {item.version_name && (
                  <TagBadge
                    size="sm"
                    iconElement={<Icon icon="solar:tag-bold" />}
                  >
                    {item.version_name}
                  </TagBadge>
                )}
              </>
            ) : (
              <>
                {isPinging ? (
                  <TagBadge size="sm" variant="default">
                    Pinging...
                  </TagBadge>
                ) : hasPingError ? (
                  <TagBadge size="sm" variant="destructive">
                    Error
                  </TagBadge>
                ) : pingInfo ? (
                  (() => {
                    let playerCountVariant:
                      | "default"
                      | "success"
                      | "info"
                      | "inactive"
                      | "destructive"
                      | "warning" = "inactive";
                    if (pingInfo.players_online != null) {
                      if (pingInfo.players_online > 0)
                        playerCountVariant = "success";
                      else playerCountVariant = "default";
                    }
                    let pingLatencyVariant:
                      | "default"
                      | "success"
                      | "info"
                      | "inactive"
                      | "destructive"
                      | "warning" = "inactive";
                    if (pingInfo.latency_ms != null) {
                      if (pingInfo.latency_ms <= 80)
                        pingLatencyVariant = "success";
                      else if (pingInfo.latency_ms <= 150)
                        pingLatencyVariant = "default";
                      else if (pingInfo.latency_ms <= 250)
                        pingLatencyVariant = "warning";
                      else pingLatencyVariant = "destructive";
                    }
                    return (
                      <>
                        <TagBadge
                          size="sm"
                          variant={playerCountVariant}
                          iconElement={
                            <Icon icon="solar:users-group-rounded-bold" />
                          }
                        >
                          {pingInfo.players_online ?? "-"}/
                          {pingInfo.players_max ?? "-"}
                        </TagBadge>
                        <TagBadge
                          size="sm"
                          variant={pingLatencyVariant}
                          iconElement={<Icon icon="solar:wifi-bold" />}
                        >
                          {pingInfo.latency_ms ?? "-"} ms
                        </TagBadge>
                        {pingInfo.version_name && (
                          <TagBadge
                            size="sm"
                            variant="default"
                            iconElement={<Icon icon="solar:tag-bold" />}
                          >
                            {pingInfo.version_name}
                          </TagBadge>
                        )}
                      </>
                    );
                  })()
                ) : (
                  <TagBadge size="sm" variant="inactive">
                    Offline / Unknown
                  </TagBadge>
                )}
              </>
            )}
          </div>
        </>
      );

      const actionsNode = (
        <>
          <LaunchButton
            id={profile.id}
            name={itemDisplayName}
            size="sm"
            buttonText={isWorld ? "Play" : "Join"}
            disabled={!isWorld && !item.address}
            quickPlaySingleplayer={isWorld ? item.folder_name : undefined}
            quickPlayMultiplayer={
              !isWorld && item.address ? item.address : undefined
            }
          />
          {isWorld && (
            <div className="flex gap-1">
              <IconButton
                onClick={() => handleOpenCopyDialog(item)}
                title="Copy World"
                disabled={isCopyingWorld}
                icon={<Icon icon="solar:copy-bold" />}
                variant="secondary"
                size="xs"
              />
              <IconButton
                onClick={() => handleOpenWorldFolder(item)}
                title="Open World Folder"
                icon={<Icon icon="solar:folder-open-bold-duotone" />}
                variant="secondary"
                size="xs"
              />
              <IconButton
                onClick={() => handleDeleteRequest(item)}
                title="Delete World"
                disabled={
                  isActuallyDeleting &&
                  worldToDelete?.folder_name === item.folder_name
                }
                icon={
                  isActuallyDeleting &&
                  worldToDelete?.folder_name === item.folder_name ? (
                    <Icon
                      icon="solar:refresh-circle-bold-duotone"
                      className="animate-spin"
                    />
                  ) : (
                    <Icon icon="solar:trash-bin-trash-bold" />
                  )
                }
                variant="destructive"
                size="xs"
              />
            </div>
          )}
        </>
      );

      return (
        <GenericListItem
          key={key}
          icon={iconNode}
          content={contentNode}
          actions={actionsNode}
        />
      );
    },
    [
      accentColor.value,
      getWorldDisplayName,
      getWorldIconSrc,
      getServerDisplayName,
      getServerIconSrc,
      serverPings,
      pingingServers,
      parseMotdToHtml,
      handleOpenCopyDialog,
      handleOpenWorldFolder,
      handleDeleteRequest,
      isCopyingWorld,
      isActuallyDeleting,
      worldToDelete,
      profile.id,
      getGameModeString,
      getDifficultyString,
      timeAgo,
    ],
  );

  return (
    <div ref={containerRef} className="h-full flex flex-col select-none p-4">
      {/* Action bar with transparent styling */}
      <div
        className="flex items-center justify-between mb-4 p-3 rounded-lg border backdrop-blur-sm"
        style={{
          backgroundColor: `${accentColor.value}10`,
          borderColor: `${accentColor.value}30`,
        }}
      >
        {/* Only show search if parent isn't providing it */}
        {!searchQuery && (
          <div className="w-full md:w-1/3">
            <SearchInput
              value={localSearchQuery}
              onChange={setLocalSearchQuery}
              placeholder={`search worlds & servers...`}
            />
          </div>
        )}

        <div className="flex items-center gap-4 ml-auto">
          <div className="flex items-center gap-2">
            <Button
              onClick={handleRefresh}
              disabled={
                loading ||
                pingingServers.size > 0 ||
                (servers.filter((s) => s.address).length === 0 &&
                  displayItems.filter((item) => item.type === "server").length >
                    0)
              }
              variant="secondary"
              size="sm"
            >
              {loading ? (
                <Icon
                  icon="solar:refresh-circle-bold-duotone"
                  className="w-4 h-4 animate-spin"
                />
              ) : (
                "refresh"
              )}
            </Button>
          </div>
        </div>
      </div>

      <GenericList<DisplayItem>
        items={displayItems}
        renderItem={renderDisplayItem}
        isLoading={loading}
        error={error}
        searchQuery={effectiveSearchQuery}
        accentColor={accentColor.value}
        emptyStateIcon={"solar:planet-bold"}
        emptyStateMessage={
          effectiveSearchQuery
            ? `no worlds or servers match your search`
            : `no worlds or servers found`
        }
        emptyStateDescription={"Create worlds or add servers in Minecraft"}
        loadingItemCount={0}
      />

      {isCopyWorldDialogOpen && worldToCopy && profile?.id && (
        <CopyWorldDialog
          isOpen={isCopyWorldDialogOpen}
          sourceWorldName={getWorldDisplayName(worldToCopy)}
          sourceProfileId={profile.id}
          availableProfiles={allProfilesFromStore}
          isLoadingProfiles={isLoadingProfilesFromStore}
          isCopying={isCopyingWorld}
          onClose={handleCloseCopyDialog}
          onConfirm={handleConfirmCopyWorld}
          initialError={copyWorldError}
        />
      )}

      {isDeleteConfirmOpen && worldToDelete && (
        <ConfirmDeleteDialog
          isOpen={isDeleteConfirmOpen}
          itemName={getWorldDisplayName(worldToDelete)}
          onClose={handleCloseDeleteConfirmDialog}
          onConfirm={handleConfirmActualDelete}
          isDeleting={isActuallyDeleting}
        />
      )}
    </div>
  );
}
