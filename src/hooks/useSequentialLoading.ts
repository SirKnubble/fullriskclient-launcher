import { useState, useEffect, useCallback, useRef } from "react";

interface SequentialLoadingOptions {
  itemsPerPage?: number;
  initialLoadCount?: number;
  loadThreshold?: number;
  enabled?: boolean;
  scrollThreshold?: number;
}

interface SequentialLoadingState<T> {
  displayedItems: T[];
  hasMore: boolean;
  isLoading: boolean;
  loadMore: () => void;
  reset: () => void;
  scrollSentinelRef: React.RefObject<HTMLDivElement>;
}

export function useSequentialLoading<T>(
  allItems: T[],
  options: SequentialLoadingOptions = {}
): SequentialLoadingState<T> {
  const {
    itemsPerPage = 10,
    initialLoadCount = 20,
    loadThreshold = 5,
    enabled = true,
    scrollThreshold = 100,
  } = options;

  const [displayedCount, setDisplayedCount] = useState(initialLoadCount);
  const [isLoading, setIsLoading] = useState(false);
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const scrollSentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (allItems.length === 0) {
      setDisplayedCount(0);
    } else if (displayedCount === 0 && allItems.length > 0) {
      setDisplayedCount(Math.min(initialLoadCount, allItems.length));
    }
  }, [allItems.length, initialLoadCount]);

  const isSequentialActive = enabled && allItems.length > loadThreshold;

  const displayedItems = isSequentialActive
    ? allItems.slice(0, displayedCount)
    : allItems;
  const hasMore = isSequentialActive ? displayedCount < allItems.length : false;

  const loadMore = useCallback(() => {
    if (!isSequentialActive || isLoading || !hasMore) return;

    setIsLoading(true);

    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
    }

    loadingTimeoutRef.current = setTimeout(() => {
      const newCount = Math.min(displayedCount + itemsPerPage, allItems.length);
      setDisplayedCount(newCount);
      setIsLoading(false);
    }, 100);
  }, [
    isSequentialActive,
    displayedCount,
    itemsPerPage,
    allItems.length,
    hasMore,
    isLoading,
  ]);

  useEffect(() => {
    if (
      !isSequentialActive ||
      !hasMore ||
      isLoading ||
      !scrollSentinelRef.current
    )
      return;

    const sentinel = scrollSentinelRef.current;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && hasMore && !isLoading) {
          loadMore();
        }
      },
      {
        threshold: 0.1,
        rootMargin: `${scrollThreshold}px 0px`,
      }
    );

    observer.observe(sentinel);

    return () => {
      observer.disconnect();
    };
  }, [isSequentialActive, hasMore, isLoading, loadMore, scrollThreshold]);

  const reset = useCallback(() => {
    setDisplayedCount(Math.min(initialLoadCount, allItems.length));
    setIsLoading(false);
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
    }
  }, [initialLoadCount, allItems.length]);

  useEffect(() => {
    return () => {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
    };
  }, []);

  return {
    displayedItems,
    hasMore,
    isLoading: isSequentialActive ? isLoading : false,
    loadMore,
    reset,
    scrollSentinelRef,
  };
}
