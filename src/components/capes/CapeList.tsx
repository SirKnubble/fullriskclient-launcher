"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  ReactNode,
} from "react";
import { useInView } from "react-intersection-observer";
import type { CosmeticCape } from "../../types/noriskCapes";
import { EmptyState } from "../ui/EmptyState";
import { Icon } from "@iconify/react";
import { CapeImage } from "./CapeImage";
import { getPlayerProfileByUuidOrName, getCapesByHashes } from "../../services/cape-service";
// Removed VirtuosoGrid import - using native scrolling instead
import { useThemeStore } from "../../store/useThemeStore";
import { cn } from "../../lib/utils";
import { Button } from "../ui/buttons/Button";
import { Card } from "../ui/Card";
import { Modal } from "../ui/Modal";
import { SkinView3DWrapper } from "../common/SkinView3DWrapper";
import { useMinecraftAuthStore } from "../../store/minecraft-auth-store";
import gsap from "gsap";
import { IconButton } from "../ui/buttons/IconButton";
import { useCapeFavoritesStore } from "../../store/useCapeFavoritesStore";
import { useGlobalModal } from "../../hooks/useGlobalModal";


// Removed ListComponent - using native grid layout instead

interface CapeItemDisplayProps {
  cape: CosmeticCape;
  imageUrl: string;
  isCurrentlyEquipping: boolean;
  onEquipCape: (capeId: string) => void;
  canDelete?: boolean;
  onDeleteCapeClick?: (cape: CosmeticCape, e: React.MouseEvent) => void;
  creatorNameCache: Map<string, string>;
  onContextMenu?: (e: React.MouseEvent) => void;
  activeAccount?: any;
  showModal?: (id: string, component: ReactNode) => void;
  hideModal?: (id: string) => void;
}

