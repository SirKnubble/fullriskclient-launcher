import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SnowEffectState {
  isEnabled: boolean;
  snowIntensity: number; // 1-100, default 50
  toggleSnowEffect: () => void;
  setSnowEffect: (enabled: boolean) => void;
  setSnowIntensity: (intensity: number) => void;
}

export const useSnowEffectStore = create<SnowEffectState>()(
  persist(
    (set) => ({
      isEnabled: false,
      snowIntensity: 50,

      toggleSnowEffect: () => set((state) => ({ isEnabled: !state.isEnabled })),

      setSnowEffect: (enabled: boolean) => set({ isEnabled: enabled }),

      setSnowIntensity: (intensity: number) => set({ snowIntensity: Math.max(1, Math.min(100, intensity)) }),
    }),
    {
      name: "snow-effect-storage",
    }
  )
);
