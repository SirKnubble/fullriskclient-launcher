"use client";

import type React from "react";
import { useState, useEffect, useRef } from "react";

import type { Profile, ResolvedLoaderVersion } from "../../types/profile";
import { ProfileIconV2 } from "./ProfileIconV2";
import { toast } from "react-hot-toast";
import { ProfileActionButtons, type ProfileActionButton } from "../ui/ProfileActionButtons";
import { SettingsContextMenu, type ContextMenuItem } from "../ui/SettingsContextMenu";
import { Icon } from "@iconify/react";
import { useProfileSettingsStore } from "../../store/profile-settings-store";
import { useProfileDuplicateStore } from "../../store/profile-duplicate-store";
import { useLaunchStateStore } from "../../store/launch-state-store";
import { useThemeStore } from "../../store/useThemeStore";
import * as ProcessService from "../../services/process-service";
import { listen, Event as TauriEvent } from "@tauri-apps/api/event";
import { EventPayload as FrontendEventPayload, EventType as FrontendEventType } from "../../types/events";
import { invoke } from "@tauri-apps/api/core";
import { LaunchState } from "../../store/launch-state-store";

interface ProfileCardV2Props {
  profile: Profile;
  onPlay?: (profile: Profile) => void;
  onSettings?: (profile: Profile) => void;
  onMods?: (profile: Profile) => void;
  onDelete?: (profileId: string, profileName: string) => void;
  onOpenFolder?: (profile: Profile) => void;
  layoutMode?: "list" | "grid" | "compact";
}

