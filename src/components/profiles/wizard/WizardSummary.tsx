"use client";

import { useEffect, useRef } from "react";
import { Icon } from "@iconify/react";
import type { Profile } from "../../../types/profile";
import { useThemeStore } from "../../../store/useThemeStore";
import { Card } from "../../ui/Card";
import { gsap } from "gsap";

interface WizardSummaryProps {
  profile: Partial<Profile>;
  error: string | null;
}

export function WizardSummary({ profile, error }: WizardSummaryProps) {
  const accentColor = useThemeStore((state) => state.accentColor);
  const isBackgroundAnimationEnabled = useThemeStore(
    (state) => state.isBackgroundAnimationEnabled,
  );
  const profileCardRef = useRef<HTMLDivElement>(null);
  const detailsGridRef = useRef<HTMLDivElement>(null);
  const infoCardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isBackgroundAnimationEnabled) {
      const elements = [
        profileCardRef.current,
        detailsGridRef.current,
        infoCardRef.current,
      ].filter(Boolean);

      gsap.fromTo(
        elements,
        { opacity: 0, y: 20 },
        {
          opacity: 1,
          y: 0,
          duration: 0.4,
          stagger: 0.1,
          ease: "power2.out",
        },
      );
    }
  }, [isBackgroundAnimationEnabled]);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-minecraft text-white mb-3 lowercase">
          profile summary
        </h2>
        <p className="text-xs text-white/70 font-minecraft-ten tracking-wide">
          Review your profile settings before creating it.
        </p>
      </div>

      {error && (
        <Card
          variant="flat"
          className="p-4 border-2 border-red-500 bg-black/20"
        >
          <p className="text-red-400 font-minecraft text-xl">{error}</p>
        </Card>
      )}

      <Card
        ref={profileCardRef}
        variant="flat"
        className="p-6 space-y-6 bg-black/20 border border-white/10"
      >
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 flex items-center justify-center rounded-md bg-black/30 border border-white/20">
            <Icon icon="solar:user-bold" className="w-8 h-8 text-white" />
          </div>
          <div>
            <h3 className="text-3xl text-white font-minecraft tracking-wide lowercase">
              {profile.name}
            </h3>
            {profile.description && (
              <p className="text-xl text-white/70 font-minecraft tracking-wide mt-1">
                {profile.description}
              </p>
            )}
            {profile.group && (
              <div className="mt-2">
                <span className="px-3 py-1 bg-black/30 border border-white/20 rounded-md text-sm font-minecraft text-white/80">
                  {profile.group}
                </span>
              </div>
            )}
          </div>
        </div>
      </Card>

      <div
        ref={detailsGridRef}
        className="grid grid-cols-1 md:grid-cols-2 gap-6"
      >
        <Card variant="flat" className="p-6 bg-black/20 border border-white/10">
          <h3 className="text-2xl text-white font-minecraft tracking-wide lowercase mb-4">
            minecraft version
          </h3>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 flex items-center justify-center rounded-md bg-black/30 border border-white/20">
              <Icon icon="solar:widget-bold" className="w-6 h-6 text-white" />
            </div>
            <div className="text-xs text-white font-minecraft-ten tracking-wide">
              Minecraft {profile.game_version}
            </div>
          </div>
        </Card>

        <Card variant="flat" className="p-6 bg-black/20 border border-white/10">
          <h3 className="text-2xl text-white font-minecraft tracking-wide lowercase mb-4">
            mod loader
          </h3>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 flex items-center justify-center rounded-md overflow-hidden bg-black/30 border border-white/20">
              <img
                src={`/icons/${profile.loader}.png`}
                alt={profile.loader}
                className="w-6 h-6 object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = "/icons/minecraft.png";
                }}
              />
            </div>
            <div className="text-xs text-white font-minecraft-ten tracking-wide">
              {profile.loader === "vanilla"
                ? "Vanilla (no mods)"
                : `${profile.loader} ${profile.loader_version || ""}`}
            </div>
          </div>
        </Card>

        <Card variant="flat" className="p-6 bg-black/20 border border-white/10">
          <h3 className="text-2xl text-white font-minecraft tracking-wide lowercase mb-4">
            memory allocation
          </h3>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 flex items-center justify-center rounded-md bg-black/30 border border-white/20">
              <Icon
                icon="solar:ssd-square-bold"
                className="w-6 h-6 text-white"
              />
            </div>
            <div className="text-xs text-white font-minecraft-ten tracking-wide lowercase">
              {profile.settings?.memory?.max} MB (
              {(profile.settings?.memory?.max || 0) / 1024} GB)
            </div>
          </div>
        </Card>

        {profile.selected_norisk_pack_id && (
          <Card
            variant="flat"
            className="p-6 bg-black/20 border border-white/10"
          >
            <h3 className="text-2xl text-white font-minecraft tracking-wide lowercase mb-4">
              norisk client pack
            </h3>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 flex items-center justify-center rounded-md bg-black/30 border border-white/20">
                <Icon icon="solar:shield-bold" className="w-6 h-6 text-white" />
              </div>
              <div className="text-xl text-white font-minecraft tracking-wide lowercase">
                {profile.selected_norisk_pack_id}
              </div>
            </div>
          </Card>
        )}
      </div>

      <Card
        ref={infoCardRef}
        variant="flat"
        className="p-6 flex items-center gap-4 bg-black/20 border border-white/10"
      >
        <div className="w-12 h-12 flex items-center justify-center rounded-md bg-black/30 border border-white/20">
          <Icon icon="solar:info-circle-bold" className="w-7 h-7 text-white" />
        </div>
        <div className="text-xs text-white/80 font-minecraft-ten tracking-wide">
          Click "Create Profile" to finish and create your new Minecraft
          profile.
        </div>
      </Card>
    </div>
  );
}
