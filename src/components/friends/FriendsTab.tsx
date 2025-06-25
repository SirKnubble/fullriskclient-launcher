"use client";

import React, { useState, memo } from "react";
import { Icon } from "@iconify/react";
import { cn } from "../../lib/utils";
import { useThemeStore } from "../../store/useThemeStore";
import { useFriendsStore } from "../../store/useFriendsStore";
import { useProfileStore } from "../../store/profile-store";
import { Card } from "../ui/Card";
import { IconButton } from "../ui/buttons/IconButton";
import { UserProfileCard } from "./UserProfileCard";
import type { FriendsFriendUser } from "../../types/friends";
import {
  FriendsUserOnlineState,
  FriendsUserStateHelpers,
} from "../../types/friends";
import * as FriendsService from "../../services/friends-service";
import * as ProcessService from "../../services/process-service";
import { toast } from "react-hot-toast";
import { Skeleton } from "../ui/Skeleton";

function formatLastSeen(lastSeenTimestamp?: string | number): string {
  if (!lastSeenTimestamp) return "Last seen a while ago";

  const lastSeen = new Date(lastSeenTimestamp);
  const now = new Date();
  const diffMs = now.getTime() - lastSeen.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffMonths = Math.floor(diffDays / 30);

  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60)
    return `${diffMinutes} minute${diffMinutes === 1 ? "" : "s"} ago`;
  if (diffHours < 24)
    return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  if (diffDays < 30) return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
  return `${diffMonths} month${diffMonths === 1 ? "" : "s"} ago`;
}

interface FriendCardProps {
  friend: FriendsFriendUser;
  onRemove: (uuid: string) => void;
}

