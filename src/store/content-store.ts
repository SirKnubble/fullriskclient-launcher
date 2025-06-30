import { create } from "zustand";
import * as ProfileService from "../services/profile-service";

interface ContentState {
  mods: any[];
  resourcePacks: any[];
  shaderPacks: any[];
  customMods: any[];
  loading: {
    mods: boolean;
    resourcePacks: boolean;
    shaderPacks: boolean;
    customMods: boolean;
  };
  error: {
    mods: string | null;
    resourcePacks: string | null;
    shaderPacks: string | null;
    customMods: string | null;
  };

  fetchCustomMods: (profileId: string) => Promise<void>;
  fetchResourcePacks: (profileId: string) => Promise<void>;
  fetchShaderPacks: (profileId: string) => Promise<void>;

  addModrinthMod: (
    profileId: string,
    projectId: string,
    versionId: string,
    fileName: string,
    downloadUrl: string,
    fileHashSha1?: string,
    modName?: string,
    versionNumber?: string,
    loaders?: string[],
    gameVersions?: string[],
  ) => Promise<void>;

  addModrinthContent: (
    profileId: string,
    projectId: string,
    versionId: string,
    fileName: string,
    downloadUrl: string,
    contentType: string,
    fileHashSha1?: string,
    contentName?: string,
    versionNumber?: string,
  ) => Promise<void>;

  setModEnabled: (
    profileId: string,
    modId: string,
    enabled: boolean,
  ) => Promise<void>;
  setCustomModEnabled: (
    profileId: string,
    filename: string,
    enabled: boolean,
  ) => Promise<void>;
  deleteCustomMod: (profileId: string, filename: string) => Promise<void>;
  importLocalMods: (profileId: string) => Promise<void>;
}

export const useContentStore = create<ContentState>((set) => ({
  mods: [],
  resourcePacks: [],
  shaderPacks: [],
  customMods: [],
  loading: {
    mods: false,
    resourcePacks: false,
    shaderPacks: false,
    customMods: false,
  },
  error: {
    mods: null,
    resourcePacks: null,
    shaderPacks: null,
    customMods: null,
  },

  fetchCustomMods: async (profileId: string) => {
    try {
      set((state) => ({
        loading: { ...state.loading, customMods: true },
        error: { ...state.error, customMods: null },
      }));

      const customMods = await ProfileService.getCustomMods(profileId);

      set((state) => ({
        customMods,
        loading: { ...state.loading, customMods: false },
      }));
    } catch (error) {
      set((state) => ({
        loading: { ...state.loading, customMods: false },
        error: { ...state.error, customMods: error instanceof Error ? error.message : "Failed to load custom mods" },
      }));
    }
  },

  fetchResourcePacks: async (profileId: string) => {
    try {
      set((state) => ({
        loading: { ...state.loading, resourcePacks: true },
        error: { ...state.error, resourcePacks: null },
      }));

      const resourcePacks =
        await ProfileService.getLocalResourcepacks(profileId);

      set((state) => ({
        resourcePacks,
        loading: { ...state.loading, resourcePacks: false },
      }));
    } catch (error) {
      set((state) => ({
        loading: { ...state.loading, resourcePacks: false },
        error: {
          ...state.error,
          resourcePacks: error instanceof Error ? error.message : "Failed to load resource packs",
        },
      }));
    }
  },

  fetchShaderPacks: async (profileId: string) => {
    try {
      set((state) => ({
        loading: { ...state.loading, shaderPacks: true },
        error: { ...state.error, shaderPacks: null },
      }));

      const shaderPacks = await ProfileService.getLocalShaderpacks(profileId);

      set((state) => ({
        shaderPacks,
        loading: { ...state.loading, shaderPacks: false },
      }));
    } catch (error) {
      set((state) => ({
        loading: { ...state.loading, shaderPacks: false },
        error: { ...state.error, shaderPacks: error instanceof Error ? error.message : "Failed to load shader packs" },
      }));
    }
  },

  addModrinthMod: async (
    profileId,
    projectId,
    versionId,
    fileName,
    downloadUrl,
    fileHashSha1,
    modName,
    versionNumber,
    loaders,
    gameVersions,
  ) => {
    try {
      await ProfileService.addModrinthModToProfile(
        profileId,
        projectId,
        versionId,
        fileName,
        downloadUrl,
        fileHashSha1,
        modName,
        versionNumber,
        loaders,
        gameVersions,
      );
    } catch (error) {
      throw error;
    }
  },

  addModrinthContent: async (
    profileId,
    projectId,
    versionId,
    fileName,
    downloadUrl,
    contentType,
    fileHashSha1,
    contentName,
    versionNumber,
  ) => {
    try {
      await ProfileService.addModrinthContentToProfile(
        profileId,
        projectId,
        versionId,
        fileName,
        downloadUrl,
        fileHashSha1 || undefined || null,
        contentName || fileName,
        versionNumber || undefined || null,
        contentType,
      );

      if (contentType === "resourcepack") {
        await ProfileService.getLocalResourcepacks(profileId);
      } else if (contentType === "shader") {
        await ProfileService.getLocalShaderpacks(profileId);
      }
    } catch (error) {
      throw error;
    }
  },

  setModEnabled: async (profileId, modId, enabled) => {
    try {
      await ProfileService.setProfileModEnabled(profileId, modId, enabled);

      set((state) => ({
        mods: state.mods.map((mod) =>
          mod.id === modId ? { ...mod, enabled } : mod,
        ),
      }));
    } catch (error) {
      throw error;
    }
  },

  setCustomModEnabled: async (profileId, filename, enabled) => {
    try {
      await ProfileService.setCustomModEnabled(profileId, filename, enabled);

      set((state) => ({
        customMods: state.customMods.map((mod) =>
          mod.filename === filename ? { ...mod, is_enabled: enabled } : mod,
        ),
      }));
    } catch (error) {
      throw error;
    }
  },

  deleteCustomMod: async (profileId, filename) => {
    try {
      await ProfileService.deleteCustomMod(profileId, filename);

      set((state) => ({
        customMods: state.customMods.filter((mod) => mod.filename !== filename),
      }));
    } catch (error) {
      throw error;
    }
  },

  importLocalMods: async (profileId) => {
    try {
      await ProfileService.importLocalMods(profileId);

      const customMods = await ProfileService.getCustomMods(profileId);
      set({ customMods });
    } catch (error) {
      throw error;
    }
  },
}));
