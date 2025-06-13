"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Icon } from "@iconify/react";
import type {
  Profile,
  ScreenshotInfo as ActualScreenshotInfo,
} from "../../../types/profile"; // Renamed ScreenshotInfo to ActualScreenshotInfo
import { useThemeStore } from "../../../store/useThemeStore";
import { gsap } from "gsap";
import { cn } from "../../../lib/utils"; // Assuming you have a cn utility
import { Select, type SelectOption } from "../../ui/Select"; // Import Select and SelectOption
import { EmptyState } from "../../ui/EmptyState"; // Import EmptyState
import { invoke } from "@tauri-apps/api/core"; // Import invoke
import { ScreenshotGridItem } from "./ScreenshotGridItem"; // Import ScreenshotGridItem
import { VirtuosoGrid } from "react-virtuoso"; // Added import
import { ThemedSurface } from "../../ui/ThemedSurface"; // Added import
import { getImagePreview as getImgPreviewServiceCall } from "../../../services/tauri-service"; // Import service
import type { ImagePreviewPayload } from "../../../types/fileSystem"; // Import types

interface ScreenshotItem {
  id: string;
  color: string;
  // Future: src: string, alt: string, date: Date etc.
}

interface ScreenshotsTabProps {
  profile: Profile;
  isActive?: boolean;
  onOpenScreenshotModal: (screenshot: ActualScreenshotInfo) => void; // Add prop for opening modal
}

// Placeholder data for screenshots
// const placeholderScreenshotsData: ScreenshotItem[] = Array.from({ length: 12 }, (_, i) => ({
// id: `screenshot-${i + 1}`,
// You could add more properties like src, alt, date, etc. later
// For now, we\'ll just use a placeholder color based on index
// color: `hsl(${i * 45}, 65%, 60%)`, // Adjusted color spread
// }));

const sortOptions: SelectOption[] = [
  {
    value: "newest",
    label: "newest first",
    icon: <Icon icon="solar:sort-amount-down-bold-duotone" />,
  },
  {
    value: "oldest",
    label: "oldest first",
    icon: <Icon icon="solar:sort-amount-up-bold-duotone" />,
  },
];

const ITEMS_PER_PAGE = 16; // 4 columns * 4 rows, changed from 8

// Define stable components for VirtuosoGrid outside the main component
const VirtuosoGridList = React.forwardRef<
  HTMLDivElement,
  { style?: React.CSSProperties; children?: React.ReactNode }
>(({ style, children, ...props }, ref) => (
  <div
    ref={ref}
    {...props}
    style={{ ...style }}
    className="grid grid-cols-4 gap-4 p-3"
  >
    {children}
  </div>
));
VirtuosoGridList.displayName = "VirtuosoGridList";

const VirtuosoGridItemWrapper = ({
  children,
  ...props
}: {
  children?: React.ReactNode;
}) => (
  <div {...props} style={{ display: "flex", alignItems: "stretch" }}>
    {children}
  </div>
);

