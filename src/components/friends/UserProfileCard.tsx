import React, { useEffect, useState, useRef } from "react";
import { Icon } from "@iconify/react";
import { cn } from "../../lib/utils";
import { useThemeStore } from "../../store/useThemeStore";
import { useMinecraftAuthStore } from "../../store/minecraft-auth-store";
import { useFriendsStore } from "../../store/useFriendsStore";
import { LoadingSpinner } from "../ui/LoadingSpinner";
import { Skeleton } from "../ui/Skeleton";
import { Card } from "../ui/Card";
import { IconButton } from "../ui/buttons/IconButton";
import { ToggleSwitch } from "../ui/ToggleSwitch";
import { Avatar } from "../common/Avatar";
import { getUserStatusColor, getUserStatusText } from "../common/UserStatus";
import { showErrorToast } from "../../utils/toast-helpers";
import type { FriendsUser } from "../../types/friends";
import { FriendsUserStateHelpers } from "../../types/friends";
import * as FriendsService from "../../services/friends-service";
import { toast } from "react-hot-toast";
import { gsap } from "gsap";

interface UserProfileCardProps {
  className?: string;
}

export function UserProfileCard({ className }: UserProfileCardProps) {
  const [user, setUser] = useState<FriendsUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [updatingSettings, setUpdatingSettings] = useState<Set<string>>(
    new Set()
  );

  const settingsRef = useRef<HTMLDivElement>(null);

  const accentColor = useThemeStore((state) => state.accentColor);
  const borderRadius = useThemeStore((state) => state.borderRadius);
  const { activeAccount } = useMinecraftAuthStore();
  const { currentUser, hasInitiallyLoaded } = useFriendsStore();

  const loadUserProfile = async () => {
    try {
      setLoading(true);
      setError(null);
      const userData = await FriendsService.getOwnUser();
      setUser(userData);
    } catch (err) {
      setError("Failed to load profile");
      showErrorToast("Failed to load user profile", { accentColor: accentColor.value });
    } finally {
      setLoading(false);
    }
  };

  const toggleSettings = () => {
    setShowSettings(!showSettings);
  };

  useEffect(() => {
    if (currentUser && hasInitiallyLoaded) {
      setUser(currentUser);
      setLoading(false);
      setError(null);
    } else {
      loadUserProfile();
    }
  }, [currentUser, hasInitiallyLoaded]);

  useEffect(() => {
    if (settingsRef.current) {
      if (showSettings) {
        gsap.fromTo(
          settingsRef.current,
          {
            height: 0,
            opacity: 0,
            overflow: "hidden",
          },
          {
            height: "auto",
            opacity: 1,
            duration: 0.3,
            ease: "power2.out",
            onComplete: () => {
              if (settingsRef.current) {
                settingsRef.current.style.overflow = "visible";
              }
            },
          }
        );
      } else {
        gsap.to(settingsRef.current, {
          height: 0,
          opacity: 0,
          duration: 0.2,
          ease: "power2.in",
          overflow: "hidden",
        });
      }
    }
  }, [showSettings]);

  const handleToggleSetting = async (
    setting: "showServer" | "allowRequests" | "allowServerInvites",
    currentValue: boolean
  ) => {
    if (!user) return;

    const newUpdatingSet = new Set(updatingSettings);
    newUpdatingSet.add(setting);
    setUpdatingSettings(newUpdatingSet);

    try {
      let updatedUser: FriendsUser;

      switch (setting) {
        case "showServer":
          updatedUser = await FriendsService.setShowServer(!currentValue);
          break;
        case "allowRequests":
          updatedUser =
            await FriendsService.setAllowFriendRequests(!currentValue);
          break;
        case "allowServerInvites":
          updatedUser =
            await FriendsService.setAllowServerInvites(!currentValue);
          break;
      }

      setUser(updatedUser);

      const settingNames = {
        showServer: "Show Server",
        allowRequests: "Allow Friend Requests",
        allowServerInvites: "Allow Server Invites",
      };

      toast(
        `${settingNames[setting]} ${!currentValue ? "enabled" : "disabled"}`,
        {
          icon: (
            <Icon
              icon="solar:check-circle-bold"
              style={{ color: accentColor.value }}
            />
          ),
        }
      );
    } catch (error) {
      toast(
        `Failed to update setting: ${error instanceof Error ? error.message : "Unknown error"}`,
        {
          icon: (
            <Icon
              icon="solar:close-circle-bold"
              style={{ color: accentColor.value }}
            />
          ),
        }
      );
    } finally {
      const newUpdatingSet = new Set(updatingSettings);
      newUpdatingSet.delete(setting);
      setUpdatingSettings(newUpdatingSet);
    }
  };

  if (loading) {
    return (
      <Card className={cn("p-4 mb-3", className)} variant="flat">
        <div className="flex items-center gap-4">
          <Skeleton
            variant="image"
            width="48px"
            height="48px"
            className="rounded-full"
          />
          <div className="flex-1 min-w-0">
            <Skeleton
              variant="text"
              width="70%"
              height="20px"
              className="mb-2"
            />
            <Skeleton variant="text" width="50%" height="14px" />
          </div>
          <Skeleton
            variant="block"
            width="32px"
            height="32px"
            className="rounded"
          />
        </div>
      </Card>
    );
  }

  if (error || !user) {
    return (
      <Card className={cn("p-4 mb-3", className)} variant="flat">
        <div className="flex flex-col items-center justify-center py-8">
          <Icon
            icon="solar:user-cross-bold"
            className="w-12 h-12 text-white/40 mb-3"
          />
          <div className="font-minecraft text-white/80 text-center mb-3">
            {error || "Failed to load profile"}
          </div>
          <button
            onClick={loadUserProfile}
            className="px-4 py-2 rounded-lg font-minecraft text-sm transition-colors duration-200"
            style={{
              backgroundColor: accentColor.value,
              color: "white",
              borderRadius: `${borderRadius * 0.5}px`,
            }}
          >
            Retry
          </button>
        </div>
      </Card>
    );
  }

  const statusText = getUserStatusText(user.state);
  const isUserOnline = FriendsUserStateHelpers.isOnline(user.state);
  const statusColor = getUserStatusColor(user.state);
  const displayName =
    activeAccount?.minecraft_username ||
    activeAccount?.username ||
    "Your Profile";
  const avatarUuid = activeAccount?.id || user.userId;

  return (
    <>
      <Card
        className={cn("p-4 mb-3 transition-all duration-200", className)}
        variant="flat"
      >
        <div className="flex items-center gap-4">
          <div className="relative">
            <Avatar
              userId={avatarUuid}
              displayName={displayName}
              size={48}
              className={statusColor}
            />
          </div>
          <div className="flex-1 min-w-0 mb-3">
            <div className="font-minecraft text-white text-4xl font-medium truncate">
              {displayName}
            </div>
            <div className="text-xs text-white/60 font-minecraft-ten truncate">
              {isUserOnline ? (
                user.server ? (
                  <span className="truncate">{user.server}</span>
                ) : (
                  statusText
                )
              ) : (
                <span className="truncate">{statusText}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <IconButton
              icon={
                <Icon
                  icon={
                    showSettings
                      ? "solar:settings-minimalistic-bold"
                      : "solar:settings-bold"
                  }
                  className={cn(
                    "transition-transform duration-200",
                    showSettings && "rotate-45"
                  )}
                />
              }
              onClick={(e) => {
                e.stopPropagation();
                toggleSettings();
              }}
              variant="ghost"
              size="sm"
              aria-label="Privacy Settings"
            />
          </div>
        </div>
        <div
          ref={settingsRef}
          className="overflow-hidden"
          style={{ height: showSettings ? "auto" : 0 }}
        >
          <div className="mt-4 pt-4 border-t border-white/10">
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <Icon
                    icon="solar:server-bold"
                    className="w-5 h-5 text-white/60 flex-shrink-0"
                  />
                  <div className="min-w-0 flex-1 mb-3">
                    <div className="font-minecraft text-white text-3xl font-medium">
                      Show Server
                    </div>
                    <div className="text-xs text-white/50 font-minecraft-ten">
                      Let friends see your server
                    </div>
                  </div>
                </div>
                <div className="flex-shrink-0">
                  {updatingSettings.has("showServer") ? (
                    <div className="w-6 h-3 flex items-center justify-center">
                      <LoadingSpinner size="sm" />
                    </div>
                  ) : (
                    <ToggleSwitch
                      checked={user?.privacy.showServer || false}
                      onChange={() =>
                        user &&
                        handleToggleSetting(
                          "showServer",
                          user.privacy.showServer
                        )
                      }
                      size="sm"
                    />
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <Icon
                    icon="solar:user-plus-bold"
                    className="w-5 h-5 text-white/60 flex-shrink-0"
                  />
                  <div className="min-w-0 flex-1 mb-3">
                    <div className="font-minecraft text-white text-3xl font-medium">
                      Friend Requests
                    </div>
                    <div className="text-xs text-white/50 font-minecraft-ten">
                      Allow friend requests
                    </div>
                  </div>
                </div>
                <div className="flex-shrink-0">
                  {updatingSettings.has("allowRequests") ? (
                    <div className="w-6 h-3 flex items-center justify-center">
                      <LoadingSpinner size="sm" />
                    </div>
                  ) : (
                    <ToggleSwitch
                      checked={user?.privacy.allowRequests || false}
                      onChange={() =>
                        user &&
                        handleToggleSetting(
                          "allowRequests",
                          user.privacy.allowRequests
                        )
                      }
                      size="sm"
                    />
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <Icon
                    icon="solar:letter-bold"
                    className="w-5 h-5 text-white/60 flex-shrink-0"
                  />
                  <div className="min-w-0 flex-1 mb-3">
                    <div className="font-minecraft text-white text-3xl font-medium">
                      Server Invites
                    </div>
                    <div className="text-xs text-white/50 font-minecraft-ten">
                      Allow server invites
                    </div>
                  </div>
                </div>
                <div className="flex-shrink-0">
                  {updatingSettings.has("allowServerInvites") ? (
                    <div className="w-6 h-3 flex items-center justify-center">
                      <LoadingSpinner size="sm" />
                    </div>
                  ) : (
                    <ToggleSwitch
                      checked={user?.privacy.allowServerInvites || false}
                      onChange={() =>
                        user &&
                        handleToggleSetting(
                          "allowServerInvites",
                          user.privacy.allowServerInvites
                        )
                      }
                      size="sm"
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </>
  );
}
