import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SnowEffectState {
  isEnabled: boolean;
  toggleSnowEffect: () => void;
  setSnowEffect: (enabled: boolean) => void;
}

export const useSnowEffectStore = create<SnowEffectState>()(
  persist(
    (set) => ({
      isEnabled: false,

      toggleSnowEffect: () => set((state) => ({ isEnabled: !state.isEnabled })),

      setSnowEffect: (enabled: boolean) => set({ isEnabled: enabled }),
    }),
    {
      name: "snow-effect-storage",
    }
  )
);
