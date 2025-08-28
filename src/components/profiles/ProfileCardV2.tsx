"use client";

import type React from "react";
import { useState } from "react";

import type { Profile } from "../../types/profile";
import { ProfileIconV2 } from "./ProfileIconV2";
import { toast } from "react-hot-toast";
import { ProfileActionButtons, type ActionButton } from "../ui/ProfileActionButtons";

interface ProfileCardV2Props {
  profile: Profile;
  onPlay?: (profile: Profile) => void;
  onSettings?: (profile: Profile) => void;
  onMods?: (profile: Profile) => void;
}

export function ProfileCardV2({
  profile,
  onPlay,
  onSettings,
  onMods,
}: ProfileCardV2Props) {
  const [isHovered, setIsHovered] = useState(false);

  // Action button configuration
  const actionButtons: ActionButton[] = [
    {
      id: "play",
      label: "PLAY",
      icon: "solar:play-bold",
      variant: "primary",
      tooltip: "Minecraft spielen!",
      onClick: (profile, e) => {
        if (onPlay) {
          onPlay(profile);
        } else {
          toast.success(`🎮 Starting ${profile.name}!`);
          console.log("Starting game with profile:", profile.name);
        }
      },
    },
    {
      id: "mods",
      label: "MODS",
      icon: "solar:box-bold",
      variant: "secondary",
      tooltip: "Mods verwalten",
      onClick: (profile, e) => {
        if (onMods) {
          onMods(profile);
        } else {
          toast.success(`📦 Managing mods for ${profile.name}!`);
          console.log("Managing mods for profile:", profile.name);
        }
      },
    },
    {
      id: "settings",
      label: "SETTINGS",
      icon: "solar:settings-bold",
      variant: "icon-only",
      tooltip: "Profil bearbeiten",
      onClick: (profile, e) => {
        if (onSettings) {
          onSettings(profile);
        } else {
          toast.success(`⚙️ Opening settings for ${profile.name}!`);
          console.log("Opening settings for profile:", profile.name);
        }
      },
    },
  ];

  return (
    <div
      className="flex items-center gap-4 p-3 rounded-lg bg-black/20 border border-white/10 hover:border-white/20 transition-all duration-200"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Profile Icon */}
      <ProfileIconV2 profile={profile} size="md" />

      {/* Profile Info */}
      <div className="flex-1 min-w-0">
        <h3 
          className="text-white font-minecraft-ten text-sm whitespace-nowrap overflow-hidden text-ellipsis"
          title={profile.name}
        >
          {profile.name}
        </h3>
        <p className="text-white/60 text-xs font-minecraft-ten">
          {profile.loader || "Vanilla"} {profile.game_version}
        </p>
      </div>

      {/* Action Buttons */}
      <ProfileActionButtons
        profile={profile}
        actions={actionButtons}
        useFlexSpacer={true}
        flexSpacerAfterIndex={1}
      />
    </div>
  );
}
