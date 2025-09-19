import * as ProfileService from '../services/profile-service';
import { toast } from 'react-hot-toast';
import { Modal } from '../components/ui/Modal';
import { Button } from '../components/ui/buttons/Button';
import { Icon } from '@iconify/react';
import { useThemeStore } from '../store/useThemeStore';

/**
 * Checks if a profile's loader is compatible with Iris shader mod
 * Iris only works with Fabric, Quilt, and NeoForge
 */
export async function isLoaderCompatibleWithIris(profileId: string): Promise<boolean> {
  try {
    const profile = await ProfileService.getProfile(profileId);
    const loader = profile.loader;

    // Iris is compatible with Fabric, Quilt, and NeoForge
    const compatibleLoaders = ['fabric', 'quilt', 'neoforge'];
    const isCompatible = compatibleLoaders.includes(loader);

    console.log(`🔧 [IrisDetection] Profile ${profileId} uses loader: ${loader}`);
    console.log(`🔧 [IrisDetection] Loader ${loader} is ${isCompatible ? 'COMPATIBLE' : 'NOT COMPATIBLE'} with Iris`);

    return isCompatible;
  } catch (error) {
    console.warn(`[IrisDetection] Failed to check loader compatibility for profile ${profileId}:`, error);
    return false; // Assume not compatible if we can't check
  }
}

/**
 * Checks if Iris shader mod is installed in a given profile
 * Only checks for Iris if the profile's loader is compatible with Iris
 */
export async function isIrisInstalled(profileId: string): Promise<boolean> {
  console.log(`🔍 [IrisDetection] Checking if Iris is installed in profile: ${profileId}`);

  try {
    // First check if the loader is compatible with Iris
    const isLoaderCompatible = await isLoaderCompatibleWithIris(profileId);
    if (!isLoaderCompatible) {
      console.log(`🔍 [IrisDetection] Profile ${profileId} uses incompatible loader, skipping Iris check`);
      return true; // Return true to skip the Iris warning since it's not applicable
    }

    // Get the full profile to check installed mods
    const profile = await ProfileService.getProfile(profileId);
    console.log(`🔍 [IrisDetection] Profile loaded, checking ${profile.mods.length} mods for Iris`);

    // Iris project IDs for different platforms
    const irisProjectIds = {
      modrinth: 'YL57xq9U',      // Iris on Modrinth
      curseforge: '455508'       // Iris on CurseForge
    };

    // Check if any mod is Iris using multiple methods
    const irisMod = profile.mods.find(mod => {
      // Method 1: Check display name and filename for "iris"
      const displayName = mod.display_name?.toLowerCase() || '';
      const fileName = mod.id?.toLowerCase() || '';
      const nameMatch = displayName.includes('iris') || fileName.includes('iris');

      // Method 2: Check specific project IDs for Modrinth and CurseForge
      let projectIdMatch = false;
      if (mod.source.type === 'modrinth') {
        projectIdMatch = mod.source.project_id === irisProjectIds.modrinth;
      } else if (mod.source.type === 'curseforge') {
        projectIdMatch = mod.source.project_id === irisProjectIds.curseforge;
      }

      const isIris = nameMatch || projectIdMatch;

      if (isIris) {
        console.log(`🎯 [IrisDetection] Found Iris via ${nameMatch ? 'name' : 'project ID'}: ${mod.display_name || mod.id} (${mod.source.type})`);
      }

      return isIris;
    });

    const isInstalled = !!irisMod;
    console.log(`✅ [IrisDetection] Iris installation status for profile ${profileId}: ${isInstalled ? 'INSTALLED' : 'NOT INSTALLED'}`);

    if (irisMod) {
      console.log(`🎨 [IrisDetection] Found Iris mod: ${irisMod.display_name || irisMod.id} (${irisMod.source.type})`);
    }

    return isInstalled;
  } catch (error) {
    console.warn(`[IrisDetection] Failed to check Iris installation for profile ${profileId}:`, error);
    return false;
  }
}

/**
 * Checks if Iris shader mod is installed in a profile
 * Note: This is now just an alias for isIrisInstalled for backward compatibility
 */
export async function hasShaderModsInstalled(profileId: string): Promise<boolean> {
  console.log(`🔍 [IrisDetection] hasShaderModsInstalled called for profile: ${profileId} (delegating to isIrisInstalled)`);
  const result = await isIrisInstalled(profileId);
  console.log(`✅ [IrisDetection] hasShaderModsInstalled result for profile ${profileId}: ${result}`);
  return result;
}

/**
 * Validates if a profile has Iris shader mod installed
 * Returns an object with validation results
 */
