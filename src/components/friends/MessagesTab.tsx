import React, { useEffect, useState, useRef } from "react";
import { Icon } from "@iconify/react";
import { toast } from "react-hot-toast";
import { cn } from "../../lib/utils";
import { useThemeStore } from "../../store/useThemeStore";
import { useMessagingStore } from "../../store/useMessagingStore";
import { useFriendsStore } from "../../store/useFriendsStore";
import { useMinecraftAuthStore } from "../../store/minecraft-auth-store";
import { useSequentialLoading } from "../../hooks/useSequentialLoading";
import { Card } from "../ui/Card";
import { IconButton } from "../ui/buttons/IconButton";
import { ScrollSentinel } from "../ui/ScrollSentinel";
import { Skeleton } from "../ui/Skeleton";
import { Avatar } from "../common/Avatar";
import { getUserStatusColor, getUserStatusText } from "../common/UserStatus";
import { useAvatarPreloader } from "../../hooks/useAvatarLoader";
import { formatMessageTime } from "../../utils/date-helpers";
import { showErrorToast } from "../../utils/toast-helpers";
import ChatWindow from "./ChatWindow";
import type { ChatWithMetadata } from "../../types/messaging";
import * as MessagingService from "../../services/messaging-service";

interface MessagesTabProps {
  isVisible?: boolean;
  searchQuery?: string;
  openChatWithFriend?: string;
  onClearOpenChat?: () => void;
  onChatOpened?: () => void;
  onChatClosed?: () => void;
}

interface ChatListItemProps {
  chat: ChatWithMetadata;
  onClick: (chat: ChatWithMetadata) => void;
  currentUser?: any;
  authUser?: any;
  friends: any[];
  getActualLatestMessage: (chatId: string) => any;
}

const ChatListItem = React.memo(
  ({
    chat,
    onClick,
    currentUser,
    authUser,
    friends,
    getActualLatestMessage,
  }: ChatListItemProps) => {
    const accentColor = useThemeStore((state) => state.accentColor);
    const borderRadius = useThemeStore((state) => state.borderRadius);

    const handleClick = () => {
      onClick(chat);
    };

    let otherParticipantId = chat.otherParticipant;
    if (!otherParticipantId && currentUser && chat.participants) {
      const otherParticipant = chat.participants.find(
        (p) => p.userId !== currentUser.userId
      );
      otherParticipantId = otherParticipant?.userId || null;
    }

    const friend = friends.find(
      (f) => f.noriskUser.uuid === otherParticipantId
    );
    const displayName =
      friend?.noriskUser.displayName ||
      friend?.noriskUser.ign ||
      otherParticipantId ||
      "Unknown";

    const friendStatus = friend?.onlineState || "OFFLINE";
    const statusColor = getUserStatusColor(friendStatus);
    const statusText = getUserStatusText(friendStatus);

    const getLatestMessageDisplay = () => {
      const actualLatestMessage = getActualLatestMessage(chat._id);
      const latestMessage = actualLatestMessage || chat.latestMessage;

      if (!latestMessage) return "No messages";

      const authUserId = authUser?.id;
      const authUsername = authUser?.minecraft_username;
      const friendsUserId = currentUser?.userId;

      const isOwnMessage =
        latestMessage.senderId === authUserId ||
        latestMessage.senderId === authUsername ||
        latestMessage.senderId === friendsUserId;

      const senderName = isOwnMessage ? "You" : displayName;

      const truncatedContent =
        latestMessage.content.length > 50
          ? latestMessage.content.substring(0, 50) + "..."
          : latestMessage.content;

      return `${senderName}: ${truncatedContent}`;
    };

    const lastMessageText = getLatestMessageDisplay();

    const getLatestTimestamp = () => {
      const actualLatestMessage = getActualLatestMessage(chat._id);
      return actualLatestMessage?.createdAt || chat.latestMessage?.createdAt;
    };

    const lastMessageTime = getLatestTimestamp()
      ? formatMessageTime(getLatestTimestamp()!)
      : "";

    return (
      <Card
        variant="flat"
        className="p-2 sm:p-3 md:p-4 mb-2 sm:mb-3 cursor-pointer transition-all duration-200 hover:bg-black/50"
        onClick={handleClick}
        disableHover={false}
      >
        <div className="flex items-center gap-2 sm:gap-3 md:gap-4">
          <div className="relative">
            <Avatar
              userId={otherParticipantId}
              displayName={displayName}
              size={48}
              className={statusColor}
              showSkeleton={true}
            />

            {chat.unreadMessages > 0 && (
              <div
                className="absolute -top-1 -right-1 min-w-[20px] h-[20px] rounded-full flex items-center justify-center text-xs font-bold text-white"
                style={{ backgroundColor: accentColor.value }}
              >
                {chat.unreadMessages > 99 ? "99+" : chat.unreadMessages}
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <div className="font-minecraft text-white text-2xl sm:text-3xl md:text-4xl font-medium truncate">
                {displayName}
              </div>
              {lastMessageTime && (
                <div className="text-xs text-white/50 font-minecraft-ten">
                  {lastMessageTime}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <div className="text-xs text-white/60 font-minecraft-ten flex-1 min-w-0 overflow-hidden">
                <span className="block truncate">{lastMessageText}</span>
              </div>
              {friend?.server && friendStatus.toUpperCase() === "ONLINE" && (
                <div className="text-xs text-white/40 font-minecraft-ten flex-shrink-0">
                  Playing on {friend.server}
                </div>
              )}
            </div>
          </div>

          <IconButton
            icon={<Icon icon="solar:alt-arrow-right-bold" />}
            variant="ghost"
            size="sm"
            className="opacity-50"
          />
        </div>
      </Card>
    );
  }
);

const ChatItemSkeleton = React.memo(() => {
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
          <div className="flex items-center justify-between mb-2">
            <Skeleton variant="text" width="40%" height="24px" />
            <Skeleton variant="text" width="60px" height="12px" />
          </div>
          <Skeleton variant="text" width="80%" height="14px" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton
            variant="block"
            width="24px"
            height="24px"
            className="rounded-full"
          />
        </div>
      </div>
    </Card>
  );
});

const MessagesLoadingSkeleton = React.memo(() => {
  return (
    <div className="p-4 space-y-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <ChatItemSkeleton key={index} />
      ))}
    </div>
  );
});

