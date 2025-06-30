import React, { useEffect, useState, memo } from "react";
import { Icon } from "@iconify/react";
import { cn } from "../../lib/utils";
import { useThemeStore } from "../../store/useThemeStore";
import { useFriendsStore } from "../../store/useFriendsStore";
import { Card } from "../ui/Card";
import { IconButton } from "../ui/buttons/IconButton";
import { Skeleton } from "../ui/Skeleton";
import { Avatar } from "../common/Avatar";
import { showSuccessToast, showErrorToast } from "../../utils/toast-helpers";
import type { FriendsFriendRequestResponse } from "../../types/friends";
import * as FriendsService from "../../services/friends-service";
import { toast } from "react-hot-toast";

interface IncomingRequestCardProps {
  request: FriendsFriendRequestResponse;
  onAccept: (senderUuid: string) => void;
  onDecline: (senderUuid: string) => void;
}

const IncomingRequestCard = memo(
  ({ request, onAccept, onDecline }: IncomingRequestCardProps) => {
    const accentColor = useThemeStore((state) => state.accentColor);

    const senderUser = request.users.find(
      (u) => u.uuid === request.friendRequest.sender
    );
    const displayName =
      senderUser?.displayName || senderUser?.ign || "Unknown User";

    const handleAccept = async () => {
      try {
        await FriendsService.acceptFriendRequest(request.friendRequest.sender);
        onAccept(request.friendRequest.sender);
        showSuccessToast(`Accepted friend request from ${displayName}`, { accentColor: accentColor.value });
      } catch (error) {
        showErrorToast("Failed to accept friend request", { accentColor: accentColor.value });
      }
    };

    const handleDecline = async () => {
      try {
        await FriendsService.declineFriendRequest(request.friendRequest.sender);
        onDecline(request.friendRequest.sender);
        showSuccessToast(`Declined friend request from ${displayName}`, { accentColor: accentColor.value });
      } catch (error) {
        showErrorToast("Failed to decline friend request", { accentColor: accentColor.value });
      }
    };

    return (
      <Card variant="flat" className="p-4 mb-3">
        <div className="flex items-center gap-4">
          <Avatar
            userId={request.friendRequest.sender}
            displayName={displayName}
            size={48}
          />

          <div className="flex-1 min-w-0 mb-3">
            <div className="font-minecraft text-white text-4xl font-medium truncate">
              {displayName}
            </div>
            <div className="text-xs text-white/60 font-minecraft-ten truncate">
              Wants to be friends
            </div>
          </div>

          <div className="flex items-center gap-2">
            <IconButton
              icon={<Icon icon="solar:check-circle-bold" />}
              onClick={handleAccept}
              variant="ghost"
              size="sm"
            />
            <IconButton
              icon={<Icon icon="solar:close-circle-bold" />}
              onClick={handleDecline}
              variant="ghost"
              size="sm"
            />
          </div>
        </div>
      </Card>
    );
  }
);

interface OutgoingRequestCardProps {
  request: FriendsFriendRequestResponse;
  onCancel: (receiverUuid: string) => void;
}

const OutgoingRequestCard = memo(
  ({ request, onCancel }: OutgoingRequestCardProps) => {
    const accentColor = useThemeStore((state) => state.accentColor);

    const receiverUser = request.users.find(
      (u) => u.uuid === request.friendRequest.receiver
    );
    const displayName =
      receiverUser?.displayName || receiverUser?.ign || "Unknown User";

    const handleCancel = async () => {
      try {
        await FriendsService.cancelFriendRequest(request.friendRequest.receiver);
        onCancel(request.friendRequest.receiver);
        toast(`Cancelled friend request to ${displayName}`, {
          icon: (
            <Icon
              icon="solar:close-circle-bold"
              style={{ color: accentColor.value }}
            />
          ),
        });
      } catch (error) {
        toast(`Failed to cancel friend request`, {
          icon: (
            <Icon
              icon="solar:info-circle-bold"
              style={{ color: accentColor.value }}
            />
          ),
        });
      }
    };

    return (
      <Card variant="flat" className="p-4 mb-3">
        <div className="flex items-center gap-4">
          <Avatar
            userId={request.friendRequest.receiver}
            displayName={displayName}
            size={48}
          />

          <div className="flex-1 min-w-0 mb-3">
            <div className="font-minecraft text-white text-4xl font-medium truncate">
              {displayName}
            </div>
            <div className="text-xs text-white/60 font-minecraft-ten truncate">
              Pending friend request
            </div>
          </div>

          <div className="flex items-center gap-2">
            <IconButton
              icon={<Icon icon="solar:close-circle-bold" />}
              onClick={handleCancel}
              variant="ghost"
              size="sm"
            />
          </div>
        </div>
      </Card>
    );
  }
);

const RequestCardSkeleton = memo(() => {
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
        </div>
      </div>
    </Card>
  );
});

