import { create } from 'zustand';
import type { ContentType as BackendContentType } from '../types/content';

export interface AppDragDropState {
  activeDropProfileId: string | null;
  activeDropContentType: BackendContentType | null;
  setActiveDropContext: (profileId: string | null, contentType: BackendContentType | null) => void;
  refreshCallbackMap: Map<BackendContentType, () => void>; // Map to store refresh callbacks by content type
  registerRefreshCallback: (contentType: BackendContentType, callback: () => void) => void;
  unregisterRefreshCallback: (contentType: BackendContentType) => void;
  triggerRefresh: (contentType: BackendContentType) => void;
}

export const useAppDragDropStore = create<AppDragDropState>((set, get) => ({
  activeDropProfileId: null,
  activeDropContentType: null,
  setActiveDropContext: (profileId, contentType) => set({ 
    activeDropProfileId: profileId, 
    activeDropContentType: contentType 
  }),
  refreshCallbackMap: new Map(),
  registerRefreshCallback: (contentType, callback) => {
    set((state) => ({
      refreshCallbackMap: new Map(state.refreshCallbackMap).set(contentType, callback),
    }));
  },
  unregisterRefreshCallback: (contentType) => {
    set((state) => {
      const newMap = new Map(state.refreshCallbackMap);
      newMap.delete(contentType);
      return { refreshCallbackMap: newMap };
    });
  },
  triggerRefresh: (contentType) => {
    const callback = get().refreshCallbackMap.get(contentType);
    if (callback) {
      callback();
    }
  },
})); 