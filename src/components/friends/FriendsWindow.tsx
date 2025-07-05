import React, { useEffect, useRef, useState } from "react";
import { Icon } from "@iconify/react";
import { gsap } from "gsap";
import { cn } from "../../lib/utils";
import { useThemeStore } from "../../store/useThemeStore";
import {
  useBackgroundEffectStore,
  BACKGROUND_EFFECTS,
} from "../../store/background-effect-store";
import { useFriendsStore } from "../../store/useFriendsStore";
import { IconButton } from "../ui/buttons/IconButton";
import { Button } from "../ui/buttons/Button";
import { Card } from "../ui/Card";
import { FriendsTab } from "./FriendsTab";
import { RequestsTab } from "./RequestsTab";
import { MessagesTab } from "./MessagesTab";
import * as FriendsService from "../../services/friends-service";
import { toast } from "react-hot-toast";
import { SearchInput } from "../ui/SearchInput";
import { ThemeInitializer } from "../ThemeInitializer";
import { RetroGridEffect } from "../effects/RetroGridEffect";
import { useMessagingStore } from "../../store/useMessagingStore";

export function FriendsWindow() {
  const containerRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const accentColor = useThemeStore((state) => state.accentColor);
  const isAnimationEnabled = useThemeStore(
    (state) => state.isBackgroundAnimationEnabled
  );
  const currentEffect = useBackgroundEffectStore(
    (state) => state.currentEffect
  );

  const {
    selectedTab,
    setSelectedTab,
    isLoading,
    setIsLoading,
    setFriendsInformation,
    refreshFriendsData,
    resetLoadingState,
    resetInitialLoadState,
    hasInitiallyLoaded,
    friends,
    getIncomingFriendRequests,
    getOutgoingFriendRequests,
  } = useFriendsStore();

  const { refreshMessagingData } = useMessagingStore();

  const [isInitialized, setIsInitialized] = useState(false);
  const [stableCounts, setStableCounts] = useState({ friends: 0, requests: 0 });
  const [searchQuery, setSearchQuery] = useState("");
  const [openChatWithFriend, setOpenChatWithFriend] = useState<
    string | undefined
  >();

  const handleManualRefresh = async () => {
    try {
      await Promise.all([refreshFriendsData(), refreshMessagingData()]);
      toast("Friends and messages refreshed", {
        icon: (
          <Icon
            icon="solar:check-circle-bold"
            style={{ color: accentColor.value }}
          />
        ),
      });
    } catch (error) {
      toast("Failed to refresh data", {
        icon: (
          <Icon
            icon="solar:info-circle-bold"
            style={{ color: accentColor.value }}
          />
        ),
      });
    }
  };

  const handleOpenChatWithFriend = (friendUuid: string) => {
    setOpenChatWithFriend(friendUuid);
    setSelectedTab("messages");
  };

  const handleClearOpenChat = () => {
    setOpenChatWithFriend(undefined);
  };

  const handleChatOpened = () => {
    // muss da noch was machen...
  };

  const handleChatClosed = () => {
    // muss da noch was machen...
    setOpenChatWithFriend(undefined);
  };

  useEffect(() => {
    if (selectedTab !== "messages") {
      setOpenChatWithFriend(undefined);
    }
  }, [selectedTab]);

  useEffect(() => {
    setSelectedTab("friends");

    const openChatWithFriendId = localStorage.getItem("openChatWithFriend");
    if (openChatWithFriendId) {
      localStorage.removeItem("openChatWithFriend");

      const initializeAndOpenChat = async () => {
        try {
          await refreshFriendsData();

          setOpenChatWithFriend(openChatWithFriendId);
          setSelectedTab("messages");
        } catch (error) {
          setOpenChatWithFriend(openChatWithFriendId);
          setSelectedTab("messages");
        }
      };

      initializeAndOpenChat();
    } else {
      if (!hasInitiallyLoaded) {
        refreshFriendsData().catch(() => {});
      }
    }
  }, [setSelectedTab, refreshFriendsData, hasInitiallyLoaded]);

  useEffect(() => {
    if (!isInitialized) {
      const loadFriendsData = async () => {
        try {
          setIsLoading(true);
          const friendsInfo = await FriendsService.getFriendsInformation();
          setFriendsInformation(friendsInfo);
          setIsInitialized(true);
        } catch (error) {
          toast("Failed to load friends data", {
            icon: (
              <Icon
                icon="solar:info-circle-bold"
                style={{ color: accentColor.value }}
              />
            ),
          });
        } finally {
          setIsLoading(false);
        }
      };
      loadFriendsData();
    } else if (hasInitiallyLoaded && !isInitialized) {
      setIsInitialized(true);
    }
  }, [
    isInitialized,
    hasInitiallyLoaded,
    setFriendsInformation,
    setIsLoading,
    accentColor.value,
  ]);

  useEffect(() => {
    if (isInitialized && !isLoading) {
      setStableCounts({
        friends: friends.length,
        requests: getIncomingFriendRequests().length,
      });
    }
  }, [isInitialized, isLoading, friends.length, getIncomingFriendRequests]);

  useEffect(() => {
    if (!isAnimationEnabled) return;

    if (containerRef.current) {
      gsap.fromTo(
        containerRef.current,
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.5, ease: "power2.out" }
      );
    }

    if (sidebarRef.current) {
      gsap.fromTo(
        sidebarRef.current,
        { opacity: 0, x: -20 },
        {
          opacity: 1,
          x: 0,
          duration: 0.4,
          delay: 0.1,
          ease: "power2.out",
        }
      );
    }

    if (headerRef.current) {
      gsap.fromTo(
        headerRef.current,
        { opacity: 0, y: -10 },
        {
          opacity: 1,
          y: 0,
          duration: 0.4,
          delay: 0.2,
          ease: "power2.out",
        }
      );
    }

    if (contentRef.current) {
      gsap.fromTo(
        contentRef.current,
        { opacity: 0, y: 10 },
        {
          opacity: 1,
          y: 0,
          duration: 0.4,
          delay: 0.3,
          ease: "power2.out",
        }
      );
    }
  }, [isAnimationEnabled]);

  const getTabs = () => [
    {
      id: "friends",
      label: "Friends",
      icon: "solar:users-group-two-rounded-bold",
      count: 0,
    },
    {
      id: "messages",
      label: "Messages",
      icon: "solar:chat-round-dots-bold",
      count: 0,
    },
    {
      id: "requests",
      label: "Requests",
      icon: "solar:bell-bold",
      count:
        isInitialized && !isLoading
          ? stableCounts.requests
          : stableCounts.requests,
    },
  ];

  const handleTabChange = (tabId: string) => {
    setSelectedTab(tabId as any);
    setSearchQuery("");
  };

  useEffect(() => {
    if (isLoading && isInitialized) {
      const timeout = setTimeout(() => {
        resetLoadingState();
      }, 2000);

      return () => clearTimeout(timeout);
    }
  }, [isLoading, isInitialized, resetLoadingState]);

  useEffect(() => {
    if (selectedTab === "messages") {
      refreshMessagingData(true);
    }
  }, [selectedTab, refreshMessagingData]);

  return (
    <>
      <ThemeInitializer />
      <div
        ref={containerRef}
        className="h-full w-full flex relative overflow-hidden"
        data-friends-window="true"
      >
        {currentEffect === BACKGROUND_EFFECTS.RETRO_GRID && (
          <div className="absolute inset-0 z-0">
            <RetroGridEffect />
          </div>
        )}
        {currentEffect !== BACKGROUND_EFFECTS.PLAIN_BACKGROUND && (
          <div
            className="absolute inset-0 z-0"
            style={{
              background:
                currentEffect === BACKGROUND_EFFECTS.RETRO_GRID
                  ? "transparent"
                  : "linear-gradient(135deg, #0f0f0f 0%, #1a1a1a 25%, #0f0f0f 50%, #1a1a1a 75%, #0f0f0f 100%)",
            }}
          />
        )}
        <div className="relative z-10 w-40 xs:w-48 sm:w-56 md:w-64 lg:w-72 flex-shrink-0 min-w-0">
          <Card
            ref={sidebarRef}
            className="h-full w-full bg-black/20 border border-white/10 rounded-none border-r border-l-0 border-t-0 border-b-0"
            variant="flat"
            disableHover={true}
          >
            <div className="p-2 sm:p-3 md:p-4 border-b border-white/10 bg-black/10">
              <div className="flex items-center justify-between mb-2 sm:mb-3">
                <div className="flex items-center gap-2 sm:gap-3">
                  <Icon
                    icon="solar:users-group-two-rounded-bold"
                    className="w-5 h-5 sm:w-6 sm:h-6 text-white"
                  />
                  <h2 className="text-lg sm:text-xl md:text-2xl font-minecraft text-white lowercase">
                    Friends
                  </h2>
                </div>
                <div className="flex items-center gap-2">
                  <IconButton
                    icon={
                      <Icon
                        icon="solar:refresh-bold"
                        className={cn("w-5 h-5", isLoading && "animate-spin")}
                      />
                    }
                    onClick={handleManualRefresh}
                    variant="ghost"
                    size="sm"
                  />
                </div>
              </div>
            </div>

            <div className="p-2 sm:p-3 md:p-4 space-y-2 sm:space-y-3 md:space-y-4">
              <div className="space-y-1 sm:space-y-2">
                {getTabs().map((tab) => {
                  const isActive = selectedTab === tab.id;
                  return (
                    <Button
                      key={tab.id}
                      onClick={() => handleTabChange(tab.id)}
                      variant={isActive ? "default" : "ghost"}
                      size="lg"
                      className={cn(
                        "w-full text-left justify-start p-2 sm:p-3 md:p-4 transition-all duration-200",
                        isActive
                          ? "bg-black/30 border-accent border-l-[3px] hover:bg-black/30"
                          : "bg-transparent hover:bg-black/20 border-transparent border-l-[3px]"
                      )}
                      icon={
                        <Icon
                          icon={tab.icon}
                          className={cn(
                            "w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6",
                            isActive ? "text-accent" : "text-white/70"
                          )}
                        />
                      }
                    >
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-2 sm:gap-3">
                          <span className="font-minecraft text-lg sm:text-xl md:text-2xl lowercase">
                            {tab.label}
                          </span>
                        </div>
                        {tab.count > 0 && (
                          <div
                            className="min-w-[24px] h-[24px] rounded-full flex items-center justify-center text-sm font-bold text-white"
                            style={{ backgroundColor: accentColor.value }}
                          >
                            {tab.count > 99 ? "99+" : tab.count}
                          </div>
                        )}
                      </div>
                    </Button>
                  );
                })}
              </div>

              {selectedTab === "friends" && (
                <SearchInput
                  value={searchQuery}
                  onChange={setSearchQuery}
                  placeholder="Search friends..."
                  className="w-full"
                  size="sm"
                />
              )}
            </div>
          </Card>
        </div>

        <div className="relative z-10 flex-1 flex flex-col">
          <Card
            className="h-full w-full flex flex-col m-0 rounded-none border-0"
            variant="flat"
            disableHover={true}
          >
            <div
              className="flex-1 overflow-y-auto custom-scrollbar p-2 sm:p-4 md:p-6"
              style={{
                display: selectedTab === "messages" ? "none" : "block",
              }}
            >
              <div
                style={{
                  display: selectedTab === "friends" ? "block" : "none",
                }}
              >
                <FriendsTab
                  isInitialized={isInitialized}
                  searchQuery={searchQuery}
                  onOpenChat={handleOpenChatWithFriend}
                />
              </div>
              <div
                style={{
                  display: selectedTab === "requests" ? "block" : "none",
                }}
              >
                <RequestsTab
                  isVisible={selectedTab === "requests"}
                  sidebarOpen={true}
                />
              </div>
            </div>
            <div
              className="flex-1 flex flex-col h-full"
              style={{
                display: selectedTab === "messages" ? "flex" : "none",
              }}
            >
              <MessagesTab
                isVisible={selectedTab === "messages"}
                searchQuery={searchQuery}
                openChatWithFriend={openChatWithFriend}
                onClearOpenChat={handleClearOpenChat}
                onChatOpened={handleChatOpened}
                onChatClosed={handleChatClosed}
              />
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
