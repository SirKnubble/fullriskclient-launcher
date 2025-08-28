"use client";

import { useEffect, useState } from "react";
import type { Profile } from "../../types/profile";
import { useProfileStore } from "../../store/profile-store";
import { LoadingState } from "../ui/LoadingState";
import { EmptyState } from "../ui/EmptyState";

import { ProfileCardV2 } from "../profiles/ProfileCardV2";
import { Icon } from "@iconify/react";
import { toast } from "react-hot-toast";
import { SearchWithFilters } from "../ui/SearchWithFilters";
import { GroupTabs, type GroupTab } from "../ui/GroupTabs";

export function ProfilesTabV2() {
  const {
    profiles,
    loading,
    error,
    fetchProfiles,
  } = useProfileStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("name");
  const [versionFilter, setVersionFilter] = useState("all");
  const [activeGroup, setActiveGroup] = useState("all");
  const [showAddGroup, setShowAddGroup] = useState(false);
  
  // Calculate group counts based on current search/filter
  const getFilteredCountForGroup = (groupId: string) => {
    if (groupId === "all") return profiles.length;
    const groupName = groupId === "nrc" ? "NORISK CLIENT" : 
                     groupId === "server" ? "SERVER" : 
                     groupId === "modpacks" ? "MODPACKS" : "";
    return profiles.filter(p => p.group === groupName).length;
  };

  const groups: GroupTab[] = [
    { id: "all", name: "All", count: getFilteredCountForGroup("all") },
    { id: "nrc", name: "NRC", count: getFilteredCountForGroup("nrc") },
    { id: "server", name: "SERVER", count: getFilteredCountForGroup("server") },
    { id: "modpacks", name: "MODPACKS", count: getFilteredCountForGroup("modpacks") },
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

  // Filter profiles based on search query, active group, and version filter
  const filteredProfiles = profiles.filter((profile) => {
    // Search filter
    const matchesSearch = searchQuery === "" || 
      profile.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (profile.group && profile.group.toLowerCase().includes(searchQuery.toLowerCase()));
    
    // Group filter
    const matchesGroup = activeGroup === "all" || 
      (activeGroup === "nrc" && profile.group === "NORISK CLIENT") ||
      (activeGroup === "server" && profile.group === "SERVER") ||
      (activeGroup === "modpacks" && profile.group === "MODPACKS");
    
    // Version filter (simplified for now)
    const matchesVersion = versionFilter === "all" || 
      profile.game_version?.includes(versionFilter);
    
    return matchesSearch && matchesGroup && matchesVersion;
  });

  // Sort filtered profiles
  const sortedProfiles = [...filteredProfiles].sort((a, b) => {
    switch (sortBy) {
      case "name":
        return a.name.localeCompare(b.name);
      case "last_played":
        // Convert string dates to timestamps for comparison
        const aTimestamp = a.last_played ? new Date(a.last_played).getTime() : 0;
        const bTimestamp = b.last_played ? new Date(b.last_played).getTime() : 0;
        return bTimestamp - aTimestamp;
      case "date_created":
        // Convert string dates to timestamps for comparison
        const aCreated = new Date(a.created).getTime();
        const bCreated = new Date(b.created).getTime();
        return bCreated - aCreated;
      default:
        return a.name.localeCompare(b.name);
    }
  });

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-1 p-6 overflow-y-auto no-scrollbar">
      {/* Group Tabs */}
      <GroupTabs
        groups={groups}
        activeGroup={activeGroup}
        onGroupChange={setActiveGroup}
        onAddGroup={() => setShowAddGroup(true)}
      />

      {/* Search & Filter Header */}
      <div className="mb-6 pb-4 border-b border-white/10">
        <SearchWithFilters
          placeholder="Search profiles..."
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
          sortOptions={[
            { value: "name", label: "Name", icon: "solar:text-bold" },
            { value: "last_played", label: "Last played", icon: "solar:clock-circle-bold" },
            { value: "date_created", label: "Date created", icon: "solar:calendar-add-bold" },
          ]}
          sortValue={sortBy}
          onSortChange={setSortBy}
          filterOptions={[
            { value: "all", label: "All versions", icon: "solar:layers-bold" },
            { value: "1.21", label: "1.21.x", icon: "solar:gamepad-bold" },
            { value: "1.20", label: "1.20.x", icon: "solar:gamepad-bold" },
            { value: "1.19", label: "1.19.x", icon: "solar:gamepad-bold" },
          ]}
          filterValue={versionFilter}
          onFilterChange={setVersionFilter}
        />
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
      </div>
    </div>
  );
}
