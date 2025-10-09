import React, { useEffect, useState } from 'react';
import type { Profile } from '../types/profile';
import type { UnifiedModpackVersionsResponse } from '../types/unified';
import UnifiedService from '../services/unified-service';
import { useDebugMode } from './useDebugMode';
import { useModUpdateText } from '../components/ui/ModUpdateText';

interface ModpackDebugInfoProps {
  profile: Profile;
}

/**
 * Debug component that shows ModPack information
 * Only renders when debug mode is enabled
 */
export function ModpackDebugInfo({ profile }: ModpackDebugInfoProps) {
  const isDebugMode = useDebugMode();
  const { getUpdateText } = useModUpdateText();
  const [modpackVersions, setModpackVersions] = useState<UnifiedModpackVersionsResponse | null>(null);

  // Only load data if debug mode is enabled and profile has modpack info
  useEffect(() => {
    if (isDebugMode && profile.modpack_info) {
      UnifiedService.getModpackVersions(profile.modpack_info.source)
        .then(setModpackVersions)
        .catch(err => console.error("Failed to load modpack versions:", err));
    }
  }, [isDebugMode, profile.modpack_info]);

  // Don't render anything if debug mode is disabled or no modpack info
  if (!isDebugMode || !profile.modpack_info || !modpackVersions) {
    return null;
  }

  // Find latest version by sorting by date_published
  const latestVersion = modpackVersions.all_versions
    .sort((a, b) => new Date(b.date_published).getTime() - new Date(a.date_published).getTime())[0];

  const isLatest = modpackVersions.installed_version?.id === latestVersion?.id;

  return (
    <div className="fixed top-4 right-4 bg-black/80 p-3 rounded text-xs font-minecraft-ten z-50 max-w-xs">
      <div className="text-yellow-400 mb-1">DEBUG MODPACK INFO</div>
        <div className="text-white/70 space-y-1">
          <div>Source: {profile.modpack_info.source.source}</div>
          {profile.modpack_info.source.source === 'modrinth' && (
            <>
              <div>PID: {profile.modpack_info.source.project_id}</div>
              <div>VID: {profile.modpack_info.source.version_id}</div>
            </>
          )}
          {profile.modpack_info.source.source === 'curse_forge' && (
            <>
              <div>PID: {profile.modpack_info.source.project_id}</div>
              <div>FID: {profile.modpack_info.source.file_id}</div>
            </>
          )}
          <div>Hash: {profile.modpack_info.file_hash || 'none'}</div>
          <div>Versions: {modpackVersions.all_versions.length}</div>
          <div>Updates: {modpackVersions.updates_available ? 'YES' : 'NO'}</div>
          {modpackVersions.installed_version && (
            <div>Installed: {modpackVersions.installed_version.name}</div>
          )}
          {latestVersion && (
            <div>Latest: {latestVersion.name} {!isLatest && <span className="text-green-400">← UPDATE</span>}</div>
          )}
          {/* Show mod info if available */}
          {profile.mods.length > 0 && (
            <div>Mods: {profile.mods.length} total</div>
          )}
          {profile.mods.some(mod => mod.modpack_origin) && (
            <div>Pack-Mods: {profile.mods.filter(mod => mod.modpack_origin).length}</div>
          )}
          {profile.mods.some(mod => mod.modpack_origin && mod.updates_enabled === false) && (
            <div>Pack-Mods-Auto-Disabled: {profile.mods.filter(mod => mod.modpack_origin && mod.updates_enabled === false).length}</div>
          )}
          {profile.mods.some(mod => mod.updates_enabled === true) && (
            <div>Updates-Enabled: {profile.mods.filter(mod => mod.updates_enabled === true).length}</div>
          )}
          {/* Show formatted update examples */}
          {profile.mods.filter(mod => mod.modpack_origin).slice(0, 2).map((mod, idx) => {
            if (!latestVersion) return null;
            return (
              <div key={idx} style={{ fontSize: '9px' }} className="mt-1 opacity-80">
                <div className="text-purple-300 font-bold">Pack-Mod {idx + 1}:</div>
                <div className="text-gray-400 ml-1">
                  {getUpdateText(true, latestVersion, mod.version || "1.0.0")}
                </div>
              </div>
            );
          })}
        </div>
    </div>
  );
}
