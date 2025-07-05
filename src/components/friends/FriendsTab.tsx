import React, { useState, memo } from "react";
import { Icon } from "@iconify/react";
import { cn } from "../../lib/utils";
import { useThemeStore } from "../../store/useThemeStore";
import { useFriendsStore } from "../../store/useFriendsStore";
import { useProfileStore } from "../../store/profile-store";
import { useSequentialLoading } from "../../hooks/useSequentialLoading";
import { Card } from "../ui/Card";
import { IconButton } from "../ui/buttons/IconButton";
import { ScrollSentinel } from "../ui/ScrollSentinel";
import { Avatar } from "../common/Avatar";
import { UserProfileCard } from "./UserProfileCard";
import { getUserStatusColor } from "../common/UserStatus";
import { showSuccessToast, showErrorToast } from "../../utils/toast-helpers";
import { formatLastSeen } from "../../utils/date-helpers";
import type { FriendsFriendUser } from "../../types/friends";
import { FriendsUserStateHelpers } from "../../types/friends";
import * as FriendsService from "../../services/friends-service";
import * as ProcessService from "../../services/process-service";
import { toast } from "react-hot-toast";
import { Skeleton } from "../ui/Skeleton";

interface FriendCardProps {
  friend: FriendsFriendUser;
  onRemove: (uuid: string) => void;
  onOpenChat?: (uuid: string) => void;
}

