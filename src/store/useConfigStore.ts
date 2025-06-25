import { create } from "zustand";
import * as ConfigService from "../services/launcher-config-service";

interface FriendsConfigStore {
  openFriendsInWindow: boolean;
  isLoading: boolean;
  loadSetting: () => Promise<void>;
  updateSetting: (value: boolean) => Promise<void>;
}

export const useFriendsConfigStore = create<FriendsConfigStore>((set, get) => ({
  openFriendsInWindow: false,
  isLoading: false,

  loadSetting: async () => {
    set({ isLoading: true });
    try {
      const config = await ConfigService.getLauncherConfig();
      set({
        openFriendsInWindow: config.open_friends_in_window || false,
        isLoading: false,
      });
    } catch (error) {
      console.error("Failed to load friends config:", error);
      set({ isLoading: false });
    }
  },

  updateSetting: async (value: boolean) => {
    try {
      const currentConfig = await ConfigService.getLauncherConfig();
      const newConfig = { ...currentConfig, open_friends_in_window: value };
      await ConfigService.setLauncherConfig(newConfig);
      set({ openFriendsInWindow: value });
    } catch (error) {
      console.error("Failed to update friends config:", error);
      throw error;
    }
  },
}));
