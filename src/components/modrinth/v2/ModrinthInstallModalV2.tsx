"use client";

import React, { useState, useEffect } from 'react';
import type {
  ModrinthSearchHit,
  ModrinthVersion,
} from '../../../types/modrinth';
import { Icon } from '@iconify/react';
import { Modal } from '../../ui/Modal';
import { Button } from '../../ui/buttons/Button';
import { useThemeStore } from '../../../store/useThemeStore';
import { cn } from '../../../lib/utils';
import { TagBadge } from '../../ui/TagBadge';
import { ModrinthQuickProfile } from './ModrinthQuickProfile';
// Potentially import Profile type if available and not 'any'
// import type { Profile } from '../../../types/profile';

// Simplified Profile type for props, consistent with ModrinthQuickProfile
interface ProfileForItem {
  id: string;
  name: string;
  game_version?: string; // Optional, as it's used in the list view
  loader?: string;      // Optional
}

interface ModrinthInstallModalV2Props {
  isOpen: boolean;
  onClose: () => void;
  project: ModrinthSearchHit | null;
  version: ModrinthVersion | null;
  profiles: ProfileForItem[]; // Using the simplified type
  selectedProfileId?: string | null;
  isLoadingStatus: boolean;
  installStatus: Record<string, boolean>;
  installingProfiles: Record<string, boolean>;
  onInstallToProfile: (profileId: string) => void;
  onUninstallClick?: (profileId: string, project: ModrinthSearchHit, version: ModrinthVersion) => Promise<void>;
  onInstallToNewProfile: (
    profileName: string, 
    project: ModrinthSearchHit, 
    version: ModrinthVersion,
    sourceProfileIdToCopy?: string | null // Added for copying
  ) => Promise<void>;
}

