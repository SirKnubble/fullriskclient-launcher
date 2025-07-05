import React, { useEffect, useRef, useState } from "react";
import { Icon } from "@iconify/react";
import { gsap } from "gsap";
import { cn } from "../../lib/utils";
import { useThemeStore } from "../../store/useThemeStore";
import { useFriendsStore } from "../../store/useFriendsStore";
import { IconButton } from "../ui/buttons/IconButton";
import { Button } from "../ui/buttons/Button";
import { Card } from "../ui/Card";
import { FriendsTab } from "./FriendsTab";
import { RequestsTab } from "./RequestsTab";
import { showSuccessToast, showErrorToast } from "../../utils/toast-helpers";
import * as FriendsService from "../../services/friends-service";
import * as ProcessService from "../../services/process-service";
import { toast } from "react-hot-toast";
import { useFriendsAutoRefresh } from "../../hooks/useFriendsAutoRefresh";
import { SearchInput } from "../ui/SearchInput";

export function FriendsSidebar() {
  const sidebarRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const accentColor = useThemeStore((state) => state.accentColor);

  const {
    isSidebarOpen,
    setSidebarOpen,
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
  const [isInitialized, setIsInitialized] = useState(false);
  const [stableCounts, setStableCounts] = useState({ friends: 0, requests: 0 });
  const [searchQuery, setSearchQuery] = useState("");

  useFriendsAutoRefresh();

  const handleManualRefresh = async () => {
    try {
      await refreshFriendsData();
      showSuccessToast("Friends list refreshed", {
        accentColor: accentColor.value,
      });
    } catch (error) {
      showErrorToast("Failed to refresh friends list", {
        accentColor: accentColor.value,
      });
    }
  };

  const handleOpenFriendsWindow = async () => {
    try {
      await ProcessService.openFriendsWindow();
      handleClose();
    } catch (error) {
      showErrorToast("Failed to open friends window", {
        accentColor: accentColor.value,
      });
    }
  };

  const handleClose = () => {
    setSidebarOpen(false);
    setIsInitialized(false);
    setSearchQuery("");
    resetLoadingState();
    resetInitialLoadState();
  };

  const handleOpenChat = async (friendUuid: string) => {
    try {
      const friend = friends.find((f) => f.noriskUser.uuid === friendUuid);
      const friendName =
        friend?.noriskUser.displayName || friend?.noriskUser.ign || "Unknown";

      localStorage.setItem("openChatWithFriend", friendUuid);

      setSidebarOpen(false);
      await ProcessService.openFriendsWindow();

      toast(`Opening chat with ${friendName}`, {
        icon: (
          <Icon
            icon="solar:chat-round-dots-bold"
            style={{ color: accentColor.value }}
          />
        ),
      });
    } catch (error) {
      showErrorToast("Failed to open chat", { accentColor: accentColor.value });
    }
  };

  useEffect(() => {
    if (isSidebarOpen) {
      setSelectedTab("friends");
    }
  }, [isSidebarOpen, setSelectedTab]);

  useEffect(() => {
    if (isSidebarOpen && !isInitialized) {
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
    isSidebarOpen,
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
    if (isSidebarOpen) {
      document.body.style.overflow = "hidden";

      if (overlayRef.current) {
        gsap.set(overlayRef.current, { display: "block" });
        gsap.fromTo(
          overlayRef.current,
          { opacity: 0 },
          { opacity: 1, duration: 0.2 }
        );
      }

      if (sidebarRef.current) {
        gsap.fromTo(
          sidebarRef.current,
          { x: "100%" },
          { x: "0%", duration: 0.3, ease: "power2.out" }
        );
      }
    } else {
      document.body.style.overflow = "";

      if (sidebarRef.current) {
        gsap.to(sidebarRef.current, {
          x: "100%",
          duration: 0.3,
          ease: "power2.in",
        });
      }

      if (overlayRef.current) {
        gsap.to(overlayRef.current, {
          opacity: 0,
          duration: 0.2,
          onComplete: () => {
            if (overlayRef.current) {
              gsap.set(overlayRef.current, { display: "none" });
            }
          },
        });
      }
    }
  }, [isSidebarOpen]);

  const getTabs = () => [
    {
      id: "friends",
      label: "Friends",
      icon: "solar:users-group-two-rounded-bold",
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
    if (isSidebarOpen && isLoading && isInitialized) {
      const timeout = setTimeout(() => {
        resetLoadingState();
      }, 2000);

      return () => clearTimeout(timeout);
    }
  }, [isSidebarOpen, isLoading, isInitialized, resetLoadingState]);

  return (
    <>
      <div
        ref={overlayRef}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9998]"
        style={{ display: "none" }}
        onClick={handleClose}
      />

      <div
        ref={sidebarRef}
        className="fixed top-0 right-0 h-full w-[28rem] z-[9999] flex flex-col"
        style={{ transform: "translateX(100%)" }}
      >
        <Card
          variant="flat"
          className="h-full flex flex-col bg-black/20 border border-white/10"
          disableHover={true}
        >
          <div className="p-4 border-b border-white/10 bg-black/10">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <Icon
                  icon="solar:users-group-two-rounded-bold"
                  className="w-6 h-6 text-white"
                />
                <h2 className="text-2xl font-minecraft text-white lowercase">
                  Friends
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <IconButton
                  icon={<Icon icon="solar:refresh-bold" className="w-5 h-5" />}
                  onClick={handleManualRefresh}
                  variant="ghost"
                  size="sm"
                />
                <IconButton
                  icon={
                    <Icon icon="solar:window-frame-bold" className="w-5 h-5" />
                  }
                  onClick={handleOpenFriendsWindow}
                  variant="ghost"
                  size="sm"
                />
                <IconButton
                  icon={
                    <Icon icon="solar:close-circle-bold" className="w-6 h-6" />
                  }
                  onClick={handleClose}
                  variant="ghost"
                  size="sm"
                />
              </div>
            </div>
          </div>

          <div className="p-4">
            <div className="flex gap-2 mb-4">
              {getTabs().map((tab) => {
                const isActive = selectedTab === tab.id;
                return (
                  <Button
                    key={tab.id}
                    onClick={() => handleTabChange(tab.id)}
                    variant={isActive ? "default" : "ghost"}
                    className="flex-1"
                    icon={
                      <Icon
                        icon={tab.icon}
                        className={cn(
                          "w-6 h-6",
                          isActive ? "text-accent" : "text-white/70"
                        )}
                      />
                    }
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-minecraft text-2xl lowercase">
                        {tab.label}
                      </span>
                      {tab.count > 0 && (
                        <div
                          className="min-w-[18px] h-[18px] rounded-full flex items-center justify-center text-xs font-bold text-white"
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
                size="md"
              />
            )}
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar">
            <div
              style={{ display: selectedTab === "friends" ? "block" : "none" }}
            >
              <FriendsTab
                isInitialized={isInitialized}
                searchQuery={searchQuery}
                onOpenChat={handleOpenChat}
                inSidebar={true}
              />
            </div>
            <div
              style={{ display: selectedTab === "requests" ? "block" : "none" }}
            >
              <RequestsTab
                isVisible={selectedTab === "requests"}
                sidebarOpen={isSidebarOpen}
              />
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}
