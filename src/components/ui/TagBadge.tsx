"use client";

import type React from "react";
import { forwardRef, useRef, useState } from "react";
import { useThemeStore } from "../../store/useThemeStore";
import { cn } from "../../lib/utils";
import { ThemedSurface } from "./ThemedSurface";

export interface TagBadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  iconElement?: React.ReactNode;
  variant?:
    | "default"
    | "success"
    | "info"
    | "inactive"
    | "destructive"
    | "warning"
    | "flat";
  size?: "sm" | "md" | "lg" | "xl";
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
  disabled?: boolean;
}

interface RippleType {
  x: number;
  y: number;
  size: number;
  id: number;
}

export const TagBadge = forwardRef<HTMLDivElement, TagBadgeProps>(
  (
    {
      children,
      className,
      iconElement,
      variant = "default",
      size = "md",
      onClick,
      disabled = false,
      ...props
    },
    ref,
  ) => {
    const badgeRef = useRef<HTMLDivElement>(null);
    const accentColor = useThemeStore((state) => state.accentColor);
    const isBackgroundAnimationEnabled = useThemeStore(
      (state) => state.isBackgroundAnimationEnabled,
    );
    const [isHovered, setIsHovered] = useState(false);
    const [isPressed, setIsPressed] = useState(false);
    const isClickable = !!onClick && !disabled;

    const mergedRef = (node: HTMLDivElement) => {
      if (ref) {
        if (typeof ref === "function") {
          ref(node);
        } else {
          ref.current = node;
        }
      }
      badgeRef.current = node;
    };

    const handleMouseDown = () => {
      if (disabled || !isClickable) return;
      setIsPressed(true);
    };

    const handleMouseUp = () => {
      if (disabled || !isClickable) return;
      setIsPressed(false);
    };

    const handleMouseEnter = () => {
      if (disabled || !isClickable) return;
      setIsHovered(true);
    };

    const handleMouseLeave = () => {
      if (disabled || !isClickable) return;
      setIsHovered(false);
      if (isPressed) {
        handleMouseUp();
      }
    };

    const getVariantStyles = () => {
      switch (variant) {
        case "destructive":
          return {
            main: "#ef4444",
            light: "#f87171",
            dark: "#dc2626",
            text: "#fee2e2",
          };
        case "success":
          return {
            main: "#10b981",
            light: "#34d399",
            dark: "#059669",
            text: "#d1fae5",
          };
        case "info":
          return {
            main: "#3b82f6",
            light: "#60a5fa",
            dark: "#2563eb",
            text: "#dbeafe",
          };
        case "warning":
          return {
            main: "#f59e0b",
            light: "#fbbf24",
            dark: "#d97706",
            text: "#fef3c7",
          };
        case "inactive":
          return {
            main: "#6b7280",
            light: "#9ca3af",
            dark: "#4b5563",
            text: "#f3f4f6",
          };
        case "flat":
          return {
            main: accentColor.value,
            light: accentColor.hoverValue || accentColor.value,
            dark: accentColor.value,
            text: "#ffffff",
          };
        default:
          return {
            main: accentColor.value,
            light: accentColor.hoverValue || accentColor.value,
            dark: accentColor.value,
            text: "#ffffff",
          };
      }
    };

    const getSizeClasses = () => {
      switch (size) {
        case "sm":
          return "px-2 py-1 rounded-md min-h-[15px]";
        case "lg":
          return "px-4 py-1.5 rounded-md min-h-[36px]";
        case "xl":
          return "px-5 py-2 rounded-md min-h-[44px]";
        default:
          return "px-2 py-1 rounded-md min-h-[15px]";
      }
    };

    const variantStyles = getVariantStyles();
    const sizeClasses = getSizeClasses();

    const getTextSizeClass = () => {
      switch (size) {
        case "sm":
          return "text-[0.9em]";
        case "lg":
          return "text-base";
        case "xl":
          return "text-lg";
        default:
          return "text-[0.7em]";
      }
    };

    const customStyling =
      variant === "flat"
        ? {
            borderWidth: "1px",
            borderBottomWidth: "2px",
            backgroundColor: `${variantStyles.main}30`,
            borderColor: `${variantStyles.main}80`,
            borderBottomColor: isHovered
              ? variantStyles.light
              : variantStyles.dark,
            boxShadow: "none",
          }
        : {};

    return (
      <ThemedSurface
        surfaceRef={mergedRef}
        className={cn(
          "inline-flex items-center justify-center relative overflow-hidden",
          "w-fit",
          sizeClasses,
          isClickable ? "cursor-pointer" : "",
          disabled
            ? "opacity-50 cursor-not-allowed"
            : "transition-all duration-150",
          className,
        )}
        baseColorHex={variantStyles.main}
        alwaysActive={true}
        onClick={isClickable ? onClick : undefined}
        onMouseDown={isClickable ? handleMouseDown : undefined}
        onMouseUp={isClickable ? handleMouseUp : undefined}
        onMouseEnter={isClickable ? handleMouseEnter : undefined}
        onMouseLeave={isClickable ? handleMouseLeave : undefined}
        style={customStyling}
        {...props}
      >
        <span
          className={cn(
            "relative z-10 flex items-center font-minecraft-ten",
            iconElement ? "gap-x-1.5" : "",
            getTextSizeClass(),
          )}
          style={{
            color: variantStyles.text,
            letterSpacing: "0.01em",
            textTransform: "capitalize",
            filter:
              isHovered && isClickable && !disabled
                ? "brightness(1.1)"
                : "brightness(1)",
          }}
        >
          {iconElement && (
            <span className="flex-shrink-0 w-3 h-3 flex items-center justify-center">
              {iconElement}
            </span>
          )}
          {children}
        </span>
      </ThemedSurface>
    );
  },
);

TagBadge.displayName = "TagBadge";
