"use client";

import { Icon } from "@iconify/react";
import type { Profile } from "../../types/profile";
import { Label } from "../ui/Label";
import { useThemeStore } from "../../store/useThemeStore";

interface ProfileItemProps {
  profile: Profile;
  isSelected: boolean;
  isCompatible: boolean;
  isInstalled: boolean;
  onClick: () => void;
}

export function ProfileItem({
  profile,
  isSelected,
  isCompatible,
  isInstalled,
  onClick,
}: ProfileItemProps) {
  const accentColor = useThemeStore((state) => state.accentColor);

  return (
    <div
      onClick={isCompatible ? onClick : undefined}
      className={`p-3 border-2 border-b-4 rounded-md flex items-center gap-3 cursor-pointer transition-all mb-2 ${
        isSelected
          ? "bg-white/10 transform translate-y-[-1px]"
          : isCompatible
            ? "bg-black/20 hover:bg-black/30 hover:transform hover:translate-y-[-1px]"
            : "bg-black/20 opacity-50 cursor-not-allowed"
      }`}
      style={{
        borderColor: isSelected
          ? `${accentColor.value}40`
          : "rgba(255, 255, 255, 0.1)",
        borderBottomColor: isSelected
          ? `${accentColor.value}60`
          : "rgba(255, 255, 255, 0.2)",
      }}
    >
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="text-white font-minecraft text-sm tracking-wide lowercase select-none">
            {profile.name}
          </span>
          {isInstalled && (
            <Label variant="success" size="xs">
              Installed
            </Label>
          )}
          {!isCompatible && (
            <Label variant="destructive" size="xs">
              Incompatible
            </Label>
          )}
        </div>
        <div className="text-white/60 font-minecraft text-xs tracking-wide lowercase select-none">
          {profile.game_version} • {profile.loader}
        </div>
      </div>
      {isSelected && (
        <div
          className="w-6 h-6 rounded-full flex items-center justify-center"
          style={{ backgroundColor: accentColor.value }}
        >
          <Icon icon="pixel:check" className="w-4 h-4 text-white" />
        </div>
      )}
    </div>
  );
}
