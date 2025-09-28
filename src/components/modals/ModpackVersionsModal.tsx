"use client";

import React, { useState } from "react";
import { Modal } from "../ui/Modal";
import { Icon } from "@iconify/react";
import { Button } from "../ui/buttons/Button";
import type { UnifiedModpackVersionsResponse, UnifiedVersion, ModpackSwitchRequest } from "../../types/unified";
import { UnifiedVersionType } from "../../types/unified";
import type { ModPackSource } from "../../types/profile";
import UnifiedService from "../../services/unified-service";
import * as ProfileService from "../../services/profile-service";
import { toast } from "react-hot-toast";

interface ModpackVersionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  versions: UnifiedModpackVersionsResponse | null;
  modpackName: string;
  profileId?: string;
  onVersionSwitch?: (version: UnifiedVersion) => void;
  onSwitchComplete?: () => void;
  isSwitching?: boolean;
}

function getVersionTypeColor(type: UnifiedVersionType): string {
  switch (type) {
    case UnifiedVersionType.Release:
      return "text-green-400";
    case UnifiedVersionType.Beta:
      return "text-yellow-400";
    case UnifiedVersionType.Alpha:
      return "text-red-400";
    default:
      return "text-gray-400";
  }
}

function getVersionTypeIcon(type: UnifiedVersionType): string {
  switch (type) {
    case UnifiedVersionType.Release:
      return "solar:tag-bold";
    case UnifiedVersionType.Beta:
      return "solar:test-tube-bold";
    case UnifiedVersionType.Alpha:
      return "solar:flask-bold";
    default:
      return "solar:tag-bold";
  }
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

function formatDownloads(downloads: number): string {
  if (downloads >= 1000000) {
    return `${(downloads / 1000000).toFixed(1)}M`;
  }
  if (downloads >= 1000) {
    return `${(downloads / 1000).toFixed(1)}K`;
  }
  return downloads.toString();
}

function VersionItem({
  version,
  isInstalled,
  isSelected,
  onSelect
}: {
  version: UnifiedVersion;
  isInstalled: boolean;
  isSelected: boolean;
  onSelect: (version: UnifiedVersion) => void;
}) {
  return (
    <div
      className={`relative p-3 rounded-lg border transition-all duration-200 ${
        isInstalled
          ? "bg-black/30 border-white/30 cursor-not-allowed"
          : isSelected
          ? "border-white/30 cursor-pointer"
          : "bg-black/20 border-white/10 hover:bg-black/30 hover:border-white/20 cursor-pointer"
      }`}
      style={isSelected && !isInstalled ? {
        backgroundColor: `rgba(var(--accent-rgb), 0.15)`,
        borderColor: `var(--accent)`
      } : undefined}
      onClick={() => !isInstalled && onSelect(version)}
    >
      {/* Stats - oben rechts */}
      <div className="absolute top-2 right-2 flex items-center space-x-1 text-xs text-white/50 font-minecraft-ten">
        <span>{formatDownloads(version.downloads)}</span>
        <span>{formatDate(version.date_published)}</span>
      </div>

      {/* Hauptinhalt */}
      <div className="flex items-center justify-between pr-20">
        <div className="flex-1 min-w-0">
          {/* Name und Version in einer Zeile */}
          <div className="flex items-center gap-2 mb-1">
            <span className="text-white font-minecraft-ten text-sm font-medium truncate">
              {version.version_number}
            </span>
            {isInstalled && (
              <span className="text-xs bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded font-minecraft-ten uppercase">
                Current
              </span>
            )}
          </div>

          {/* MC Versionen */}
          <div className="text-xs text-white/60 font-minecraft-ten">
            MC: {version.game_versions.slice(0, 2).join(', ')}
            {version.game_versions.length > 2 && ` +${version.game_versions.length - 2}`}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ModpackVersionsModal({
  isOpen,
  onClose,
  versions: initialVersions,
  modpackName,
  profileId,
  onVersionSwitch,
  onSwitchComplete,
  isSwitching = false,
}: ModpackVersionsModalProps) {
  const [versions, setVersions] = useState<UnifiedModpackVersionsResponse | null>(initialVersions);
  const [isLoadingVersions, setIsLoadingVersions] = useState(false);

  // Load fresh versions when modal opens by loading the current profile
  React.useEffect(() => {
    if (isOpen && profileId) {
      setIsLoadingVersions(true);

      // Load the current profile to get the latest modpack source
      ProfileService.getProfile(profileId)
        .then(profile => {
          if (profile.modpack_info?.source) {
            return UnifiedService.getModpackVersions(profile.modpack_info.source);
          } else {
            throw new Error("No modpack source found in profile");
          }
        })
        .then(setVersions)
        .catch(err => {
          console.error("Failed to load fresh modpack versions:", err);
          setVersions(initialVersions); // fallback to initial versions
        })
        .finally(() => setIsLoadingVersions(false));
    }
  }, [isOpen, profileId, initialVersions]);

  // Reset when modal closes
  React.useEffect(() => {
    if (!isOpen) {
      setVersions(initialVersions);
      setSelectedVersion(null);
    }
  }, [isOpen, initialVersions]);

  if (!isOpen || !versions) {
    return null;
  }

  // Sort versions by date (newest first)
  const sortedVersions = [...versions.all_versions].sort(
    (a, b) => new Date(b.date_published).getTime() - new Date(a.date_published).getTime()
  );

  const installedVersionId = versions.installed_version?.id;
  const [selectedVersion, setSelectedVersion] = useState<UnifiedVersion | null>(null);

  const handleVersionSelect = (version: UnifiedVersion) => {
    // Don't allow selecting already installed version
    if (version.id === installedVersionId) return;
    setSelectedVersion(version);
  };

  const handleSwitchVersion = async () => {
    if (!selectedVersion) return;

    // Check if we have all required information for the new modpack switching
    if (profileId && selectedVersion.files.length > 0) {
      try {
        // Find the primary file
        const primaryFile = selectedVersion.files.find(f => f.primary) || selectedVersion.files[0];

        // Create new ModPackSource based on selected version
        let newModpackSource: ModPackSource;
        if (selectedVersion.source === "Modrinth") {
          newModpackSource = {
            source: "modrinth",
            project_id: selectedVersion.project_id,
            version_id: selectedVersion.id,
          };
        } else if (selectedVersion.source === "CurseForge") {
          // For CurseForge, we need the file_id from the primary file
          const fileId = primaryFile.fingerprint; // CurseForge uses fingerprint as file_id
          if (!fileId) {
            throw new Error("CurseForge file fingerprint (file_id) not found");
          }
          newModpackSource = {
            source: "curse_forge",
            project_id: parseInt(selectedVersion.project_id), // CurseForge project_id is number
            file_id: fileId,
          };
        } else {
          throw new Error(`Unsupported modpack source: ${selectedVersion.source}`);
        }

        const request: ModpackSwitchRequest = {
          download_url: primaryFile.url,
          modpack_source: newModpackSource,
          profile_id: profileId,
        };

        // Show loading toast
        const loadingToast = toast.loading(`Switching ${modpackName} to version ${selectedVersion.version_number}...`);

        await UnifiedService.switchModpackVersion(request);

        // Dismiss loading toast and show success
        toast.dismiss(loadingToast);
        toast.success(`Successfully switched ${modpackName} to version ${selectedVersion.version_number}!`);

        // Don't refresh here - let parent components handle the refresh

        // Call completion callback if provided (wait for parent components to update their state)
        if (onSwitchComplete) {
          await onSwitchComplete();
        }

        // Close modal after parent states are updated
        onClose();

      } catch (error) {
        toast.error(`Failed to switch modpack version: ${error}`);
      }
    } else if (onVersionSwitch) {
      // Fallback to old method if we don't have all required info
      onVersionSwitch(selectedVersion);
    }
  };

  // Reset selection when modal closes
  React.useEffect(() => {
    if (!isOpen) {
      setSelectedVersion(null);
    }
  }, [isOpen]);

  return (
    <Modal
      title={`${modpackName} - Versions`}
      titleIcon={<Icon icon="solar:archive-bold" className="w-6 h-6 text-blue-400" />}
      onClose={onClose}
      width="lg"
      className="max-h-[80vh]"
      footer={
        <div className="flex justify-end items-center gap-3">
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={isSwitching}
          >
            Cancel
          </Button>
          <Button
            variant="default"
            onClick={handleSwitchVersion}
            disabled={!selectedVersion || isSwitching}
            icon={isSwitching ? <Icon icon="solar:refresh-bold" className="animate-spin h-4 w-4" /> : <Icon icon="solar:refresh-circle-bold" className="h-4 w-4" />}
          >
            {isSwitching ? "Switching..." : selectedVersion ? "Switch Version" : "Select a Version"}
          </Button>
        </div>
      }
    >
      <div className="p-4">
        <div className="mb-4 text-sm text-white/70 font-minecraft-ten">
          {isLoadingVersions ? (
            "Loading versions..."
          ) : (
            <>
              {versions.all_versions.length} version{versions.all_versions.length !== 1 ? 's' : ''} available
              {versions.updates_available && (
                <span className="ml-2 text-green-400">
                  • Updates available
                </span>
              )}
            </>
          )}
        </div>

        {selectedVersion ? (
          <div className="mb-4">
            <div
              className="text-xs font-minecraft-ten text-center font-medium mb-1"
              style={{ color: `var(--accent)` }}
            >
              Selected: {selectedVersion.name} ({selectedVersion.version_number})
            </div>
          </div>
        ) : (
          <div className="mb-4 text-xs text-white/50 font-minecraft-ten text-center">
            Click on a version to select it for switching
          </div>
        )}

        <div className="space-y-4">
          {sortedVersions.map((version) => (
            <VersionItem
              key={version.id}
              version={version}
              isInstalled={version.id === installedVersionId}
              isSelected={selectedVersion?.id === version.id}
              onSelect={handleVersionSelect}
            />
          ))}
        </div>

        {sortedVersions.length === 0 && (
          <div className="text-center py-8 text-white/50 font-minecraft-ten">
            No versions found for this modpack.
          </div>
        )}
      </div>
    </Modal>
  );
}
