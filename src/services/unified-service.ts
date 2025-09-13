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
    return invoke<UnifiedModSearchResponse>("search_mods_unified_command", {params});
  }
}
