import {
  ModPlatform,
  type UnifiedModSearchParams,
  type UnifiedModSearchResponse,
  type UnifiedModVersionsParams,
  type UnifiedModpackVersionsResponse,
  type UnifiedVersionResponse,
  type UnifiedProjectType,
  type UnifiedSortType,
  type UnifiedUpdateCheckRequest,
  type UnifiedUpdateCheckResponse,
  type UnifiedVersion,
  type ModpackSwitchRequest,
  type ModpackSwitchResponse,
} from "../types/unified";
import type { ModPackSource } from "../types/profile";
import type { SwitchContentVersionPayload, ContentType } from "../types/content";
import type { LocalContentItem } from "../types/profile";
import { invoke } from "@tauri-apps/api/core";

class UnifiedService {
    static async searchMods(params: UnifiedModSearchParams): Promise<UnifiedModSearchResponse> {
        return invoke<UnifiedModSearchResponse>("search_mods_unified_command", { params });
    }

    static async getModVersions(params: UnifiedModVersionsParams): Promise<UnifiedVersionResponse> {
        return invoke<UnifiedVersionResponse>("get_mod_versions_unified_command", { params });
    }

    static async checkModUpdates(request: UnifiedUpdateCheckRequest): Promise<UnifiedUpdateCheckResponse> {
        return invoke<UnifiedUpdateCheckResponse>("check_mod_updates_unified_command", { request });
    }

    static async getModpackVersions(modpackSource: ModPackSource): Promise<UnifiedModpackVersionsResponse> {
        return invoke<UnifiedModpackVersionsResponse>("get_modpack_versions_unified_command", {
            modpackSource
        });
    }

    static async switchContentVersion(
        profileId: string,
        contentType: ContentType,
        currentItem: LocalContentItem,
        newVersion: UnifiedVersion
    ): Promise<void> {
        const payload: SwitchContentVersionPayload = {
            profile_id: profileId,
            content_type: contentType,
            current_item_details: { ...currentItem, path_str: currentItem.path_str },
            new_version_details: newVersion,
        };

        return invoke("switch_content_version", { payload });
    }

    static async switchModpackVersion(request: ModpackSwitchRequest): Promise<ModpackSwitchResponse> {
        console.log("Switching modpack version", request);

        // Convert platform to ModPlatform enum if it's a ModPackSource
        let platform: ModPlatform;
        if (typeof request.platform === 'string') {
            platform = request.platform as ModPlatform;
        } else {
            // It's a ModPackSource, extract the platform
            platform = request.platform.source === 'modrinth' ? ModPlatform.Modrinth : ModPlatform.CurseForge;
        }

        const convertedRequest = {
            download_url: request.download_url,
            platform: platform,
            profile_id: request.profile_id
        };

        return invoke("switch_modpack_version_command", { request: convertedRequest });
    }
}

export default UnifiedService;
