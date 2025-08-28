"use client";

import type React from "react";
import { useState, useEffect, useRef } from "react";

import type { Profile } from "../../types/profile";
import { ProfileIconV2 } from "./ProfileIconV2";
import { toast } from "react-hot-toast";
import { ProfileActionButtons, type ActionButton } from "../ui/ProfileActionButtons";
import { SettingsContextMenu, type ContextMenuItem } from "../ui/SettingsContextMenu";
import { ProfileSettings } from "./ProfileSettings";
import { useLaunchStateStore } from "../../store/launch-state-store";
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
}

export function ProfileCardV2({
  profile,
  onPlay,
  onSettings,
  onMods,
  onDelete,
  onOpenFolder,
}: ProfileCardV2Props) {
  const [isHovered, setIsHovered] = useState(false);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Settings context menu state
  const [isContextMenuOpen, setIsContextMenuOpen] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  
  // Settings modal state
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  // Settings context menu items
  const contextMenuItems: ContextMenuItem[] = [
    {
      id: "edit",
      label: "Edit Profile",
      icon: "solar:settings-bold",
      onClick: (profile) => {
        console.log("Edit Profile clicked for:", profile.name);
        setIsSettingsModalOpen(true);
      },
    },
    {
      id: "duplicate",
      label: "Duplicate",
      icon: "solar:copy-bold",
      onClick: (profile) => {
        toast.success(`📋 Duplicating ${profile.name}!`);
        console.log("Duplicating profile:", profile.name);
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
  const actionButtons: ActionButton[] = [
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
        
        // Calculate position for context menu relative to the card container
        const buttonRect = e.currentTarget.getBoundingClientRect();
        const cardRect = e.currentTarget.closest('.relative')?.getBoundingClientRect();
        
        if (cardRect) {
          setContextMenuPosition({
            x: buttonRect.right - cardRect.left - 200, // Position menu to the left of the button
            y: buttonRect.bottom - cardRect.top + 4,   // Position below the button
          });
          setIsContextMenuOpen(true);
        }
      },
    },
  ];

  return (
    <div
      className="relative flex items-center gap-4 p-3 rounded-lg bg-black/20 border border-white/10 hover:border-white/20 transition-all duration-200"
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
        <div 
          className="text-white/60 text-xs font-minecraft-ten flex items-center gap-2"
          title={
            isButtonLaunching
              ? buttonStatusMessage || currentStep || "Starting..."
              : `${profile.loader || "Vanilla"} - ${profile.game_version}`
          }
        >
          {isButtonLaunching ? (
            <span className="opacity-70">
              {buttonStatusMessage || currentStep || "Starting..."}
            </span>
          ) : (
            <>
              <img
                src={getModLoaderIcon()}
                alt={profile.loader || "Vanilla"}
                className="w-3 h-3 object-contain"
              />
              <span>
                {profile.loader || "Vanilla"} {profile.game_version}
              </span>
            </>
          )}
        </div>
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
        onClose={() => setIsContextMenuOpen(false)}
      />

      {/* Profile Settings Modal */}
      {isSettingsModalOpen && (
        <ProfileSettings
          profile={profile}
          onClose={() => setIsSettingsModalOpen(false)}
        />
      )}
    </div>
  );
}
