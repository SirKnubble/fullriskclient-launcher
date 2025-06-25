import React, { useEffect, useState, memo } from "react";
import { Icon } from "@iconify/react";
import { cn } from "../../lib/utils";
import { useThemeStore } from "../../store/useThemeStore";
import { Card } from "../ui/Card";
import { IconButton } from "../ui/buttons/IconButton";
import { Skeleton } from "../ui/Skeleton";
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
    const borderRadius = useThemeStore((state) => state.borderRadius);

    const senderUser = request.users.find(
      (u) => u.uuid === request.friendRequest.sender
    );
    const displayName =
      senderUser?.displayName || senderUser?.ign || "Unknown User";

    const handleAccept = async () => {
      try {
        await FriendsService.acceptFriendRequest(request.friendRequest.sender);
        onAccept(request.friendRequest.sender);
        toast(`Accepted friend request from ${displayName}`, {
          icon: (
            <Icon
              icon="solar:check-circle-bold"
              style={{ color: accentColor.value }}
            />
          ),
        });
      } catch (error) {
        toast(`Failed to accept friend request`, {
          icon: (
            <Icon
              icon="solar:info-circle-bold"
              style={{ color: accentColor.value }}
            />
          ),
        });
      }
    };

    const handleDecline = async () => {
      try {
        await FriendsService.declineFriendRequest(request.friendRequest.sender);
        onDecline(request.friendRequest.sender);
        toast(`Declined friend request from ${displayName}`, {
          icon: (
            <Icon
              icon="solar:info-circle-bold"
              style={{ color: accentColor.value }}
            />
          ),
        });
      } catch (error) {
        toast(`Failed to decline friend request`, {
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
          <div className="relative">
            <div
              className={cn(
                "w-12 h-12 rounded-lg overflow-hidden border-2",
                "border-blue-500"
              )}
            >
              <img
                src={`https://crafatar.com/avatars/${senderUser?.uuid}?overlay&size=48`}
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
                className="w-full h-full flex items-center justify-center text-white font-minecraft text-lg font-bold absolute top-0.5 left-0.5"
                style={{
                  backgroundColor: accentColor.value,
                  borderRadius: `${borderRadius * 0.8}px`,
                  display: "none",
                }}
              >
                {displayName.charAt(0).toUpperCase()}
              </div>
            </div>
          </div>

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
    const borderRadius = useThemeStore((state) => state.borderRadius);

    const receiverUser = request.users.find(
      (u) => u.uuid === request.friendRequest.receiver
    );
    const displayName =
      receiverUser?.displayName || receiverUser?.ign || "Unknown User";

    const handleCancel = async () => {
      try {
        await FriendsService.cancelFriendRequest(
          request.friendRequest.receiver
        );
        onCancel(request.friendRequest.receiver);
        toast(`Cancelled friend request to ${displayName}`, {
          icon: (
            <Icon
              icon="solar:info-circle-bold"
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
          <div className="relative">
            <div
              className={cn(
                "w-12 h-12 rounded-lg overflow-hidden border-2",
                "border-gray-500"
              )}
            >
              <img
                src={`https://crafatar.com/avatars/${receiverUser?.uuid}?overlay&size=48`}
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
                className="w-full h-full flex items-center justify-center text-white font-minecraft text-lg font-bold absolute top-0.5 left-0.5"
                style={{
                  backgroundColor: accentColor.value,
                  borderRadius: `${borderRadius * 0.8}px`,
                  display: "none",
                }}
              >
                {displayName.charAt(0).toUpperCase()}
              </div>
            </div>
          </div>

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
  const [incomingRequests, setIncomingRequests] = useState<
    FriendsFriendRequestResponse[]
  >([]);
  const [outgoingRequests, setOutgoingRequests] = useState<
    FriendsFriendRequestResponse[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [hasBeenVisible, setHasBeenVisible] = useState(false);
  const [lastSidebarState, setLastSidebarState] = useState(false);

  const accentColor = useThemeStore((state) => state.accentColor);
  const borderRadius = useThemeStore((state) => state.borderRadius);

  useEffect(() => {
    if (sidebarOpen && !lastSidebarState) {
      setHasBeenVisible(false);
      setHasLoaded(false);
      setIncomingRequests([]);
      setOutgoingRequests([]);
      setError(null);
      setLoading(false);
    }
    setLastSidebarState(!!sidebarOpen);
  }, [sidebarOpen, lastSidebarState]);

  const loadRequests = async () => {
    try {
      setLoading(true);
      setError(null);

      const [incoming, outgoing] = await Promise.all([
        FriendsService.getIncomingFriendRequests(),
        FriendsService.getOutgoingFriendRequests(),
      ]);

      setIncomingRequests(incoming);
      setOutgoingRequests(outgoing);
      setHasLoaded(true);
    } catch (err) {
      setError("Failed to load friend requests. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isVisible && !hasBeenVisible) {
      setHasBeenVisible(true);
      if (!hasLoaded) {
        loadRequests();
      }
    }
  }, [isVisible, hasBeenVisible, hasLoaded]);

  const handleAcceptRequest = (senderUuid: string) => {
    setIncomingRequests((prev) =>
      prev.filter((req) => req.friendRequest.sender !== senderUuid)
    );
  };

  const handleDeclineRequest = (senderUuid: string) => {
    setIncomingRequests((prev) =>
      prev.filter((req) => req.friendRequest.sender !== senderUuid)
    );
  };

  const handleCancelRequest = (receiverUuid: string) => {
    setOutgoingRequests((prev) =>
      prev.filter((req) => req.friendRequest.receiver !== receiverUuid)
    );
  };

  const shouldShowSkeletons = loading && !hasLoaded;

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

  if (error) {
    return (
      <div className="relative p-4 overflow-y-auto max-h-full custom-scrollbar">
        <div className="flex flex-col items-center justify-center h-64 text-center px-8">
          <Icon
            icon="solar:wifi-router-minimalistic-bold"
            className="w-16 h-16 text-white/30 mb-4"
          />
          <h3 className="text-xl font-minecraft text-white mb-2">
            Connection Error
          </h3>
          <p className="text-white/60 font-ten mb-4">{error}</p>
          <button
            onClick={loadRequests}
            className="px-4 py-2 rounded-lg font-minecraft text-sm transition-colors duration-200"
            style={{
              backgroundColor: accentColor.value,
              color: "white",
            }}
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const totalRequests = incomingRequests.length + outgoingRequests.length;

  if (totalRequests === 0) {
    return (
      <div className="relative p-4 overflow-y-auto max-h-full custom-scrollbar">
        <div className="flex flex-col items-center justify-center h-64 text-center px-8">
          <Icon
            icon="solar:users-group-two-rounded-bold"
            className="w-16 h-16 text-white/30 mb-4"
          />
          <h3 className="text-xl font-minecraft text-white mb-2">
            No Friend Requests
          </h3>
          <p className="text-white/60 font-ten">
            You have no pending friend requests
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative p-4 overflow-y-auto max-h-full custom-scrollbar">
      {incomingRequests.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-4 px-2">
            <div
              className="w-3 h-3 bg-blue-500"
              style={{ borderRadius: `${borderRadius}px` }}
            />
            <h3 className="font-minecraft-ten text-white/90 text-sm font-medium uppercase tracking-wider">
              Incoming — {incomingRequests.length}
            </h3>
          </div>
          {incomingRequests.map((request) => (
            <IncomingRequestCard
              key={`${request.friendRequest.sender}-${request.friendRequest.receiver}`}
              request={request}
              onAccept={handleAcceptRequest}
              onDecline={handleDeclineRequest}
            />
          ))}
        </div>
      )}

      {outgoingRequests.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4 px-2">
            <div
              className="w-3 h-3 bg-gray-500"
              style={{ borderRadius: `${borderRadius}px` }}
            />
            <h3 className="font-minecraft-ten text-white/90 text-sm font-medium uppercase tracking-wider">
              Outgoing — {outgoingRequests.length}
            </h3>
          </div>
          {outgoingRequests.map((request) => (
            <OutgoingRequestCard
              key={`${request.friendRequest.sender}-${request.friendRequest.receiver}`}
              request={request}
              onCancel={handleCancelRequest}
            />
          ))}
        </div>
      )}
    </div>
  );
}