function CapeItemDisplay({
  cape,
  imageUrl,
  isCurrentlyEquipping,
  onEquipCape,
  canDelete,
  onDeleteCapeClick,
  creatorNameCache,
  onContextMenu,
  activeAccount,
  showModal,
  hideModal,
}: CapeItemDisplayProps) {
  const handleCapeClick = useCallback(() => {
    if (isCurrentlyEquipping || !showModal) return;

    const userSkinUrl = activeAccount?.id
      ? `https://crafatar.com/skins/${activeAccount.id}`
      : undefined;

    showModal(`cape-preview-${cape._id}`, (
      <Modal
        title="Cape Preview"
        onClose={() => hideModal && hideModal(`cape-preview-${cape._id}`)}
        width="md"
        variant="flat"
      >
        <Cape3DPreviewWithToggle
          skinUrl={userSkinUrl}
          capeId={cape._id}
          onEquipCape={() => {
            onEquipCape(cape._id);
            hideModal && hideModal(`cape-preview-${cape._id}`);
          }}
        />
      </Modal>
    ));
  }, [cape._id, isCurrentlyEquipping, activeAccount, showModal, hideModal, onEquipCape]);
  const [creatorName, setCreatorName] = useState<string | null>(null);
  const [creatorLoading, setCreatorLoading] = useState<boolean>(false);
  const [isHovered, setIsHovered] = useState(false);
  const accentColor = useThemeStore((state) => state.accentColor);
  const isFavorite = useCapeFavoritesStore((s) => s.isFavorite(cape._id));
  const toggleFavoriteOptimistic = useCapeFavoritesStore((s) => s.toggleFavoriteOptimistic);

  useEffect(() => {
    let isMounted = true;
    if (cape.firstSeen) {
      if (creatorNameCache.has(cape.firstSeen)) {
        setCreatorName(creatorNameCache.get(cape.firstSeen)!);
        setCreatorLoading(false);
        return;
      }

      setCreatorLoading(true);
      getPlayerProfileByUuidOrName(cape.firstSeen)
        .then((profile) => {
          if (isMounted) {
            const nameToCache =
              profile && profile.name ? profile.name : "Unknown";
            setCreatorName(nameToCache);
            creatorNameCache.set(cape.firstSeen, nameToCache);
          }
        })
        .catch(() => {
          if (isMounted) {
            const errorNameToCache = "Error";
            setCreatorName(errorNameToCache);
            creatorNameCache.set(cape.firstSeen, errorNameToCache);
          }
        })
        .finally(() => {
          if (isMounted) {
            setCreatorLoading(false);
          }
        });
    }
    return () => {
      isMounted = false;
    };
  }, [cape.firstSeen, creatorNameCache]);

  // Use consistent dimensions like original CapeDisplay
  const displayWidth = 140;
  const displayHeight = Math.round(displayWidth * (16 / 10)); // 16:10 aspect ratio for capes

  // Grid layout (similar to ProfileCardV2 grid mode)
  return (
    <div
      className="relative flex flex-col gap-3 p-4 rounded-lg bg-black/20 border border-white/10 hover:border-white/20 transition-all duration-200 cursor-pointer"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={(e) => {
        e.preventDefault();
        handleCapeClick();
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        handleCapeClick();
      }}
    >
      {/* Action buttons - top right */}
      <div className={`absolute top-3 right-3 z-20 flex flex-col gap-1`}>
        {/* Favorite button */}
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleFavoriteOptimistic(cape._id);
          }}
          className="w-8 h-8 flex items-center justify-center bg-black/30 hover:bg-black/50 text-white/70 hover:text-white border border-white/10 hover:border-white/20 rounded transition-all duration-200"
          title={isFavorite ? "Unfavorite" : "Favorite"}
          disabled={isCurrentlyEquipping}
        >
          <Icon
            icon={isFavorite ? "ph:heart-fill" : "ph:heart"}
            className="w-4 h-4"
            style={{ color: isFavorite ? "#ef4444" : undefined }}
          />
        </button>

        {/* Delete button (only if canDelete) */}
        {canDelete && onDeleteCapeClick && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onDeleteCapeClick(cape, e);
            }}
            className="w-8 h-8 flex items-center justify-center bg-black/30 hover:bg-red-700/80 text-white/70 hover:text-white border border-white/10 hover:border-white/20 rounded transition-all duration-200"
            title="Delete Cape"
            disabled={isCurrentlyEquipping}
          >
            <Icon
              icon="solar:close-circle-bold"
              className="w-4 h-4"
            />
          </button>
        )}
      </div>

      {/* Cape content */}
      <div className="flex flex-col items-center gap-3 relative z-10 w-full">
        {/* Cape Image */}
        <div
          className="relative flex-shrink-0 rounded-lg flex items-center justify-center overflow-hidden border-2 transition-all duration-300 ease-out"
          style={{
            width: `${displayWidth}px`,
            height: `${displayHeight}px`,
            backgroundColor: isHovered ? `${accentColor.value}20` : 'transparent',
            borderColor: isHovered ? `${accentColor.value}60` : 'transparent',
          }}
        >
          <CapeImage
            imageUrl={imageUrl}
            part="front"
            width={displayWidth}
            className="rounded-sm block"
          />

          {/* Equipping overlay */}
          {isCurrentlyEquipping && (
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center rounded-lg">
              <Icon
                icon="solar:refresh-bold"
                className="w-8 h-8 animate-spin mb-1"
                style={{ color: accentColor.value }}
              />
              <span className="font-minecraft text-xs text-white lowercase">
                Equipping
              </span>
            </div>
          )}

        </div>

        {/* Cape Info */}
        <div className="flex-grow min-w-0 w-full text-center">
          {/* Creator Name */}
          <h3
            className="font-minecraft-ten text-white text-base whitespace-nowrap overflow-hidden text-ellipsis max-w-full normal-case mb-1"
            title={creatorName || cape.firstSeen}
          >
            {creatorLoading ? "Loading..." : creatorName || "Unknown"}
          </h3>

          {/* Usage Stats */}
          <div className="flex items-center justify-center gap-2 text-xs font-minecraft-ten">
            <div className="text-white/60 flex items-center gap-1">
              <Icon
                icon="solar:download-minimalistic-outline"
                className="w-3 h-3 text-white/50"
              />
              <span>{cape.uses.toLocaleString()} uses</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


export interface CapeListProps {
  capes: CosmeticCape[];
  onEquipCape: (capeHash: string) => void;
  isLoading?: boolean;
  isEquippingCapeId?: string | null;
  searchQuery?: string;
  canDelete?: boolean;
  onDeleteCape?: (cape: CosmeticCape) => void;
  loadMoreItems?: () => void;
  hasMoreItems?: boolean;
  isFetchingMore?: boolean;
  onTriggerUpload?: () => void;
  onDownloadTemplate?: () => void;
  groupFavoritesInHeader?: boolean;
}

