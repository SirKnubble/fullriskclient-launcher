import { create } from "zustand";
import { persist } from "zustand/middleware";

export enum BACKGROUND_EFFECTS {
  NONE = "none",
  MATRIX_RAIN = "matrix-rain",
  ENCHANTMENT_PARTICLES = "enchantment-particles",
  NEBULA_WAVES = "nebula-waves",
  NEBULA_PARTICLES = "nebula-particles",
  NEBULA_GRID = "nebula-grid",
  NEBULA_VOXELS = "nebula-voxels",
  NEBULA_LIGHTNING = "nebula-lightning",
  NEBULA_LIQUID_CHROME = "nebula-liquid-chrome",
  RETRO_GRID = "retro-grid",
  PLAIN_BACKGROUND = "plain-background",
}

interface BackgroundEffectState {
  currentEffect: string;
  setCurrentEffect: (effect: string) => void;
}

export const useBackgroundEffectStore = create<BackgroundEffectState>()(
  persist(
    (set) => ({
      currentEffect: BACKGROUND_EFFECTS.RETRO_GRID,
      setCurrentEffect: (effect) => set({ currentEffect: effect }),
    }),
    {
      name: "norisk-background-effect-storage",
    },
  ),
);
