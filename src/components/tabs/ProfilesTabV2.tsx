"use client";

import { useEffect, useState } from "react";
import type { Profile } from "../../types/profile";
import { useProfileStore } from "../../store/profile-store";
import { LoadingState } from "../ui/LoadingState";
import { EmptyState } from "../ui/EmptyState";
import { useThemeStore } from "../../store/useThemeStore";
import { ProfileCardV2 } from "../profiles/ProfileCardV2";
import { Icon } from "@iconify/react";
import { toast } from "react-hot-toast";
import { CustomDropdown } from "../ui/CustomDropdown";

export function ProfilesTabV2() {
  const {
    profiles,
    loading,
    error,
    fetchProfiles,
  } = useProfileStore();

  const accentColor = useThemeStore((state) => state.accentColor);
  const [sortBy, setSortBy] = useState("name");
  const [versionFilter, setVersionFilter] = useState("all");
  const [activeGroup, setActiveGroup] = useState("all");
  const [showAddGroup, setShowAddGroup] = useState(false);
  
  const groups = [
    { id: "all", name: "All", count: profiles.length },
    { id: "nrc", name: "NRC", count: profiles.filter(p => p.group === "NORISK CLIENT").length },
    { id: "server", name: "SERVER", count: profiles.filter(p => p.group === "SERVER").length },
    { id: "modpacks", name: "MODPACKS", count: profiles.filter(p => p.group === "MODPACKS").length },
  ];

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  const handlePlay = (profile: Profile) => {
    toast.success(`🎮 Starting ${profile.name}!`);
    console.log("Starting game with profile:", profile.name);
    // TODO: Add actual game launch logic
  };

  const handleSettings = (profile: Profile) => {
    toast.success(`⚙️ Opening settings for ${profile.name}!`);
    console.log("Opening settings for profile:", profile.name);
    // TODO: Add settings navigation logic
  };

  const handleMods = (profile: Profile) => {
    toast.success(`📦 Managing mods for ${profile.name}!`);
    console.log("Managing mods for profile:", profile.name);
    // TODO: Add mods management logic
  };

  if (loading) {
    return <LoadingState message="Loading profiles..." />;
  }

  if (error) {
    return (
      <EmptyState
        icon="solar:danger-triangle-bold"
        message={error || ""}
      />
    );
  }

  if (profiles.length === 0) {
    return (
      <EmptyState
        icon="solar:widget-bold"
        message="No profiles found"
      />
    );
  }

  const sortedProfiles = [...profiles].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="p-6">
      {/* Group Tabs */}
      <div className="mb-4">
        <div className="flex items-center gap-2 flex-wrap">
          {groups.map((group) => (
            <button
              key={group.id}
              onClick={() => setActiveGroup(group.id)}
              className={`px-4 py-2 rounded-lg font-minecraft text-sm transition-all duration-200 flex items-center gap-2 ${
                activeGroup === group.id
                  ? 'text-white border-2'
                  : 'text-white/70 bg-black/30 hover:bg-black/40 border border-white/10 hover:border-white/20'
              }`}
              style={{
                backgroundColor: activeGroup === group.id ? `${accentColor.value}20` : undefined,
                borderColor: activeGroup === group.id ? accentColor.value : undefined,
              }}
            >
              <span className="uppercase">{group.name}</span>
              <span 
                className="px-2 py-0.5 rounded-full text-xs bg-white/10"
                style={{
                  backgroundColor: activeGroup === group.id ? `${accentColor.value}30` : undefined,
                }}
              >
                {group.count}
              </span>
            </button>
          ))}
          
          {/* Add Group Button */}
          <button
            onClick={() => setShowAddGroup(true)}
            className="px-3 py-2 rounded-lg border border-dashed border-white/30 hover:border-white/50 text-white/50 hover:text-white/70 transition-all duration-200 flex items-center gap-2"
          >
            <Icon icon="solar:add-circle-bold" className="w-4 h-4" />
            <span className="font-minecraft text-sm">ADD GROUP</span>
          </button>
        </div>
      </div>

      {/* Search & Filter Header */}
      <div className="mb-6 pb-4 border-b border-white/10">
        <div className="flex items-center gap-4">
          {/* Search with integrated filters */}
          <div className="flex items-center gap-2 bg-black/50 rounded-lg px-4 py-3 border border-white/10 hover:border-white/20 transition-colors flex-1 max-w-md">
            <Icon icon="solar:magnifer-bold" className="w-4 h-4 text-white/50" />
            <input
              type="text"
              placeholder="Search profiles..."
              className="bg-transparent text-white placeholder-white/50 font-minecraft text-sm flex-1 outline-none"
            />
            
            {/* Separator */}
            <div className="h-4 w-px bg-white/20 mx-2"></div>
            
            {/* Sort Filter Button */}
            <div className="relative">
              <CustomDropdown
                label=""
                value={sortBy}
                onChange={setSortBy}
                options={[
                  { value: "name", label: "Name", icon: "solar:text-bold" },
                  { value: "last_played", label: "Last played", icon: "solar:clock-circle-bold" },
                  { value: "date_created", label: "Date created", icon: "solar:calendar-add-bold" },
                ]}
                className="w-auto"
              />
            </div>
            
            {/* Separator */}
            <div className="h-4 w-px bg-white/20 mx-2"></div>
            
            {/* Version Filter Button */}
            <div className="relative">
              <CustomDropdown
                label=""
                value={versionFilter}
                onChange={setVersionFilter}
                options={[
                  { value: "all", label: "All versions", icon: "solar:layers-bold" },
                  { value: "1.21", label: "1.21.x", icon: "solar:gamepad-bold" },
                  { value: "1.20", label: "1.20.x", icon: "solar:gamepad-bold" },
                  { value: "1.19", label: "1.19.x", icon: "solar:gamepad-bold" },
                ]}
                className="w-auto"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Profile list */}
      <div className="space-y-3">
        {sortedProfiles.map((profile) => (
          <ProfileCardV2
            key={profile.id}
            profile={profile}
            onPlay={handlePlay}
            onSettings={handleSettings}
            onMods={handleMods}
          />
        ))}
      </div>

      {/* Bottom tip */}
      <div className="mt-8 text-center text-white/60 text-sm">
        <Icon icon="solar:lightbulb-bold" className="w-4 h-4 inline mr-1" />
        Tipp: Jedes Profil hat drei bunte Buttons - probier sie aus!
      </div>
    </div>
  );
}
