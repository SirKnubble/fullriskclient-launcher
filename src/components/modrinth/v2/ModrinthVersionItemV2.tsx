"use client";

import React, { useEffect, useRef, useState } from "react";
import { cn } from "../../../lib/utils";
import type {
  ModrinthSearchHit,
  ModrinthVersion,
} from "../../../types/modrinth";
import type { AccentColor } from "../../../store/useThemeStore";
import type { ContentInstallStatus } from "../../../types/profile";
import { Icon } from "@iconify/react";
import { Button } from "../../ui/buttons/Button";
import { TagBadge } from "../../ui/TagBadge";
import { gsap } from "gsap";
import { useIsFirstRender } from "../../../hooks/useIsFirstRender";

interface ModrinthVersionItemV2Props {
  version: ModrinthVersion;
  project: ModrinthSearchHit;
  versionStatus: ContentInstallStatus | null;
  isInstalling?: boolean;
  isInstallingModpackVersion?: boolean;
  accentColor: AccentColor;
  isHovered: boolean;
  onMouseEnter: (id: string) => void;
  onMouseLeave: () => void;
  onInstallClick: (
    project: ModrinthSearchHit,
    version: ModrinthVersion,
  ) => void;
  onDeleteClick?: (
    profileId: string,
    project: ModrinthSearchHit,
    version: ModrinthVersion,
  ) => void;
  onToggleEnableClick?: (
    profileId: string,
    project: ModrinthSearchHit,
    version: ModrinthVersion,
    newEnabledState: boolean,
    sha1Hash: string,
  ) => void;
  onInstallModpackVersionAsProfileClick?: (
    project: ModrinthSearchHit,
    version: ModrinthVersion,
  ) => void;
  selectedProfileId?: string | null;
}

