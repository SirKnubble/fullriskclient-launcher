import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useMinecraftAuthStore } from "./minecraft-auth-store";
import { createRefreshState, createRefreshActions, type RefreshState } from "../utils/refresh-utils";
import type {
  FriendsUser,
  FriendsFriendsInformationDto,
  FriendsFriendRequestResponse,
  FriendsFriendUser,
} from "../types/friends";
import { FriendsUserStateHelpers } from "../types/friends";

interface FriendsState extends RefreshState {
  friends: FriendsFriendUser[];
  friendRequests: FriendsFriendRequestResponse[];
  currentUser: FriendsUser | null;
  isLoading: boolean;
  isSidebarOpen: boolean;
  searchQuery: string;
  selectedTab: "friends" | "messages" | "requests" | "search";
  autoRefreshEnabled: boolean;
  hasInitiallyLoaded: boolean;

  setFriends: (friends: FriendsFriendUser[]) => void;
  setFriendRequests: (requests: FriendsFriendRequestResponse[]) => void;
  setCurrentUser: (user: FriendsUser) => void;
  setFriendsInformation: (info: FriendsFriendsInformationDto) => void;
  setIsLoading: (loading: boolean) => void;
  setSidebarOpen: (open: boolean) => void;
  setSearchQuery: (query: string) => void;
  setSelectedTab: (tab: "friends" | "messages" | "requests") => void;
  removeFriend: (friendUuid: string) => void;
  addFriendRequest: (request: FriendsFriendRequestResponse) => void;
  removeFriendRequest: (requestId: string) => void;
  setAutoRefreshEnabled: (enabled: boolean) => void;
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
    (set, get) => {
      const refreshFriendsDataImplementation = async () => {
        const { getFriendsInformation } = await import("../services/friends-service");
        const friendsInfo = await getFriendsInformation();
        set({
          friends: friendsInfo.friends || [],
          friendRequests: friendsInfo.pending || [],
          currentUser: friendsInfo.user,
          hasInitiallyLoaded: true,
        });
      };

      const refreshActions = createRefreshActions(set, get, refreshFriendsDataImplementation);

      return {
        friends: [],
        friendRequests: [],
        currentUser: null,
        isLoading: false,
        isSidebarOpen: false,
        searchQuery: "",
        selectedTab: "friends",
        autoRefreshEnabled: true,
        hasInitiallyLoaded: false,
        
        ...createRefreshState(),

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
        setAutoRefreshEnabled: (enabled) => set({ autoRefreshEnabled: enabled }),
        
        refreshFriendsData: refreshActions.refresh,
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
      };
    },
    {
      name: "friends-store",
      partialize: (state) => ({
        isSidebarOpen: state.isSidebarOpen,
        selectedTab: state.selectedTab,
      }),
    }
  )
);
