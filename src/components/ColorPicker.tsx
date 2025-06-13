"use client";

import { useState } from "react";
import { Icon } from "@iconify/react";
import { ACCENT_COLORS, useThemeStore } from "../store/useThemeStore";
import { Button } from "./ui/buttons/Button";
import { Input } from "./ui/Input";

interface ColorPickerProps {
  shape?: "square" | "circle";
  size?: "sm" | "md" | "lg";
  showCustomOption?: boolean;
}

export function ColorPicker({
  shape = "square",
  size = "md",
  showCustomOption = true,
}: ColorPickerProps) {
  const { accentColor, setAccentColor, setCustomAccentColor } = useThemeStore();
  const [showCustomPicker, setShowCustomPicker] = useState(false);
  const [customColor, setCustomColor] = useState("#4f8eff");

  const sizeClasses = {
    sm: "w-8 h-8",
    md: "w-12 h-12",
    lg: "w-16 h-16",
  };

  const shapeClasses = {
    square: "rounded-md",
    circle: "rounded-full",
  };

  const handleCustomColorSubmit = () => {
    const isValidHex = /^#([0-9A-F]{3}){1,2}$/i.test(customColor);

    if (isValidHex) {
      setCustomAccentColor(customColor);
      setShowCustomPicker(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        {Object.values(ACCENT_COLORS).map((color) => (
          <button
            key={color.name}
            onClick={() => setAccentColor(color)}
            className={`
              ${sizeClasses[size]} 
              ${shapeClasses[shape]} 
              relative cursor-pointer transition-all duration-200
              shadow-[0_4px_0_rgba(0,0,0,0.2),0_6px_10px_rgba(0,0,0,0.3),inset_0_1px_1px_rgba(255,255,255,0.3)]
              hover:shadow-[0_5px_0_rgba(0,0,0,0.15),0_8px_15px_rgba(0,0,0,0.25),inset_0_1px_1px_rgba(255,255,255,0.4)]
              hover:translate-y-[-2px]
              active:shadow-[0_2px_0_rgba(0,0,0,0.1),0_3px_5px_rgba(0,0,0,0.2),inset_0_1px_1px_rgba(255,255,255,0.2)]
              active:translate-y-[1px]
              ${accentColor.value === color.value ? "ring-2 ring-white ring-offset-2 ring-offset-black/50" : ""}
            `}
            style={{ backgroundColor: color.value }}
            aria-label={`Set accent color to ${color.name}`}
          >
            {accentColor.value === color.value && (
              <span className="absolute inset-0 flex items-center justify-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-6 h-6 drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)]"
                >
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              </span>
            )}
          </button>
        ))}

        {showCustomOption && (
          <button
            onClick={() => setShowCustomPicker(!showCustomPicker)}
            className={`
              ${sizeClasses[size]} 
              ${shapeClasses[shape]} 
              relative cursor-pointer transition-all duration-200
              shadow-[0_4px_0_rgba(0,0,0,0.2),0_6px_10px_rgba(0,0,0,0.3),inset_0_1px_1px_rgba(255,255,255,0.3)]
              hover:shadow-[0_5px_0_rgba(0,0,0,0.15),0_8px_15px_rgba(0,0,0,0.25),inset_0_1px_1px_rgba(255,255,255,0.4)]
              hover:translate-y-[-2px]
              active:shadow-[0_2px_0_rgba(0,0,0,0.1),0_3px_5px_rgba(0,0,0,0.2),inset_0_1px_1px_rgba(255,255,255,0.2)]
              active:translate-y-[1px]
              bg-gradient-to-r from-purple-500 via-pink-500 to-red-500
              ${accentColor.isCustom ? "ring-2 ring-white ring-offset-2 ring-offset-black/50" : ""}
            `}
            aria-label="Custom color"
          >
            <span className="absolute inset-0 flex items-center justify-center">
              <Icon
                icon="solar:palette-bold"
                className="w-6 h-6 text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)]"
              />
            </span>
          </button>
        )}
      </div>

      {showCustomPicker && (
        <div className="mt-4 p-4 bg-black/30 rounded-lg border border-white/10">
          <h5 className="font-minecraft text-xl lowercase text-white/80 mb-3">
            Custom Color
          </h5>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <Input
                type="text"
                value={customColor}
                onChange={(e) => setCustomColor(e.target.value)}
                placeholder="#RRGGBB"
                icon={<Icon icon="solar:palette-bold" />}
              />
            </div>
            <div
              className={`w-10 h-10 rounded-md border-2 border-white/20`}
              style={{ backgroundColor: customColor }}
            />
            <Button
              onClick={handleCustomColorSubmit}
              size="sm"
              icon={<Icon icon="solar:check-circle-bold" />}
            >
              Apply
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
