"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { CosmeticCape } from "../../types/noriskCapes";
import { EmptyState } from "../ui/EmptyState";
import { Icon } from "@iconify/react";
import { CapeImage } from "./CapeImage";
import { getPlayerProfileByUuidOrName } from "../../services/cape-service";
import { VirtuosoGrid } from "react-virtuoso";
import { useThemeStore } from "../../store/useThemeStore";
import { cn } from "../../lib/utils";
import { Button } from "../ui/buttons/Button";
import { Card } from "../ui/Card";

// Define ListComponent outside of CapeList to ensure a stable reference
const ListComponent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ style, children, ...props }, ref) => {
  return (
    <div
      ref={ref}
      {...props}
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))",
        gap: "16px",
        padding: "16px",
        ...style, // Style from Virtuoso (e.g., height, width, transform)
      }}
    >
      {children}
    </div>
  );
});
ListComponent.displayName = "VirtuosoGridList";

interface CapeItemDisplayProps {
  cape: CosmeticCape;
  imageUrl: string;
  isCurrentlyEquipping: boolean;
  onEquipCape: (capeId: string) => void;
  canDelete?: boolean;
  onDeleteCapeClick?: (cape: CosmeticCape, e: React.MouseEvent) => void;
  creatorNameCache: Map<string, string>;
}

function CapeItemDisplay({
  cape,
  imageUrl,
  isCurrentlyEquipping,
  onEquipCape,
  canDelete,
  onDeleteCapeClick,
  creatorNameCache,
}: CapeItemDisplayProps) {
  const [creatorName, setCreatorName] = useState<string | null>(null);
  const [creatorLoading, setCreatorLoading] = useState<boolean>(false);
  const accentColor = useThemeStore((state) => state.accentColor);

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

  const capeImageWidth = 140;
  const capeImageHeight = Math.round(capeImageWidth * (16 / 10));

  return (
    <Card
      className="flex flex-col items-center group cursor-pointer h-full justify-between transition-all duration-300 ease-out hover:scale-105 hover:z-10"
      onClick={() => !isCurrentlyEquipping && onEquipCape(cape._id)}
      variant="flat"
    >
      {isCurrentlyEquipping && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center rounded-md z-30">
          <Icon
            icon="solar:refresh-bold"
            className="w-10 h-10 animate-spin mb-2"
            style={{ color: accentColor.value }}
          />
          <span className="font-minecraft text-base text-white lowercase">
            Equipping
          </span>
        </div>
      )}

      <p
        className="font-minecraft-ten text-white lowercase truncate text-sm w-full text-center h-6 flex items-center justify-center mb-1 transition-transform duration-300 ease-out group-hover:scale-110"
        style={{ minHeight: "24px" }}
        title={creatorName || cape.firstSeen}
      >
        {creatorLoading ? "Loading..." : creatorName || "-"}
      </p>

      <div
        className="relative transition-transform duration-300 ease-out group-hover:scale-105"
        style={{ width: `${capeImageWidth}px`, height: `${capeImageHeight}px` }}
      >
        <CapeImage
          imageUrl={imageUrl}
          part="front"
          width={capeImageWidth}
          className="rounded-sm block"
        />
      </div>

      <p
        className="font-minecraft-ten text-white/70 text-xs w-full text-center mt-1 h-5 flex items-center justify-center transition-transform duration-300 ease-out group-hover:scale-110"
        title={`Used ${cape.uses.toLocaleString()} times`}
      >
        <Icon
          icon="solar:download-minimalistic-outline"
          className="w-3 h-3 mr-1 text-white/50"
        />
        {cape.uses.toLocaleString()}
      </p>

      {canDelete && onDeleteCapeClick && (
        <button
          onClick={(e) => onDeleteCapeClick(cape, e)}
          className="absolute top-1.5 right-1.5 p-0.5 bg-black/60 hover:bg-red-700/80 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-20 m-0"
          title="Delete Cape"
          disabled={isCurrentlyEquipping}
        >
          <Icon
            icon="solar:close-circle-bold"
            className="w-4 h-4 text-white/80 hover:text-white"
          />
        </button>
      )}
    </Card>
  );
}

interface AddCapeCardProps {
  onClick: () => void;
  onDownloadTemplate?: () => void;
}

function AddCapeCard({ onClick, onDownloadTemplate }: AddCapeCardProps) {
  const [isVisible, setIsVisible] = useState(false);
  const accentColor = useThemeStore((state) => state.accentColor);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 50); // Short delay to trigger transition
    return () => clearTimeout(timer);
  }, []);

  const handleCardClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest(".download-template-button")) {
      return;
    }
    onClick();
  };

  return (
    <Card
      className="flex flex-col items-center justify-between group cursor-pointer h-full border-dashed relative min-h-[300px] transition-all duration-300 ease-out hover:scale-105 hover:z-10"
      onClick={handleCardClick}
      variant="flat"
    >
      <div
        className={cn(
          "flex flex-col items-center justify-center flex-grow transition-opacity duration-300 ease-in-out p-3",
          isVisible ? "opacity-100" : "opacity-0",
        )}
      >
        <Icon
          icon="solar:add-square-bold-duotone"
          className="w-16 h-16 opacity-70 group-hover:opacity-100 transition-opacity"
          style={{ color: accentColor.value }}
        />
        <p className="font-minecraft lowercase text-2xl text-white/70 mt-2 transition-transform duration-300 ease-out group-hover:scale-110">
          Add Cape
        </p>
      </div>
      {onDownloadTemplate && (
        <Button
          onClick={(e) => {
            e.stopPropagation(); // Prevent card click
            onDownloadTemplate();
          }}
          className="download-template-button w-full mt-2 cursor-pointer rounded-md transition-colors duration-150 group/template-btn"
          variant="ghost"
          size="md"
        >
          <div className="flex items-center justify-center gap-2">
            <Icon
              icon="solar:download-minimalistic-bold"
              className="w-4 h-4 transition-colors duration-150"
              style={{ color: accentColor.value }}
            />
            <span className="font-minecraft text-xl transition-colors duration-150 lowercase">
              TEMPLATE
            </span>
          </div>
        </Button>
      )}
    </Card>
  );
}