const FriendCard = memo(({ friend, onRemove }: FriendCardProps) => {
  const accentColor = useThemeStore((state) => state.accentColor);
  const borderRadius = useThemeStore((state) => state.borderRadius);
  const { selectedProfile, lastPlayedProfileId } = useProfileStore();

  const handleRemove = async () => {
    try {
      await FriendsService.removeFriend(friend.noriskUser.uuid);
      onRemove(friend.noriskUser.uuid);
      toast(
        `Removed ${friend.noriskUser.displayName || friend.noriskUser.ign} from friends`,
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
      toast(`Failed to remove friend`, {
        icon: (
          <Icon
            icon="solar:info-circle-bold"
            style={{ color: accentColor.value }}
          />
        ),
      });
    }
  };

  const handleMessage = () => {
    toast("Messaging feature coming soon!", {
      icon: (
        <Icon
          icon="solar:info-circle-bold"
          style={{ color: accentColor.value }}
        />
      ),
    });
  };

  const handleJoinServer = async () => {
    if (!friend.server) return;

    try {
      const profileId = selectedProfile?.id || lastPlayedProfileId;
      if (!profileId) {
        toast("No profile selected", {
          icon: (
            <Icon
              icon="solar:info-circle-bold"
              style={{ color: accentColor.value }}
            />
          ),
        });
        return;
      }

      await ProcessService.launch(profileId, undefined, friend.server);
      toast(`Joining ${friend.server}...`, {
        icon: (
          <Icon
            icon="solar:check-circle-bold"
            style={{ color: accentColor.value }}
          />
        ),
      });
    } catch (error) {
      toast("Failed to join server", {
        icon: (
          <Icon
            icon="solar:info-circle-bold"
            style={{ color: accentColor.value }}
          />
        ),
      });
    }
  };
  const parsedState = FriendsUserStateHelpers.parseState(friend.onlineState);
  const displayName = friend.noriskUser.displayName || friend.noriskUser.ign;
  const isOnline = FriendsUserStateHelpers.isOnline(friend.onlineState);

  const getStatusColor = (state: string): string => {
    switch (state?.toUpperCase()) {
      case "ONLINE":
        return "border-green-500";
      case "AFK":
        return "border-orange-500";
      case "BUSY":
        return "border-red-500";
      case "AWAY":
      case "INVISIBLE":
      case "OFFLINE":
      default:
        return "border-gray-500";
    }
  };

  const statusColor = getStatusColor(friend.onlineState);
  return (
    <Card variant="flat" className="p-4 mb-3">
      <div className="flex items-center gap-4">
        {" "}
        <div className="relative">
          <div
            className={cn("w-12 h-12 rounded-full border-2", statusColor)}
            style={{ borderRadius: `${borderRadius}px` }}
          >
            <img
              src={`https://crafatar.com/avatars/${friend.noriskUser.uuid}?overlay&size=48`}
              alt={displayName}
              className="w-full h-full object-cover p-0.5"
              style={{ borderRadius: `${borderRadius * 0.8}px` }}
              onError={(e) => {
                e.currentTarget.style.display = "none";
                const fallback = e.currentTarget
                  .nextElementSibling as HTMLElement;
                if (fallback) fallback.style.display = "flex";
              }}
            />
            <div
              className="w-full h-full flex items-center justify-center text-white font-minecraft text-lg font-bold absolute top-0.5 left-0.5 p-0.5"
              style={{
                backgroundColor: accentColor.value,
                borderRadius: `${borderRadius * 0.8}px`,
                display: "none",
              }}
            >
              {displayName.charAt(0).toUpperCase()}
            </div>
          </div>
        </div>{" "}
        <div className="flex-1 min-w-0 mb-3">
          <div className="font-minecraft text-white text-4xl font-medium truncate">
            {displayName}
          </div>
          <div className="text-xs text-white/60 font-minecraft-ten truncate">
            {isOnline ? (
              friend.server ? (
                <span className="truncate">{friend.server}</span>
              ) : (
                "Online"
              )
            ) : (
              <span className="truncate">{`Offline • ${formatLastSeen(friend.noriskUser.lastSeen)}`}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <IconButton
            icon={<Icon icon="solar:chat-round-dots-bold" />}
            onClick={handleMessage}
            variant="ghost"
            size="sm"
            aria-label={`Message ${displayName}`}
          />

          {isOnline && friend.server && (
            <IconButton
              icon={<Icon icon="solar:login-3-bold" />}
              onClick={handleJoinServer}
              variant="ghost"
              size="sm"
              aria-label={`Join ${friend.server}`}
            />
          )}

          <IconButton
            icon={<Icon icon="solar:trash-bin-trash-bold" />}
            onClick={handleRemove}
            variant="ghost"
            size="sm"
            aria-label={`Remove ${displayName}`}
          />
        </div>
      </div>
    </Card>
  );
});

const FriendCardSkeleton = memo(() => {
  const borderRadius = useThemeStore((state) => state.borderRadius);

  return (
    <Card variant="flat" className="p-4 mb-3">
      <div className="flex items-center gap-4">
        <Skeleton
          variant="image"
          width="48px"
          height="48px"
          className="rounded-full"
        />
        <div className="flex-1 min-w-0">
          <Skeleton variant="text" width="60%" height="20px" className="mb-2" />
          <Skeleton variant="text" width="40%" height="14px" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton
            variant="block"
            width="32px"
            height="32px"
            className="rounded"
          />
          <Skeleton
            variant="block"
            width="32px"
            height="32px"
            className="rounded"
          />
          <Skeleton
            variant="block"
            width="32px"
            height="32px"
            className="rounded"
          />
        </div>{" "}
      </div>
    </Card>
  );
});

const SectionSkeleton = memo(({ title }: { title: string }) => {
  const borderRadius = useThemeStore((state) => state.borderRadius);

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-4 px-2">
        <div
          className="w-3 h-3 bg-gray-500"
          style={{ borderRadius: `${borderRadius}px` }}
        />
        <h3 className="font-minecraft-ten text-white/90 text-sm font-medium uppercase tracking-wider flex items-center gap-2">
          {title} —
          <Skeleton variant="text" width="20px" height="14px" />
        </h3>
      </div>{" "}
      {Array.from({ length: 4 }).map((_, index) => (
        <FriendCardSkeleton key={index} />
      ))}
    </div>
  );
});

export function FriendsTab({
  isInitialized,
  searchQuery = "",
}: {
  isInitialized?: boolean;
  searchQuery?: string;
}) {
  const { friends, removeFriend, hasInitiallyLoaded, isLoading } =
    useFriendsStore();
  const accentColor = useThemeStore((state) => state.accentColor);
  const borderRadius = useThemeStore((state) => state.borderRadius);

  const filteredAndSortedFriends = React.useMemo(() => {
    let filtered = friends.filter((friend) => {
      const displayName =
        friend.noriskUser.displayName || friend.noriskUser.ign;
      const server = friend.server || "";
      return (
        displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        server.toLowerCase().includes(searchQuery.toLowerCase())
      );
    });

    filtered.sort((a, b) => {
      const isOnlineA = FriendsUserStateHelpers.isOnline(a.onlineState);
      const isOnlineB = FriendsUserStateHelpers.isOnline(b.onlineState);

      if (isOnlineA !== isOnlineB) {
        return isOnlineB ? 1 : -1;
      }

      const lastSeenA = a.noriskUser.lastSeen
        ? new Date(a.noriskUser.lastSeen).getTime()
        : 0;
      const lastSeenB = b.noriskUser.lastSeen
        ? new Date(b.noriskUser.lastSeen).getTime()
        : 0;

      if (lastSeenA !== lastSeenB) {
        return lastSeenB - lastSeenA;
      }

      const nameA = a.noriskUser.displayName || a.noriskUser.ign;
      const nameB = b.noriskUser.displayName || b.noriskUser.ign;
      return nameA.localeCompare(nameB);
    });

    return filtered;
  }, [friends, searchQuery]);

  const onlineFriends = filteredAndSortedFriends.filter((f) =>
    FriendsUserStateHelpers.isOnline(f.onlineState)
  );
  const offlineFriends = filteredAndSortedFriends.filter(
    (f) => !FriendsUserStateHelpers.isOnline(f.onlineState)
  );

  const handleRemoveFriend = (uuid: string) => {
    removeFriend(uuid);
  };

  if (!isInitialized || (isLoading && !hasInitiallyLoaded)) {
    return (
      <div className="p-4 overflow-y-auto max-h-full custom-scrollbar">
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-4 px-2">
            <div
              className="w-3 h-3 bg-blue-500"
              style={{ borderRadius: `${borderRadius}px` }}
            />
            <h3 className="font-minecraft-ten text-white/90 text-sm font-medium uppercase tracking-wider">
              You
            </h3>
          </div>
          <FriendCardSkeleton />
        </div>
        <SectionSkeleton title="Online" />
        <SectionSkeleton title="Offline" />
      </div>
    );
  }

  if (friends.length === 0) {
    return (
      <div className="relative p-4 overflow-y-auto max-h-full custom-scrollbar">
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-4 px-2">
            <div
              className="w-3 h-3 bg-blue-500"
              style={{ borderRadius: `${borderRadius}px` }}
            />
            <h3 className="font-minecraft-ten text-white/90 text-sm font-medium uppercase tracking-wider">
              You
            </h3>
          </div>
          <UserProfileCard />
        </div>
        <div className="flex flex-col items-center justify-center h-64 text-center px-8">
          <Icon
            icon="solar:users-group-rounded-bold"
            className="w-16 h-16 text-white/30 mb-4"
          />
          <h3 className="text-xl font-minecraft text-white mb-2">
            No Friends Yet
          </h3>
          <p className="text-white/60 font-ten">
            Add some friends to get started!
          </p>
        </div>
      </div>
    );
  }

  if (filteredAndSortedFriends.length === 0 && searchQuery) {
    return (
      <div className="relative p-4 overflow-y-auto max-h-full custom-scrollbar">
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-4 px-2">
            <div
              className="w-3 h-3 bg-blue-500"
              style={{ borderRadius: `${borderRadius}px` }}
            />
            <h3 className="font-minecraft-ten text-white/90 text-sm font-medium uppercase tracking-wider">
              You
            </h3>
          </div>
          <UserProfileCard />
        </div>
        <div className="flex flex-col items-center justify-center h-64 text-center px-8">
          <Icon
            icon="solar:magnifer-bold"
            className="w-16 h-16 text-white/30 mb-4"
          />
          <h3 className="text-xl font-minecraft text-white mb-2">
            No Results Found
          </h3>
          <p className="text-white/60 font-ten">Try a different search term</p>
        </div>
      </div>
    );
  }
  return (
    <div className="relative p-4 overflow-y-auto max-h-full custom-scrollbar">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-4 px-2">
          <div
            className="w-3 h-3 bg-blue-500"
            style={{ borderRadius: `${borderRadius}px` }}
          />
          <h3 className="font-minecraft-ten text-white/90 text-sm font-medium uppercase tracking-wider">
            You
          </h3>
        </div>
        <UserProfileCard />
      </div>

      {onlineFriends.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-4 px-2">
            <div
              className="w-3 h-3 bg-green-500"
              style={{ borderRadius: `${borderRadius}px` }}
            />{" "}
            <h3 className="font-minecraft-ten text-white/90 text-sm font-medium uppercase tracking-wider">
              Online — {onlineFriends.length}
            </h3>
          </div>
          {onlineFriends.map((friend) => (
            <FriendCard
              key={friend.noriskUser.uuid}
              friend={friend}
              onRemove={handleRemoveFriend}
            />
          ))}
        </div>
      )}

      {offlineFriends.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4 px-2">
            <div
              className="w-3 h-3 bg-gray-500"
              style={{ borderRadius: `${borderRadius}px` }}
            />{" "}
            <h3 className="font-minecraft-ten text-white/90 text-sm font-medium uppercase tracking-wider">
              Offline — {offlineFriends.length}
            </h3>
          </div>
          {offlineFriends.map((friend) => (
            <FriendCard
              key={friend.noriskUser.uuid}
              friend={friend}
              onRemove={handleRemoveFriend}
            />
          ))}
        </div>
      )}
    </div>
  );
}
