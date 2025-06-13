"use client";

import React, { useState } from "react";
import { Input } from "../../ui/Input";
import { Select, type SelectOption } from "../../ui/Select";
import { IconButton } from "../../ui/buttons/IconButton";
import { Icon } from "@iconify/react";
import type { AccentColor } from "../../../store/useThemeStore";
import { cn } from "../../../lib/utils";
import { useProfileStore } from "../../../store/profile-store";

interface ModrinthQuickProfileProps {
  accentColor: AccentColor;
  projectTitle: string;
  versionNumber?: string;
  profileName: string;
  onProfileNameChange: (name: string) => void;
  error: string | null;
  isLoading?: boolean;

  selectedSourceProfileId: string | null;
  onSourceProfileChange: (profileId: string | null) => void;
}

const PLACEHOLDER_VALUE = "__placeholder__";
const NO_PROFILES_VALUE = "__no_profiles__";
const LOADING_PROFILES_VALUE = "__loading_profiles__";

export const ModrinthQuickProfile: React.FC<ModrinthQuickProfileProps> = ({
  accentColor,
  projectTitle,
  versionNumber,
  profileName,
  onProfileNameChange,
  error,
  isLoading = false,
  selectedSourceProfileId,
  onSourceProfileChange,
}) => {
  const [showSourceSelectInput, setShowSourceSelectInput] = useState(false);
  const { profiles: storeProfiles, loading: profilesLoading } =
    useProfileStore();

  const sourceProfileOptions: SelectOption[] = storeProfiles.map((p) => ({
    value: p.id,
    label: p.name,
  }));

  if (storeProfiles.length > 0 && !profilesLoading) {
    sourceProfileOptions.unshift({
      value: PLACEHOLDER_VALUE,
      label: "Select a profile to copy from...",
    });
  }

  const handleToggleCopySection = () => {
    if (selectedSourceProfileId) {
      onSourceProfileChange(null);
      setShowSourceSelectInput(false);
    } else {
      setShowSourceSelectInput(!showSourceSelectInput);
    }
  };

  const isActuallyCopying = selectedSourceProfileId !== null;

  return (
    <div
      className={cn(
        "p-1 sm:p-2 md:p-4 space-y-4",
        isLoading && "opacity-70 pointer-events-none",
      )}
    >
      <div className="text-center">
        <h3 className="text-xl sm:text-2xl font-semibold text-gray-100 font-minecraft-ten normal-case">
          {isActuallyCopying
            ? "Copy existing profile and install "
            : "Install "}
          <span style={{ color: accentColor.value }}>{projectTitle}</span>
          {versionNumber && (
            <span className="text-gray-400"> v{versionNumber}</span>
          )}
          <br />
          {isActuallyCopying ? "to new profile" : "as new profile"}
        </h3>
      </div>

      <p className="text-xs font-minecraft-ten sm:text-sm text-gray-400 text-center">
        {isActuallyCopying
          ? `Copying settings from '${storeProfiles.find((p) => p.id === selectedSourceProfileId)?.name || "selected profile"}'. Enter a name for the new copy.`
          : "Enter a name for the new profile. Optionally, copy settings from an existing profile."}
      </p>

      <div className="flex items-start gap-2">
        <div className="flex-grow">
          <label
            htmlFor="quickProfileNameInput"
            className="block text-sm font-medium text-gray-300 mb-1 sr-only"
          >
            New Profile Name
          </label>
          <Input
            id="quickProfileNameInput"
            value={profileName}
            onChange={(e) => onProfileNameChange(e.target.value)}
            placeholder="Enter name for new profile"
            className="w-full text-center text-lg"
            aria-describedby={error ? "profileNameError" : undefined}
            disabled={isLoading}
          />
        </div>
        <IconButton
          icon={
            isActuallyCopying ? (
              <Icon
                icon="solar:close-circle-bold-duotone"
                className="w-5 h-5"
              />
            ) : (
              <Icon icon="solar:copy-bold-duotone" className="w-5 h-5" />
            )
          }
          onClick={handleToggleCopySection}
          variant="ghost"
          size="md"
          disabled={isLoading}
          title={
            isActuallyCopying
              ? "Clear source profile selection"
              : "Copy settings from existing profile"
          }
          className="flex-shrink-0 mt-0.5"
        />
      </div>
      {error && (
        <p
          id="profileNameError"
          className="text-red-500 text-xs mt-1 text-center"
        >
          {error}
        </p>
      )}

      {(showSourceSelectInput || isActuallyCopying) && (
        <div className="space-y-1 pt-2 animated-fade-in">
          <label
            htmlFor="sourceProfileSelect"
            className="block text-xs font-medium font-minecraft-ten text-gray-400"
          >
            Source Profile to Copy
          </label>
          <Select
            value={selectedSourceProfileId || PLACEHOLDER_VALUE}
            onChange={(value) => {
              if (
                value === PLACEHOLDER_VALUE ||
                value === NO_PROFILES_VALUE ||
                value === LOADING_PROFILES_VALUE
              ) {
                onSourceProfileChange(null);
              } else {
                onSourceProfileChange(value);
                setShowSourceSelectInput(true);
              }
            }}
            options={
              profilesLoading
                ? [
                    {
                      value: LOADING_PROFILES_VALUE,
                      label: "Loading profiles...",
                    },
                  ]
                : storeProfiles.length === 0
                  ? [
                      {
                        value: NO_PROFILES_VALUE,
                        label: "No profiles available to copy",
                      },
                    ]
                  : sourceProfileOptions
            }
            placeholder="Select a profile to copy from..."
            disabled={
              isLoading ||
              profilesLoading ||
              (storeProfiles.length === 0 && !profilesLoading)
            }
            className="w-full"
          />
          {storeProfiles.length === 0 &&
            !profilesLoading &&
            (showSourceSelectInput || isActuallyCopying) && (
              <p className="text-xs text-amber-500 mt-1 text-center">
                You don't have any profiles to copy from. A new empty profile
                will be created if you proceed without selecting a source.
              </p>
            )}
        </div>
      )}
    </div>
  );
};
