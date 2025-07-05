import { useState, useEffect, useCallback, useRef } from "react";

interface ReverseSequentialLoadingOptions {
  itemsPerPage?: number;
  initialLoadCount?: number;
  loadThreshold?: number;
  enabled?: boolean;
  scrollThreshold?: number;
}

interface ReverseSequentialLoadingState<T> {
  displayedItems: T[];
  hasMore: boolean;
  isLoading: boolean;
  loadMore: () => void;
  reset: () => void;
  scrollSentinelRef: React.RefObject<HTMLDivElement>;
}

export function useReverseSequentialLoading<T>(
  allItems: T[],
  options: ReverseSequentialLoadingOptions = {}
): ReverseSequentialLoadingState<T> {
  const {
    itemsPerPage = 10,
    initialLoadCount = 20,
    loadThreshold = 5,
    enabled = true,
    scrollThreshold = 100,
  } = options;

  const [displayedCount, setDisplayedCount] = useState(initialLoadCount);
  const [isLoading, setIsLoading] = useState(false);
  const [justLoaded, setJustLoaded] = useState(false);
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const scrollSentinelRef = useRef<HTMLDivElement>(null);
  const lastScrollHeightRef = useRef<number>(0);
  const scrollContainerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (allItems.length === 0) {
      setDisplayedCount(0);
    } else if (displayedCount === 0 && allItems.length > 0) {
      setDisplayedCount(Math.min(initialLoadCount, allItems.length));
    }
  }, [allItems.length, initialLoadCount]);

  const isSequentialActive = enabled && allItems.length > loadThreshold;
  const displayedItems = isSequentialActive
    ? allItems.slice(-displayedCount)
    : allItems;
  const hasMore = isSequentialActive ? displayedCount < allItems.length : false;

  const loadMore = useCallback(() => {
    if (!isSequentialActive || isLoading || !hasMore) return;

    setIsLoading(true);

    const scrollContainer = scrollSentinelRef.current?.parentElement;
    const scrollHeight = scrollContainer?.scrollHeight || 0;
    const scrollTop = scrollContainer?.scrollTop || 0;
    lastScrollHeightRef.current = scrollHeight;

    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
    }

    loadingTimeoutRef.current = setTimeout(() => {
      const newCount = Math.min(displayedCount + itemsPerPage, allItems.length);
      setDisplayedCount(newCount);
      setIsLoading(false);

      setTimeout(() => {
        if (scrollContainer) {
          const newScrollHeight = scrollContainer.scrollHeight;
          const scrollDiff = newScrollHeight - lastScrollHeightRef.current;
          const newScrollTop = scrollTop + scrollDiff;

          scrollContainer.scrollTop = newScrollTop;

          setJustLoaded(true);
          setTimeout(() => setJustLoaded(false), 1000);
        }
      }, 10);
    }, 300);
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
      justLoaded ||
      !scrollSentinelRef.current
    )
      return;

    const sentinel = scrollSentinelRef.current;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && hasMore && !isLoading && !justLoaded) {
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
  }, [
    isSequentialActive,
    hasMore,
    isLoading,
    justLoaded,
    loadMore,
    scrollThreshold,
    itemsPerPage,
  ]);

  const reset = useCallback(() => {
    setDisplayedCount(Math.min(initialLoadCount, allItems.length));
    setIsLoading(false);
    setJustLoaded(false);
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
