import type {
  ModPlatform,
  UnifiedModSearchParams,
  UnifiedModSearchResponse,
  UnifiedModVersionsParams,
  UnifiedVersionResponse,
  UnifiedProjectType,
  UnifiedSortType,
} from "../types/unified";
import { invoke } from "@tauri-apps/api/core";

export class UnifiedService {
    static async searchMods(params: UnifiedModSearchParams): Promise<UnifiedModSearchResponse> {
        return invoke<UnifiedModSearchResponse>("search_mods_unified_command", { params });
    }

    static async getModVersions(params: UnifiedModVersionsParams): Promise<UnifiedVersionResponse> {
        return invoke<UnifiedVersionResponse>("get_mod_versions_unified_command", { params });
    }
}
