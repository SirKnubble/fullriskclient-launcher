"use client";

import type React from "react";
import { useState } from "react";
import { Icon } from "@iconify/react";
import type { Profile } from "../../types/profile";
import { ProfileIconV2 } from "./ProfileIconV2";
import { toast } from "react-hot-toast";
import { useThemeStore } from "../../store/useThemeStore";

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
  const accentColor = useThemeStore((state) => state.accentColor);

  const handlePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onPlay) {
      onPlay(profile);
    } else {
      toast.success(`🎮 Starting ${profile.name}!`);
      console.log("Starting game with profile:", profile.name);
    }
  };

  const handleSettings = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onSettings) {
      onSettings(profile);
    } else {
      toast.success(`⚙️ Opening settings for ${profile.name}!`);
      console.log("Opening settings for profile:", profile.name);
    }
  };

  const handleMods = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onMods) {
      onMods(profile);
    } else {
      toast.success(`📦 Managing mods for ${profile.name}!`);
      console.log("Managing mods for profile:", profile.name);
    }
  };

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
      <div className="flex items-center gap-3">
        {/* Play Button */}
        <button
          onClick={handlePlay}
          className="text-white rounded-lg px-4 py-2 flex items-center gap-2 transition-all duration-200 hover:scale-105 border border-white/20 hover:border-white/30 font-minecraft text-sm"
          style={{
            backgroundColor: `${accentColor.value}40`,
            color: 'white',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = `${accentColor.value}60`;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = `${accentColor.value}40`;
          }}
          title="Minecraft spielen!"
        >
          <Icon icon="solar:play-bold" className="w-4 h-4" />
          <span>PLAY</span>
        </button>

        {/* Mods Button */}
        <button
          onClick={handleMods}
          className="bg-black/30 hover:bg-black/40 text-white/70 hover:text-white rounded-lg px-4 py-2 flex items-center gap-2 transition-all duration-200 hover:scale-105 border border-white/10 hover:border-white/20 font-minecraft text-sm"
          title="Mods verwalten"
        >
          <Icon icon="solar:box-bold" className="w-4 h-4" />
          <span>MODS</span>
        </button>

        {/* Spacer to push settings to the right */}
        <div className="flex-1"></div>

        {/* Settings Button */}
        <button
          onClick={handleSettings}
          className="bg-black/30 hover:bg-black/40 text-white/70 hover:text-white rounded-lg p-2 flex items-center justify-center transition-all duration-200 hover:scale-105 border border-white/10 hover:border-white/20"
          title="Profil bearbeiten"
        >
          <Icon icon="solar:settings-bold" className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
