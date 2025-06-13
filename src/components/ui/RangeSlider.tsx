"use client";

import type React from "react";
import { useEffect, useRef, useState } from "react";
import { useThemeStore } from "../../store/useThemeStore";
import { cn } from "../../lib/utils";
import { Icon } from "@iconify/react";

interface RangeSliderProps {
  value: number;
  onChange: (value: number) => void;
  onChangeEnd?: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  valueLabel?: string;
  minLabel?: string;
  maxLabel?: string;
  disabled?: boolean;
  showValue?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
  variant?: "default" | "flat" | "3d";
  icon?: React.ReactNode;
}

export function RangeSlider({
  value,
  onChange,
  onChangeEnd,
  min,
  max,
  step = 1,
  valueLabel,
  minLabel,
  maxLabel,
  disabled = false,
  showValue = true,
  size = "md",
  className,
  variant = "flat",
  icon,
}: RangeSliderProps) {
  const accentColor = useThemeStore((state) => state.accentColor);
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [localValue, setLocalValue] = useState(value);
  const sliderRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const valueDisplayRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const sizeConfig = {
    sm: {
      track: "h-2",
      thumb: "w-5 h-5",
      text: "text-xs",
    },
    md: {
      track: "h-3",
      thumb: "w-6 h-6",
      text: "text-sm",
    },
    lg: {
      track: "h-4",
      thumb: "w-8 h-8",
      text: "text-base",
    },
  };

  const getPercentage = (val: number) => {
    return ((val - min) / (max - min)) * 100;
  };

  const updateUI = () => {
    if (!progressRef.current || !thumbRef.current) return;

    const percentage = getPercentage(localValue);

    progressRef.current.style.width = `${percentage}%`;

    thumbRef.current.style.left = `${percentage}%`;
  };

  useEffect(() => {
    updateUI();
  }, [localValue, min, max]);

  const handleMouseEnter = () => {
    if (disabled) return;
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    if (disabled) return;
    setIsHovered(false);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (disabled) return;
    setIsDragging(true);

    if (trackRef.current) {
      const rect = trackRef.current.getBoundingClientRect();
      const offsetX = e.clientX - rect.left;
      const width = rect.width;
      const percentage = Math.max(0, Math.min(1, offsetX / width));
      let newValue = min + percentage * (max - min);

      if (step > 0) {
        newValue = Math.round(newValue / step) * step;
      }

      newValue = Math.max(min, Math.min(max, newValue));

      setLocalValue(newValue);
      onChange(newValue);
    }

    if (inputRef.current) {
      inputRef.current.focus();
    }
    e.preventDefault();
  };

  const handleMouseUp = () => {
    if (disabled) return;
    setIsDragging(false);

    if (onChangeEnd && localValue !== value) {
      onChangeEnd(localValue);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = Number(e.target.value);
    setLocalValue(newValue);
    onChange(newValue);
  };

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isDragging) {
        handleMouseUp();
      }
    };

    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!isDragging || !trackRef.current) return;

      const rect = trackRef.current.getBoundingClientRect();
      const offsetX = e.clientX - rect.left;
      const width = rect.width;

      const percentage = Math.max(0, Math.min(1, offsetX / width));
      let newValue = min + percentage * (max - min);

      if (step > 0) {
        newValue = Math.round(newValue / step) * step;
      }

      newValue = Math.max(min, Math.min(max, newValue));

      setLocalValue(newValue);
      onChange(newValue);
    };

    document.addEventListener("mouseup", handleGlobalMouseUp);
    document.addEventListener("mousemove", handleGlobalMouseMove);

    return () => {
      document.removeEventListener("mouseup", handleGlobalMouseUp);
      document.removeEventListener("mousemove", handleGlobalMouseMove);
    };
  }, [isDragging, min, max, step, onChange]);

  return (
    <div
      ref={sliderRef}
      className={cn(
        "relative w-full",
        disabled && "opacity-50 cursor-not-allowed",
        className,
      )}
    >
      {valueLabel && (
        <div className="flex items-center gap-2 mb-2">
          {icon && <span className="text-white">{icon}</span>}
          <span
            className={cn(
              "text-white font-minecraft-ten tracking-wide",
              sizeConfig[size].text,
            )}
          >
            {valueLabel}
          </span>
        </div>
      )}

      <div className="mb-2">
        {showValue && (
          <div className="flex justify-between mb-1">
            {minLabel && (
              <span
                className={cn(
                  "text-white/70 font-minecraft-ten",
                  sizeConfig[size].text,
                )}
              >
                {minLabel}
              </span>
            )}
            <div className="flex items-center gap-1">
              <span
                ref={valueDisplayRef}
                className={cn(
                  "text-white font-minecraft-ten",
                  sizeConfig[size].text,
                )}
              >
                {localValue}
              </span>
              {localValue === max && (
                <Icon
                  icon="solar:star-bold"
                  className="w-3 h-3 text-yellow-400"
                />
              )}
            </div>
            {maxLabel && (
              <span
                className={cn(
                  "text-white/70 font-minecraft-ten",
                  sizeConfig[size].text,
                )}
              >
                {maxLabel}
              </span>
            )}
          </div>
        )}

        <div
          className="relative pt-4 pb-4 cursor-pointer"
          onMouseDown={handleMouseDown}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <div
            className={cn(
              "relative overflow-hidden transition-colors duration-200",
              "border border-white/10",
              "focus-within:ring-1 focus-within:ring-white/30",
              sizeConfig[size].track,
            )}
            style={{
              backgroundColor: `${accentColor.value}15`,
              borderColor: `${accentColor.value}40`,
            }}
            ref={trackRef}
          >
            <div
              ref={progressRef}
              className="absolute h-full"
              style={{
                width: `${getPercentage(localValue)}%`,
                backgroundColor: `${accentColor.value}${isHovered ? "60" : "50"}`,
              }}
            />
          </div>

          <div
            ref={thumbRef}
            className={cn(
              "absolute top-2 -translate-x-1/2 z-10 cursor-grab",
              isDragging && "cursor-grabbing",
              "border-2",
              sizeConfig[size].thumb,
              "transition-colors duration-200",
            )}
            style={{
              backgroundColor: `${accentColor.value}${isHovered || isDragging ? "90" : "80"}`,
              borderColor: `${accentColor.value}`,
              left: `${getPercentage(localValue)}%`,
              transform: isDragging
                ? "translateX(0) scale(1.1)"
                : "translateX(0) scale(1)",
            }}
          >
            <div
              className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent transition-opacity duration-200"
              style={{ opacity: isHovered || isDragging ? 0.5 : 0 }}
            />

            <div className="absolute inset-0 flex items-center justify-center opacity-70">
              <div className="w-2/3 h-[2px] bg-white/50"></div>
            </div>
          </div>
        </div>
      </div>

      <input
        ref={inputRef}
        type="range"
        min={min}
        max={max}
        step={step}
        value={localValue}
        onChange={handleChange}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        disabled={disabled}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={localValue}
        aria-valuetext={
          valueLabel ? `${valueLabel}: ${localValue}` : `${localValue}`
        }
      />
    </div>
  );
}
