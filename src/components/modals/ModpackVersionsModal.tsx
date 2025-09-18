"use client";

import React, { useState } from "react";
import { Modal } from "../ui/Modal";
import { Icon } from "@iconify/react";
import { Button } from "../ui/buttons/Button";
import type { UnifiedModpackVersionsResponse, UnifiedVersion, ModpackSwitchRequest } from "../../types/unified";
import { UnifiedVersionType, ModPlatform } from "../../types/unified";
import UnifiedService from "../../services/unified-service";
import { toast } from "react-hot-toast";

interface ModpackVersionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  versions: UnifiedModpackVersionsResponse | null;
  modpackName: string;
  profileId?: string;
  modpackSource?: ModPlatform;
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
      className={`relative p-4 rounded-lg border transition-all duration-200 ${
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
      {/* Stats - absolute oben rechts */}
      <div className="absolute top-3 right-3 flex items-center space-x-2 text-xs text-white/50 font-minecraft-ten">
        {/* Downloads */}
        <div className="flex items-center gap-0.5">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-3 w-3"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" />
          </svg>
          <span>{formatDownloads(version.downloads)}</span>
        </div>

        {/* Datum */}
        <div className="flex items-center gap-0.5">
          <Icon icon="solar:calendar-bold" className="w-3 h-3" />
          <span>{formatDate(version.date_published)}</span>
        </div>
      </div>

      {/* Header mit Name und Installed Badge */}
      <div className="flex items-center gap-2 mb-2 pr-32">
        <h3 className="text-white font-minecraft-ten text-sm truncate">
          {version.name}
        </h3>
        {isInstalled && (
          <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded font-minecraft-ten uppercase">
            Installed
          </span>
        )}
      </div>

      {/* Version - prominent darstellen */}
      <div className="mb-2 pr-32">
        <div className="flex items-center gap-2">
          <Icon icon="solar:tag-bold" className="w-4 h-4 text-white/80" />
          <span className="text-white font-minecraft-ten text-sm font-medium">
            {version.version_number}
          </span>
          <span className={`text-xs px-2 py-0.5 rounded font-minecraft-ten uppercase ${getVersionTypeColor(version.release_type)}`}>
            {version.release_type}
          </span>
        </div>
      </div>

      {version.changelog && (
        <div className="mt-3 text-xs text-white/50 font-minecraft-ten pr-32">
          <div
            className="max-h-16 overflow-hidden"
            dangerouslySetInnerHTML={{
              __html: version.changelog.length > 200
                ? `${version.changelog.substring(0, 200)}...`
                : version.changelog
            }}
            style={{
              // Override any default styles that might interfere with our theme
              color: 'inherit',
              fontSize: 'inherit',
              fontFamily: 'inherit',
            }}
          />
        </div>
      )}

      <div className="mt-3 pr-32">
        <div className="text-xs text-white/60 font-minecraft-ten">
          <span className="text-white/70">MC: </span>
          <span className="text-white/80">
            {version.game_versions.slice(0, 3).join(', ')}
            {version.game_versions.length > 3 && (
              <span className="text-white/50"> +{version.game_versions.length - 3} more</span>
            )}
          </span>
        </div>
      </div>
    </div>
  );
}

export function ModpackVersionsModal({
  isOpen,
  onClose,
  versions,
  modpackName,
  profileId,
  modpackSource,
  onVersionSwitch,
  onSwitchComplete,
  isSwitching = false,
}: ModpackVersionsModalProps) {
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
    if (profileId && modpackSource && selectedVersion.files.length > 0) {
      try {
        // Find the primary file
        const primaryFile = selectedVersion.files.find(f => f.primary) || selectedVersion.files[0];

        const request: ModpackSwitchRequest = {
          download_url: primaryFile.url,
          platform: modpackSource,
          profile_id: profileId,
        };

        // Show loading toast
        const loadingToast = toast.loading(`Switching ${modpackName} to version ${selectedVersion.version_number}...`);

        await UnifiedService.switchModpackVersion(request);

        // Dismiss loading toast and show success
        toast.dismiss(loadingToast);
        toast.success(`Successfully switched ${modpackName} to version ${selectedVersion.version_number}!`);

        // Call completion callback if provided
        if (onSwitchComplete) {
          onSwitchComplete();
        }

        // Close modal
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
    >
      <div className="p-4">
        <div className="mb-4 text-sm text-white/70 font-minecraft-ten">
          {versions.all_versions.length} version{versions.all_versions.length !== 1 ? 's' : ''} available
          {versions.updates_available && (
            <span className="ml-2 text-green-400">
              • Updates available
            </span>
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

        <div className="space-y-4 max-h-96 overflow-y-auto">
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

        {/* Footer with Switch Version Buttons */}
        <div className="flex justify-end items-center gap-3 pt-4 border-t border-white/10">
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
            {isSwitching ? "Switching..." : selectedVersion ? (profileId && modpackSource ? "Switch Version" : "Switch Version (Legacy)") : "Select a Version"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
