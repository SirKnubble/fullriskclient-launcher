import React from "react";

interface ScrollSentinelProps {
  sentinelRef: React.RefObject<HTMLDivElement>;
  isLoading?: boolean;
  hasMore?: boolean;
  className?: string;
}

export const ScrollSentinel: React.FC<ScrollSentinelProps> = ({
  sentinelRef,
  isLoading = false,
  hasMore = true,
  className = "",
}) => {
  if (!hasMore) {
    return null;
  }

  return (
    <div
      ref={sentinelRef}
      className={`h-4 flex justify-center items-center ${className}`}
    >
      {isLoading && (
        <div className="text-white/40 font-minecraft-ten text-xs">
          Loading more...
        </div>
      )}
    </div>
  );
};
