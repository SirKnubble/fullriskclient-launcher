"use client";

import React from "react";
import { Icon } from "@iconify/react";
import type { UnifiedVersion } from "../../types/unified";

interface ModUpdateTextProps {
  isFromModPack: boolean;
  updateVersion: UnifiedVersion;
  currentVersion?: string;
  className?: string;
}

/**
 * Component for displaying formatted update text based on modpack origin
 * Provides clear, readable information about updates and modpack relationships
 */
export function ModUpdateText({
  isFromModPack,
  updateVersion,
  currentVersion,
  className = ""
}: ModUpdateTextProps) {
  if (isFromModPack) {
    return (
      <div className={`space-y-2 ${className}`}>
        <div className="flex items-center gap-2">
          <Icon
            icon="solar:package-bold-duotone"
            className="w-4 h-4 text-purple-400 flex-shrink-0"
          />
          <span className="text-sm font-semibold text-purple-300">
            ModPack Mod
          </span>
        </div>

        <div className="space-y-1 text-xs text-gray-300">
          <div className="flex items-start gap-2">
            <Icon
              icon="solar:shield-warning-bold-duotone"
              className="w-3 h-3 text-yellow-400 flex-shrink-0 mt-0.5"
            />
            <div>
              <p className="font-medium text-yellow-300">
                Automatic Updates Disabled
              </p>
              <p className="text-gray-400 leading-relaxed">
                This mod is part of a modpack. Individual updates are disabled
                to prevent breaking changes and compatibility issues.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2">
            <Icon
              icon="solar:refresh-bold-duotone"
              className="w-3 h-3 text-blue-400 flex-shrink-0 mt-0.5"
            />
            <div>
              <p className="font-medium text-blue-300">
                Manual Update Available
              </p>
              <p className="text-gray-400 leading-relaxed">
                You can still update this mod manually if you know what you're doing.
                Update to version <span className="text-white font-medium">
                  {updateVersion.version_number}
                </span>
                {currentVersion && (
                  <span className="text-gray-500">
                    {" "}from {currentVersion}
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center gap-2">
        <Icon
          icon="solar:download-minimalistic-bold"
          className="w-4 h-4 text-green-400 flex-shrink-0"
        />
        <span className="text-sm font-semibold text-green-300">
          Update Available
        </span>
      </div>

      <div className="space-y-1 text-xs text-gray-300">
        <div className="flex items-start gap-2">
          <Icon
            icon="solar:refresh-circle-bold-duotone"
            className="w-3 h-3 text-green-400 flex-shrink-0 mt-0.5"
          />
          <div>
            <p className="font-medium text-green-300">
              Ready to Update
            </p>
            <p className="text-gray-400 leading-relaxed">
              This standalone mod can be safely updated automatically.
              Update to version <span className="text-white font-medium">
                {updateVersion.version_number}
              </span>
              {currentVersion && (
                <span className="text-gray-500">
                  {" "}from {currentVersion}
                </span>
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Hook for getting formatted update text
 */
export function useModUpdateText() {
  const getUpdateText = (
    isFromModPack: boolean,
    updateVersion: UnifiedVersion,
    currentVersion?: string
  ): string => {
    if (isFromModPack) {
      return `ModPack Mod: Updates disabled to prevent breaking changes. Manual update to ${updateVersion.version_number} available.`;
    } else {
      return `Update to ${updateVersion.version_number}${currentVersion ? ` from ${currentVersion}` : ''}`;
    }
  };

  const getShortUpdateText = (
    isFromModPack: boolean,
    updateVersion: UnifiedVersion
  ): string => {
    if (isFromModPack) {
      return `ModPack Mod: Manual update to ${updateVersion.version_number}`;
    } else {
      return `Update to ${updateVersion.version_number}`;
    }
  };

  return {
    getUpdateText,
    getShortUpdateText
  };
}
