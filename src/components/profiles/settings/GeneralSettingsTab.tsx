"use client";

import { useEffect, useRef, useState } from "react";
import type { Profile } from "../../../types/profile";
import { useThemeStore } from "../../../store/useThemeStore";
import { SearchStyleInput } from "../../ui/Input";
import { Checkbox } from "../../ui/Checkbox";
import { gsap } from "gsap";
import { ProfileIcon } from "../ProfileIcon";

interface GeneralSettingsTabProps {
  profile: Profile;
  editedProfile: Profile;
  updateProfile: (updates: Partial<Profile>) => void;
  onRefresh?: () => Promise<Profile>;
  onDelete?: () => void;
  isDeleting?: boolean;
}



export function GeneralSettingsTab({
  profile,
  editedProfile,
  updateProfile,
  onRefresh,
  onDelete,
  isDeleting,
}: GeneralSettingsTabProps) {
  const accentColor = useThemeStore((state) => state.accentColor);
  const isBackgroundAnimationEnabled = useThemeStore(
    (state) => state.isBackgroundAnimationEnabled,
  );
  const tabRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isBackgroundAnimationEnabled) {
      if (tabRef.current) {
        gsap.fromTo(
          tabRef.current,
          { opacity: 0 },
          { opacity: 1, duration: 0.4, ease: "power2.out" },
        );
      }

      if (formRef.current) {
        gsap.fromTo(
          formRef.current.children,
          { opacity: 0, y: 20 },
          {
            opacity: 1,
            y: 0,
            duration: 0.4,
            stagger: 0.1,
            ease: "power2.out",
            delay: 0.2,
          },
        );
      }


    }
  }, [isBackgroundAnimationEnabled]);



  return (
    <div ref={tabRef} className="space-y-6 select-none">
      <div ref={formRef} className="space-y-6">
        <div className="flex gap-6">
          <div className="flex-1 flex flex-col">
            <label className="block text-3xl font-minecraft text-white mb-2 lowercase">
              profile name
            </label>
            <div className="flex items-center gap-4">
              <ProfileIcon
                profileId={profile.id}
                banner={profile.banner}
                profileName={profile.name}
                accentColor={accentColor.value}
                onSuccessfulUpdate={async () => {
                  try {
                    if (onRefresh) {
                      await onRefresh();
                    }
                  } catch (error) {
                    console.error("Failed to refresh profile after icon update:", error);
                  }
                }}
                className="w-12 h-12 flex-shrink-0"
              />
              <SearchStyleInput
                value={editedProfile.name}
                onChange={(e) => updateProfile({ name: e.target.value })}
                placeholder="Enter profile name"
                className="text-xl flex-1"
                disabled={profile.is_standard_version ? true : false}
              />
            </div>
          </div>

          <div className="flex-1 flex flex-col">
            <label className="block text-3xl font-minecraft text-white mb-2 lowercase">
              group
            </label>
            <div className="flex items-center">
              <SearchStyleInput
                value={editedProfile.group || ""}
                onChange={(e) => updateProfile({ group: e.target.value || null })}
                placeholder="e.g. modpacks, vanilla+"
                className="text-xl w-full"
                disabled={profile.is_standard_version ? true : false}
              />
            </div>
          </div>
        </div>

        {/* Shared Minecraft Folder Checkbox */}
        <div className="space-y-1">
          <Checkbox
            label="Use shared Minecraft folder"
            checked={editedProfile.use_shared_minecraft_folder ?? false}
            onChange={(event) => {
              const newValue = event.target.checked;
              updateProfile({
                use_shared_minecraft_folder: newValue
              });
            }}
            description="When enabled, a shared Minecraft folder will be used based on the group. Your settings, worlds, configs and resource packs will remain the same between profiles."
            descriptionClassName="font-minecraft-ten text-sm"
            size="lg"
          />
          <p className="text-xs text-white/50 font-minecraft-ten ml-10 -mt-1">
            (you can change this anytime)
          </p>
        </div>

        <div>
          <label className="block text-3xl font-minecraft text-white mb-2 lowercase">
            quick play path
          </label>
          <SearchStyleInput
            value={editedProfile.settings.quick_play_path || ""}
            onChange={(e) =>
              updateProfile({
                settings: {
                  ...editedProfile.settings,
                  quick_play_path: e.target.value || null
                }
              })
            }
            placeholder="World name or server address (e.g. MyWorld or hypixel.net)"
            className="text-xl"
          />
          <p className="text-xs text-white/70 mt-2 font-minecraft-ten tracking-wide select-none">
            Enter a world name for singleplayer or server address for multiplayer.
            Server addresses are detected by containing a dot (e.g. hypixel.net).
          </p>
        </div>


      </div>


    </div>
  );
}
