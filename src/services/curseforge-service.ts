import type {
  CurseForgeModsResponse,
  GetModsByIdsRequestBody,
} from "../types/curseforge";
import { invoke } from "@tauri-apps/api/core";

export class CurseForgeService {
  /**
   * Get multiple CurseForge mods by their IDs
   * @param modIds Array of CurseForge mod IDs
   * @param filterPcOnly Optional filter for PC-only mods
   * @returns Promise with CurseForgeModsResponse containing the requested mods
   */
  static async getModsByIds(
    modIds: number[],
    filterPcOnly?: boolean,
  ): Promise<CurseForgeModsResponse> {
    return invoke<CurseForgeModsResponse>("get_curseforge_mods_by_ids", {
      modIds,
      filterPcOnly,
    });
  }
}
