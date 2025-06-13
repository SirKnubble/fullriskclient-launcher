"use client";

import type React from "react";
import { forwardRef, useRef, useState } from "react";
import { cn } from "../../../lib/utils";
import { gsap } from "gsap";
import { useThemeStore } from "../../../store/useThemeStore";
import { ThemedSurface } from "../ThemedSurface";

interface IconButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:
    | "default"
    | "secondary"
    | "ghost"
    | "warning"
    | "destructive"
    | "info"
    | "success"
    | "flat"
    | "flat-secondary"
    | "3d";
  displayVariant?: "button" | "ghost" | "themed-surface";
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  icon: React.ReactNode;
  shadowDepth?: "default" | "short" | "none";
}

interface RippleType {
  x: number;
  y: number;
  size: number;
  id: number;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      className,
      variant = "default",
      displayVariant = "button",
      size = "md",
      disabled = false,
      icon,
      shadowDepth = "short",
      onClick,
      ...props
    },
    ref,
  ) => {
    const buttonRef = useRef<HTMLButtonElement>(null);
    const [ripples, setRipples] = useState<RippleType[]>([]);
    const rippleCounter = useRef(0);
    const accentColor = useThemeStore((state) => state.accentColor);
    const isBackgroundAnimationEnabled = useThemeStore(
      (state) => state.isBackgroundAnimationEnabled,
    );
    const [isPressed, setIsPressed] = useState(false);
    const [isHovered, setIsHovered] = useState(false);

    const mergedRef = (node: HTMLButtonElement) => {
      if (ref) {
        if (typeof ref === "function") {
          ref(node);
        } else {
          ref.current = node;
        }
      }
      buttonRef.current = node;
    };

    const handleRipple = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (disabled) return;

      if (onClick) onClick(e);
    };

    const handleMouseDown = () => {
      if (disabled) return;
      setIsPressed(true);
    };

    const handleMouseUp = () => {
      if (disabled) return;
      setIsPressed(false);
    };

    const handleMouseEnter = () => {
      if (disabled) return;
      setIsHovered(true);

      if (
        buttonRef.current &&
        isBackgroundAnimationEnabled &&
        shouldShowShadow()
      ) {
        gsap.to(buttonRef.current, {
          boxShadow: `0 6px 0 rgba(0,0,0,0.25), 0 8px 12px rgba(0,0,0,0.4)`,
          duration: 0.2,
          ease: "power2.out",
        });
      }
    };

    const handleMouseLeave = () => {
      if (disabled) return;
      setIsHovered(false);

      if (
        buttonRef.current &&
        isBackgroundAnimationEnabled &&
        shouldShowShadow()
      ) {
        gsap.to(buttonRef.current, {
          boxShadow: `0 4px 0 rgba(0,0,0,0.3), 0 6px 10px rgba(0,0,0,0.35)`,
          duration: 0.2,
          ease: "power2.out",
        });
      }

      if (isPressed) {
        handleMouseUp();
      }
    };

    const shouldShowShadow = () => {
      return (
        displayVariant === "button" &&
        variant === "3d" &&
        shadowDepth !== "none"
      );
    };

    const getVariantColors = () => {
      switch (variant) {
        case "warning":
          return {
            main: "#f59e0b",
            light: "#fbbf24",
            dark: "#d97706",
            text: "#fef3c7",
          };
        case "destructive":
          return {
            main: "#ef4444",
            light: "#f87171",
            dark: "#dc2626",
            text: "#fee2e2",
          };
        case "info":
          return {
            main: "#3b82f6",
            light: "#60a5fa",
            dark: "#2563eb",
            text: "#dbeafe",
          };
        case "success":
          return {
            main: "#10b981",
            light: "#34d399",
            dark: "#059669",
            text: "#d1fae5",
          };
        case "secondary":
          return {
            main: "#6b7280",
            light: "#9ca3af",
            dark: "#4b5563",
            text: "#f3f4f6",
          };
        case "flat-secondary":
          return {
            main: "#6b7280",
            light: "#9ca3af",
            dark: "#4b5563",
            text: "#f3f4f6",
          };
        case "ghost":
          return {
            main: "transparent",
            light: accentColor.hoverValue || accentColor.value,
            dark: accentColor.value,
            text: "#ffffff",
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

    const colors = getVariantColors();

    const sizeStyles = {
      xs: "h-[32px] w-[32px] text-sm",
      sm: "h-[42px] w-[42px] text-xl",
      md: "h-[50px] w-[50px] text-2xl",
      lg: "h-[58px] w-[58px] text-3xl",
      xl: "h-[66px] w-[66px] text-4xl",
    };

    const iconSizes = {
      xs: "w-3.5 h-3.5",
      sm: "w-5 h-5",
      md: "w-6 h-6",
      lg: "w-7 h-7",
      xl: "w-8 h-8",
    };

    const getBackgroundColor = () => {
      if (displayVariant === "ghost" || displayVariant === "themed-surface")
        return "transparent";

      if (variant === "ghost") {
        return isHovered ? `rgba(255, 255, 255, 0.1)` : "transparent";
      }

      if (variant === "flat" || variant === "flat-secondary") {
        return `${colors.main}30`;
      }

      const baseOpacity = isHovered ? "50" : "30";
      return `${colors.main}${baseOpacity}`;
    };

    const getBorderColor = () => {
      if (displayVariant === "ghost" || displayVariant === "themed-surface")
        return "transparent";

      if (variant === "ghost") {
        return "transparent";
      }

      if (variant === "flat" || variant === "flat-secondary") {
        return `${colors.main}80`;
      }

      return isHovered ? `${colors.light}` : `${colors.main}80`;
    };

    const getBorderBottomColor = () => {
      if (displayVariant === "ghost" || displayVariant === "themed-surface")
        return "transparent";

      if (variant === "ghost") {
        return "transparent";
      }

      if (variant === "flat" || variant === "flat-secondary") {
        return isHovered ? colors.light : colors.dark;
      }

      return isHovered ? colors.light : colors.dark;
    };

    const getBoxShadow = () => {
      if (
        displayVariant === "ghost" ||
        displayVariant === "themed-surface" ||
        variant !== "3d" ||
        shadowDepth === "none"
      ) {
        return "none";
      }

      const part1Y = shadowDepth === "short" ? "4px" : "8px";
      const part2Y = shadowDepth === "short" ? "6px" : "10px";
      const part2Blur = shadowDepth === "short" ? "10px" : "15px";

      return `0 ${part1Y} 0 rgba(0,0,0,0.3), 0 ${part2Y} ${part2Blur} rgba(0,0,0,0.35), inset 0 1px 0 ${colors.light}40, inset 0 0 0 1px ${colors.main}20`;
    };

    const getBorderClasses = () => {
      if (displayVariant === "ghost" || displayVariant === "themed-surface") {
        return "";
      }

      if (variant === "ghost") {
        return "";
      }

      if (variant === "3d") {
        return shadowDepth === "none" ? "border-2" : "border-2 border-b-4";
      }

      return "border border-b-2";
    };

    const getShadowClasses = () => {
      if (
        displayVariant === "ghost" ||
        displayVariant === "themed-surface" ||
        variant !== "3d" ||
        shadowDepth === "none"
      ) {
        return "";
      }

      return shadowDepth === "default"
        ? "shadow-[0_8px_0_rgba(0,0,0,0.3),0_10px_15px_rgba(0,0,0,0.35)]"
        : "shadow-[0_4px_0_rgba(0,0,0,0.3),0_6px_10px_rgba(0,0,0,0.35)]";
    };

    const buttonElement = (
      <button
        ref={mergedRef}
        disabled={disabled}
        onClick={handleRipple}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={cn(
          "font-minecraft relative overflow-hidden backdrop-blur-md",
          "rounded-md text-white tracking-wider",
          "flex items-center justify-center",
          "text-shadow-sm",
          getBorderClasses(),
          getShadowClasses(),
          "focus:outline-none focus:ring-2 focus:ring-white/30 focus:ring-offset-1 focus:ring-offset-black/20",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          displayVariant !== "themed-surface" && sizeStyles[size],
          className,
        )}
        style={{
          backgroundColor: getBackgroundColor(),
          borderColor: getBorderColor(),
          borderBottomColor: getBorderBottomColor(),
          boxShadow: getBoxShadow(),
          color: colors.text,
          filter: isHovered && !disabled ? "brightness(1.1)" : "brightness(1)",
        }}
        {...props}
      >
        {variant !== "ghost" &&
          variant === "3d" &&
          displayVariant !== "ghost" &&
          displayVariant !== "themed-surface" && (
            <span
              className="absolute inset-x-0 top-0 h-[2px] rounded-t-sm transition-colors duration-200"
              style={{
                backgroundColor: isHovered
                  ? `${colors.light}`
                  : `${colors.light}80`,
                opacity: isHovered ? 1 : 0.8,
              }}
            />
          )}

        <span
          className={cn(
            "relative z-10 flex items-center justify-center transition-transform duration-200",
            iconSizes[size],
          )}
          style={{
            transform: isHovered && !disabled ? "scale(1.05)" : "scale(1)",
          }}
        >
          {icon}
        </span>
      </button>
    );

    if (displayVariant === "themed-surface") {
      const surfaceBaseColorHex =
        variant === "default" || variant === "ghost" ? undefined : colors.main;

      return (
        <ThemedSurface
          baseColorHex={surfaceBaseColorHex}
          className={cn(sizeStyles[size], "!p-0", className)}
        >
          {buttonElement}
        </ThemedSurface>
      );
    }

    return buttonElement;
  },
);

IconButton.displayName = "IconButton";
