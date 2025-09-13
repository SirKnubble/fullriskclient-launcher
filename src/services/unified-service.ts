import type {
  ModSource,
  UnifiedModSearchParams,
  UnifiedModSearchResponse,
  UnifiedProjectType,
  UnifiedSortType,
} from "../types/unified";
import { invoke } from "@tauri-apps/api/core";

export class UnifiedService {
  static async searchMods(params: UnifiedModSearchParams): Promise<UnifiedModSearchResponse> {
    return invoke<UnifiedModSearchResponse>("search_mods_unified_command", {
      params: {
        query: params.query,
        source: params.source,
        projectType: params.project_type,
        gameVersion: params.game_version,
        categories: params.categories,
        modLoader: params.mod_loader,
        limit: params.limit,
        offset: params.offset,
        sort: params.sort,
        clientSideFilter: params.client_side_filter,
        serverSideFilter: params.server_side_filter,
      }
    });
  }
}