export const ADD_CAPE_PLACEHOLDER_ID = "__ADD_CAPE_PLACEHOLDER__";

export interface CapeListProps {
  capes: (CosmeticCape | { _id: typeof ADD_CAPE_PLACEHOLDER_ID })[];
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
}: CapeListProps) {
  const accentColor = useThemeStore((state) => state.accentColor.value);
  const creatorNameCacheRef = useRef<Map<string, string>>(new Map());

  const [isDebouncedLoading, setIsDebouncedLoading] = useState(false);
  const debouncedLoadingTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Determine if actual capes (excluding placeholder) are present
    const actualCapesCount = capes.filter(
      (c) => c._id !== ADD_CAPE_PLACEHOLDER_ID,
    ).length;
    const showLoadingSkeleton =
      isLoading && actualCapesCount === 0 && !searchQuery;

    if (showLoadingSkeleton) {
      if (debouncedLoadingTimerRef.current) {
        clearTimeout(debouncedLoadingTimerRef.current);
      }
      debouncedLoadingTimerRef.current = setTimeout(() => {
        setIsDebouncedLoading(true);
      }, 300);
    } else {
      if (debouncedLoadingTimerRef.current) {
        clearTimeout(debouncedLoadingTimerRef.current);
      }
      setIsDebouncedLoading(false);
    }

    return () => {
      if (debouncedLoadingTimerRef.current) {
        clearTimeout(debouncedLoadingTimerRef.current);
      }
    };
  }, [isLoading, capes, searchQuery]);

  const handleDeleteClickInternal = useCallback(
    (cape: CosmeticCape, e: React.MouseEvent) => {
      e.stopPropagation();
      if (onDeleteCape) {
        onDeleteCape(cape);
      }
    },
    [onDeleteCape],
  );

  const itemsToRender = useMemo(() => {
    // This can be simplified as CapeBrowser now always includes the placeholder if activeAccount exists.
    // However, keeping it consistent with the passed `capes` prop is fine.
    return capes;
  }, [capes]);

  const virtuosoComponents = useMemo(
    () => ({
      Footer: () => {
        if (!isFetchingMore) return null;
        return (
          <div className="flex justify-center items-center p-4">
            <Icon
              icon="eos-icons:loading"
              className="w-8 h-8"
              style={{ color: accentColor }}
            />
          </div>
        );
      },
      List: ListComponent, // Use the stable ListComponent reference
    }),
    [isFetchingMore, accentColor],
  ); // Dependencies for the Footer part

  if (isDebouncedLoading) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center h-[calc(100vh-200px)] text-white/70 transition-opacity duration-500",
          isDebouncedLoading ? "opacity-100" : "opacity-0",
        )}
      >
        <Icon
          icon="solar:hourglass-bold-duotone"
          className="w-16 h-16 mb-4 animate-pulse"
          style={{ color: accentColor }}
        />
        <p className="font-minecraft text-2xl lowercase">Loading Capes...</p>
      </div>
    );
  }

  // Adjusted empty state condition to also consider if ADD_CAPE_PLACEHOLDER_ID is the only item
  const noActualCapesToDisplay =
    itemsToRender.filter((item) => item._id !== ADD_CAPE_PLACEHOLDER_ID)
      .length === 0;
  const addCapeCardIsPresent = itemsToRender.some(
    (item) => item._id === ADD_CAPE_PLACEHOLDER_ID,
  );

  if (
    !isLoading &&
    noActualCapesToDisplay &&
    !(addCapeCardIsPresent && onTriggerUpload)
  ) {
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

  const handleEndReached = () => {
    if (hasMoreItems && !isFetchingMore && loadMoreItems) {
      console.log("[CapeList] Reached end, loading more items...");
      loadMoreItems();
    } else if (!hasMoreItems) {
      console.log("[CapeList] Reached end, no more items to load.");
    }
  };

  return (
    <div
      className={cn(
        "flex-grow overflow-auto custom-scrollbar h-full",
        onTriggerUpload ? "" : "p-4",
      )}
    >
      <VirtuosoGrid
        style={{ height: "100%" }}
        data={itemsToRender}
        endReached={handleEndReached}
        overscan={200}
        components={virtuosoComponents} // Pass the memoized components object
        itemContent={(index, item) => {
          if (item._id === ADD_CAPE_PLACEHOLDER_ID) {
            if (!onTriggerUpload) return null;
            return (
              <AddCapeCard
                onClick={onTriggerUpload}
                onDownloadTemplate={onDownloadTemplate}
              />
            );
          }
          const cape = item as CosmeticCape;
          const imageUrl = `https://cdn.norisk.gg/capes-staging/prod/${cape._id}.png`;
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
            />
          );
        }}
        className="custom-scrollbar"
      />
    </div>
  );
}
