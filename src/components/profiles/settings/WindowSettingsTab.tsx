"use client";

import { useEffect, useRef } from "react";
import type { Profile } from "../../../types/profile";
import { useThemeStore } from "../../../store/useThemeStore";
import { Checkbox } from "../../ui/Checkbox";
import { Label } from "../../ui/Label";
import { Input } from "../../ui/Input";
import { Card } from "../../ui/Card";
import { gsap } from "gsap";
import { cn } from "../../../lib/utils";

interface WindowSettingsTabProps {
  editedProfile: Profile;
  updateProfile: (updates: Partial<Profile>) => void;
}

export function WindowSettingsTab({
  editedProfile,
  updateProfile,
}: WindowSettingsTabProps) {
  const accentColor = useThemeStore((state) => state.accentColor);
  const isBackgroundAnimationEnabled = useThemeStore(
    (state) => state.isBackgroundAnimationEnabled,
  );
  const tabRef = useRef<HTMLDivElement>(null);
  const resolutionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isBackgroundAnimationEnabled) {
      if (tabRef.current) {
        gsap.fromTo(
          tabRef.current,
          { opacity: 0 },
          { opacity: 1, duration: 0.4, ease: "power2.out" },
        );
      }

      if (resolutionRef.current) {
        gsap.fromTo(
          resolutionRef.current,
          { opacity: 0, y: 20 },
          {
            opacity: 1,
            y: 0,
            duration: 0.4,
            ease: "power2.out",
            delay: 0.2,
          },
        );
      }
    }
  }, [isBackgroundAnimationEnabled]);

  const resolutionPresets = [
    { width: 854, height: 480, label: "Default" },
    { width: 1280, height: 720, label: "720p" },
    { width: 1920, height: 1080, label: "1080p" },
    { width: 2560, height: 1440, label: "1440p" },
    { width: 3840, height: 2160, label: "4k" },
  ];

  const handleResolutionChange = (width: number, height: number) => {
    const newSettings = { ...editedProfile.settings };
    if (!newSettings.resolution) {
      newSettings.resolution = { width, height };
    } else {
      newSettings.resolution.width = width;
      newSettings.resolution.height = height;
    }
    updateProfile({ settings: newSettings });
  };

  const handleFullscreenChange = (fullscreen: boolean) => {
    const newSettings = { ...editedProfile.settings };
    newSettings.fullscreen = fullscreen;
    updateProfile({ settings: newSettings });
  };

  const handlePresetClick = (preset: { width: number; height: number }) => {
    if (isBackgroundAnimationEnabled) {
      gsap.fromTo(
        `.preset-${preset.width}x${preset.height}`,
        { scale: 0.95 },
        {
          scale: 1,
          duration: 0.3,
          ease: "elastic.out(1.2, 0.4)",
        },
      );
    }

    handleResolutionChange(preset.width, preset.height);
  };

  return (
    <div ref={tabRef} className="space-y-6 select-none">
      <div>
        <h3 className="text-3xl font-minecraft text-white mb-2 lowercase">
          window settings
        </h3>
        <p className="text-xs text-white/70 mb-4 font-minecraft-ten tracking-wide select-none">
          configure how minecraft's window appears on your screen.
        </p>
      </div>

      <div ref={resolutionRef} className="space-y-4">
        <div>
          <h3 className="text-3xl font-minecraft text-white mb-3 lowercase">
            resolution
          </h3>
          <Card
            variant="flat"
            className="p-4 border border-white/10 bg-black/20"
          >
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xl text-white/70 font-minecraft mb-2 lowercase tracking-wide select-none">
                  width
                </label>
                <Input
                  type="number"
                  value={String(
                    editedProfile.settings?.resolution?.width || 1280,
                  )}
                  onChange={(e) => {
                    const width = Number.parseInt(e.target.value) || 1280;
                    handleResolutionChange(
                      width,
                      editedProfile.settings?.resolution?.height || 720,
                    );
                  }}
                  className="text-2xl py-3"
                  variant="flat"
                />
              </div>
              <div>
                <label className="block text-xl text-white/70 font-minecraft mb-2 lowercase tracking-wide select-none">
                  height
                </label>
                <Input
                  type="number"
                  value={String(
                    editedProfile.settings?.resolution?.height || 720,
                  )}
                  onChange={(e) => {
                    const height = Number.parseInt(e.target.value) || 720;
                    handleResolutionChange(
                      editedProfile.settings?.resolution?.width || 1280,
                      height,
                    );
                  }}
                  className="text-2xl py-3"
                  variant="flat"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mb-4">
              {resolutionPresets.map((preset) => (
                <Label
                  key={preset.label}
                  variant={
                    editedProfile.settings?.resolution?.width ===
                      preset.width &&
                    editedProfile.settings?.resolution?.height === preset.height
                      ? "default"
                      : "ghost"
                  }
                  size="md"
                  className={cn(
                    "cursor-pointer text-xl preset-${preset.width}x${preset.height}",
                    editedProfile.settings?.resolution?.width ===
                      preset.width &&
                      editedProfile.settings?.resolution?.height ===
                        preset.height
                      ? "bg-accent/20 border-accent text-white"
                      : "bg-black/20 hover:bg-black/30 border-white/10 text-white/80",
                  )}
                  onClick={() => handlePresetClick(preset)}
                >
                  {preset.label}
                </Label>
              ))}
            </div>

            <Checkbox
              checked={editedProfile.settings?.fullscreen || false}
              onChange={(e) => handleFullscreenChange(e.target.checked)}
              label="fullscreen"
              className="text-2xl"
              variant="flat"
            />
          </Card>
        </div>
      </div>
    </div>
  );
}
