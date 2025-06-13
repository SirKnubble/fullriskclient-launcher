"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import type { Profile } from "../../../types/profile";
import { useThemeStore } from "../../../store/useThemeStore";
import { useDisplayContextStore } from "../../../store/useDisplayContextStore";
import { Icon } from "@iconify/react";
import { Card } from "../../ui/Card";
import { ModrinthSearchV2 } from "../../modrinth/v2/ModrinthSearchV2";
import * as ProfileService from "../../../services/profile-service";
import type { ModrinthProjectType } from "../../../types/modrinth";

interface BrowseTabProps {
  profile?: Profile;
  initialContentType?: string;
  onRefresh?: () => void;
  parentTransitionActive?: boolean;
}

export function BrowseTab({
  profile: initialProfile,
  initialContentType: initialContentTypeFromProp = "mods",
  onRefresh,
  parentTransitionActive,
}: BrowseTabProps) {
  const { profileId, contentType: contentTypeFromUrl } = useParams<{ profileId: string; contentType: string }>();
  const accentColor = useThemeStore((state) => state.accentColor);
  const setDisplayContext = useDisplayContextStore((state) => state.setContext);
  const containerRef = useRef<HTMLDivElement>(null);

  const [currentProfile, setCurrentProfile] = useState<Profile | undefined | null>(initialProfile);
  const [isLoading, setIsLoading] = useState<boolean>(!initialProfile && !!profileId);
  const [error, setError] = useState<string | null>(null);

  const activeContentType = contentTypeFromUrl || initialContentTypeFromProp;

  useEffect(() => {
    setDisplayContext("detail");
    return () => {
      setDisplayContext("standalone");
    };
  }, [setDisplayContext]);

  useEffect(() => {
    if (profileId && !initialProfile) {
      setIsLoading(true);
      setError(null);
      ProfileService.getProfile(profileId)
        .then(fetchedProfile => {
          setCurrentProfile(fetchedProfile);
        })
        .catch(err => {
          console.error(`Failed to fetch profile ${profileId}:`, err);
          setError(`Failed to load profile: ${err instanceof Error ? err.message : String(err)}`);
          setCurrentProfile(null);
        })
        .finally(() => {
          setIsLoading(false);
        });
    } else if (initialProfile) {
      setCurrentProfile(initialProfile);
      setIsLoading(false);
    }
  }, [profileId, initialProfile]);

  const getProjectType = () => {
    switch (activeContentType) {
      case "mods":
      case "mod":
        return "mod";
      case "resourcepacks":
      case "resourcepack":
        return "resourcepack";
      case "shaderpacks":
      case "shaderpack":
      case "shader":
        return "shader";
      case "datapacks":
      case "datapack":
        return "datapack";
      default:
        return "mod";
    }
  };

  const getContentTypeIcon = () => {
    switch (activeContentType) {
      case "mods": case "mod": return "solar:cube-bold";
      case "resourcepacks": case "resourcepack": return "solar:image-gallery-bold";
      case "shaderpacks": case "shaderpack": case "shader": return "solar:sun-bold";
      case "datapacks": case "datapack": return "solar:database-bold";
      default: return "solar:cube-bold";
    }
  };

  const getContentTypeTitle = () => {
    switch (activeContentType) {
      case "mods": case "mod": return "Browse Mods";
      case "resourcepacks": case "resourcepack": return "Browse Resource Packs";
      case "shaderpacks": case "shaderpack": case "shader": return "Browse Shader Packs";
      case "datapacks": case "datapack": return "Browse Data Packs";
      default: return "Browse Content";
    }
  };

  if (isLoading) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-4 gap-6">
        <Icon icon="eos-icons:loading" className="w-16 h-16 text-[var(--accent)]" />
        <p className="text-white/70 font-minecraft text-lg">Loading profile data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex flex-col p-4 gap-6">
        <Card variant="flat" className="p-4 border-red-500 bg-red-900/30">
          <div className="flex items-center gap-2">
            <Icon icon="solar:danger-triangle-bold" className="w-6 h-6 text-red-400" />
            <span className="text-white font-minecraft text-lg">Error</span>
          </div>
          <p className="text-red-300 font-minecraft mt-2 text-sm">{error}</p>
        </Card>
      </div>
    );
  }

  if (!currentProfile || !currentProfile.id) {
    return (
      <div className="h-full flex flex-col p-4 gap-6">
        <Card variant="flat" className="p-4 border-orange-500 bg-orange-900/30">
          <div className="flex items-center gap-2">
            <Icon icon="solar:question-circle-bold" className="w-6 h-6 text-orange-400" />
            <span className="text-white font-minecraft text-lg">
              Profile Not Found
            </span>
          </div>
           <p className="text-orange-300 font-minecraft mt-2 text-sm">
            The requested profile (ID: {profileId || 'N/A'}) could not be loaded or does not exist.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="h-full flex flex-col p-4 gap-4">
      <div className="flex-1 overflow-hidden">
        <ModrinthSearchV2
          profiles={[currentProfile]}
          selectedProfileId={currentProfile.id}
          initialProjectType={getProjectType() as ModrinthProjectType}
          allowedProjectTypes={["mod", "resourcepack", "shader", "datapack"]}
          className="h-full"
          initialSidebarVisible={false}
          overrideDisplayContext="detail"
        />
      </div>
    </div>
  );
}
