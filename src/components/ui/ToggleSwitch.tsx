"use client";

import type React from "react";
import { forwardRef, useState } from "react";
import { cn } from "../../lib/utils";
import { useThemeStore } from "../../store/useThemeStore";
import { getBorderRadiusStyle } from "./design-system";

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  size?: "sm" | "md" | "lg";
  label?: string;
  description?: string;
  className?: string;
}

export const ToggleSwitch = forwardRef<HTMLButtonElement, ToggleSwitchProps>(
  ({ checked, onChange, disabled = false, size = "md", label, description, className }, ref) => {
    const [isFocused, setIsFocused] = useState(false);
    const [isHovered, setIsHovered] = useState(false);
    
    const accentColor = useThemeStore((state) => state.accentColor);
    const borderRadius = useThemeStore((state) => state.borderRadius);

    const handleClick = () => {
      if (!disabled) {
        onChange(!checked);
      }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if ((e.key === "Enter" || e.key === " ") && !disabled) {
        e.preventDefault();
        onChange(!checked);
      }
    };

    const sizeConfig = {
      sm: {
        container: "w-8 h-5",
        thumb: "w-3 h-3",
        translate: "translate-x-3",
      },
      md: {
        container: "w-11 h-6",
        thumb: "w-5 h-5",
        translate: "translate-x-5",
      },
      lg: {
        container: "w-14 h-7",
        thumb: "w-6 h-6",
        translate: "translate-x-7",
      },
    };

    const config = sizeConfig[size];
    const containerRadiusStyle = getBorderRadiusStyle(borderRadius);
    const thumbRadiusStyle = getBorderRadiusStyle(Math.max(0, borderRadius - 2));

    return (
      <div className={cn("flex items-center gap-3", className)}>
        <button
          ref={ref}
          type="button"
          role="switch"
          aria-checked={checked}
          aria-disabled={disabled}
          disabled={disabled}
          onClick={handleClick}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}          className={cn(
            "relative inline-flex shrink-0 cursor-pointer backdrop-blur-md",
            "transition-all duration-200 ease-in-out",
            "focus:outline-none focus:ring-2 focus:ring-white focus:ring-opacity-30",
            config.container,
            disabled && "opacity-50 cursor-not-allowed",
          )}          style={{
            backgroundColor: checked 
              ? accentColor.value 
              : "rgba(107, 114, 128, 0.3)",
            borderColor: checked 
              ? accentColor.light 
              : "rgba(107, 114, 128, 0.5)",
            boxShadow: isFocused 
              ? `0 0 0 2px rgba(255, 255, 255, 0.3)` 
              : "none",
            filter: isHovered && !disabled ? "brightness(1.1)" : "brightness(1)",
            transform: isHovered && !disabled ? "scale(1.05)" : "scale(1)",
            ...containerRadiusStyle,
          }}
        >          <span
            className={cn(
              "pointer-events-none inline-block transform transition-transform duration-200",
              "bg-white shadow-lg",
              config.thumb,
              checked ? config.translate : "translate-x-0.5",
            )}
            style={{
              transform: `translateX(${checked ? 
                (size === "sm" ? "12px" : size === "md" ? "20px" : "28px") 
                : "2px"}) translateY(-50%)`,
              top: "50%",
              position: "absolute",
              ...thumbRadiusStyle,
            }}
          />
        </button>

        {(label || description) && (
          <div className="flex flex-col">
            {label && (              <span 
                className="text-white font-minecraft text-xl lowercase"
                onClick={!disabled ? handleClick : undefined}
              >
                {label}
              </span>
            )}
            {description && (
              <span className="text-white text-opacity-70 text-sm">
                {description}
              </span>
            )}
          </div>
        )}
      </div>
    );
  }
);

ToggleSwitch.displayName = "ToggleSwitch";