export async function validateShaderSetup(profileId: string): Promise<{
  hasIris: boolean;
  needsIris: boolean;
  message: string;
}> {
  console.log(`🔍 [IrisDetection] validateShaderSetup called for profile: ${profileId}`);

  const hasIris = await isIrisInstalled(profileId);
  const needsIris = !hasIris;

  let message = '';
  if (hasIris) {
    message = 'Iris shader mod is installed - shader packs will work optimally';
  } else {
    message = 'Iris shader mod is required for optimal shader pack performance';
  }

  console.log(`📊 [IrisDetection] validateShaderSetup result for profile ${profileId}:`, {
    hasIris,
    needsIris,
    message
  });

  return {
    hasIris,
    needsIris,
    message
  };
}

/**
 * React component for Iris shader mod required modal
 * @param projectTitle - Name of the shader pack being installed
 * @param profileId - Profile ID where the shader pack was installed
 * @param installType - Type of installation (e.g., "Direct install", "Quick install", etc.)
 * @param onInstallIris - Callback function to install Iris
 * @param onClose - Callback function to close the modal
 */
export function IrisRequiredModal({
  projectTitle,
  profileId,
  installType = "Installation",
  onInstallIris,
  onClose
}: {
  projectTitle: string;
  profileId: string;
  installType?: string;
  onInstallIris?: () => void;
  onClose: () => void;
}) {
  const accentColor = useThemeStore((state) => state.accentColor);

  console.log(`⚠️ [ModrinthSearchV2] ${installType}: Iris NOT found in profile ${profileId}, showing modal notification`);
  console.log(`🎨 [ModrinthSearchV2] ${installType}: Showing Iris requirement modal for shader pack '${projectTitle}'`);

  const modalFooter = (
    <div className="flex justify-end items-center gap-3">
      <Button
        variant="secondary"
        onClick={onClose}
      >
        Skip Shader Mod
      </Button>
      {onInstallIris && (
        <Button
          onClick={onInstallIris}
          icon={<Icon icon="ph:download-simple-bold" className="w-4 h-4" />}
        >
          Install Iris
        </Button>
      )}
    </div>
  );

  return (
    <Modal
      title="Shader Pack Setup"
      titleIcon={<Icon icon="solar:eye-bold" className="w-6 h-6" style={{ color: accentColor.value }} />}
      onClose={onClose}
      width="md"
      footer={modalFooter}
    >
      <div className="p-6">
        <div className="space-y-6">
        {/* Main warning section */}
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">
            <Icon icon="solar:warning-triangle-bold" className="w-8 h-8 text-yellow-400" />
          </div>
          <div className="flex-1 space-y-3">
            <p className="text-white/80 font-minecraft-ten leading-relaxed">
              You installed <span className="text-white font-medium">"{projectTitle}"</span> shader pack, but you don't have a shader mod like
              <span style={{ color: accentColor.value }} className="font-medium"> Iris</span> installed!
            </p>
            <p className="text-white/70 font-minecraft-ten leading-relaxed">
              <strong className="text-yellow-400">You need Iris (or similar)</strong> to display and use shader packs properly.
            </p>
          </div>
        </div>

        {/* Performance warning */}
        <div className="p-4 rounded-lg bg-yellow-500/10 border-2 border-yellow-500/30">
          <div className="flex items-center gap-3">
            <Icon icon="solar:info-circle-bold" className="w-5 h-5 text-yellow-400 flex-shrink-0" />
            <p className="text-yellow-200 font-minecraft-ten text-sm leading-relaxed">
              Shader mods like Iris can reduce performance
              <strong className="text-yellow-400"> even when shaders are disabled</strong>. Keep this in mind!
            </p>
          </div>
        </div>

        </div>
      </div>
    </Modal>
  );
}

/**
 * Legacy function for backward compatibility - now opens a modal instead of toast
 * @deprecated Use IrisRequiredModal component instead
 */
export function createIrisRequiredModal(
  projectTitle: string,
  profileId: string,
  installType: string = "Installation",
  onInstallIris?: () => void,
  onClose?: () => void
) {
  console.log(`⚠️ [ModrinthSearchV2] ${installType}: Iris NOT found in profile ${profileId}, showing modal notification`);
  console.log(`🎨 [ModrinthSearchV2] ${installType}: Showing Iris requirement modal for shader pack '${projectTitle}'`);

  // This function is deprecated - use IrisRequiredModal component with proper modal management
  console.warn('createIrisRequiredModal is deprecated. Use IrisRequiredModal component with useGlobalModal instead.');
}

/**
 * Legacy function for backward compatibility - now opens a modal instead of toast
 * @deprecated Use createIrisRequiredModal instead
 */