const ChatListSkeleton = React.memo(() => {
  const borderRadius = useThemeStore((state) => state.borderRadius);

  return (
    <Card variant="flat" className="p-2 sm:p-3 md:p-4 mb-2 sm:mb-3">
      <div className="flex items-center gap-2 sm:gap-3 md:gap-4">
        <Skeleton
          variant="image"
          width="48px"
          height="48px"
          className="rounded-full"
          style={{ borderRadius: `${borderRadius}px` }}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-2">
            <Skeleton variant="text" width="60%" height="20px" />
            <Skeleton variant="text" width="50px" height="14px" />
          </div>
          <Skeleton variant="text" width="80%" height="14px" />
        </div>
        <Skeleton
          variant="block"
          width="24px"
          height="24px"
          className="rounded"
        />
      </div>
    </Card>
  );
});

export function MessagesTab({
  isVisible,
  searchQuery = "",
  openChatWithFriend,
  onClearOpenChat,
  onChatOpened,
  onChatClosed,
}: MessagesTabProps) {
  const accentColor = useThemeStore((state) => state.accentColor);
  const borderRadius = useThemeStore((state) => state.borderRadius);

  const {
    chats,
    isRefreshing,
    setActiveChat,
    refreshMessagingData,
    loadChatMessages,
    addOrUpdateChat,
  } = useMessagingStore();

  const allMessages = useMessagingStore((state) => state.messages);

  const { friends, currentUser } = useFriendsStore();
  const authUser = useMinecraftAuthStore((state) => state.activeAccount);
  const preloadAvatars = useAvatarPreloader();

  const [hasLoaded, setHasLoaded] = useState(false);
  const [selectedChat, setSelectedChat] = useState<ChatWithMetadata | null>(
    null
  );
  const hasProcessedOpenChatRef = useRef(false);

  useEffect(() => {
    if (isVisible && !hasLoaded && !isRefreshing) {
      const initializeMessages = async () => {
        try {
          await refreshMessagingData();
          setHasLoaded(true);
        } catch (error) {}
      };
      initializeMessages();
    }
  }, [isVisible, hasLoaded, isRefreshing]);

  const getActualLatestTimestamp = (chat: ChatWithMetadata) => {
    const messages = allMessages[chat._id] || [];
    if (messages.length > 0) {
      const latestFromStore = messages[messages.length - 1];
      return latestFromStore.createdAt;
    }

    if (chat.latestMessage) {
      return chat.latestMessage.createdAt;
    }

    const fallbackTime = chat.createdAt || 0;
    return fallbackTime;
  };

  const getActualLatestMessage = (chatId: string) => {
    const messages = allMessages[chatId] || [];
    if (messages.length === 0) return null;

    const latestMessage = messages[messages.length - 1];
    return latestMessage;
  };

  let filteredChats: ChatWithMetadata[] = [];
  try {
    filteredChats = chats
      .filter((chat) => {
        const actualLatestMessage = getActualLatestMessage(chat._id);
        const hasMessages =
          actualLatestMessage !== null || chat.latestMessage !== null;
        return hasMessages;
      })
      .filter((chat) => {
        if (!searchQuery) return true;

        let otherParticipantId = chat.otherParticipant;
        if (!otherParticipantId && currentUser && chat.participants) {
          const otherParticipant = chat.participants.find(
            (p) => p.userId !== currentUser.userId
          );
          otherParticipantId = otherParticipant?.userId || null;
        }

        const friend = friends.find(
          (f) => f.noriskUser.uuid === otherParticipantId
        );
        const displayName =
          friend?.noriskUser.displayName ||
          friend?.noriskUser.ign ||
          otherParticipantId ||
          "";
        return displayName.toLowerCase().includes(searchQuery.toLowerCase());
      })
      .sort((a, b) => {
        const aTime = getActualLatestTimestamp(a);
        const bTime = getActualLatestTimestamp(b);
        return bTime - aTime;
      });
  } catch (error) {}

  const chatsLoader = useSequentialLoading(filteredChats, {
    itemsPerPage: 10,
    initialLoadCount: 10,
    loadThreshold: 1,
    enabled: filteredChats.length > 1,
  });

  useEffect(() => {
    if (chatsLoader.displayedItems.length > 0 && isVisible) {
      const userIds = chatsLoader.displayedItems
        .map((chat) => {
          let otherParticipantId = chat.otherParticipant;
          if (!otherParticipantId && currentUser && chat.participants) {
            const otherParticipant = chat.participants.find(
              (p) => p.userId !== currentUser.userId
            );
            otherParticipantId = otherParticipant?.userId || null;
          }
          return otherParticipantId;
        })
        .filter(Boolean) as string[];

      if (userIds.length > 0) {
        preloadAvatars(userIds);
      }
    }
  }, [chatsLoader.displayedItems, isVisible, currentUser, preloadAvatars]);

  useEffect(() => {
    if (openChatWithFriend && !hasProcessedOpenChatRef.current) {
      hasProcessedOpenChatRef.current = true;

      if (chats.length > 0) {
        const existingChat = chats.find(
          (chat) => chat.otherParticipant === openChatWithFriend
        );

        if (existingChat) {
          setSelectedChat(existingChat);
        } else {
          const createChatForFriend = async () => {
            try {
              const newChat =
                await MessagingService.getPrivateChatForFriend(
                  openChatWithFriend
                );
              setSelectedChat(newChat);
            } catch (error) {
              try {
                await MessagingService.createPrivateChat(openChatWithFriend);
                const newChat =
                  await MessagingService.getPrivateChatForFriend(
                    openChatWithFriend
                  );
                setSelectedChat(newChat);

                addOrUpdateChat(newChat);

                await refreshMessagingData(true);
              } catch (createError) {
                showErrorToast("Failed to create chat with friend", {
                  accentColor: accentColor.value,
                });
              }
            }
          };
          createChatForFriend();
        }
      } else if (hasLoaded && !isRefreshing) {
        const createFirstChat = async () => {
          try {
            await MessagingService.createPrivateChat(openChatWithFriend);
            const newChat =
              await MessagingService.getPrivateChatForFriend(
                openChatWithFriend
              );
            setSelectedChat(newChat);

            addOrUpdateChat(newChat);

            await refreshMessagingData(true);
          } catch (createError) {
            showErrorToast("Failed to create chat with friend", {
              accentColor: accentColor.value,
            });
          }
        };
        createFirstChat();
      } else {
      }
    }

    if (!openChatWithFriend) {
      hasProcessedOpenChatRef.current = false;
    }
  }, [
    openChatWithFriend,
    chats,
    accentColor.value,
    hasLoaded,
    isRefreshing,
    refreshMessagingData,
  ]);

  const handleChatClick = (chat: ChatWithMetadata) => {
    setActiveChat(chat);
    setSelectedChat(chat);
    if (onChatOpened) {
      onChatOpened();
    }
  };

  const handleBackToList = () => {
    setSelectedChat(null);
    if (onClearOpenChat) {
      onClearOpenChat();
    }
    if (onChatClosed) {
      onChatClosed();
    }
  };

  const shouldShowSkeletons =
    (isRefreshing && !hasLoaded && chats.length === 0) ||
    (isVisible && !hasLoaded && chats.length === 0);

  if (shouldShowSkeletons) {
    return (
      <div className="p-6 overflow-y-auto max-h-full custom-scrollbar">
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-4 px-2">
            <div
              className="w-3 h-3 bg-green-500"
              style={{ borderRadius: `${borderRadius}px` }}
            />
            <h3 className="font-minecraft-ten text-white/90 text-sm font-medium uppercase tracking-wider">
              Recent Chats
            </h3>
          </div>
          {Array.from({ length: 3 }).map((_, index) => (
            <ChatItemSkeleton key={index} />
          ))}
        </div>
      </div>
    );
  }

  if (selectedChat) {
    let otherParticipantId = selectedChat.otherParticipant;
    if (!otherParticipantId && currentUser && selectedChat.participants) {
      const otherParticipant = selectedChat.participants.find(
        (p) => p.userId !== currentUser.userId
      );
      otherParticipantId = otherParticipant?.userId || null;
    }

    const friend = friends.find(
      (f) => f.noriskUser.uuid === otherParticipantId
    );
    const recipientName =
      friend?.noriskUser.displayName ||
      friend?.noriskUser.ign ||
      otherParticipantId ||
      "Unknown";

    return (
      <div className="h-full flex flex-col">
        <ChatWindow
          chatId={selectedChat._id}
          recipientName={recipientName}
          recipientId={otherParticipantId}
          onClose={handleBackToList}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full p-6">
      <div className="flex items-center gap-2 mb-4 px-2">
        <div
          className="w-3 h-3 bg-green-500"
          style={{ borderRadius: `${borderRadius}px` }}
        />
        <h3 className="font-minecraft-ten text-white/90 text-sm font-medium uppercase tracking-wider">
          Messages
        </h3>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {chatsLoader.displayedItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <div
              className="w-16 h-16 rounded-full border-2 border-b-4 flex items-center justify-center mb-4"
              style={{
                backgroundColor: `${accentColor.value}20`,
                borderColor: `${accentColor.value}30`,
                borderBottomColor: `${accentColor.value}40`,
              }}
            >
              <Icon
                icon="solar:chat-round-dots-bold"
                className="w-8 h-8 text-white/70"
              />
            </div>
            <p className="text-white/60 font-minecraft text-sm tracking-wide lowercase select-none">
              {searchQuery
                ? "No matching conversations"
                : "No conversations yet"}
            </p>
            <p className="text-white/40 font-minecraft text-xs mt-2 tracking-wide lowercase select-none">
              {searchQuery
                ? "Try a different search term"
                : "Send a message to a friend to start chatting"}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {chatsLoader.displayedItems.map((chat) => (
              <ChatListItem
                key={chat._id}
                chat={chat}
                onClick={handleChatClick}
                currentUser={currentUser}
                authUser={authUser}
                friends={friends}
                getActualLatestMessage={getActualLatestMessage}
              />
            ))}
            <ScrollSentinel
              sentinelRef={chatsLoader.scrollSentinelRef}
              isLoading={chatsLoader.isLoading}
              hasMore={chatsLoader.hasMore}
            />
          </div>
        )}
      </div>
    </div>
  );
}