export const ModrinthInstallModalV2: React.FC<ModrinthInstallModalV2Props> = ({
  isOpen,
  onClose,
  project,
  version,
  profiles, // This is the list of all available profiles
  selectedProfileId,
  isLoadingStatus,
  installStatus,
  installingProfiles,
  onInstallToProfile,
  onUninstallClick,
  onInstallToNewProfile,
}) => {
  const [showQuickProfileView, setShowQuickProfileView] = useState(false);
  const [isCreatingProfile, setIsCreatingProfile] = useState(false);
  const accentColor = useThemeStore((state) => state.accentColor);

  // State for the new profile name input, managed by this modal
  const [quickProfileName, setQuickProfileName] = useState('');
  const [quickProfileError, setQuickProfileError] = useState<string | null>(null);
  const [creationResult, setCreationResult] = useState<'success' | 'error' | null>(null); // New state
  const [lastErrorMessage, setLastErrorMessage] = useState<string | null>(null);

  // New states for profile copying
  const [sourceProfileToCopyId, setSourceProfileToCopyId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setShowQuickProfileView(false);
      setIsCreatingProfile(false);
      setQuickProfileName(''); // Reset on close
      setQuickProfileError(null); // Reset on close
      setCreationResult(null); // Reset on close
      setLastErrorMessage(null); // Reset on close
      // Reset copying states on close
      setSourceProfileToCopyId(null);
    }
  }, [isOpen]);

  if (!isOpen || !project || !version) return null;

  const switchToQuickProfileView = () => {
    setQuickProfileName(''); // Set to empty string
    setQuickProfileError(null);
    setCreationResult(null); // Clear any previous result when switching views
    // Reset copying states when switching to this view
    setSourceProfileToCopyId(null);
    setShowQuickProfileView(true);
  };

  const switchToProfileListView = () => {
    setShowQuickProfileView(false);
    setQuickProfileName('');
    setQuickProfileError(null);
    setCreationResult(null); // Clear any previous result
    // Also reset copying states here, although less critical
    setSourceProfileToCopyId(null);
  };

  const isActuallyCopying = sourceProfileToCopyId !== null;

  const handleCreateAndInstallProfile = async () => {
    if (!quickProfileName.trim()) {
      setQuickProfileError("Profile name cannot be empty.");
      return;
    }
    setQuickProfileError(null);
    setLastErrorMessage(null);
    
    setIsCreatingProfile(true);
    try {
      await onInstallToNewProfile(
        quickProfileName.trim(), 
        project, 
        version, 
        sourceProfileToCopyId // Directly pass the ID, it will be null if not copying
      );
      setCreationResult('success'); 
    } catch (error: any) {
      console.error("Error in handleCreateAndInstallProfile:", error);
      setCreationResult('error');
      setLastErrorMessage(error?.message || "An unknown error occurred during profile creation.");
    } finally {
      setIsCreatingProfile(false);
    }
  };

  const handleModalClose = () => {
    setShowQuickProfileView(false); 
    setIsCreatingProfile(false);
    setQuickProfileName('');
    setQuickProfileError(null);
    setCreationResult(null); // Reset creation result
    setLastErrorMessage(null);
    setSourceProfileToCopyId(null); // Reset source profile
    onClose();
  };

  let modalContentLayout;
  if (creationResult === 'success') {
    modalContentLayout = (
      <div className="p-4 text-center space-y-3">
        <Icon icon="solar:check-circle-bold" className="w-16 h-16 text-green-500 mx-auto" />
        <h3 className="text-xl font-semibold text-gray-100">
          {isActuallyCopying ? 'Profile Copied' : 'Profile Created'} & Content Installed!
        </h3>
        <p className="text-sm text-gray-300 font-minecraft-ten">
          {project.title} (v{version.version_number}) has been successfully installed into the new profile '{quickProfileName.trim()}'.
          {isActuallyCopying && sourceProfileToCopyId && ` (Copied from ${profiles.find(p=>p.id === sourceProfileToCopyId)?.name || 'source'})`}
        </p>
      </div>
    );
  } else if (creationResult === 'error') {
    modalContentLayout = (
      <div className="p-4 text-center space-y-3">
        <Icon icon="solar:close-circle-bold" className="w-16 h-16 text-red-500 mx-auto" />
        <h3 className="text-xl font-semibold text-gray-100">Operation Failed</h3>
        <p className="text-sm text-red-400">
          {lastErrorMessage || `An error occurred while ${isActuallyCopying ? 'copying the profile' : 'creating the profile'} or installing content.`}
        </p>
        {/* Optional: Add a retry button here if applicable, which might call handleCreateAndInstallProfile again */}
        {/* For now, only close is available in footer */}
      </div>
    );
  } else if (showQuickProfileView) {
    modalContentLayout = (
      <ModrinthQuickProfile
        accentColor={accentColor}
        projectTitle={project.title}
        versionNumber={version.version_number}
        profileName={quickProfileName}
        onProfileNameChange={(name) => {
          setQuickProfileName(name);
          if (quickProfileError && name.trim()) setQuickProfileError(null); 
        }}
        error={quickProfileError}
        isLoading={isCreatingProfile} 
        selectedSourceProfileId={sourceProfileToCopyId}
        onSourceProfileChange={setSourceProfileToCopyId}
      />
    );
  } else {
    modalContentLayout = (
      <>
        <div className="mb-1 mt-1">
          <p className="text-gray-300 mb-2 text-base font-minecraft-ten">Select Profile(s) to install to:</p>
          {isLoadingStatus ? (
            <div className="flex justify-center items-center py-6">
              <svg
                className="animate-spin h-8 w-8 text-blue-500"
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
              <span className="ml-3 text-gray-300">Loading profiles...</span>
            </div>
          ) : (
            <div
              className="max-h-60 overflow-y-auto border custom-scrollbar"
              style={{ borderColor: `${accentColor.value}80` }}
            >
              {profiles.length > 0 ? (
                [...profiles]
                  .sort((a, b) => {
                    if (a.id === selectedProfileId) return -1;
                    if (b.id === selectedProfileId) return 1;
                    return 0;
                  })
                  .map((profile) => (
                    <div
                      key={profile.id}
                      className={cn(
                        "p-3 border-b last:border-b-0 flex justify-between items-center hover:bg-white/10 transition-colors duration-150"
                      )}
                      style={{
                        backgroundColor: profile.id === selectedProfileId ? `${accentColor.value}50` : `${accentColor.value}30`,
                        borderBottomColor: `${accentColor.value}80`,
                      }}
                    >
                      <div className="flex-grow mr-3 min-w-0">
                        <span className="font-medium text-base font-minecraft-ten block mb-0.5 truncate">{profile.name}</span>
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          <TagBadge variant="info" className="text-xs">
                            {profile.game_version}
                          </TagBadge>
                          {profile.loader && (
                            <TagBadge variant="info" className="text-xs">
                              {profile.loader}
                            </TagBadge>
                          )}
                        </div>
                        {profile.id === selectedProfileId && (
                          <span className="block mt-1 text-xs text-green-400 font-minecraft-ten">
                            (Current Profile)
                          </span>
                        )}
                      </div>

                      {installingProfiles[profile.id] ? (
                        <Button
                          size="xs"
                          variant="secondary"
                          disabled
                          shadowDepth="short"
                          icon={<svg
                            className="animate-spin h-3 w-3 text-white"
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
                          </svg>}
                          iconPosition="left"
                          className="flex-shrink-0"
                        >
                          Installing...
                        </Button>
                      ) : installStatus[profile.id] ? (
                        <Button
                          onClick={async () => {
                            if (onUninstallClick && project && version) {
                              try {
                                await onUninstallClick(profile.id, project, version);
                                // Optimistically update modal's internal state if needed, or rely on parent re-render
                                // For now, parent state change via onInstallSuccess in handleDelete will trigger re-render.
                              } catch (err) {
                                // Error is usually handled by toast in the handler itself
                                console.error("Uninstall from modal failed:", err);
                              }
                            }
                          }}
                          size="xs"
                          variant="destructive"
                          shadowDepth="short"
                          icon={<Icon icon="solar:trash-bin-trash-bold" className="w-3.5 h-3.5" />}
                          iconPosition="left"
                          className="flex-shrink-0"
                          disabled={!onUninstallClick} // Disable if handler not provided
                        >
                          Uninstall
                        </Button>
                      ) : (
                        <Button
                          onClick={() => onInstallToProfile(profile.id)}
                          size="xs"
                          variant={"success"} // No need for ternary, installing state handled above
                          shadowDepth="short"
                          icon={<Icon icon="solar:download-minimalistic-bold" className="w-3.5 h-3.5" />}
                          iconPosition="left"
                          className="flex-shrink-0"
                        >
                          Install
                        </Button>
                      )}
                    </div>
                  ))
              ) : (
                <p className="p-4 text-center text-gray-400">
                  No profiles available. You can create a new one.
                </p>
              )}
            </div>
          )}
        </div>
        <p className="text-gray-400 text-xs text-center font-minecraft-ten mt-2">
          This will install version {version.version_number} of {project.title}.
        </p>
      </>
    );
  }
  
  return (
    <Modal
      title={ (showQuickProfileView && !creationResult) 
                ? (isActuallyCopying ? `Copy & Install: ${project.title}` : `New Profile for: ${project.title}`) 
                : `Install: ${project.title}`
            }
      titleIcon={(showQuickProfileView && !creationResult && isActuallyCopying) 
                  ? <Icon icon="solar:copy-bold-duotone" className="w-5 h-5 mr-2" /> 
                  : (showQuickProfileView && !creationResult) 
                    ? <Icon icon="solar:folder-with-files-bold-duotone" className="w-5 h-5 mr-2" /> 
                    : <Icon icon="material-symbols:download-for-offline-outline" className="w-5 h-5" />
                }
      onClose={handleModalClose}
      width="lg" // Adjusted width to give more space for profile list and quick profile view
      footer={
        <div className="flex justify-between items-center w-full">
          {creationResult ? (
            <div className="w-full flex justify-end"> {/* Ensure close button is on the right */} 
              <Button onClick={handleModalClose} variant="secondary" shadowDepth="short">
                Close
              </Button>
            </div>
          ) : showQuickProfileView ? (
            <>
              <Button
                variant="secondary"
                onClick={switchToProfileListView} 
                disabled={isCreatingProfile}
                shadowDepth="short"
                size="sm"
                icon={<Icon icon="solar:arrow-left-linear" className="w-4 h-4" />}
                className="mr-auto" 
              >
                Back to Profiles
              </Button>
              <Button 
                variant="success"
                onClick={handleCreateAndInstallProfile} 
                disabled={isCreatingProfile || !quickProfileName.trim() || (isActuallyCopying && !sourceProfileToCopyId)}
                shadowDepth="short"
                size="sm"
                icon={isCreatingProfile ? <Icon icon="line-md:loading-twotone-loop" className="w-4 h-4" /> : <Icon icon="solar:disk-bold-duotone" className="w-4 h-4" />}
              >
                {isCreatingProfile 
                  ? (isActuallyCopying ? "Copying & Installing..." : "Creating...") 
                  : (isActuallyCopying ? "Copy & Install" : "Create & Install")}
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="secondary"
                onClick={switchToQuickProfileView} 
                icon={<Icon icon="solar:add-folder-line-duotone" className="w-4 h-4 mr-1" />}
                shadowDepth="short"
                size="sm"
                className="mr-auto" 
              >
                Install as New Profile
              </Button>
              <Button 
                onClick={handleModalClose} 
                variant="secondary" 
                shadowDepth="short"
                size="sm"
              >
                Close
              </Button>
            </>
          )}
        </div>
      }
    >
      <div className="px-1 sm:px-2 md:px-4 py-2 sm:py-3 md:py-4">
         {modalContentLayout}
      </div>
    </Modal>
  );
}; 