export function ScreenshotsTab({
  profile,
  isActive = true, // Assuming it's active when rendered by ProfileDetailView logic
  onOpenScreenshotModal, // Destructure the new prop
}: ScreenshotsTabProps) {
  const accentColor = useThemeStore((state) => state.accentColor);
  const isBackgroundAnimationEnabled = useThemeStore(
    (state) => state.isBackgroundAnimationEnabled,
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true); // Simulate loading
  const [error, setError] = useState<string | null>(null); // Simulate error

  const [sortOrder, setSortOrder] = useState<string>("newest");

  // Simulate fetching and initial data state
  const [rawScreenshots, setRawScreenshots] = useState<ActualScreenshotInfo[]>(
    [],
  );

  useEffect(() => {
    const fetchScreenshots = async () => {
      if (!profile || !profile.id) {
        setRawScreenshots([]);
        setIsLoading(false);
        setError("Profile information is missing.");
        return;
      }
      setIsLoading(true);
      setError(null);
      try {
        const result = await invoke<ActualScreenshotInfo[]>(
          "list_profile_screenshots",
          { profileId: profile.id },
        );
        setRawScreenshots(result);
      } catch (err) {
        console.error("Failed to fetch screenshots:", err);
        setError(err instanceof Error ? err.message : String(err));
        setRawScreenshots([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchScreenshots();
  }, [profile.id, profile]); // Added profile to dependency array

  const sortedScreenshots = useMemo(() => {
    let sorted = [...rawScreenshots];
    if (sortOrder === "newest") {
      sorted.sort((a, b) => {
        if (!a.modified && !b.modified) return 0;
        if (!a.modified) return 1; // b comes first if a has no date
        if (!b.modified) return -1; // a comes first if b has no date
        return new Date(b.modified).getTime() - new Date(a.modified).getTime();
      });
    } else if (sortOrder === "oldest") {
      sorted.sort((a, b) => {
        if (!a.modified && !b.modified) return 0;
        if (!a.modified) return -1; // a comes first if a has no date
        if (!b.modified) return 1; // b comes first if b has no date
        return new Date(a.modified).getTime() - new Date(b.modified).getTime();
      });
    }
    return sorted;
  }, [rawScreenshots, sortOrder]);

  useEffect(() => {
    if (containerRef.current && isActive) {
      gsap.set(containerRef.current, { opacity: 1, y: 0 });
    }
  }, [isActive, isBackgroundAnimationEnabled, isLoading]);

  // --- Start Caching Logic ---
  const [previewCache, setPreviewCache] = useState<Map<string, string>>(
    new Map(),
  );
  const [loadingPreviews, setLoadingPreviews] = useState<Set<string>>(
    new Set(),
  );
  const [errorPreviews, setErrorPreviews] = useState<Set<string>>(new Set());
  // --- End Caching Logic ---

  // --- Memoized itemContent for VirtuosoGrid ---
  const memoizedItemContent = useCallback(
    (index: number) => {
      const screenshot = sortedScreenshots[index];
      const path = screenshot.path;

      if (
        path &&
        !previewCache.has(path) &&
        !loadingPreviews.has(path) &&
        !errorPreviews.has(path)
      ) {
        setLoadingPreviews((prev) => new Set(prev).add(path));
        const payload: ImagePreviewPayload = {
          path: path,
          width: 256,
          height: 144, // User updated value
          quality: 75,
        };
        getImgPreviewServiceCall(payload)
          .then((response) => {
            const imageType = screenshot.filename.toLowerCase().endsWith(".png")
              ? "png"
              : "jpeg";
            const src = `data:image/${imageType};base64,${response.base64_image}`;
            setPreviewCache((prev) => {
              if (prev.get(path) === src) return prev;
              const next = new Map(prev);
              next.set(path, src);
              return next;
            });
          })
          .catch((err) => {
            console.error(
              `Failed to load preview for ${path} in ScreenshotsTab:`,
              err,
            );
            setErrorPreviews((prev) => new Set(prev).add(path));
          })
          .finally(() => {
            setLoadingPreviews((prev) => {
              const next = new Set(prev);
              next.delete(path);
              return next;
            });
          });
      }

      return (
        <ThemedSurface
          key={path}
          className={cn(
            "flex p-0 transition-transform duration-300 ease-out hover:scale-105 active:scale-95",
          )}
        >
          <ScreenshotGridItem
            screenshot={screenshot}
            isBackgroundAnimationEnabled={isBackgroundAnimationEnabled}
            itemIndex={index}
            onItemClick={onOpenScreenshotModal}
            previewSrc={previewCache.get(path) || null}
            isLoading={loadingPreviews.has(path)}
            hasError={errorPreviews.has(path)}
          />
        </ThemedSurface>
      );
    },
    [
      sortedScreenshots,
      previewCache,
      loadingPreviews,
      errorPreviews,
      isBackgroundAnimationEnabled,
      onOpenScreenshotModal,
    ],
  );
  // --- End Memoized itemContent ---

  return (
    <>
      <div
        ref={containerRef}
        className="h-full flex flex-col select-none p-4 gap-4"
      >
        {/* Header with styling similar to WorldsTab action bar */}
        <div
          className="flex items-center justify-end gap-4 mb-4 p-3 rounded-lg border backdrop-blur-sm"
          style={{
            backgroundColor: `${accentColor.value}10`,
            borderColor: `${accentColor.value}30`,
          }}
        >
          <div className="w-full max-w-xs sm:max-w-[200px]">
            <Select
              value={sortOrder}
              onChange={setSortOrder}
              options={sortOptions}
              size="md"
              disabled={
                isLoading ||
                (!isLoading && !error && sortedScreenshots.length === 0)
              } // Disable if loading or no items
            />
          </div>
        </div>

        {/* New main content wrapper with its own background */}
        <div
          className="flex-1 overflow-hidden rounded-lg border flex flex-col"
          style={{
            backgroundColor: `${accentColor.value}10`,
            borderColor: `${accentColor.value}30`,
          }}
        >
          {isLoading && (
            <EmptyState
              icon="solar:gallery-send-bold-duotone"
              message="loading screenshots..."
            />
          )}

          {!isLoading && error && (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
              <Icon
                icon="solar:gallery-remove-bold-duotone"
                className="w-20 h-20 mb-4 text-red-400/80"
              />
              <p className="font-minecraft-ten text-xl text-red-400 mb-2">
                Oops! Something went wrong.
              </p>
              <p className="text-white/60 font-minecraft-five text-base">
                {error}
              </p>
            </div>
          )}

          {!isLoading &&
            !error &&
            sortedScreenshots.length === 0 &&
            rawScreenshots.length > 0 && (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
                <Icon
                  icon="solar:gallery-minimalistic-bold-duotone"
                  className="w-20 h-20 mb-4 text-white/40"
                />
                <p className="font-minecraft-ten text-xl text-white/70 mb-2">
                  No Screenshots Match Filter
                </p>
                <p className="text-white/50 font-minecraft-five text-base">
                  Try adjusting your sort options.
                </p>
              </div>
            )}

          {!isLoading && !error && rawScreenshots.length === 0 && (
            <EmptyState
              icon="solar:camera-minimalistic-bold-duotone"
              message="no screenshots yet"
              description="take some in-game screenshots and they\'ll appear here!"
              // iconClassName="text-white/30" // Icon color is handled by EmptyState or can be passed to Icon if customization is needed beyond accent
            />
          )}

          {!isLoading && !error && sortedScreenshots.length > 0 && (
            <>
              <VirtuosoGrid
                style={{ height: "100%" }} // Ensure VirtuosoGrid takes available space
                totalCount={sortedScreenshots.length}
                components={{
                  List: VirtuosoGridList,
                  Item: VirtuosoGridItemWrapper,
                  Header: () => <div style={{ height: "0.75rem" }} />,
                  Footer: () => <div style={{ height: "1.5rem" }} />,
                }}
                itemContent={memoizedItemContent}
              />
            </>
          )}
        </div>
      </div>
    </>
  );
}

// ... (keyframes can be removed if not used, or ensure they are globally defined if ScreenshotGridItem relies on them via a class)
// For now, assuming ScreenshotGridItem handles its own animation or uses global styles.

// It's generally better to define keyframes in a global CSS file (e.g., globals.css)
// For Tailwind, you can also define custom animations in tailwind.config.js
// If you must include it here and are not in a Next.js pages dir,
// you might need a different approach than <style jsx> or ensure your setup supports it.
// For now, adding a utility class `animate-fadeInUpItem` and assuming it's defined globally:
/*
@keyframes fadeInUpItem {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
.animate-fadeInUpItem {
  animation-name: fadeInUpItem;
  animation-duration: 0.5s;
  animation-fill-mode: forwards;
  animation-timing-function: ease-out;
}
*/
