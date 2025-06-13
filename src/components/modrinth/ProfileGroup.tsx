"use client";

import { Icon } from "@iconify/react";
import { ProfileItem } from "./ProfileItem";
import type { Profile } from "../../types/profile";
import { useThemeStore } from "../../store/useThemeStore";

interface ProfileGroupProps {
  loader: string;
  profiles: Profile[];
  selectedProfileId: string | null;
  onSelectProfile: (profileId: string) => void;
  compatibleProfiles: Record<string, boolean>;
  installedProfiles: Record<string, boolean>;
}

export function ProfileGroup({
  loader,
  profiles,
  selectedProfileId,
  onSelectProfile,
  compatibleProfiles,
  installedProfiles = {},
}: ProfileGroupProps) {
  const accentColor = useThemeStore((state) => state.accentColor);

  const getLoaderIcon = (loaderName: string) => {
    const normalizedName = loaderName.toLowerCase();
    if (normalizedName.includes("fabric")) return "pixel:fabric";
    if (normalizedName.includes("forge")) return "pixel:forge";
    if (normalizedName.includes("quilt")) return "pixel:quilt";
    if (normalizedName.includes("neoforge")) return "pixel:neoforge";
    return "pixel:cube";
  };

  return (
    <div className="mb-4 px-3 pt-3">
      <div
        className="flex items-center gap-2 mb-3 p-2 rounded-md border-2"
        style={{
          backgroundColor: `${accentColor.value}15`,
          borderColor: `${accentColor.value}30`,
        }}
      >
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center"
          style={{ backgroundColor: `${accentColor.value}30` }}
        >
          <Icon icon={getLoaderIcon(loader)} className="w-4 h-4 text-white" />
        </div>
        <h4 className="text-white font-minecraft text-sm tracking-wide lowercase select-none">
          {loader}
        </h4>
      </div>
      <div className="space-y-2 px-1">
        {profiles.map((profile) => (
          <ProfileItem
            key={profile.id}
            profile={profile}
            isSelected={selectedProfileId === profile.id}
            isCompatible={compatibleProfiles[profile.id] ?? true}
            isInstalled={installedProfiles[profile.id] ?? false}
            onClick={() => onSelectProfile(profile.id)}
          />
        ))}
      </div>
    </div>
  );
}
