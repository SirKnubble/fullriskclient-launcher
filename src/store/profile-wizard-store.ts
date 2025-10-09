import { create } from 'zustand';

interface ProfileWizardState {
  isModalOpen: boolean;
  defaultGroup: string | null;
  openModal: (defaultGroup?: string | null) => void;
  closeModal: () => void;
}

export const useProfileWizardStore = create<ProfileWizardState>((set) => ({
  isModalOpen: false,
  defaultGroup: null,
  openModal: (defaultGroup = null) => set({ isModalOpen: true, defaultGroup }),
  closeModal: () => set({ isModalOpen: false, defaultGroup: null }),
}));
