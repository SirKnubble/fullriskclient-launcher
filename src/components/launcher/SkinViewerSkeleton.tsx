"use client";

import type React from "react";
import { forwardRef, useEffect, useRef } from "react";
import { cn } from "../../lib/utils";
import { gsap } from "gsap";
import { useThemeStore } from "../../store/useThemeStore";

interface SkinViewerSkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  width?: number;
  height?: number;
  variant?: "classic" | "slim";
  animated?: boolean;
  shadowDepth?: "default" | "short" | "none";
}

export const SkinViewerSkeleton = forwardRef<
  HTMLDivElement,
  SkinViewerSkeletonProps
>(
  (
    {
      className,
      width = 130,
      height = 260,
      variant = "classic",
      animated = true,
      shadowDepth = "short",
      ...props
    },
    ref,
  ) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const headRef = useRef<HTMLDivElement>(null);
    const bodyRef = useRef<HTMLDivElement>(null);
    const leftArmRef = useRef<HTMLDivElement>(null);
    const rightArmRef = useRef<HTMLDivElement>(null);
    const leftLegRef = useRef<HTMLDivElement>(null);
    const rightLegRef = useRef<HTMLDivElement>(null);
    const accentColor = useThemeStore((state) => state.accentColor);
    const isBackgroundAnimationEnabled = useThemeStore(
      (state) => state.isBackgroundAnimationEnabled,
    );

    // Merge refs
    const mergedRef = (node: HTMLDivElement) => {
      if (ref) {
        if (typeof ref === "function") {
          ref(node);
        } else {
          ref.current = node;
        }
      }
      containerRef.current = node;
    };

    // Animation on mount
    useEffect(() => {
      if (containerRef.current && isBackgroundAnimationEnabled) {
        // Initial animation
        gsap.fromTo(
          containerRef.current,
          { scale: 0.95, opacity: 0 },
          {
            scale: 1,
            opacity: 1,
            duration: 0.4,
            ease: "power2.out",
          },
        );

        // Animate body parts if animated is true
        if (animated) {
          const timeline = gsap.timeline({
            repeat: -1,
            yoyo: true,
            defaults: { duration: 1.5, ease: "power1.inOut" },
          });

          // Subtle floating animation for the whole figure
          timeline.to(containerRef.current, {
            y: "-=5",
            duration: 2,
          });

          // Subtle arm swing
          if (leftArmRef.current && rightArmRef.current) {
            timeline.to(
              [leftArmRef.current, rightArmRef.current],
              {
                rotate: variant === "slim" ? 5 : 3,
                transformOrigin: "top center",
                duration: 2,
              },
              "<",
            );
          }

          // Subtle head movement
          if (headRef.current) {
            timeline.to(
              headRef.current,
              {
                rotate: 3,
                transformOrigin: "bottom center",
                duration: 2.5,
              },
              "<",
            );
          }
        }
      }
    }, [animated, isBackgroundAnimationEnabled, variant]);

    // Get shadow style based on depth
    const getShadowStyle = () => {
      if (shadowDepth === "none") return "none";

      if (shadowDepth === "short") {
        return `0 4px 0 rgba(0,0,0,0.3), 0 6px 10px rgba(0,0,0,0.35), inset 0 1px 0 ${accentColor.value}20, inset 0 0 0 1px ${accentColor.value}10`;
      }

      return `0 8px 0 rgba(0,0,0,0.3), 0 10px 15px rgba(0,0,0,0.35), inset 0 1px 0 ${accentColor.value}20, inset 0 0 0 1px ${accentColor.value}10`;
    };

    // Calculate dimensions based on the container size
    const scale = Math.min(width / 180, height / 280); // Adjusted base size
    const headSize = Math.round(24 * scale); // Larger head
    const bodyWidth = Math.round(20 * scale); // Wider body
    const bodyHeight = Math.round(30 * scale); // Taller body
    const armWidth = Math.round(variant === "slim" ? 8 * scale : 10 * scale); // Wider arms
    const armHeight = Math.round(30 * scale); // Longer arms
    const legWidth = Math.round(10 * scale); // Wider legs
    const legHeight = Math.round(30 * scale); // Longer legs

    // Calculate positions - adjust to center the figure better
    const headTop = Math.round(height * 0.15); // Position head higher
    const bodyTop = headTop + headSize + Math.round(2 * scale);
    const armsTop = bodyTop + Math.round(2 * scale); // Align arms with body
    const legsTop = bodyTop + bodyHeight + Math.round(2 * scale);

    // Center points
    const centerX = width / 2;
    const headLeft = centerX - headSize / 2;
    const bodyLeft = centerX - bodyWidth / 2;
    const leftArmLeft = bodyLeft - armWidth - Math.round(1 * scale); // Closer to body
    const rightArmLeft = bodyLeft + bodyWidth + Math.round(1 * scale); // Closer to body
    const leftLegLeft = centerX - legWidth - Math.round(1 * scale); // Closer together
    const rightLegLeft = centerX + Math.round(1 * scale); // Closer together

    return (
      <div
        ref={mergedRef}
        className={cn("relative mx-auto", className)}
        style={{
          width: `${width}px`,
          height: `${height}px`,
          perspective: "400px",
        }}
        {...props}
      >
        <div
          ref={headRef}
          className={cn(
            "absolute rounded-sm backdrop-blur-sm transition-all duration-200",
            "border-2 border-b-4",
            animated && "animate-skeleton-pulse",
          )}
          style={{
            left: `${headLeft}px`,
            top: `${headTop}px`,
            width: `${headSize}px`,
            height: `${headSize}px`,
            backgroundColor: `${accentColor.value}15`,
            borderColor: `${accentColor.value}30`,
            borderBottomColor: `${accentColor.value}40`,
            boxShadow: getShadowStyle(),
            transformStyle: "preserve-3d",
          }}
        >
          <span
            className="absolute inset-x-0 top-0 h-[2px] rounded-t-sm"
            style={{ backgroundColor: `${accentColor.value}40` }}
          />
          {animated && (
            <div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
              style={{
                animation: "skeleton-shimmer 2s infinite",
                backgroundSize: "200% 100%",
              }}
            />
          )}
        </div>

        <div
          ref={bodyRef}
          className={cn(
            "absolute rounded-sm backdrop-blur-sm transition-all duration-200",
            "border-2 border-b-4",
            animated && "animate-skeleton-pulse",
          )}
          style={{
            left: `${bodyLeft}px`,
            top: `${bodyTop}px`,
            width: `${bodyWidth}px`,
            height: `${bodyHeight}px`,
            backgroundColor: `${accentColor.value}15`,
            borderColor: `${accentColor.value}30`,
            borderBottomColor: `${accentColor.value}40`,
            boxShadow: getShadowStyle(),
            transformStyle: "preserve-3d",
          }}
        >
          <span
            className="absolute inset-x-0 top-0 h-[2px] rounded-t-sm"
            style={{ backgroundColor: `${accentColor.value}40` }}
          />
          {animated && (
            <div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
              style={{
                animation: "skeleton-shimmer 2s infinite",
                backgroundSize: "200% 100%",
              }}
            />
          )}
        </div>

        <div
          ref={leftArmRef}
          className={cn(
            "absolute rounded-sm backdrop-blur-sm transition-all duration-200",
            "border-2 border-b-4",
            animated && "animate-skeleton-pulse",
          )}
          style={{
            left: `${leftArmLeft}px`,
            top: `${armsTop}px`,
            width: `${armWidth}px`,
            height: `${armHeight}px`,
            backgroundColor: `${accentColor.value}15`,
            borderColor: `${accentColor.value}30`,
            borderBottomColor: `${accentColor.value}40`,
            boxShadow: getShadowStyle(),
            transformStyle: "preserve-3d",
          }}
        >
          <span
            className="absolute inset-x-0 top-0 h-[2px] rounded-t-sm"
            style={{ backgroundColor: `${accentColor.value}40` }}
          />
          {animated && (
            <div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
              style={{
                animation: "skeleton-shimmer 2s infinite",
                backgroundSize: "200% 100%",
              }}
            />
          )}
        </div>

        <div
          ref={rightArmRef}
          className={cn(
            "absolute rounded-sm backdrop-blur-sm transition-all duration-200",
            "border-2 border-b-4",
            animated && "animate-skeleton-pulse",
          )}
          style={{
            left: `${rightArmLeft}px`,
            top: `${armsTop}px`,
            width: `${armWidth}px`,
            height: `${armHeight}px`,
            backgroundColor: `${accentColor.value}15`,
            borderColor: `${accentColor.value}30`,
            borderBottomColor: `${accentColor.value}40`,
            boxShadow: getShadowStyle(),
            transformStyle: "preserve-3d",
          }}
        >
          <span
            className="absolute inset-x-0 top-0 h-[2px] rounded-t-sm"
            style={{ backgroundColor: `${accentColor.value}40` }}
          />
          {animated && (
            <div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
              style={{
                animation: "skeleton-shimmer 2s infinite",
                backgroundSize: "200% 100%",
              }}
            />
          )}
        </div>

        <div
          ref={leftLegRef}
          className={cn(
            "absolute rounded-sm backdrop-blur-sm transition-all duration-200",
            "border-2 border-b-4",
            animated && "animate-skeleton-pulse",
          )}
          style={{
            left: `${leftLegLeft}px`,
            top: `${legsTop}px`,
            width: `${legWidth}px`,
            height: `${legHeight}px`,
            backgroundColor: `${accentColor.value}15`,
            borderColor: `${accentColor.value}30`,
            borderBottomColor: `${accentColor.value}40`,
            boxShadow: getShadowStyle(),
            transformStyle: "preserve-3d",
          }}
        >
          <span
            className="absolute inset-x-0 top-0 h-[2px] rounded-t-sm"
            style={{ backgroundColor: `${accentColor.value}40` }}
          />
          {animated && (
            <div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
              style={{
                animation: "skeleton-shimmer 2s infinite",
                backgroundSize: "200% 100%",
              }}
            />
          )}
        </div>

        <div
          ref={rightLegRef}
          className={cn(
            "absolute rounded-sm backdrop-blur-sm transition-all duration-200",
            "border-2 border-b-4",
            animated && "animate-skeleton-pulse",
          )}
          style={{
            left: `${rightLegLeft}px`,
            top: `${legsTop}px`,
            width: `${legWidth}px`,
            height: `${legHeight}px`,
            backgroundColor: `${accentColor.value}15`,
            borderColor: `${accentColor.value}30`,
            borderBottomColor: `${accentColor.value}40`,
            boxShadow: getShadowStyle(),
            transformStyle: "preserve-3d",
          }}
        >
          <span
            className="absolute inset-x-0 top-0 h-[2px] rounded-t-sm"
            style={{ backgroundColor: `${accentColor.value}40` }}
          />
          {animated && (
            <div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
              style={{
                animation: "skeleton-shimmer 2s infinite",
                backgroundSize: "200% 100%",
              }}
            />
          )}
        </div>
      </div>
    );
  },
);

SkinViewerSkeleton.displayName = "SkinViewerSkeleton";