export function ProfileCardV2({
  profile,
  onPlay,
  onSettings,
  onMods,
  onDelete,
  onOpenFolder,
  layoutMode = "list",
}: ProfileCardV2Props) {
  const [isHovered, setIsHovered] = useState(false);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const accentColor = useThemeStore((state) => state.accentColor);
  const { openContextMenuId, setOpenContextMenuId } = useThemeStore();
  
  // Settings context menu state
  const [isContextMenuOpen, setIsContextMenuOpen] = useState(false);
  const contextMenuId = `profile-${profile.id}`;
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const settingsButtonRef = useRef<HTMLButtonElement>(null);
  
  // Profile settings store
  const { openModal } = useProfileSettingsStore();
  
  // Profile duplicate store
  const { openModal: openDuplicateModal } = useProfileDuplicateStore();
  
  // Resolved loader version state
  const [resolvedLoaderVersion, setResolvedLoaderVersion] = useState<ResolvedLoaderVersion | null>(null);

  // Settings context menu items
  const contextMenuItems: ContextMenuItem[] = [
    {
      id: "edit",
      label: "Edit Profile",
      icon: "solar:settings-bold",
      onClick: (profile) => {
        console.log("Edit Profile clicked for:", profile.name);
        openModal(profile);
      },
    },
    {
      id: "duplicate",
      label: "Duplicate",
      icon: "solar:copy-bold",
      onClick: (profile) => {
        console.log("Duplicate Profile clicked for:", profile.name);
        openDuplicateModal(profile);
      },
    },
    {
      id: "export",
      label: "Export",
      icon: "solar:download-bold",
      onClick: (profile) => {
        toast.success(`📤 Exporting ${profile.name}!`);
        console.log("Exporting profile:", profile.name);
      },
    },
    {
      id: "open-folder",
      label: "Open Folder",
      icon: "solar:folder-bold",
      onClick: (profile) => {
        if (onOpenFolder) {
          onOpenFolder(profile);
        } else {
          toast.success(`📁 Opening folder for ${profile.name}!`);
          console.log("Opening folder for profile:", profile.name);
        }
      },
    },
    {
      id: "delete",
      label: "Delete",
      icon: "solar:trash-bin-trash-bold",
      destructive: true,
      separator: true, // Trennstrich vor Delete
      disabled: profile.is_standard_version,
      onClick: (profile) => {
        if (onDelete) {
          onDelete(profile.id, profile.name);
        } else {
          toast.error(`🗑️ Delete ${profile.name}!`);
          console.log("Deleting profile:", profile.name);
        }
      },
    },
  ];

  // Launch state management - similar to ProfileCard.tsx and MainLaunchButton.tsx
  const { getProfileState, initializeProfile, initiateButtonLaunch, finalizeButtonLaunch, setButtonStatusMessage, setLaunchError } = useLaunchStateStore();
  const { isButtonLaunching, buttonStatusMessage, currentStep, launchState } = getProfileState(profile.id);

  useEffect(() => {
    initializeProfile(profile.id);
  }, [profile.id, initializeProfile]);

  // Close this menu if another context menu opens globally
  useEffect(() => {
    if (openContextMenuId && openContextMenuId !== contextMenuId && isContextMenuOpen) {
      setIsContextMenuOpen(false);
    }
  }, [openContextMenuId, contextMenuId, isContextMenuOpen]);





  // Fetch resolved loader version
  useEffect(() => {
    async function fetchResolvedLoaderVersion() {
      if (!profile.game_version || profile.loader === "vanilla") {
        setResolvedLoaderVersion(null);
        return;
      }

      try {
        const resolved = await invoke<ResolvedLoaderVersion>("resolve_loader_version", {
          profileId: profile.id,
          minecraftVersion: profile.game_version,
        });
        setResolvedLoaderVersion(resolved);
      } catch (err) {
        console.error("Failed to resolve loader version:", err);
        setResolvedLoaderVersion(null);
      }
    }

    fetchResolvedLoaderVersion();
  }, [profile.id, profile.game_version, profile.loader, profile.loader_version]);

  // Event listener for detailed launch status - similar to MainLaunchButton.tsx
  useEffect(() => {
    let unlistenStateEvent: (() => void) | undefined;

    const setupDetailedListener = async () => {
      console.log(`[ProfileCardV2] Setting up detailed status listener for ${profile.id}`);
      unlistenStateEvent = await listen<FrontendEventPayload>(
        "state_event",
        (event: TauriEvent<FrontendEventPayload>) => {
          if (event.payload.target_id === profile.id) {
            const eventTypeFromPayload = event.payload.event_type;
            const eventMessage = event.payload.message;

            if (eventTypeFromPayload === FrontendEventType.LaunchSuccessful) {
              console.log(`[ProfileCardV2] LaunchSuccessful event for ${profile.id}`);
              finalizeButtonLaunch(profile.id);
              setButtonStatusMessage(profile.id, "STARTING!");
              setTimeout(() => {
                setButtonStatusMessage(profile.id, null);
              }, 3000);
            } else if (eventTypeFromPayload === FrontendEventType.Error) {
              console.log(`[ProfileCardV2] Error event via state_event for ${profile.id}`);
              const eventErrorMsg = eventMessage || "Error during launch process.";
              toast.error(`Error: ${eventErrorMsg}`);
              setLaunchError(profile.id, eventErrorMsg);
            } else {
              if (eventMessage) {
                setButtonStatusMessage(profile.id, eventMessage);
              }
            }
          }
        }
      );
    };

    if (isButtonLaunching) {
      setupDetailedListener();
      if (!buttonStatusMessage) {
        setButtonStatusMessage(profile.id, "Initializing launch...");
      }
    }

    return () => {
      if (unlistenStateEvent) {
        unlistenStateEvent();
      }
    };
  }, [profile.id, isButtonLaunching, finalizeButtonLaunch, setButtonStatusMessage, setLaunchError, buttonStatusMessage]);

  // Polling for launch status - similar to MainLaunchButton.tsx
  useEffect(() => {
    const clearPolling = () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
        console.log(`[ProfileCardV2] Polling stopped for ${profile.id}`);
      }
    };

    if (isButtonLaunching && profile.id) {
      console.log(`[ProfileCardV2] Starting polling for launcher task finished for ${profile.id}`);
      pollingIntervalRef.current = setInterval(async () => {
        try {
          const isStillPhysicallyLaunching = await invoke<boolean>(
            "is_profile_launching",
            { profileId: profile.id }
          );
          const launcherTaskFinished = !isStillPhysicallyLaunching;

          if (launcherTaskFinished) {
            console.log(`[ProfileCardV2] Polling determined launcher task finished for ${profile.id}`);
            clearPolling();

            const currentProfileStateAfterPoll = getProfileState(profile.id);
            if (
              currentProfileStateAfterPoll.launchState === LaunchState.ERROR ||
              currentProfileStateAfterPoll.error
            ) {
              console.log(`[ProfileCardV2] Polling: Launch task finished, but an error was detected in store.`);
              if (currentProfileStateAfterPoll.isButtonLaunching) {
                finalizeButtonLaunch(
                  profile.id,
                  currentProfileStateAfterPoll.error || "Unknown error after completion."
                );
              }
            } else {
              console.log(`[ProfileCardV2] Polling: Launch task finished successfully.`);
              if (currentProfileStateAfterPoll.isButtonLaunching) {
                finalizeButtonLaunch(profile.id);
              }
            }
          }
        } catch (err: any) {
          console.error(`[ProfileCardV2] Error during polling is_profile_launching:`, err);
          const pollErrorMsg =
            err.message || err.toString() || "Error while checking profile status.";
          toast.error(`Polling error: ${pollErrorMsg}`);
          finalizeButtonLaunch(profile.id, pollErrorMsg);
          clearPolling();
        }
      }, 1500);
    } else {
      clearPolling();
    }

    return clearPolling;
  }, [profile.id, isButtonLaunching, finalizeButtonLaunch, getProfileState]);

  // Get mod loader icon - reused from ProfileCard.tsx
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

  // Format last played date
  const formatLastPlayed = (lastPlayed: string | null): string => {
    if (!lastPlayed) return "Never played";
    
    const date = new Date(lastPlayed);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    const diffInHours = Math.floor(diffInMinutes / 60);
    const diffInDays = Math.floor(diffInHours / 24);
    const diffInWeeks = Math.floor(diffInDays / 7);
    const diffInMonths = Math.floor(diffInDays / 30);
    const diffInYears = Math.floor(diffInDays / 365);
    
    if (diffInMinutes < 1) return "Just now";
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInHours < 24) return `${diffInHours}h ago`;
    if (diffInDays < 7) return `${diffInDays}d ago`;
    if (diffInWeeks < 4) return `${diffInWeeks}w ago`;
    if (diffInMonths < 12) return `${diffInMonths}mo ago`;
    
    return `${diffInYears}y ago`;
  };

  // Launch handler with abort functionality - similar to LaunchButton.tsx
  const handleLaunch = async (profile: Profile) => {
    const currentProfile = getProfileState(profile.id);

    if (currentProfile.isButtonLaunching) {
      try {
        setButtonStatusMessage(profile.id, "Attempting to stop...");
        await ProcessService.abort(profile.id);
        toast.success("Launch process stopped.");
        finalizeButtonLaunch(profile.id);
      } catch (err: any) {
        console.error("Failed to abort launch:", err);
        const abortErrorMsg =
          typeof err === "string"
            ? err
            : err.message || err.toString() || "Error during abort.";
        toast.error(`Stop failed: ${abortErrorMsg}`);
        finalizeButtonLaunch(profile.id, abortErrorMsg);
      }
      return;
    }

    initiateButtonLaunch(profile.id);

    try {
      await ProcessService.launch(profile.id);
    } catch (err: any) {
      console.error("Failed to launch profile:", err);
      const launchErrorMsg =
        typeof err === "string"
          ? err
          : err.message || err.toString() || "Unknown error during launch.";
      toast.error(`Launch failed: ${launchErrorMsg}`);
      setLaunchError(profile.id, launchErrorMsg);
    }
  };

  // Action button configuration
  const actionButtons: ProfileActionButton[] = [
    {
      id: "play",
      label: isButtonLaunching ? "STOP" : "PLAY",
      icon: isButtonLaunching ? "solar:stop-bold" : "solar:play-bold",
      variant: isButtonLaunching ? "destructive" : "primary",
      tooltip: isButtonLaunching ? "Launch stoppen" : "Minecraft spielen!",
      onClick: (profile, e) => {
        if (onPlay) {
          onPlay(profile);
        } else {
          handleLaunch(profile);
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
      tooltip: "Profil Optionen",
             onClick: (profile, e) => {
         e.preventDefault();
         e.stopPropagation();
         
         // Close any other open context menus first
         if (openContextMenuId && openContextMenuId !== contextMenuId) {
           setOpenContextMenuId(null);
         }
         
         // Simple toggle like CustomDropdown
         const newState = !isContextMenuOpen;
         setIsContextMenuOpen(newState);
         setOpenContextMenuId(newState ? contextMenuId : null);
         
         // Calculate position when opening
         if (!isContextMenuOpen) {
           const buttonRect = e.currentTarget.getBoundingClientRect();
           const cardRect = e.currentTarget.closest('.relative')?.getBoundingClientRect();
           
           if (cardRect) {
             setContextMenuPosition({
               x: buttonRect.right - cardRect.left - 200, // Position menu to the left of the button
               y: buttonRect.bottom - cardRect.top + 4,   // Position below the button
             });
           }
         }
       },
    },
  ];

    // Grid layout (more compact, similar to ProfileCard.tsx)
  if (layoutMode === "grid" || layoutMode === "compact") {
    const isCompact = layoutMode === "compact";
    const iconSize = isCompact ? 16 : 20; // Smaller icons for compact mode
    const padding = isCompact ? "p-3" : "p-4"; // Less padding for compact mode
    const gap = isCompact ? "gap-2" : "gap-3"; // Smaller gaps for compact mode
    
    return (
      <div
        className={`relative flex flex-col ${gap} ${padding} rounded-lg bg-black/20 border border-white/10 hover:border-white/20 transition-all duration-200 cursor-pointer`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={(e) => {
          // Don't trigger if clicking on action buttons or play overlay
          const target = e.target as Element;
          if (e.target === e.currentTarget || (!target.closest('button') && !target.closest('.play-overlay'))) {
            if (onMods) {
              onMods(profile);
            } else {
              toast.success(`📦 Managing mods for ${profile.name}!`);
              console.log("Managing mods for profile:", profile.name);
            }
          }
        }}
      >
        {/* Action buttons - top right */}
        <div className={`absolute ${isCompact ? 'top-2 right-2' : 'top-3 right-3'} z-20 flex flex-col gap-1`}>
          {/* Settings button */}
          <button
            ref={settingsButtonRef}
                         onClick={(e) => {
               e.preventDefault();
               e.stopPropagation();
               
               // Close any other open context menus first
               if (openContextMenuId && openContextMenuId !== contextMenuId) {
                 setOpenContextMenuId(null);
               }
               
               // Simple toggle like CustomDropdown
               const newState = !isContextMenuOpen;
               setIsContextMenuOpen(newState);
               setOpenContextMenuId(newState ? contextMenuId : null);
               
               // Calculate position when opening
               if (!isContextMenuOpen) {
                 const buttonRect = e.currentTarget.getBoundingClientRect();
                 const cardRect = e.currentTarget.closest('.relative')?.getBoundingClientRect();
                 
                 if (cardRect) {
                   setContextMenuPosition({
                     x: buttonRect.right - cardRect.left - 200, // Position menu to the left of the button
                     y: buttonRect.bottom - cardRect.top + 4,   // Position below the button
                   });
                 }
               }
             }}
            className={`${isCompact ? 'w-6 h-6' : 'w-8 h-8'} flex items-center justify-center bg-black/30 hover:bg-black/50 text-white/70 hover:text-white border border-white/10 hover:border-white/20 rounded transition-all duration-200`}
            title="Profile Options"
            data-action="settings"
          >
            <Icon icon="solar:settings-bold" className={isCompact ? 'w-3 h-3' : 'w-4 h-4'} />
          </button>
          
          {/* Mods button */}
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (onMods) {
                onMods(profile);
              } else {
                toast.success(`📦 Managing mods for ${profile.name}!`);
                console.log("Managing mods for profile:", profile.name);
              }
            }}
            className={`${isCompact ? 'w-6 h-6' : 'w-8 h-8'} flex items-center justify-center bg-black/30 hover:bg-black/50 text-white/70 hover:text-white border border-white/10 hover:border-white/20 rounded transition-all duration-200`}
            title="Manage Mods"
          >
            <Icon icon="solar:box-bold" className={isCompact ? 'w-3 h-3' : 'w-4 h-4'} />
          </button>
        </div>

        {/* Profile content */}
        <div className={`flex items-center ${isCompact ? 'gap-3' : 'gap-4'} relative z-10 w-full`}>
          <div className={`relative ${isCompact ? 'w-16 h-16' : 'w-20 h-20'} flex-shrink-0 rounded-lg flex items-center justify-center overflow-hidden border-2 transition-all duration-200`}
            style={{
              backgroundColor: isHovered ? `${accentColor.value}20` : 'transparent',
              borderColor: isHovered ? `${accentColor.value}60` : 'transparent',
            }}
          >
            <ProfileIconV2 profile={profile} size={isCompact ? "md" : "lg"} className="w-full h-full" />
            
            {/* Play button overlay - similar to ProfileCard.tsx */}
            {(isButtonLaunching || isHovered) && (
              <div className="play-overlay absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm transition-opacity duration-150 cursor-pointer rounded-lg">
                <button
                  onClick={() => handleLaunch(profile)}
                  className={`${isCompact ? 'w-8 h-8' : 'w-12 h-12'} flex items-center justify-center text-white hover:text-white/80 transition-colors`}
                  disabled={false}
                >
                  {isButtonLaunching ? (
                    <Icon icon="solar:stop-bold" className={isCompact ? 'w-6 h-6' : 'w-8 h-8'} />
                  ) : (
                    <Icon icon="solar:play-bold" className={isCompact ? 'w-6 h-6' : 'w-8 h-8'} />
                  )}
                </button>
              </div>
            )}
          </div>

          <div className={`flex-grow min-w-0 mr-auto pr-2 ${isCompact ? 'max-w-[calc(100%-64px)]' : 'max-w-[calc(100%-80px)]'}`}>
            <h3
              className={`font-minecraft-ten text-white ${isCompact ? 'text-base' : 'text-lg'} whitespace-nowrap overflow-hidden text-ellipsis max-w-full normal-case`}
              title={profile.name}
            >
              {profile.name}
            </h3>
            {isButtonLaunching ? (
              <div className="text-white/60 text-xs font-minecraft-ten opacity-70 whitespace-nowrap overflow-hidden text-ellipsis max-w-full">
                {buttonStatusMessage || currentStep || "Starting..."}
              </div>
            ) : (
              isCompact ? (
                 // Compact mode: Only MC version + last played
                 <div className="flex items-center gap-1.5 text-xs font-minecraft-ten">
                   {/* Minecraft Version */}
                   <div className="text-white/70 flex items-center gap-0.5">
                     <img
                       src="/icons/minecraft.png"
                       alt="Minecraft"
                       className="w-2.5 h-2.5 object-contain"
                     />
                     <span>{profile.game_version}</span>
                   </div>
                   
                   <div className="w-px h-2.5 bg-white/30"></div>
                   
                   {/* Last Played */}
                   <div className="text-white/50">
                     {formatLastPlayed(profile.last_played)}
                   </div>
                 </div>
               ) : (
                 // Grid mode: Full info display
                 <div className="flex items-center gap-2 text-xs font-minecraft-ten">
                   {/* Minecraft Version */}
                   <div className="text-white/70 flex items-center gap-1">
                     <img
                       src="/icons/minecraft.png"
                       alt="Minecraft"
                       className="w-3 h-3 object-contain"
                     />
                     <span>{profile.game_version}</span>
                   </div>
                   
                   <div className="w-px h-3 bg-white/30"></div>
                   
                   {/* Loader Version */}
                   <div className="text-white/60 flex items-center gap-1">
                     <img
                       src={getModLoaderIcon()}
                       alt={profile.loader || "Vanilla"}
                       className="w-3 h-3 object-contain"
                     />
                     <span>
                       {profile.loader === "vanilla" 
                         ? "Vanilla" 
                         : `${resolvedLoaderVersion?.version || profile.loader_version || "Unknown"}`
                       }
                     </span>
                   </div>
                   
                   <div className="w-px h-3 bg-white/30"></div>
                   
                   {/* Last Played */}
                   <div className="text-white/50">
                     {formatLastPlayed(profile.last_played)}
                   </div>
                 </div>
               )
            )}
          </div>
        </div>

        {/* Settings Context Menu */}
                 <SettingsContextMenu
           profile={profile}
           isOpen={isContextMenuOpen}
           position={contextMenuPosition}
           items={contextMenuItems}
           onClose={() => {
             setIsContextMenuOpen(false);
             setOpenContextMenuId(null);
           }}
           triggerButtonRef={settingsButtonRef}
         />
      </div>
    );
  }

  // List layout (original layout)
  return (
    <div
      className="relative flex items-center gap-4 p-3 rounded-lg bg-black/20 border border-white/10 hover:border-white/20 transition-all duration-200 cursor-pointer"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={(e) => {
        // Don't trigger if clicking on action buttons
        const target = e.target as Element;
        if (e.target === e.currentTarget || !target.closest('button')) {
          if (onMods) {
            onMods(profile);
          } else {
            toast.success(`📦 Managing mods for ${profile.name}!`);
            console.log("Managing mods for profile:", profile.name);
          }
        }
      }}
    >
      {/* Profile Icon */}
      <ProfileIconV2 profile={profile} size="md" />

      {/* Profile Info */}
      <div className="flex-1 min-w-0">
        <h3 
          className="text-white font-minecraft-ten text-sm whitespace-nowrap overflow-hidden text-ellipsis normal-case mb-1"
          title={profile.name}
        >
          {profile.name}
        </h3>
        
        {isButtonLaunching ? (
          <div className="text-white/60 text-xs font-minecraft-ten opacity-70 whitespace-nowrap overflow-hidden text-ellipsis max-w-full">
            {buttonStatusMessage || currentStep || "Starting..."}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs font-minecraft-ten">
          {/* Minecraft Version */}
          <div className="text-white/70 flex items-center gap-1">
            <img
              src="/icons/minecraft.png"
              alt="Minecraft"
              className="w-3 h-3 object-contain"
            />
            <span>{profile.game_version}</span>
          </div>
          
          <div className="w-px h-3 bg-white/30"></div>
          
          {/* Loader Version */}
          <div className="text-white/60 flex items-center gap-1">
            <img
              src={getModLoaderIcon()}
              alt={profile.loader || "Vanilla"}
              className="w-3 h-3 object-contain"
            />
            <span>
              {profile.loader === "vanilla" 
                ? "Vanilla" 
                : `${resolvedLoaderVersion?.version || profile.loader_version || "Unknown"}`
              }
            </span>
          </div>
          
          <div className="w-px h-3 bg-white/30"></div>
          
          {/* Last Played */}
          <div className="text-white/50">
            {formatLastPlayed(profile.last_played)}
          </div>
        </div>
        )}
      </div>

      {/* Action Buttons */}
      <ProfileActionButtons
        profile={profile}
        actions={actionButtons}
        useFlexSpacer={true}
        flexSpacerAfterIndex={1}
      />

             {/* Settings Context Menu */}
       <SettingsContextMenu
         profile={profile}
         isOpen={isContextMenuOpen}
         position={contextMenuPosition}
         items={contextMenuItems}
         onClose={() => {
           setIsContextMenuOpen(false);
           setOpenContextMenuId(null);
         }}
         triggerButtonRef={undefined} // List layout doesn't have direct button ref
       />


    </div>
  );
}