export function CapeList({
  capes,
  onEquipCape,
  isLoading = false,
  isEquippingCapeId = null,
  searchQuery = "",
  canDelete = false,
  onDeleteCape,
  loadMoreItems,
  hasMoreItems = false,
  isFetchingMore = false,
  onTriggerUpload,
  onDownloadTemplate,
  groupFavoritesInHeader = true,
}: CapeListProps) {
  const accentColor = useThemeStore((state) => state.accentColor);
  const creatorNameCacheRef = useRef<Map<string, string>>(new Map());
  const { showModal, hideModal } = useGlobalModal();
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    cape: CosmeticCape | null;
  } | null>(null);
  const authStore = useMinecraftAuthStore();
  const activeAccount = authStore.activeAccount;

  const [hasInitiallyLoaded, setHasInitiallyLoaded] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const favoriteCapeIds = useCapeFavoritesStore((s) => s.favoriteCapeIds);
  const [favoriteCapesFetched, setFavoriteCapesFetched] = useState<Map<string, CosmeticCape>>(new Map());

  const favoriteCapes = useMemo(() => {
    // Create maps for faster lookups - independent of main capes array
    const capesMap = new Map(capes.map(cape => [cape._id, cape]));
    const fetchedMap = favoriteCapesFetched;

    // Build result by checking both sources
    const result: CosmeticCape[] = [];
    for (const id of favoriteCapeIds) {
      // First try main capes list
      let cape = capesMap.get(id);

      // Then try fetched favorites
      if (!cape) {
        cape = fetchedMap.get(id);
      }

      if (cape) {
        result.push(cape);
      }
    }

    return result;
  }, [favoriteCapeIds, favoriteCapesFetched, capes]); // Keep capes dependency but optimize the calculation

  const missingFavoriteIds = useMemo(() => {
    if (!groupFavoritesInHeader) return [] as string[];
    const presentIds = new Set(favoriteCapes.map((c) => c._id));
    const fetchedIds = new Set(favoriteCapesFetched.keys());
    return favoriteCapeIds.filter((id) => !presentIds.has(id) && !fetchedIds.has(id));
  }, [favoriteCapeIds, favoriteCapes, favoriteCapesFetched, groupFavoritesInHeader]);

  useEffect(() => {
    if (!groupFavoritesInHeader) return;
    const idsToFetch = missingFavoriteIds.filter((id) => !favoriteCapesFetched.has(id));
    if (idsToFetch.length === 0) return;
    const chunk = idsToFetch.slice(0, 100);
    getCapesByHashes(chunk)
      .then((capes) => {
        setFavoriteCapesFetched((prev) => {
          const next = new Map(prev);
          capes.forEach((c) => next.set(c._id, c));
          return next;
        });
      })
      .catch((e) => {
        console.warn("[CapeList] Failed to fetch favorite capes by hashes:", e);
      });
  }, [missingFavoriteIds, favoriteCapesFetched, groupFavoritesInHeader]);

  // Separate state for stable favorites display - completely independent of capes loading
  const [stableFavoriteCapes, setStableFavoriteCapes] = useState<CosmeticCape[]>([]);

  // Update stable favorites only when favorite data actually changes, not when main capes change
  useEffect(() => {
    if (!groupFavoritesInHeader) {
      setStableFavoriteCapes([]);
      return;
    }

    if (favoriteCapeIds.length === 0) {
      setStableFavoriteCapes([]);
      return;
    }

    // Use favoriteCapes directly since it already contains the correct data from both sources
    // Only create placeholders for missing capes that are still being fetched
    const result: CosmeticCape[] = [];
    for (const id of favoriteCapeIds) {
      let cape = favoriteCapes.find(c => c._id === id);

      // If not in favoriteCapes but in fetched map, use that
      if (!cape) {
        cape = favoriteCapesFetched.get(id);
      }

      // If still not found, create placeholder (will be replaced when fetched)
      if (!cape) {
        cape = {
          _id: id,
          uses: 0,
          firstSeen: "",
          elytra: false,
        } as CosmeticCape;
      }

      result.push(cape);
    }

    setStableFavoriteCapes(result);
  }, [favoriteCapeIds, favoriteCapes, favoriteCapesFetched, groupFavoritesInHeader]); // Only essential dependencies

  // Track if we've ever loaded capes successfully (for EmptyState logic)
  useEffect(() => {
    if (!isLoading && capes.length > 0 && !hasInitiallyLoaded) {
      setHasInitiallyLoaded(true);
    }
  }, [isLoading, capes.length, hasInitiallyLoaded]);

  // No loading spinner - capes appear immediately when available

  const itemsToRender = useMemo(() => {
    if (!groupFavoritesInHeader) return capes;
    // Since favorites are now rendered separately above Virtuoso, always filter them out
    if (stableFavoriteCapes.length === 0) return capes;
    const favoriteIdsSet = new Set(stableFavoriteCapes.map(cape => cape._id));
    return capes.filter((item) => !favoriteIdsSet.has(item._id));
  }, [capes, stableFavoriteCapes, groupFavoritesInHeader]);

