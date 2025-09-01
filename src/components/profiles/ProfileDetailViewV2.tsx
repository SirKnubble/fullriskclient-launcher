"use client";

import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "@iconify/react";
import type { Profile } from "../../types/profile";
import { ProfileIconV2 } from "./ProfileIconV2";
import { useThemeStore } from "../../store/useThemeStore";
import { Button } from "../ui/buttons/Button";
import { IconButton } from "../ui/buttons/IconButton";
import { ActionButtons, type ActionButton } from "../ui/ActionButtons";
import { ActionButton as SingleActionButton } from "../ui/ActionButton";
import { GroupTabs, type GroupTab } from "../ui/GroupTabs";
import { LocalContentTabV2 } from "./detail/v2/LocalContentTabV2";

import { WorldsTab } from "./detail/WorldsTab";
import { ScreenshotsTab } from "./detail/ScreenshotsTab";
import { LogsTab } from "./detail/LogsTab";
import type { LocalContentItem } from "../../hooks/useLocalContentManager";

type MainTabType = "content" | "worlds" | "logs" | "screenshots";
type ContentTabType = "mods" | "resourcepacks" | "datapacks" | "shaderpacks" | "nrc";

interface ProfileDetailViewV2Props {
  profile: Profile;
  onClose: () => void;
  onEdit: () => void;
}