export const ModrinthVersionItemV2 = React.memo<ModrinthVersionItemV2Props>(
  ({
    version,
    project,
    versionStatus,
    isInstalling = false,
    isInstallingModpackVersion = false,
    accentColor,
    isHovered,
    onMouseEnter,
    onMouseLeave,
    onInstallClick,
    onDeleteClick,
    onToggleEnableClick,
    onInstallModpackVersionAsProfileClick,
    selectedProfileId,
  }) => {
    const isModpack = project.project_type === "modpack";
    const cardRef = useRef<HTMLDivElement>(null);
    const [isCardHovered, setIsCardHovered] = useState(false);
    const isFirstRender = useIsFirstRender();

    const handleMouseEnterLocal = () => {
      onMouseEnter(version.id);
    };

    const handleMouseLeaveLocal = () => {
      onMouseLeave();
    };

    useEffect(() => {
      // GSAP animation is removed as the style will be more static like GenericList
      // if (cardRef.current) {
      //   if (isFirstRender) return;

      //   if (isCardHovered) { // isCardHovered is also effectively removed for this
      //     gsap.to(cardRef.current, {
      //       backgroundColor: `${accentColor.value}15`,
      //       borderColor: `${accentColor.value}60`,
      //       y: -3,
      //       boxShadow: `0 8px 0 rgba(0,0,0,0.3), 0 10px 15px rgba(0,0,0,0.35), inset 0 1px 0 ${accentColor.value}30, inset 0 0 0 1px ${accentColor.value}15`,
      //       duration: 0.2,
      //       ease: "power2.out",
      //     });
      //   } else {
      //     gsap.to(cardRef.current, {
      //       backgroundColor: `${accentColor.value}08`,
      //       borderColor: `${accentColor.value}30`,
      //       y: 0,
      //       boxShadow: `0 2px 0 rgba(0,0,0,0.1), 0 3px 5px rgba(0,0,0,0.1)`,
      //       duration: 0.2,
      //       ease: "power2.out",
      //     });
      //   }
      // }
    }, [isCardHovered, accentColor, isFirstRender]);

    const handleButtonClick = () => {
      if (isInstalling) return;

      if (isModpack && onInstallModpackVersionAsProfileClick) {
        onInstallModpackVersionAsProfileClick(project, version);
      } else if (!isModpack) {
        onInstallClick(project, version);
      } else {
        console.warn(
          "onInstallModpackVersionAsProfileClick is not defined for modpack version item",
        );
        onInstallClick(project, version);
      }
    };

    const handleDeleteButtonClick = () => {
      if (onDeleteClick && !isModpack && selectedProfileId) {
        onDeleteClick(selectedProfileId, project, version);
      } else {
        console.warn(
          "Delete action called without a selectedProfileId or onDeleteClick handler missing/isModpack",
        );
      }
    };

    const handleToggleEnableButtonClick = () => {
      if (versionStatus?.norisk_pack_item_details?.norisk_mod_identifier) {
        if (onToggleEnableClick && !isModpack && selectedProfileId) {
          onToggleEnableClick(
            selectedProfileId,
            project,
            version,
            !versionStatus.is_enabled,
            "",
          );
        }
        return;
      }

      const primaryFile =
        version.files.find((f) => f.primary) || version.files[0];
      if (
        onToggleEnableClick &&
        !isModpack &&
        selectedProfileId &&
        versionStatus?.is_installed &&
        primaryFile?.hashes?.sha1 &&
        typeof versionStatus.is_enabled === "boolean"
      ) {
        onToggleEnableClick(
          selectedProfileId,
          project,
          version,
          !versionStatus.is_enabled,
          primaryFile.hashes.sha1,
        );
      } else {
        console.warn(
          "Toggle enable action called under invalid conditions or missing data",
          {
            onToggleEnableClick: !!onToggleEnableClick,
            isModpack,
            selectedProfileId: !!selectedProfileId,
            is_installed: versionStatus?.is_installed,
            sha1: primaryFile?.hashes?.sha1,
            is_enabled_type: typeof versionStatus?.is_enabled,
          },
        );
      }
    };

    let buttonText = "Install";
    let buttonIcon: React.ReactNode = null;
    let buttonVariant: "default" | "success" | "secondary" = "success";
    let buttonDisabled = false;

    if (project.project_type === "modpack" && isInstallingModpackVersion) {
      buttonText = "Installing...";
      buttonIcon = (
        <svg
          className="animate-spin mr-2 h-4 w-4 text-white"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          ></circle>
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          ></path>
        </svg>
      );
      buttonVariant = "secondary";
      buttonDisabled = true;
    } else if (isInstalling) {
      buttonText = "Installing...";
      buttonIcon = (
        <svg
          className="animate-spin mr-2 h-4 w-4 text-white"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          ></circle>
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          ></path>
        </svg>
      );
      buttonVariant = "secondary";
      buttonDisabled = true;
    } else if (versionStatus && versionStatus.is_installed) {
      if (versionStatus?.is_included_in_norisk_pack && !isModpack) {
        buttonText = "In Pack";
        buttonVariant = "default";
        buttonDisabled = true;
      } else if (versionStatus?.is_installed && !isModpack) {
        buttonText = "Installed";
        buttonDisabled = true;
      } else if (isModpack && !versionStatus?.is_installed) {
        buttonText = "Install";
        buttonVariant = "success";
        buttonDisabled = false;
      }
    }
    const showInstallBorder =
      selectedProfileId &&
      (versionStatus?.is_installed ||
        versionStatus?.is_included_in_norisk_pack);

    return (
      <div
        ref={cardRef}
        key={version.id}
        onMouseEnter={handleMouseEnterLocal}
        onMouseLeave={handleMouseLeaveLocal}
        className={cn(
          "relative overflow-hidden transition-colors duration-150 rounded-md backdrop-blur-sm",
          "border",
          showInstallBorder &&
            versionStatus?.is_installed &&
            "border-l-green-500 border-l-4",
          showInstallBorder &&
            !versionStatus?.is_installed &&
            versionStatus?.is_included_in_norisk_pack &&
            "border-l-blue-500 border-l-4",
        )}
        style={{
          backgroundColor: `${accentColor.value}08`,
          borderColor: `${accentColor.value}20`,
        }}
      >
        <div className="relative z-10 p-2.5">
          <div className="flex flex-col space-y-2">
            <div className="flex justify-between items-baseline gap-2">
              <div className="flex-shrink min-w-0">
                <h5 className="text-gray-100 text-sm font-minecraft-ten normal-case truncate">
                  {version.name}
                </h5>
                <p className="text-gray-400 text-xs font-minecraft-ten normal-case truncate">
                  {version.version_number}
                </p>
              </div>
              <div className="flex items-center space-x-2 text-[10px] text-gray-400 font-minecraft-ten flex-shrink-0">
                {" "}
                <span className="flex items-center">
                  <Icon
                    icon="solar:download-minimalistic-bold"
                    className="w-3 h-3 mr-0.5"
                  />
                  {version.downloads.toLocaleString()}
                </span>
                <span className="flex items-center">
                  <Icon
                    icon="solar:calendar-mark-bold"
                    className="w-3 h-3 mr-0.5"
                  />
                  {new Date(version.date_published).toLocaleDateString()}
                </span>
              </div>
            </div>

            <div className="flex justify-between items-center gap-2">
              <div className="flex flex-wrap items-center gap-1 flex-grow min-w-0">
                {selectedProfileId &&
                  versionStatus?.is_installed &&
                  versionStatus?.is_enabled !== false && (
                    <TagBadge variant="success" className="flex-shrink-0">
                      <Icon
                        icon="solar:check-circle-bold"
                        className="w-3 h-3 mr-0.5"
                      />
                      Installed
                    </TagBadge>
                  )}
                {selectedProfileId &&
                  versionStatus?.is_installed &&
                  versionStatus?.is_enabled === false && (
                    <TagBadge variant="inactive" className="flex-shrink-0">
                      <Icon
                        icon="solar:close-circle-bold"
                        className="w-3 h-3 mr-0.5"
                      />
                      Disabled
                    </TagBadge>
                  )}
                {selectedProfileId &&
                  versionStatus?.is_included_in_norisk_pack && (
                    <TagBadge
                      variant={versionStatus?.is_enabled ? "info" : "inactive"}
                      className="flex-shrink-0"
                    >
                      <Icon
                        icon="solar:bolt-circle-bold"
                        className="w-3 h-3 mr-0.5"
                      />
                      In NoRisk Pack
                    </TagBadge>
                  )}
                <TagBadge className="flex-shrink-0">
                  {version.version_type}
                </TagBadge>
                {version.game_versions.length > 0 &&
                  version.game_versions.slice(0, 5).map((gv) => (
                    <TagBadge key={`gv-${version.id}-${gv}`} variant="default">
                      {gv}
                    </TagBadge>
                  ))}
                {version.game_versions.length > 5 && (
                  <TagBadge variant="default">...</TagBadge>
                )}
                {version.loaders.length > 0 &&
                  version.loaders.map((loader) => (
                    <TagBadge
                      key={`loader-${version.id}-${loader}`}
                      variant="default"
                    >
                      {loader}
                    </TagBadge>
                  ))}
              </div>
              <div className="flex gap-1 flex-shrink-0">
                {" "}
                {selectedProfileId &&
                  ((versionStatus?.is_installed &&
                    !isModpack &&
                    typeof versionStatus.is_enabled === "boolean" &&
                    onToggleEnableClick) ||
                    (versionStatus?.is_included_in_norisk_pack &&
                      versionStatus?.norisk_pack_item_details &&
                      onToggleEnableClick)) && (
                    <Button
                      onClick={handleToggleEnableButtonClick}
                      size="xs"
                      shadowDepth="short"
                      variant={
                        versionStatus.is_enabled ? "warning" : "secondary"
                      }
                      className="min-w-[80px] justify-center"
                    >
                      {versionStatus.is_enabled ? "Active" : "Disabled"}
                    </Button>
                  )}
                {selectedProfileId &&
                  versionStatus?.is_installed &&
                  !isModpack &&
                  onDeleteClick && (
                    <Button
                      onClick={handleDeleteButtonClick}
                      size="xs"
                      shadowDepth="short"
                      variant="destructive"
                      className="min-w-[80px] justify-center"
                    >
                      Delete
                    </Button>
                  )}
                {(!selectedProfileId || !versionStatus?.is_installed) && (
                  <Button
                    onClick={handleButtonClick}
                    size="xs"
                    shadowDepth="short"
                    variant={buttonVariant}
                    disabled={buttonDisabled || isInstalling}
                    className="min-w-[80px] justify-center"
                    icon={buttonIcon}
                    iconPosition="left"
                  >
                    {buttonText}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  },
);
