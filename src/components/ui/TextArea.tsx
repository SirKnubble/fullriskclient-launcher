"use client";

import type React from "react";
import { forwardRef, useRef, useState } from "react";
import { cn } from "../../lib/utils";
import { useThemeStore } from "../../store/useThemeStore";

export interface TextAreaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string;
  variant?: "default" | "flat" | "3d";
}

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  ({ className, error, variant = "default", ...props }, ref) => {
    const [isFocused, setIsFocused] = useState(false);
    const [isHovered, setIsHovered] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const accentColor = useThemeStore((state) => state.accentColor);
    const isBackgroundAnimationEnabled = useThemeStore(
      (state) => state.isBackgroundAnimationEnabled,
    );

    const handleFocus = () => {
      setIsFocused(true);
    };

    const handleBlur = () => {
      setIsFocused(false);
    };

    const handleMouseEnter = () => {
      if (props.disabled) return;
      setIsHovered(true);
    };

    const handleMouseLeave = () => {
      if (props.disabled) return;
      setIsHovered(false);
    };

    const getBorderClasses = () => {
      if (variant === "3d") {
        return "border-2 border-b-4";
      }
      return "border border-b-2";
    };

    return (
      <div className="w-full">
        <div
          ref={containerRef}
          className={cn(
            "relative rounded-md",
            getBorderClasses(),
            "overflow-hidden",
            error ? "border-red-500" : "",
            props.disabled ? "opacity-50 cursor-not-allowed" : "",
            className,
          )}
          style={{
            backgroundColor: `${accentColor.value}${isHovered || isFocused ? "50" : "30"}`,
            borderColor: error
              ? "rgba(239, 68, 68, 0.6)"
              : `${accentColor.value}${isHovered || isFocused ? "90" : "80"}`,
            borderBottomColor: error
              ? "rgb(185, 28, 28)"
              : isHovered || isFocused
                ? accentColor.hoverValue
                : accentColor.value,
            filter:
              (isHovered || isFocused) && !props.disabled
                ? "brightness(1.1)"
                : "brightness(1)",
          }}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          {variant === "3d" && (
            <span
              className="absolute inset-x-0 top-0 h-[2px] rounded-t-sm transition-colors duration-200"
              style={{
                backgroundColor: error
                  ? "rgba(239, 68, 68, 0.8)"
                  : isHovered || isFocused
                    ? accentColor.hoverValue
                    : `${accentColor.value}80`,
                opacity: isHovered || isFocused ? 1 : 0.8,
              }}
            />
          )}

          <textarea
            ref={ref}
            className="w-full min-h-[100px] bg-transparent border-none outline-none p-3 text-white font-minecraft-ten text-xs placeholder:text-white/50 resize-y custom-scrollbar transition-transform duration-200"
            onFocus={handleFocus}
            onBlur={handleBlur}
            {...props}
          />
        </div>
        {error && (
          <p className="mt-1 text-xl text-red-400 font-minecraft lowercase">
            {error}
          </p>
        )}
      </div>
    );
  },
);

TextArea.displayName = "TextArea";