export function ProfileDetailViewV2({
  profile,
  onClose,
  onEdit,
}: ProfileDetailViewV2Props) {
  const navigate = useNavigate();
  const [currentProfile, setCurrentProfile] = useState<Profile>(profile);
  const [activeMainTab, setActiveMainTab] = useState<MainTabType>("content");
  const [activeContentTab, setActiveContentTab] = useState<ContentTabType>("mods");
  const accentColor = useThemeStore((state) => state.accentColor);

  // Memoized callback for getDisplayFileName
  const getGenericDisplayFileName = useCallback((item: LocalContentItem) => item.filename, []);

  // Handler for refreshing profile data
  const handleRefresh = useCallback(() => {
    // Profile refresh logic would go here
    console.log("Refreshing profile data");
  }, []);

  // Handler for browse content requests
  const handleBrowseContent = useCallback((contentType: string) => {
    console.log("Browse content requested for:", contentType);
    // Navigate to the browse route instead of just changing the tab
    navigate(`/profilesv2/${profile.id}/browse/${contentType}`);
  }, [navigate, profile.id]);

  // Effect to synchronize the internal currentProfile state with the profile prop
  useEffect(() => {
    setCurrentProfile(profile);
  }, [profile]);

  // Get mod loader icon
  const getModLoaderIcon = () => {
    switch (profile.loader) {
      case "fabric":
        return "/icons/fabric.png";
      case "forge":
        return "/icons/forge.png";
      case "quilt":
        return "/icons/quilt.png";
      case "neoforge":
        return "/icons/neoforge.png";
      default:
        return "/icons/minecraft.png";
    }
  };

  // Main tabs configuration
  const mainTabs: GroupTab[] = [
    { id: "content", name: "Content", count: 0, icon: "solar:widget-bold" },
    { id: "worlds", name: "Worlds", count: 0, icon: "solar:planet-bold" },
    { id: "screenshots", name: "Screenshots", count: 0, icon: "solar:camera-bold" },
    { id: "logs", name: "Logs", count: 0, icon: "solar:code-bold" },
  ];



  // Action buttons configuration similar to ProfilesTabV2
  const actionButtons: ActionButton[] = [
    {
      id: "back",
      label: "BACK",
      icon: "solar:arrow-left-bold",
      tooltip: "Back to profiles",
      onClick: () => onClose(),
    },
    {
      id: "play",
      label: "PLAY",
      icon: "solar:play-bold",
      tooltip: "Start playing",
      onClick: () => {
        // TODO: Implement play functionality
        console.log("Play button clicked");
      },
    },
    {
      id: "settings",
      label: "SETTINGS",
      icon: "solar:settings-bold",
      tooltip: profile.is_standard_version ? "Java Settings" : "Edit profile",
      onClick: () => onEdit(),
    },
  ];

  return (
    <div className="h-full flex flex-col overflow-hidden p-4 relative">
      <div className={`flex-1 ${activeMainTab === "logs" ? "flex flex-col min-h-0" : "overflow-y-auto no-scrollbar"}`}>
        {/* Profile Header Section */}
        <div className="mb-1 flex-shrink-0">
          <div className="flex items-center gap-4 mb-4">
            {/* Profile Icon */}
            <div className="relative">
              <ProfileIconV2
                profile={currentProfile}
                size="lg"
                className="w-16 h-16"
              />
            </div>

            {/* Profile Details */}
            <div className="flex flex-col gap-2 flex-1">
              {/* Profile Name */}
              <h1 className="font-minecraft-ten text-2xl text-white normal-case">
                {profile.name || profile.id}
              </h1>

              {/* Game Info */}
              <div className="flex items-center gap-3 text-sm font-minecraft-ten">
                {/* Minecraft Version */}
                <div className="text-white/70 flex items-center gap-2">
                  <img
                    src="/icons/minecraft.png"
                    alt="Minecraft"
                    className="w-4 h-4 object-contain"
                  />
                  <span>{profile.game_version}</span>
                </div>

                {/* Loader Info (if not vanilla) */}
                {profile.loader && profile.loader !== "vanilla" && (
                  <>
                    <div className="w-px h-4 bg-white/30"></div>
                    <div className="text-white/60 flex items-center gap-2">
                      <img
                        src={getModLoaderIcon()}
                        alt={profile.loader}
                        className="w-4 h-4 object-contain"
                        onError={(e) => {
                          e.currentTarget.src = "/icons/minecraft.png";
                        }}
                      />
                      <span className="capitalize">{profile.loader}</span>
                      {profile.loader_version && (
                        <span className="text-white/50">
                          {profile.loader_version}
                        </span>
                      )}
                    </div>
                  </>
                )}

                {/* Profile Group (if exists) */}
                {profile.group && (
                  <>
                    <div className="w-px h-4 bg-white/30"></div>
                    <div className="text-white/50 flex items-center gap-1">
                      <Icon icon="solar:folder-bold" className="w-3 h-3" />
                      <span className="uppercase text-xs tracking-wide">
                        {profile.group}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Action Buttons - Right side of the header row */}
            <div className="flex items-center gap-3">
              <ActionButtons actions={actionButtons.filter(btn => btn.id !== 'back')} />
            </div>
          </div>

          {/* Divider under profile info */}
          <div className="h-px w-full bg-white/10 mt-4 mb-4" />

          {/* Main Tabs Navigation - under divider */}
          <div className="flex-shrink-0">
            <GroupTabs
              groups={mainTabs}
              activeGroup={activeMainTab}
              onGroupChange={(tabId) => setActiveMainTab(tabId as MainTabType)}
              showAddButton={false}
            />
          </div>
        </div>



        {/* Content Area */}
        <div className="flex-1 min-h-0">
          {activeMainTab === "content" && (
            <div>
              {/* Content Type Tabs */}
              <div className="flex items-center gap-4 mb-4">
                <SingleActionButton 
                  label="MODS" 
                  variant={activeContentTab === "mods" ? "highlight" : "text"} 
                  icon="solar:widget-bold" 
                  size="sm" 
                  onClick={() => setActiveContentTab("mods")} 
                />
                <div className="w-px h-4 bg-white/20"></div>
                <SingleActionButton 
                  label="RESOURCEPACKS" 
                  variant={activeContentTab === "resourcepacks" ? "highlight" : "text"} 
                  icon="solar:palette-bold" 
                  size="sm" 
                  onClick={() => setActiveContentTab("resourcepacks")} 
                />
                <div className="w-px h-4 bg-white/20"></div>
                <SingleActionButton 
                  label="DATAPACKS" 
                  variant={activeContentTab === "datapacks" ? "highlight" : "text"} 
                  icon="solar:database-bold" 
                  size="sm" 
                  onClick={() => setActiveContentTab("datapacks")} 
                />
                <div className="w-px h-4 bg-white/20"></div>
                <SingleActionButton 
                  label="SHADERPACKS" 
                  variant={activeContentTab === "shaderpacks" ? "highlight" : "text"} 
                  icon="solar:sun-bold" 
                  size="sm" 
                  onClick={() => setActiveContentTab("shaderpacks")} 
                />
                <div className="w-px h-4 bg-white/20"></div>
                <SingleActionButton 
                  label="NRC" 
                  variant={activeContentTab === "nrc" ? "highlight" : "text"} 
                  icon="solar:shield-check-bold" 
                  size="sm" 
                  onClick={() => setActiveContentTab("nrc")} 
                />
              </div>
              {activeContentTab === "mods" && (
                <LocalContentTabV2<LocalContentItem>
                  profile={currentProfile}
                  contentType="Mod"
                  getDisplayFileName={getGenericDisplayFileName}
                  itemTypeName="mod"
                  itemTypeNamePlural="mods"
                  addContentButtonText="Add Mods"
                  emptyStateIconOverride="solar:bolt-bold-duotone"
                  onRefreshRequired={handleRefresh}
                  onBrowseContentRequest={handleBrowseContent}
                />
              )}
              
              {activeContentTab === "resourcepacks" && (
                <LocalContentTabV2<LocalContentItem>
                  profile={currentProfile}
                  contentType="ResourcePack"
                  getDisplayFileName={getGenericDisplayFileName}
                  itemTypeName="resource pack"
                  itemTypeNamePlural="resource packs"
                  addContentButtonText="Add Resource Packs"
                  emptyStateIconOverride="solar:gallery-bold-duotone"
                  onRefreshRequired={handleRefresh}
                  onBrowseContentRequest={handleBrowseContent}
                />
              )}
              
              {activeContentTab === "datapacks" && (
                <LocalContentTabV2<LocalContentItem>
                  profile={currentProfile}
                  contentType="DataPack"
                  getDisplayFileName={getGenericDisplayFileName}
                  itemTypeName="data pack"
                  itemTypeNamePlural="data packs"
                  addContentButtonText="Add Data Packs"
                  emptyStateIconOverride="solar:database-bold-duotone"
                  onRefreshRequired={handleRefresh}
                  onBrowseContentRequest={handleBrowseContent}
                />
              )}
              
              {activeContentTab === "shaderpacks" && (
                <LocalContentTabV2<LocalContentItem>
                  profile={currentProfile}
                  contentType="ShaderPack"
                  getDisplayFileName={getGenericDisplayFileName}
                  itemTypeName="shader pack"
                  itemTypeNamePlural="shader packs"
                  addContentButtonText="Add Shader Packs"
                  emptyStateIconOverride="solar:sun-bold-duotone"
                  onRefreshRequired={handleRefresh}
                  onBrowseContentRequest={handleBrowseContent}
                />
              )}
              
              {activeContentTab === "nrc" && (
                <LocalContentTabV2<LocalContentItem>
                  profile={currentProfile}
                  contentType="NoRiskMod"
                  getDisplayFileName={getGenericDisplayFileName}
                  itemTypeName="NoRisk Mod"
                  itemTypeNamePlural="NoRisk Mods"
                  addContentButtonText="Add NoRisk Mods"
                  emptyStateIconOverride="solar:shield-check-bold-duotone"
                  onRefreshRequired={handleRefresh}
                  onBrowseContentRequest={handleBrowseContent}
                />
              )}
            </div>
          )}

          {activeMainTab === "worlds" && (
            <div className="h-full">
              <WorldsTab
                profile={currentProfile}
                onRefresh={handleRefresh}
                isActive={true}
              />
            </div>
          )}
          
          {activeMainTab === "screenshots" && (
            <div className="h-full">
              <ScreenshotsTab
                profile={currentProfile}
                isActive={true}
                onOpenScreenshotModal={(screenshot) => {
                  // TODO: Implement screenshot modal using global modal system
                  console.log("Open screenshot modal for:", screenshot);
                }}
              />
            </div>
          )}
          
          {activeMainTab === "logs" && (
            <div className="h-full">
              <LogsTab
                profile={currentProfile}
                isActive={true}
                onRefresh={handleRefresh}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
