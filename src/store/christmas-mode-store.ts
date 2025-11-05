import { create } from "zustand";
import { persist } from "zustand/middleware";

interface ChristmasModeState {
  isEnabled: boolean;
  autoEnableInDecember: boolean;
  originalAccentColor: string | null;
  
  enableChristmasMode: () => void;
  disableChristmasMode: () => void;
  toggleChristmasMode: () => void;
  setAutoEnable: (value: boolean) => void;
  setOriginalAccentColor: (color: string | null) => void;
  checkAndAutoEnable: () => void;
}

export const useChristmasModeStore = create<ChristmasModeState>()(
  persist(
    (set, get) => ({
      isEnabled: false,
      autoEnableInDecember: true,
      originalAccentColor: null,

      enableChristmasMode: () => set({ isEnabled: true }),
      
      disableChristmasMode: () => set({ isEnabled: false }),
      
      toggleChristmasMode: () => set((state) => ({ isEnabled: !state.isEnabled })),
      
      setAutoEnable: (value: boolean) => set({ autoEnableInDecember: value }),
      
      setOriginalAccentColor: (color: string | null) => set({ originalAccentColor: color }),
      
      checkAndAutoEnable: () => {
        const { autoEnableInDecember } = get();
        if (!autoEnableInDecember) return;
        
        const now = new Date();
        const month = now.getMonth(); 
        
        if (month === 11) {
          set({ isEnabled: true });
        } else {
          set({ isEnabled: false });
        }
      },
    }),
    {
      name: "christmas-mode-storage",
    }
  )
);
