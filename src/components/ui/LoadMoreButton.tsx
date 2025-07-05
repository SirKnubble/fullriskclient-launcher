import React from "react";
import { Icon } from "@iconify/react";
import { useThemeStore } from "../../store/useThemeStore";
import { Button } from "../ui/buttons/Button";

interface LoadMoreButtonProps {
  onClick: () => void;
  isLoading?: boolean;
  hasMore?: boolean;
  loadedCount?: number;
  totalCount?: number;
  className?: string;
}

export const LoadMoreButton = React.memo(
  ({
    onClick,
    isLoading = false,
    hasMore = true,
    loadedCount = 0,
    totalCount = 0,
    className = "",
  }: LoadMoreButtonProps) => {
    const accentColor = useThemeStore((state) => state.accentColor);
    const borderRadius = useThemeStore((state) => state.borderRadius);

    if (!hasMore) {
      return null;
    }

    return (
      <div className={`flex justify-center py-4 ${className}`}>
        <Button
          onClick={onClick}
          disabled={isLoading}
          variant="ghost"
          size="sm"
          className="px-6 py-2 text-sm font-minecraft-ten uppercase tracking-wider transition-all duration-200 hover:scale-105"
          style={{
            borderColor: `${accentColor.value}40`,
            borderRadius: `${borderRadius}px`,
            backgroundColor: `${accentColor.value}10`,
            color: accentColor.value,
          }}
        >
          {isLoading ? (
            <>
              <Icon
                icon="solar:refresh-bold"
                className="w-4 h-4 mr-2 animate-spin"
              />
              Loading...
            </>
          ) : (
            <>
              <Icon
                icon="solar:double-alt-arrow-down-bold"
                className="w-4 h-4 mr-2"
              />
              Load More ({totalCount - loadedCount} remaining)
            </>
          )}
        </Button>
      </div>
    );
  }
);