export function showIrisRequiredToast(
  projectTitle: string,
  profileId: string,
  installType: string = "Installation"
): void {
  console.log(`⚠️ [ModrinthSearchV2] ${installType}: Iris NOT found in profile ${profileId}, showing modal notification`);
  console.log(`🎨 [ModrinthSearchV2] ${installType}: Showing Iris requirement modal for shader pack '${projectTitle}'`);

  // This function is deprecated - use createIrisRequiredModal with proper modal management
  console.warn('showIrisRequiredToast is deprecated. Use createIrisRequiredModal with useGlobalModal instead.');
}

/**
 * Shows success log when Iris is already installed
 * @param profileId - Profile ID where Iris was found
 * @param installType - Type of installation (e.g., "Direct install", "Quick install", etc.)
 */
export function showIrisAlreadyInstalledLog(profileId: string, installType: string = "Installation"): void {
  console.log(`✅ [ModrinthSearchV2] ${installType}: Iris already installed in profile ${profileId}, no toast needed`);
}

/**
 * Shows initial log when checking for Iris after shader pack installation
 * @param projectTitle - Name of the shader pack being installed
 * @param profileId - Profile ID where the shader pack was installed
 * @param installType - Type of installation (e.g., "Direct install", "Quick install", etc.)
 */
export function showIrisCheckStartLog(
  projectTitle: string,
  profileId: string,
  installType: string = "Installation"
): void {
  console.log(`🎨 [ModrinthSearchV2] ${installType}: Shader pack '${projectTitle}' installed to profile ${profileId}, checking for Iris...`);
}

/**
 * Shows error log when Iris check fails
 * @param profileId - Profile ID where the check failed
 * @param installType - Type of installation (e.g., "Direct install", "Quick install", etc.)
 * @param error - The error that occurred
 */
export function showIrisCheckErrorLog(
  profileId: string,
  installType: string = "Installation",
  error: any
): void {
  console.warn(`[ModrinthSearchV2] ${installType}: Failed to check Iris installation status for profile ${profileId}:`, error);
}

/**
 * Comprehensive function to handle Iris detection, logging and modal display for shader pack installations
 * @param projectTitle - Name of the shader pack being installed
 * @param profileId - Profile ID where the shader pack was installed
 * @param projectId - Project ID for unique modal identification
 * @param installType - Type of installation (e.g., "Direct install", "Quick install", etc.)
 * @param showModal - Function to show modal (from useGlobalModal)
 * @param hideModal - Function to hide modal (from useGlobalModal)
 * @param onInstallIris - Optional callback when user clicks "Install Iris Now"
 */
export async function handleIrisCheckAndShowModal(
  projectTitle: string,
  profileId: string,
  projectId: string,
  installType: string = "Installation",
  showModal: (id: string, component: React.ReactNode, zIndex?: number) => void,
  hideModal: (id: string) => void,
  onInstallIris?: () => void
): Promise<boolean> {
  showIrisCheckStartLog(projectTitle, profileId, installType);

  try {
    const hasIris = await isIrisInstalled(profileId);
    if (!hasIris) {
      // Show modal immediately to alert user quickly
      const modalId = `iris-required-${projectId}-${Date.now()}`;
      showModal(
        modalId,
        <IrisRequiredModal
          projectTitle={projectTitle}
          profileId={profileId}
          installType={installType}
          onInstallIris={() => {
            // Call custom install callback if provided
            if (onInstallIris) {
              onInstallIris();
            } else {
              // Default behavior: log and close modal
              console.log('🎯 User clicked "Install Iris Now" - implement Iris installation logic here');
            }
            hideModal(modalId);
          }}
          onClose={() => hideModal(modalId)}
        />,
        1200
      );

      return false; // Iris is not installed
    } else {
      showIrisAlreadyInstalledLog(profileId, installType);
      return true; // Iris is installed
    }
  } catch (error) {
    showIrisCheckErrorLog(profileId, installType, error);
    return false; // Error occurred, assume Iris is not installed
  }
}

/**
 * Legacy function for backward compatibility - now handles modal instead of toast
 * @param projectTitle - Name of the shader pack being installed
 * @param profileId - Profile ID where the shader pack was installed
 * @param installType - Type of installation (e.g., "Direct install", "Quick install", etc.)
 * @deprecated Use handleIrisCheckAndShowModal instead
 */
export async function handleIrisCheckForShaderPack(
  projectTitle: string,
  profileId: string,
  installType: string = "Installation"
): Promise<boolean> {
  showIrisCheckStartLog(projectTitle, profileId, installType);

  try {
    const hasIris = await isIrisInstalled(profileId);
    if (!hasIris) {
      showIrisRequiredToast(projectTitle, profileId, installType);
      return false; // Iris is not installed
    } else {
      showIrisAlreadyInstalledLog(profileId, installType);
      return true; // Iris is installed
    }
  } catch (error) {
    showIrisCheckErrorLog(profileId, installType, error);
    return false; // Error occurred, assume Iris is not installed
  }
}