export function RequestsTab({
  isVisible,
  sidebarOpen,
}: {
  isVisible?: boolean;
  sidebarOpen?: boolean;
}) {
  const [hasBeenVisible, setHasBeenVisible] = useState(false);

  const accentColor = useThemeStore((state) => state.accentColor);
  const borderRadius = useThemeStore((state) => state.borderRadius);

  const { 
    friendRequests,
    isLoading,
    refreshFriendsData,
    hasInitiallyLoaded,
    currentUser
  } = useFriendsStore();

  useEffect(() => {
    if (isVisible && !hasBeenVisible) {
      setHasBeenVisible(true);
      if (!hasInitiallyLoaded) {
        refreshFriendsData().catch(() => {
        });
      }
    }
  }, [isVisible, hasBeenVisible, hasInitiallyLoaded, refreshFriendsData]);

  const incomingRequests = React.useMemo(() => {
    if (!currentUser) return [];
    return friendRequests.filter(req => req.friendRequest.receiver === currentUser.userId);
  }, [friendRequests, currentUser]);

  const outgoingRequests = React.useMemo(() => {
    if (!currentUser) return [];
    return friendRequests.filter(req => req.friendRequest.sender === currentUser.userId);
  }, [friendRequests, currentUser]);

  const handleAcceptRequest = async (senderUuid: string) => {
    await refreshFriendsData();
  };

  const handleDeclineRequest = async (senderUuid: string) => {
    await refreshFriendsData();
  };

  const handleCancelRequest = async (receiverUuid: string) => {
    await refreshFriendsData();
  };

  const hasRequests = incomingRequests.length > 0 || outgoingRequests.length > 0;

  const shouldShowSkeletons = isLoading && !hasInitiallyLoaded;

  if (shouldShowSkeletons) {
    return (
      <div className="p-4 overflow-y-auto max-h-full custom-scrollbar">
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-4 px-2">
            <div
              className="w-3 h-3 bg-blue-500"
              style={{ borderRadius: `${borderRadius}px` }}
            />
            <h3 className="font-minecraft-ten text-white/90 text-sm font-medium uppercase tracking-wider">
              Incoming
            </h3>
          </div>
          {Array.from({ length: 2 }).map((_, index) => (
            <RequestCardSkeleton key={index} />
          ))}
        </div>
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-4 px-2">
            <div
              className="w-3 h-3 bg-gray-500"
              style={{ borderRadius: `${borderRadius}px` }}
            />
            <h3 className="font-minecraft-ten text-white/90 text-sm font-medium uppercase tracking-wider">
              Outgoing
            </h3>
          </div>
          {Array.from({ length: 2 }).map((_, index) => (
            <RequestCardSkeleton key={index} />
          ))}
        </div>
      </div>
    );
  }

  if (!hasRequests) {
    return (
      <div className="relative p-4 overflow-y-auto max-h-full custom-scrollbar">
        <div className="flex flex-col items-center justify-center h-64 text-center px-8">
          <div
            className="w-16 h-16 flex items-center justify-center mb-4 backdrop-blur-md border border-white/10"
            style={{
              backgroundColor: `${accentColor}15`,
              borderRadius: `${borderRadius * 2}px`,
            }}
          >
            <Icon
              icon="solar:users-group-two-rounded-bold-duotone"
              className="w-8 h-8"
              style={{ color: `${accentColor}` }}
            />
          </div>
          <h3 className="text-xl font-minecraft text-white mb-2">
            No friend requests
          </h3>
          <p className="text-white/60 font-minecraft-ten text-sm tracking-wide lowercase">
            You have no pending friend requests at the moment
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 overflow-y-auto max-h-full custom-scrollbar">
      {incomingRequests.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-4 px-2">
            <div
              className="w-3 h-3 bg-blue-500"
              style={{ borderRadius: `${borderRadius}px` }}
            />
            <h3 className="font-minecraft-ten text-white/90 text-sm font-medium uppercase tracking-wider">
              Incoming ({incomingRequests.length})
            </h3>
          </div>
          {incomingRequests.map((request) => (
            <IncomingRequestCard
              key={request.friendRequest.id}
              request={request}
              onAccept={handleAcceptRequest}
              onDecline={handleDeclineRequest}
            />
          ))}
        </div>
      )}

      {outgoingRequests.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-4 px-2">
            <div
              className="w-3 h-3 bg-gray-500"
              style={{ borderRadius: `${borderRadius}px` }}
            />
            <h3 className="font-minecraft-ten text-white/90 text-sm font-medium uppercase tracking-wider">
              Outgoing ({outgoingRequests.length})
            </h3>
          </div>
          {outgoingRequests.map((request) => (
            <OutgoingRequestCard
              key={request.friendRequest.id}
              request={request}
              onCancel={handleCancelRequest}
            />
          ))}
        </div>
      )}
    </div>
  );
}
