"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useMinecraftAuthStore } from "./minecraft-auth-store";
import type {
  FriendsUser,
  FriendsFriendsInformationDto,
  FriendsFriendRequestResponse,
  FriendsFriendUser,
  FriendsUserOnlineState,
} from "../types/friends";
import { FriendsUserStateHelpers } from "../types/friends";

interface FriendsState {
  friends: FriendsFriendUser[];
  friendRequests: FriendsFriendRequestResponse[];
  currentUser: FriendsUser | null;
  isLoading: boolean;
  isSidebarOpen: boolean;
  searchQuery: string;
  selectedTab: "friends" | "requests" | "search";
  lastRefresh: number;
  autoRefreshEnabled: boolean;
  hasInitiallyLoaded: boolean;
  isAutoRefreshing: boolean;

  setFriends: (friends: FriendsFriendUser[]) => void;
  setFriendRequests: (requests: FriendsFriendRequestResponse[]) => void;
  setCurrentUser: (user: FriendsUser) => void;
  setFriendsInformation: (info: FriendsFriendsInformationDto) => void;
  setIsLoading: (loading: boolean) => void;
  setSidebarOpen: (open: boolean) => void;
  setSearchQuery: (query: string) => void;
  setSelectedTab: (tab: "friends" | "requests") => void;
  removeFriend: (friendUuid: string) => void;
  addFriendRequest: (request: FriendsFriendRequestResponse) => void;
  removeFriendRequest: (requestId: string) => void;
  setLastRefresh: (timestamp: number) => void;
  setAutoRefreshEnabled: (enabled: boolean) => void;
  setIsAutoRefreshing: (refreshing: boolean) => void;
  refreshFriendsData: () => Promise<void>;
  resetLoadingState: () => void;
  resetInitialLoadState: () => void;

  getOnlineFriendsCount: () => number;
  getFriendRequestsCount: () => number;
  getIncomingFriendRequests: () => FriendsFriendRequestResponse[];
  getOutgoingFriendRequests: () => FriendsFriendRequestResponse[];
}

export const useFriendsStore = create<FriendsState>()(
  persist(
    (set, get) => ({
      friends: [],
      friendRequests: [],
      currentUser: null,
      isLoading: false,
      isSidebarOpen: false,
      searchQuery: "",
      selectedTab: "friends",
      lastRefresh: 0,
      autoRefreshEnabled: true,
      hasInitiallyLoaded: false,
      isAutoRefreshing: false,

      setFriends: (friends) => set({ friends: friends || [] }),
      setFriendRequests: (requests) => set({ friendRequests: requests || [] }),
      setCurrentUser: (user) => set({ currentUser: user }),
      setFriendsInformation: (info) =>
        set({
          friends: info.friends || [],
          friendRequests: info.pending || [],
          currentUser: info.user,
          hasInitiallyLoaded: true,
          lastRefresh: Date.now(),
        }),
      setIsLoading: (loading) => set({ isLoading: loading }),
      setSidebarOpen: (open) => set({ isSidebarOpen: open }),
      setSearchQuery: (query) => set({ searchQuery: query }),
      setSelectedTab: (tab) => set({ selectedTab: tab }),
      removeFriend: (friendUuid) =>
        set((state) => ({
          friends: (state.friends || []).filter(
            (f) => f.noriskUser.uuid !== friendUuid
          ),
        })),
      addFriendRequest: (request) =>
        set((state) => ({
          friendRequests: [...(state.friendRequests || []), request],
        })),
      removeFriendRequest: (requestId) =>
        set((state) => ({
          friendRequests: (state.friendRequests || []).filter(
            (r) => r.friendRequest.id !== requestId
          ),
        })),
      setLastRefresh: (timestamp) => set({ lastRefresh: timestamp }),
      setAutoRefreshEnabled: (enabled) => set({ autoRefreshEnabled: enabled }),
      setIsAutoRefreshing: (refreshing) =>
        set({ isAutoRefreshing: refreshing }),
      refreshFriendsData: async () => {
        const timeout = setTimeout(() => {
          set({ isAutoRefreshing: false });
        }, 10000);

        try {
          set({ isAutoRefreshing: true });

          const { getFriendsInformation } = await import(
            "../services/friends-service"
          );
          const friendsInfo = await getFriendsInformation();

          set({
            friends: friendsInfo.friends || [],
            friendRequests: friendsInfo.pending || [],
            currentUser: friendsInfo.user,
            hasInitiallyLoaded: true,
            lastRefresh: Date.now(),
            isAutoRefreshing: false,
          });
        } catch (error) {
          set({ isAutoRefreshing: false });
        } finally {
          clearTimeout(timeout);
        }
      },
      resetLoadingState: () => set({ isLoading: false }),
      resetInitialLoadState: () =>
        set({ hasInitiallyLoaded: false, lastRefresh: 0 }),

      getOnlineFriendsCount: () => {
        const state = get();
        return (
          state.friends?.filter((f) =>
            FriendsUserStateHelpers.isOnline(f.onlineState)
          ).length || 0
        );
      },
      getFriendRequestsCount: () => {
        const state = get();
        return state.friendRequests?.length || 0;
      },
      getIncomingFriendRequests: () => {
        const state = get();
        const currentUserId =
          useMinecraftAuthStore.getState().activeAccount?.id;

        if (!currentUserId) {
          return [];
        }

        return (state.friendRequests || []).filter((request) => {
          const isReceiver = request.friendRequest.receiver === currentUserId;
          const isPending =
            request.friendRequest.currentState.newState === "PENDING";
          return isReceiver && isPending;
        });
      },
      getOutgoingFriendRequests: () => {
        const state = get();
        const currentUserId =
          useMinecraftAuthStore.getState().activeAccount?.id;

        if (!currentUserId) {
          return [];
        }

        return (state.friendRequests || []).filter((request) => {
          const isSender = request.friendRequest.sender === currentUserId;
          const isPending =
            request.friendRequest.currentState.newState === "PENDING";
          return isSender && isPending;
        });
      },
    }),
    {
      name: "friends-store",
      partialize: (state) => ({
        isSidebarOpen: state.isSidebarOpen,
        selectedTab: state.selectedTab,
      }),
    }
  )
);
