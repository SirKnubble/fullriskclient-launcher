import { create } from 'zustand';
import { MinecraftProcessExitedPayload } from '../types/events';

interface CrashModalState {
  isCrashModalOpen: boolean;
  crashData: MinecraftProcessExitedPayload | null;
  openCrashModal: (data: MinecraftProcessExitedPayload) => void;
  closeCrashModal: () => void;
}

const useCrashModalStore = create<CrashModalState>((set) => ({
  isCrashModalOpen: false,
  crashData: null,
  openCrashModal: (data) => {
    set({ isCrashModalOpen: true, crashData: data });
  },
  closeCrashModal: () => set({ isCrashModalOpen: false, crashData: null }),
}));

export { useCrashModalStore }; 