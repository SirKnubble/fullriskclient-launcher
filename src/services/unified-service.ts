import type {
  ModPlatform,
  UnifiedModSearchParams,
  UnifiedModSearchResponse,
  UnifiedModVersionsParams,
  UnifiedModpackVersionsResponse,
  UnifiedVersionResponse,
  UnifiedProjectType,
  UnifiedSortType,
  UnifiedUpdateCheckRequest,
  UnifiedUpdateCheckResponse,
  UnifiedVersion,
} from "../types/unified";
import type { ModPackSource } from "../types/profile";
import type { SwitchContentVersionPayload, ContentType } from "../types/content";
import type { LocalContentItem } from "../types/profile";
import { invoke } from "@tauri-apps/api/core";

export class UnifiedService {
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
}