// Removed virtuosoComponents - using native scrolling grid instead 

  function calculateMenuPosition(x: number, y: number, menuWidth: number, menuHeight: number) {
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    const padding = 16;
    let adjustedX = x;
    let adjustedY = y;
    if (x + menuWidth + padding > viewport.width) {
      adjustedX = x - menuWidth;
      if (adjustedX < padding) adjustedX = viewport.width - menuWidth - padding;
    }
    if (y + menuHeight + padding > viewport.height) {
      adjustedY = y - menuHeight;
      if (adjustedY < padding) adjustedY = viewport.height - menuHeight - padding;
    }
    adjustedX = Math.max(padding, Math.min(adjustedX, viewport.width - menuWidth - padding));
    adjustedY = Math.max(padding, Math.min(adjustedY, viewport.height - menuHeight - padding));
    return { x: adjustedX, y: adjustedY };
  }

  useEffect(() => {
    if (contextMenu) {
      const menuWidth = 200;
      const menuHeight = 56;
      setMenuPosition(calculateMenuPosition(contextMenu.x, contextMenu.y, menuWidth, menuHeight));
      window.addEventListener("click", () => setContextMenu(null));
      return () => window.removeEventListener("click", () => setContextMenu(null));
    }
  }, [contextMenu]);

  useEffect(() => {
    if (contextMenu && menuRef.current) {
      gsap.fromTo(
        menuRef.current,
        { opacity: 0, scale: 0.95, y: -10 },
        { opacity: 1, scale: 1, y: 0, duration: 0.18, ease: "power2.out" }
      );
    }
  }, [contextMenu]);

  const handleCapeContextMenu = useCallback(
    (cape: CosmeticCape, e: React.MouseEvent) => {
      e.preventDefault();
      setContextMenu({ x: e.clientX, y: e.clientY, cape });
    },
    []
  );

  const handleDeleteClickInternal = useCallback(
    (cape: CosmeticCape, e: React.MouseEvent) => {
      e.stopPropagation();
      if (onDeleteCape) {
        onDeleteCape(cape);
      }
    },
    [onDeleteCape],
  );

  const handlePreview3D = useCallback(() => {
    // Preview is now handled by direct click, this function is kept for potential future use
    setContextMenu(null);
  }, []);

  // No loading spinner - capes appear immediately when available


  const noActualCapesToDisplay = itemsToRender.length === 0;
  if (!isLoading && noActualCapesToDisplay && hasInitiallyLoaded) {
    return (
      <div className="flex-grow flex items-center justify-center p-5">
        <EmptyState
          icon="solar:hanger-wave-line-duotone"
          message={
            searchQuery
              ? `No capes found for "${searchQuery}"`
              : "No capes available"
          }
        />
      </div>
    );
  }

  // Load more trigger component for intersection observer
  const LoadMoreTrigger = () => {
    const { ref, inView } = useInView({
      threshold: 0,
      rootMargin: '300px', // Load more when 300px from bottom
    });

    useEffect(() => {
      if (inView && hasMoreItems && !isFetchingMore && loadMoreItems) {
        console.log("[CapeList] Load more trigger activated, loading more items...");
        loadMoreItems();
      }
    }, [inView, hasMoreItems, isFetchingMore, loadMoreItems]);

    if (!hasMoreItems) return null;

    return (
      <div ref={ref} className="flex justify-center items-center p-8">
        {isFetchingMore ? (
          <Icon
            icon="eos-icons:loading"
            className="w-8 h-8 animate-spin"
            style={{ color: accentColor.value }}
          />
        ) : (
          <div className="w-full h-4" /> // Invisible trigger area
        )}
      </div>
    );
  };

  return (
    <div
      className={cn(
        "flex-grow custom-scrollbar h-full",
        onTriggerUpload ? "" : "p-4",
      )}
    >
      {/* Render favorites separately above native grid to prevent flickering */}
      {groupFavoritesInHeader && stableFavoriteCapes.length > 0 && (
        <div className="mb-2">
          <div className="flex items-center justify-between mb-2 px-4">
            <span className="font-minecraft text-white/80 lowercase text-xl">favorites</span>
            <span className="text-white/40 text-xs font-minecraft">{stableFavoriteCapes.length}</span>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))",
              gap: "16px",
              padding: "16px",
              paddingTop: "8px",
              paddingBottom: 0,
            }}
          >
            {stableFavoriteCapes.map((cape) => {
              const imageUrl = `https://cdn.norisk.gg/capes/prod/${cape._id}.png`;
              return (
                <CapeItemDisplay
                  key={`fav-${cape._id}`}
                  cape={cape}
                  imageUrl={imageUrl}
                  isCurrentlyEquipping={isEquippingCapeId === cape._id}
                  onEquipCape={onEquipCape}
                  canDelete={canDelete}
                  onDeleteCapeClick={handleDeleteClickInternal}
                  creatorNameCache={creatorNameCacheRef.current}
                  onContextMenu={(e) => handleCapeContextMenu(cape, e)}
                  activeAccount={activeAccount}
                  showModal={(id, component) => showModal(id, component)}
                  hideModal={(id) => hideModal(id)}
                />
              );
            })}
          </div>
          {/* Separator line between favorites and regular capes */}
          <div className="h-px w-full bg-white/10 my-4" />
        </div>
      )}

      {/* Native scrolling grid - similar to ScreenshotsTab */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))",
            gap: "16px",
            padding: "16px",
          }}
        >
          {itemsToRender.map((cape) => {
            const imageUrl = `https://cdn.norisk.gg/capes/prod/${cape._id}.png`;
            return (
              <CapeItemDisplay
                key={cape._id}
                cape={cape}
                imageUrl={imageUrl}
                isCurrentlyEquipping={isEquippingCapeId === cape._id}
                onEquipCape={onEquipCape}
                canDelete={canDelete}
                onDeleteCapeClick={handleDeleteClickInternal}
                creatorNameCache={creatorNameCacheRef.current}
                onContextMenu={(e) => handleCapeContextMenu(cape, e)}
                activeAccount={activeAccount}
                showModal={(id, component) => showModal(id, component)}
                hideModal={(id) => hideModal(id)}
              />
            );
          })}

          {/* Load more trigger */}
          <LoadMoreTrigger />
        </div>
      </div>
      {contextMenu && contextMenu.cape && (
        <div
          ref={menuRef}
          className="fixed z-[9999] rounded-md shadow-xl border-2 border-b-4 overflow-hidden"
          style={{
            top: menuPosition.y,
            left: menuPosition.x,
            backgroundColor: accentColor.value + "20",
            borderColor: accentColor.value + "90",
            borderBottomColor: accentColor.value,
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            boxShadow: "0 8px 16px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.05)",
          }}
          onClick={e => e.stopPropagation()}
        >
          <span
            className="absolute inset-x-0 top-0 h-[2px] rounded-t-sm"
            style={{ backgroundColor: `${accentColor.value}80` }}
          />
          <ul className="py-1">
            <li
              className="px-4 py-2.5 flex items-center gap-3 hover:bg-white/10 cursor-pointer transition-colors duration-150"
              onClick={handlePreview3D}
            >
              <Icon icon="ph:eye-bold" className="w-5 h-5 text-white" />
              <span className="font-minecraft-ten text-base text-white/80">
                Preview
              </span>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}

function Cape3DPreviewWithToggle({
  skinUrl,
  capeId,
  onEquipCape
}: {
  skinUrl?: string;
  capeId: string;
  onEquipCape: () => void;
}) {
  const [showElytra, setShowElytra] = useState(false);

  return (
    <div className="p-4">
      <div style={{ width: 300, height: 380, margin: "0 auto", position: "relative" }}>
        <IconButton
          onClick={() => setShowElytra((v) => !v)}
          variant="ghost"
          size="sm"
          className="absolute top-2 right-2 z-10"
          icon={
            <Icon
              icon={showElytra ? "ph:airplane-tilt-fill" : "ph:airplane-tilt-duotone"}
              className="w-5 h-5"
            />
          }
          title={showElytra ? "Show as Cape" : "Show as Elytra"}
          aria-label={showElytra ? "Show as Cape" : "Show as Elytra"}
        />
        <SkinView3DWrapper
          skinUrl={skinUrl}
          capeUrl={`https://cdn.norisk.gg/capes/prod/${capeId}.png`}
          enableAutoRotate={true}
          autoRotateSpeed={0.5}
          startFromBack={true}
          zoom={0.9}
          displayAsElytra={showElytra}
          width={300}
          height={380}
        />
      </div>

      <div className="flex justify-center mt-4">
        <Button
          onClick={onEquipCape}
          variant="flat"
          size="lg"
          className="px-8"
        >
          SELECT CAPE
        </Button>
      </div>
    </div>
  );
}
