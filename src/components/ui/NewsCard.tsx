"use client";

import type React from "react";
import { forwardRef } from "react";
import { cn } from "../../lib/utils";
import { useThemeStore } from "../../store/useThemeStore";

interface NewsCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  imageUrl: string;
  postUrl: string;
}

export const NewsCard = forwardRef<HTMLDivElement, NewsCardProps>(
  (
    {
      className,
      title,
      imageUrl,
      postUrl,
      onClick,
      ...props
    },
    ref,
  ) => {
    const uiStylePreset = useThemeStore((state) => state.uiStylePreset);
    const isFullRiskStyle = uiStylePreset === "fullrisk";
    return (
      <div
        ref={ref}
        className={cn(
          isFullRiskStyle
            ? "relative w-full h-full overflow-hidden border-[3px] border-white/10 hover:border-[var(--panel-border-strong)] transition-all duration-200 cursor-pointer"
            : "relative w-full h-full overflow-hidden rounded-lg border-2 border-white/10 hover:border-white/20 transition-all duration-200 cursor-pointer group",
          className,
        )}
        onClick={onClick}
        {...props}
      >
        <img
          src={imageUrl || "/placeholder.svg"}
          alt={title || "News image"}
          className={cn(
            "w-full h-full object-cover transition-transform duration-200",
            !isFullRiskStyle && "group-hover:scale-[1.04]",
          )}
          loading="lazy"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.src = "/placeholder.svg";
          }}
        />
      </div>
    );
  },
);

NewsCard.displayName = "NewsCard";