const FriendCard = memo(({ friend, onRemove, onOpenChat }: FriendCardProps) => {
  const accentColor = useThemeStore((state) => state.accentColor);
  const borderRadius = useThemeStore((state) => state.borderRadius);
  const { selectedProfile, lastPlayedProfileId } = useProfileStore();

  const handleRemove = async () => {
    try {
      await FriendsService.removeFriend(friend.noriskUser.uuid);
      onRemove(friend.noriskUser.uuid);
      showSuccessToast(
        `Removed ${friend.noriskUser.displayName || friend.noriskUser.ign} from friends`,
        { accentColor: accentColor.value }
      );
    } catch (error) {
      showErrorToast("Failed to remove friend", {
        accentColor: accentColor.value,
      });
    }
  };

  const handleMessage = () => {
    if (onOpenChat) {
      onOpenChat(friend.noriskUser.uuid);
    }
  };

  const handleJoinServer = async () => {
    if (!friend.server) return;

    try {
      const profileId = selectedProfile?.id || lastPlayedProfileId;
      if (!profileId) {
        showErrorToast("No profile selected", {
          accentColor: accentColor.value,
        });
        return;
      }

      await ProcessService.launch(profileId, undefined, friend.server);
      showSuccessToast(`Joining ${friend.server}...`, {
        accentColor: accentColor.value,
      });
    } catch (error) {
      showErrorToast("Failed to join server", {
        accentColor: accentColor.value,
      });
    }
  };
  const parsedState = FriendsUserStateHelpers.parseState(friend.onlineState);
  const displayName = friend.noriskUser.displayName || friend.noriskUser.ign;
  const isOnline = FriendsUserStateHelpers.isOnline(friend.onlineState);

  const statusColor = getUserStatusColor(friend.onlineState);
  return (
    <Card variant="flat" className="p-2 sm:p-3 md:p-4 mb-2 sm:mb-3">
      <div className="flex items-center gap-2 sm:gap-3 md:gap-4">
        <div className="relative">
          <Avatar
            userId={friend.noriskUser.uuid}
            displayName={displayName}
            size={48}
            className={statusColor}
          />
        </div>
        <div className="flex-1 min-w-0 mb-2 sm:mb-3">
          <div className="font-minecraft text-white text-2xl sm:text-3xl md:text-4xl font-medium break-words overflow-wrap-anywhere">
            {displayName}
          </div>
          <div className="text-xs text-white/60 font-minecraft-ten break-words overflow-wrap-anywhere">
            {isOnline ? (
              friend.server ? (
                <span className="break-words">{friend.server}</span>
              ) : (
                "Online"
              )
            ) : (
              <span className="break-words">{`Offline • ${formatLastSeen(friend.noriskUser.lastSeen)}`}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
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
    <Card variant="flat" className="p-2 sm:p-3 md:p-4 mb-2 sm:mb-3">
      <div className="flex items-center gap-2 sm:gap-3 md:gap-4">
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
        </div>
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
      </div>
      {Array.from({ length: 4 }).map((_, index) => (
        <FriendCardSkeleton key={index} />
      ))}
    </div>
  );
});

export function FriendsTab({
  isInitialized,
  searchQuery = "",
  onOpenChat,
  inSidebar = false,
}: {
  isInitialized?: boolean;
  searchQuery?: string;
  onOpenChat?: (friendUuid: string) => void;
  inSidebar?: boolean;
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

  const onlineFriendsLoader = useSequentialLoading(onlineFriends, {
    itemsPerPage: 10,
    initialLoadCount: 10,
    loadThreshold: 1,
    enabled: onlineFriends.length > 1,
  });

  const offlineFriendsLoader = useSequentialLoading(offlineFriends, {
    itemsPerPage: 10,
    initialLoadCount: 10,
    loadThreshold: 1,
    enabled: offlineFriends.length > 1,
  });

  const handleRemoveFriend = (uuid: string) => {
    removeFriend(uuid);
  };

  if (!isInitialized || (isLoading && !hasInitiallyLoaded)) {
    return (
      <div
        className={cn(
          "p-4",
          inSidebar ? "" : "overflow-y-auto max-h-full custom-scrollbar"
        )}
      >
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
      <div
        className={cn(
          "relative p-4",
          inSidebar ? "" : "overflow-y-auto max-h-full custom-scrollbar"
        )}
      >
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
      <div
        className={cn(
          "relative p-4",
          inSidebar ? "" : "overflow-y-auto max-h-full custom-scrollbar"
        )}
      >
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
    <div
      className={cn(
        "relative p-4",
        inSidebar ? "" : "overflow-y-auto max-h-full custom-scrollbar"
      )}
    >
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

      {onlineFriendsLoader.displayedItems.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-4 px-2">
            <div
              className="w-3 h-3 bg-green-500"
              style={{ borderRadius: `${borderRadius}px` }}
            />
            <h3 className="font-minecraft-ten text-white/90 text-sm font-medium uppercase tracking-wider">
              Online — {onlineFriends.length}
            </h3>
          </div>
          {onlineFriendsLoader.displayedItems.map((friend, index) => (
            <FriendCard
              key={friend.noriskUser.uuid}
              friend={friend}
              onRemove={handleRemoveFriend}
              onOpenChat={onOpenChat}
            />
          ))}
          <ScrollSentinel
            sentinelRef={onlineFriendsLoader.scrollSentinelRef}
            isLoading={onlineFriendsLoader.isLoading}
            hasMore={onlineFriendsLoader.hasMore}
          />
        </div>
      )}

      {offlineFriendsLoader.displayedItems.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4 px-2">
            <div
              className="w-3 h-3 bg-gray-500"
              style={{ borderRadius: `${borderRadius}px` }}
            />
            <h3 className="font-minecraft-ten text-white/90 text-sm font-medium uppercase tracking-wider">
              Offline — {offlineFriends.length}
            </h3>
          </div>
          {offlineFriendsLoader.displayedItems.map((friend, index) => (
            <FriendCard
              key={friend.noriskUser.uuid}
              friend={friend}
              onRemove={handleRemoveFriend}
              onOpenChat={onOpenChat}
            />
          ))}
          <ScrollSentinel
            sentinelRef={offlineFriendsLoader.scrollSentinelRef}
            isLoading={offlineFriendsLoader.isLoading}
            hasMore={offlineFriendsLoader.hasMore}
          />
        </div>
      )}
    </div>
  );
}
