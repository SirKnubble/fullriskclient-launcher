"use client";

import type React from "react";
import { forwardRef, useEffect, useRef } from "react";
import { cn } from "../../lib/utils";
import { gsap } from "gsap";
import { useThemeStore } from "../../store/useThemeStore";
import { SkinViewerSkeleton } from "../launcher/SkinViewerSkeleton";
import { Skeleton } from "./Skeleton";

interface SkeletonCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary";
  height?: number | string;
  width?: number | string;
  animated?: boolean;
  shadowDepth?: "default" | "short" | "none";
  skinVariant?: "classic" | "slim";
  index?: number;
}

export const SkeletonSkinCard = forwardRef<HTMLDivElement, SkeletonCardProps>(
  (
    {
      className,
      variant = "secondary",
      height = 380,
      width = "100%",
      animated = true,
      shadowDepth = "short",
      skinVariant = "classic",
      index = 0,
      ...props
    },
    ref,
  ) => {
    const cardRef = useRef<HTMLDivElement>(null);
    const accentColor = useThemeStore((state) => state.accentColor);
    const isBackgroundAnimationEnabled = useThemeStore(
      (state) => state.isBackgroundAnimationEnabled,
    );

    const mergedRef = (node: HTMLDivElement) => {
      if (ref) {
        if (typeof ref === "function") {
          ref(node);
        } else {
          ref.current = node;
        }
      }
      cardRef.current = node;
    };

    useEffect(() => {
      if (cardRef.current && isBackgroundAnimationEnabled) {
        gsap.fromTo(
          cardRef.current,
          { scale: 0.95, opacity: 0, y: 20 },
          {
            scale: 1,
            opacity: 1,
            y: 0,
            duration: 0.4,
            delay: index * 0.075,
            ease: "power2.out",
          },
        );
      }
    }, [isBackgroundAnimationEnabled, index]);

    const getShadowStyle = () => {
      if (shadowDepth === "none") return "none";

      if (shadowDepth === "short") {
        return `0 4px 0 rgba(0,0,0,0.3), 0 6px 10px rgba(0,0,0,0.35), inset 0 1px 0 ${accentColor.value}20, inset 0 0 0 1px ${accentColor.value}10`;
      }

      return `0 8px 0 rgba(0,0,0,0.3), 0 10px 15px rgba(0,0,0,0.35), inset 0 1px 0 ${accentColor.value}20, inset 0 0 0 1px ${accentColor.value}10`;
    };

    const getBgColor = () => {
      return variant === "secondary"
        ? "rgba(107, 114, 128, 0.2)"
        : `${accentColor.value}20`;
    };

    const getBorderColor = () => {
      return variant === "secondary"
        ? "rgba(107, 114, 128, 0.6)"
        : `${accentColor.value}60`;
    };

    const getBorderBottomColor = () => {
      return variant === "secondary"
        ? "rgba(75, 85, 99, 1)"
        : accentColor.value;
    };

    return (
      <div
        ref={mergedRef}
        className={cn(
          "relative p-4 pt-1 pb-2 flex flex-col text-center",
          "rounded-lg overflow-hidden backdrop-blur-md transition-all duration-200",
          "border-2 border-b-4",
          className,
        )}
        style={{
          height: typeof height === "number" ? `${height}px` : height,
          width: typeof width === "number" ? `${width}px` : width,
          backgroundColor: getBgColor(),
          borderColor: getBorderColor(),
          borderBottomColor: getBorderBottomColor(),
          boxShadow: getShadowStyle(),
        }}
        {...props}
      >
        <span
          className="absolute inset-x-0 top-0 h-[2px] rounded-t-sm"
          style={{
            backgroundColor:
              variant === "secondary"
                ? "rgba(156, 163, 175, 0.8)"
                : `${accentColor.value}80`,
          }}
        />

        <Skeleton
          variant="text"
          height={36}
          width="80%"
          className="mx-auto mb-2"
          animated={animated}
        />

        <div className="h-64 flex relative pt-2 pb-2 flex-grow items-center justify-center">
          <SkinViewerSkeleton
            width={700}
            height={700}
            variant={skinVariant}
            animated={animated}
            shadowDepth="none"
            className="absolute inset-0 -left-60 -top-20"
          />
        </div>

        <div className="flex items-center justify-between mt-auto">
          <Skeleton
            variant="text"
            height={24}
            width="40%"
            animated={animated}
          />
        </div>
      </div>
    );
  },
);

SkeletonSkinCard.displayName = "SkeletonSkinCard";
