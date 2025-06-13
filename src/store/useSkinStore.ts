"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SkinState {
  selectedSkinId: string | null;
  setSelectedSkinId: (id: string | null) => void;
}

export const useSkinStore = create<SkinState>()(
  persist(
    (set) => ({
      selectedSkinId: null,
      setSelectedSkinId: (id) => set({ selectedSkinId: id }),
    }),
    {
      name: "skin-store",
    },
  ),
);
