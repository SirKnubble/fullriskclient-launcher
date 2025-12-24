import { useEffect, useRef, useState, useMemo } from "react";
import { Icon } from "@iconify/react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import { useFriendsStore, FriendsFriendUser } from "../../store/friends-store";
import { useThemeStore } from "../../store/useThemeStore";
import { useCrafatarAvatar } from "../../hooks/useCrafatarAvatar";

function getDateLabel(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (messageDate.getTime() === today.getTime()) {
    return "Today";
  } else if (messageDate.getTime() === yesterday.getTime()) {
    return "Yesterday";
  } else {
    return date.toLocaleDateString(undefined, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: messageDate.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  }
}

interface MessageReaction {
  emoji: string;
  reactor: string;
}

interface Message {
  _id: string;
  chatId: string;
  senderId: string;
  content: string;
  sentAt?: number;
  receivedAt?: number;
  readAt?: number;
  editedAt?: number;
  deletedAt?: number;
  reactions: MessageReaction[];
  relatesTo?: string;
  timestamp?: number;
}

interface ChatParticipant {
  userId: string;
  joinedAt: number;
  role?: string;
}

interface ChatInfo {
  _id: string;
  participants: ChatParticipant[];
  type?: string;
  name?: string;
  timestamp?: number;
}

interface ChatPanelProps {
  friend: FriendsFriendUser;
}

export function ChatPanel({ friend }: ChatPanelProps) {
  const { accentColor } = useThemeStore();
  const { closeChat, currentUser } = useFriendsStore();
  const [chat, setChat] = useState<ChatInfo | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const avatarUrl = useCrafatarAvatar({ uuid: friend.uuid, size: 20 });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const scrollHeightBeforeRef = useRef(0);

  useEffect(() => {
    let cancelled = false;

    const initChat = async () => {
      setChat(null);
      setMessages([]);
      setIsLoading(true);
      setIsLoadingMore(false);
      setHasMore(true);
      setCurrentPage(1);

      try {
        const chatData = await invoke<ChatInfo>("get_or_create_chat", {
          friendUuid: friend.uuid,
        });
        if (cancelled) return;
        setChat(chatData);

        const messagesData = await invoke<Message[]>("get_chat_messages", {
          chatId: chatData._id,
          page: 1,
        });
        if (cancelled) return;

        if (messagesData.length < 5) {
          setHasMore(false);
        }

        const sorted = [...messagesData].sort((a, b) => {
          const timeA = a.sentAt || a.timestamp || 0;
          const timeB = b.sentAt || b.timestamp || 0;
          return timeA - timeB;
        });
        setMessages(sorted);

        requestAnimationFrame(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
        });
      } catch (e) {
        console.error("Failed to init chat:", e);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    initChat();
    return () => { cancelled = true; };
  }, [friend.uuid]);

  useEffect(() => {
    if (!chat?._id) return;

    const unlistenMessage = listen<Message>(
      "chat:message_received",
      (event) => {
        const msg = event.payload;
        if (msg.chatId === chat._id && msg._id) {
          setMessages((prev) => {
            if (prev.some((m) => m._id === msg._id)) {
              return prev;
            }
            return [...prev, msg];
          });
          setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
          }, 50);
        }
      }
    );

    const unlistenMessageUpdated = listen<Message>(
      "chat:message_updated",
      (event) => {
        if (event.payload.chatId === chat._id) {
          setMessages((prev) => {
            const exists = prev.some((m) => m._id === event.payload._id);
            if (exists) {
              return prev.map((m) =>
                m._id === event.payload._id ? event.payload : m
              );
            }
            return [...prev, event.payload];
          });
        }
      }
    );

    return () => {
      unlistenMessage.then((fn) => fn());
      unlistenMessageUpdated.then((fn) => fn());
    };
  }, [chat?._id]);

  const loadMoreMessages = async () => {
    if (!chat || isLoadingMore || !hasMore) return;

    const container = messagesContainerRef.current;
    if (container) {
      scrollHeightBeforeRef.current = container.scrollHeight;
    }

    setIsLoadingMore(true);

    try {
      const nextPage = currentPage + 1;
      const messagesData = await invoke<Message[]>("get_chat_messages", {
        chatId: chat._id,
        page: nextPage,
      });

      await new Promise((r) => setTimeout(r, 1000));

      if (messagesData.length === 0) {
        setHasMore(false);
        setIsLoadingMore(false);
        return;
      }

      if (messagesData.length < 5) {
        setHasMore(false);
      }

      setCurrentPage(nextPage);

      const existingIds = new Set(messages.map((m) => m._id));
      const newMessages = messagesData.filter((m) => !existingIds.has(m._id));

      if (newMessages.length === 0) {
        setHasMore(false);
        setIsLoadingMore(false);
        return;
      }

      const merged = [...newMessages, ...messages].sort((a, b) => {
        const timeA = a.sentAt || a.timestamp || 0;
        const timeB = b.sentAt || b.timestamp || 0;
        return timeA - timeB;
      });

      setMessages(merged);

      requestAnimationFrame(() => {
        if (container && scrollHeightBeforeRef.current > 0) {
          const newHeight = container.scrollHeight;
          container.scrollTop = newHeight - scrollHeightBeforeRef.current;
          scrollHeightBeforeRef.current = 0;
        }
        setIsLoadingMore(false);
      });
    } catch (e) {
      console.error("Failed to load more messages:", e);
      setIsLoadingMore(false);
    }
  };

  const handleSend = async (content: string) => {
    if (!chat || isSending) return;

    setIsSending(true);
    try {
      await invoke<Message>("send_chat_message", {
        chatId: chat._id,
        content,
      });
    } catch (e) {
      console.error("Failed to send message:", e);
    } finally {
      setIsSending(false);
    }
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Icon
            icon="solar:refresh-linear"
            className="w-6 h-6 animate-spin"
            style={{ color: accentColor.value }}
          />
          <span className="text-white/60 text-xs">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div
        className="flex items-center justify-between px-3 py-2.5 shrink-0"
        style={{
          borderBottom: `1px solid ${accentColor.value}40`,
          background: `linear-gradient(90deg, ${accentColor.value}20, ${accentColor.value}10)`,
        }}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={closeChat}
            className="p-1.5 rounded-lg transition-all duration-200"
            style={{
              backgroundColor: `${accentColor.value}20`,
              color: accentColor.value,
            }}
          >
            <Icon icon="solar:arrow-left-linear" className="w-4 h-4" />
          </button>
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={friend.username}
              className="w-7 h-7 rounded-lg"
              style={{ border: `2px solid ${accentColor.value}50` }}
            />
          ) : (
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{
                backgroundColor: `${accentColor.value}30`,
                border: `2px solid ${accentColor.value}50`,
              }}
            >
              <Icon
                icon="solar:user-bold"
                className="w-4 h-4"
                style={{ color: accentColor.value }}
              />
            </div>
          )}
          <span className="text-sm font-medium text-white font-minecraft-ten truncate">
            {friend.username}
          </span>
        </div>
      </div>

      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar"
      >
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center mb-3"
              style={{
                backgroundColor: `${accentColor.value}15`,
                border: `1px solid ${accentColor.value}40`,
              }}
            >
              <Icon
                icon="solar:chat-round-line-linear"
                className="w-6 h-6"
                style={{ color: accentColor.value }}
              />
            </div>
            <p className="text-white/50 text-xs font-minecraft-ten">No Messages Yet</p>
            <p className="text-white/30 text-xl mt-1 font-minecraft">say hello!</p>
          </div>
        ) : (
          <>
            {isLoadingMore ? (
              <div className="flex justify-center py-3">
                <Icon
                  icon="solar:refresh-linear"
                  className="w-5 h-5 animate-spin"
                  style={{ color: accentColor.value }}
                />
              </div>
            ) : hasMore ? (
              <div className="flex justify-center py-2">
                <button
                  onClick={loadMoreMessages}
                  className="text-xs font-minecraft-ten px-3 py-1.5 rounded-lg transition-all hover:scale-105"
                  style={{
                    color: accentColor.value,
                    backgroundColor: `${accentColor.value}20`,
                    border: `1px solid ${accentColor.value}40`,
                  }}
                >
                  Load older messages
                </button>
              </div>
            ) : (
              <div className="flex justify-center py-2">
                <span className="text-xs font-minecraft-ten text-white/30">
                  — start of conversation —
                </span>
              </div>
            )}
            {messages.filter((m) => m != null).map((message, index, arr) => {
              const timestamp = message.sentAt || message.timestamp || 0;
              const prevMessage = arr[index - 1];
              const prevTimestamp = prevMessage ? (prevMessage.sentAt || prevMessage.timestamp || 0) : 0;

              const showDateSeparator = index === 0 ||
                getDateLabel(timestamp) !== getDateLabel(prevTimestamp);

              return (
                <div key={message._id}>
                  {showDateSeparator && (
                    <div className="flex items-center justify-center py-3 my-1">
                      <div
                        className="px-3 py-1 rounded-full text-[10px] font-minecraft-ten uppercase tracking-wider"
                        style={{
                          backgroundColor: `${accentColor.value}15`,
                          color: `${accentColor.value}90`,
                          border: `1px solid ${accentColor.value}30`,
                        }}
                      >
                        {getDateLabel(timestamp)}
                      </div>
                    </div>
                  )}
                  <ChatMessage
                    message={message}
                    isOwn={message.senderId === currentUser?.uuid}
                    friendUuid={friend.uuid}
                    accentColor={accentColor.value}
                  />
                </div>
              );
            })}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      <ChatInput
        onSend={handleSend}
        disabled={isSending}
        accentColor={accentColor.value}
      />
    </div>
  );
}
