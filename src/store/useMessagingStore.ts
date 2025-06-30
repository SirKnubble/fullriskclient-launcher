import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Chat, ChatMessage, ChatWithMetadata } from "../types/messaging";
import type { RefreshState } from "../utils/refresh-utils";
import { createRefreshActions } from "../utils/refresh-utils";

const recentlyReadChats = new Map<string, number>();
const READ_STATUS_PRESERVATION_TIME = 300000;

export const markChatAsGloballyRead = (chatId: string) => {
  recentlyReadChats.set(chatId, Date.now());
};

export const isChatRecentlyRead = (chatId: string) => {
  const readTime = recentlyReadChats.get(chatId);
  if (!readTime) return false;

  const timeSinceRead = Date.now() - readTime;
  return timeSinceRead <= READ_STATUS_PRESERVATION_TIME;
};

setInterval(() => {
  const now = Date.now();
  for (const [chatId, timestamp] of recentlyReadChats.entries()) {
    if (now - timestamp > READ_STATUS_PRESERVATION_TIME * 2) {
      recentlyReadChats.delete(chatId);
    }
  }
}, READ_STATUS_PRESERVATION_TIME);

declare global {
  interface Window {
    markChatAsRecentlyLoaded?: (chatId: string) => void;
  }
}

interface MessagingState extends RefreshState {
  chats: ChatWithMetadata[];
  messages: Record<string, ChatMessage[]>;
  messagePages: Record<string, number>;
  activeChat: ChatWithMetadata | null;
  unreadCount: number;

  setChats: (chats: ChatWithMetadata[]) => void;
  setChatMessages: (chatId: string, messages: ChatMessage[]) => void;
  setActiveChat: (chat: ChatWithMetadata | null) => void;
  setUnreadCount: (count: number) => void;
  addMessage: (chatId: string, message: ChatMessage) => void;
  updateMessage: (chatId: string, message: ChatMessage) => void;
  removeMessage: (chatId: string, messageId: string) => void;
  addOrUpdateChat: (chat: ChatWithMetadata) => void;
  refreshMessagingData: (forceApi?: boolean) => Promise<void>;
  loadChatMessages: (chatId: string) => Promise<ChatMessage[]>;
  loadMoreMessages: (chatId: string) => Promise<ChatMessage[]>;
  markChatAsRead: (chatId: string) => Promise<void>;

  getChatMessages: (chatId: string) => ChatMessage[];
  getChatByFriendId: (friendId: string) => ChatWithMetadata | undefined;
  getUnreadChatsCount: () => number;
  markMessagesAsSeen: (messages: ChatMessage[]) => void;
}

export const useMessagingStore = create<MessagingState>()(
  persist(
    (set, get) => {
      const refreshActions = createRefreshActions<MessagingState>(
        set,
        get,
        async () => {
          const { getPrivateChats, getCachedChats, getUnreadMessageCount } =
            await import("../services/messaging-service");

          let chats: ChatWithMetadata[] = [];

          try {
            chats = await getCachedChats();
          } catch {
            chats = await getPrivateChats();
          }

          let unreadCount = 0;
          try {
            unreadCount = await getUnreadMessageCount();
          } catch {}

          set({
            chats: chats || [],
            unreadCount,
          });
        }
      );

      const refreshDataWithForce = async (forceApi = false) => {
        if (forceApi) {
          const { getPrivateChats, getUnreadMessageCount } = await import(
            "../services/messaging-service"
          );

          const state = get();

          const hasRecentlyReadChats = recentlyReadChats.size > 0;
          if (hasRecentlyReadChats) {
            await new Promise((resolve) => setTimeout(resolve, 5000));
          }

          const chats = await getPrivateChats();
          let unreadCount = 0;
          try {
            unreadCount = await getUnreadMessageCount();
          } catch {}

          const now = Date.now();
          for (const [chatId, timestamp] of recentlyReadChats.entries()) {
            if (now - timestamp > READ_STATUS_PRESERVATION_TIME) {
              recentlyReadChats.delete(chatId);
            }
          }

          const updatedChats =
            chats?.map((chat) => {
              const wasRecentlyRead = recentlyReadChats.has(chat._id);
              const localChat = state.chats.find((c) => c._id === chat._id);

              if (wasRecentlyRead) {
                return { ...chat, unreadMessages: 0 };
              }

              if (
                localChat &&
                localChat.unreadMessages < chat.unreadMessages / 2 &&
                chat.unreadMessages > 10
              ) {
                return { ...chat, unreadMessages: localChat.unreadMessages };
              }

              if (chat.unreadMessages > 50 && localChat) {
                if (localChat.unreadMessages < chat.unreadMessages / 3) {
                  recentlyReadChats.set(chat._id, now);
                  return { ...chat, unreadMessages: localChat.unreadMessages };
                }
              }

              return chat;
            }) || [];

          set({
            chats: updatedChats,
            unreadCount,
            lastRefresh: Date.now(),
            refreshCount: state.refreshCount + 1,
          });

          const actualUnreadCount = updatedChats.reduce(
            (sum, chat) => sum + (chat.unreadMessages || 0),
            0
          );
          if (actualUnreadCount !== unreadCount) {
            set({ unreadCount: actualUnreadCount });
          }
        } else {
          await refreshActions.refresh();
        }
      };

      return {
        chats: [],
        messages: {},
        messagePages: {},
        activeChat: null,
        unreadCount: 0,
        isRefreshing: false,
        lastRefresh: 0,
        refreshCount: 0,

        ...refreshActions,
        refreshMessagingData: refreshDataWithForce,

        setChats: (chats) => set({ chats }),

        setChatMessages: (chatId, messages) =>
          set((state) => ({
            messages: { ...state.messages, [chatId]: messages },
          })),

        setActiveChat: (chat) => set({ activeChat: chat }),

        setUnreadCount: (count) => set({ unreadCount: count }),

        addMessage: (chatId, message) =>
          set((state) => {
            const currentMessages = state.messages[chatId] || [];

            const existingMessageIndex = currentMessages.findIndex(
              (m) => m._id === message._id
            );
            if (existingMessageIndex !== -1) {
              const existingMessage = currentMessages[existingMessageIndex];
              const isNewer =
                message.editedAt > (existingMessage.editedAt || 0) ||
                (!existingMessage.editedAt && message.editedAt);

              if (!isNewer) {
                return state;
              }

              const updatedMessages = [...currentMessages];
              updatedMessages[existingMessageIndex] = message;

              const isLatestMessage =
                existingMessageIndex === currentMessages.length - 1;
              const updatedChats = isLatestMessage
                ? state.chats.map((chat) => {
                    if (chat._id === chatId) {
                      return {
                        ...chat,
                        latestMessage: message,
                        updatedAt: message.editedAt || message.createdAt,
                      };
                    }
                    return chat;
                  })
                : state.chats;

              return {
                ...state,
                messages: { ...state.messages, [chatId]: updatedMessages },
                chats: updatedChats,
              };
            }

            const updatedMessages = [...currentMessages, message].sort(
              (a, b) => a.createdAt - b.createdAt
            );

            const updatedChats = state.chats.map((chat) => {
              if (chat._id === chatId) {
                const wasRecentlyRead = recentlyReadChats.has(chatId);
                const timeSinceRead = wasRecentlyRead
                  ? Date.now() - (recentlyReadChats.get(chatId) || 0)
                  : Infinity;

                const messageAge = Date.now() - message.createdAt;
                const isOldMessage = messageAge > 5 * 60 * 1000;
                const isChatActive =
                  state.activeChat && state.activeChat._id === chatId;
                const shouldIncrementUnread =
                  !isChatActive &&
                  (!wasRecentlyRead ||
                    timeSinceRead > READ_STATUS_PRESERVATION_TIME) &&
                  !isOldMessage;

                if (
                  wasRecentlyRead &&
                  timeSinceRead <= READ_STATUS_PRESERVATION_TIME
                ) {
                } else if (isOldMessage) {
                } else if (isChatActive) {
                }

                const newUnreadCount = shouldIncrementUnread
                  ? (chat.unreadMessages || 0) + 1
                  : chat.unreadMessages || 0;

                return {
                  ...chat,
                  latestMessage: message,
                  updatedAt: message.createdAt,
                  unreadMessages: newUnreadCount,
                };
              }
              return chat;
            });

            const newState = {
              ...state,
              messages: { ...state.messages, [chatId]: updatedMessages },
              chats: updatedChats,
            };

            return newState;
          }),

        updateMessage: (chatId, updatedMessage) =>
          set((state) => {
            const currentMessages = state.messages[chatId] || [];
            const updatedMessages = currentMessages.map((msg) =>
              msg._id === updatedMessage._id ? updatedMessage : msg
            );

            const latestMessage = updatedMessages[updatedMessages.length - 1];
            const updatedChats = state.chats.map((chat) => {
              if (
                chat._id === chatId &&
                latestMessage &&
                latestMessage._id === updatedMessage._id
              ) {
                return {
                  ...chat,
                  latestMessage: updatedMessage,
                  updatedAt:
                    updatedMessage.editedAt || updatedMessage.createdAt,
                };
              }
              return chat;
            });

            return {
              messages: { ...state.messages, [chatId]: updatedMessages },
              chats: updatedChats,
            };
          }),

        removeMessage: (chatId, messageId) =>
          set((state) => {
            const currentMessages = state.messages[chatId] || [];
            const filteredMessages = currentMessages.filter(
              (msg) => msg._id !== messageId
            );

            return {
              messages: { ...state.messages, [chatId]: filteredMessages },
            };
          }),

        addOrUpdateChat: (chat) =>
          set((state) => {
            const existingIndex = state.chats.findIndex(
              (c) => c._id === chat._id
            );

            if (existingIndex >= 0) {
              const updatedChats = [...state.chats];
              updatedChats[existingIndex] = chat;
              return { chats: updatedChats };
            } else {
              return { chats: [...state.chats, chat] };
            }
          }),

        loadChatMessages: async (chatId: string) => {
          try {
            const { getMessages, getCachedMessages } = await import(
              "../services/messaging-service"
            );

            if (
              typeof window !== "undefined" &&
              window.markChatAsRecentlyLoaded
            ) {
              window.markChatAsRecentlyLoaded(chatId);
            }

            const currentStoreMessages = get().messages[chatId] || [];
            let apiMessages: ChatMessage[] = [];
            let cachedMessages: ChatMessage[] = [];

            try {
              for (let page = 0; page < 3; page++) {
                const pageMessages = await getMessages({ chatId, page });
                if (pageMessages.length === 0) break;
                apiMessages = [...apiMessages, ...pageMessages];
              }
            } catch (error) {
            }

            try {
              cachedMessages = await getCachedMessages(chatId);
            } catch (error) {
            }

            const messageMap = new Map<string, ChatMessage>();

            cachedMessages.forEach((message) => {
              messageMap.set(message._id, message);
            });

            apiMessages.forEach((message) => {
              messageMap.set(message._id, message);
            });

            currentStoreMessages.forEach((message) => {
              const existing = messageMap.get(message._id);
              if (
                !existing ||
                message.editedAt > (existing.editedAt || 0) ||
                message.createdAt >= existing.createdAt
              ) {
                messageMap.set(message._id, message);
              }
            });

            const finalMessages = Array.from(messageMap.values()).sort(
              (a, b) => a.createdAt - b.createdAt
            );

            set((state) => ({
              messages: { ...state.messages, [chatId]: finalMessages },
              messagePages: { ...state.messagePages, [chatId]: 3 },
            }));

            return finalMessages;
          } catch (error) {
            throw error;
          }
        },

        loadMoreMessages: async (chatId: string) => {
          try {
            const { getMessages } = await import(
              "../services/messaging-service"
            );
            const state = get();
            const currentPage = state.messagePages[chatId] || 1;

            const olderMessages = await getMessages({
              chatId,
              page: currentPage,
            });

            if (olderMessages.length > 0) {
              const currentMessages = state.messages[chatId] || [];
              const existingIds = new Set(currentMessages.map((m) => m._id));
              const newMessages = olderMessages.filter(
                (m) => !existingIds.has(m._id)
              );

              const allMessages = [...currentMessages, ...newMessages].sort(
                (a, b) => a.createdAt - b.createdAt
              );

              set((prevState) => ({
                messages: { ...prevState.messages, [chatId]: allMessages },
                messagePages: {
                  ...prevState.messagePages,
                  [chatId]: currentPage + 1,
                },
              }));
            }

            return olderMessages;
          } catch (error) {
            throw error;
          }
        },

        markChatAsRead: async (chatId: string) => {
          try {
            const state = get();
            const chat = state.chats.find((c) => c._id === chatId);
            const messages = state.messages[chatId] || [];

            if (!chat) {
              return;
            }

            if (chat.unreadMessages === 0) {
              recentlyReadChats.set(chatId, Date.now());
              return;
            }

            const readTimestamp = Date.now();
            recentlyReadChats.set(chatId, readTimestamp);

            const updatedChats = state.chats.map((c) =>
              c._id === chatId ? { ...c, unreadMessages: 0 } : c
            );

            const totalUnreadBefore = state.chats.reduce(
              (sum, c) => sum + (c.unreadMessages || 0),
              0
            );
            const newTotalUnread = Math.max(
              0,
              totalUnreadBefore - (chat.unreadMessages || 0)
            );

            set({
              chats: updatedChats,
              unreadCount: newTotalUnread,
            });

            const unreadCount = chat.unreadMessages || 0;
            let messagesToMarkAsRead: ChatMessage[] = [];

            if (messages.length >= unreadCount) {
              messagesToMarkAsRead = messages.slice(-unreadCount);
            } else {
              try {
                const { getMessages } = await import(
                  "../services/messaging-service"
                );
                const additionalMessages: ChatMessage[] = [];
                let page = 0;
                let totalLoaded = messages.length;

                while (totalLoaded < unreadCount && page < 10) {
                  const pageMessages = await getMessages({ chatId, page });
                  if (pageMessages.length === 0) break;

                  additionalMessages.push(...pageMessages);
                  totalLoaded += pageMessages.length;
                  page++;
                }

                const allMessages = [...messages, ...additionalMessages];
                const uniqueMessages = Array.from(
                  new Map(allMessages.map((m) => [m._id, m])).values()
                ).sort((a, b) => a.createdAt - b.createdAt);

                set((prevState) => ({
                  messages: { ...prevState.messages, [chatId]: uniqueMessages },
                }));

                messagesToMarkAsRead = uniqueMessages.slice(
                  -Math.min(uniqueMessages.length, unreadCount)
                );
              } catch (error) {
                messagesToMarkAsRead = messages;
              }
            }

            const batchSize = 5;
            let successCount = 0;

            for (let i = 0; i < messagesToMarkAsRead.length; i += batchSize) {
              const batch = messagesToMarkAsRead.slice(i, i + batchSize);

              const batchPromises = batch.map(async (message) => {
                try {
                  const { markMessageReceived } = await import(
                    "../services/messaging-service"
                  );
                  await markMessageReceived({
                    chatId,
                    messageId: message._id,
                  });
                  return { success: true, messageId: message._id };
                } catch (error) {
                  return { success: false, messageId: message._id, error };
                }
              });

              const batchResults = await Promise.allSettled(batchPromises);
              const batchSuccessCount = batchResults.filter(
                (r) => r.status === "fulfilled" && r.value?.success
              ).length;
              successCount += batchSuccessCount;

              if (i + batchSize < messagesToMarkAsRead.length) {
                await new Promise((resolve) => setTimeout(resolve, 500));
              }
            }

            await new Promise((resolve) => setTimeout(resolve, 3000));

            try {
              const { getUnreadMessageCount, getPrivateChats } = await import(
                "../services/messaging-service"
              );

              await getUnreadMessageCount();
              const newChats = await getPrivateChats();
              const thisChat = newChats.find((c) => c._id === chatId);

              if (thisChat && thisChat.unreadMessages > 0) {
                recentlyReadChats.set(
                  chatId,
                  Date.now() + READ_STATUS_PRESERVATION_TIME
                );
              }
            } catch (error) {
            }

            const successRate =
              messagesToMarkAsRead.length > 0
                ? successCount / messagesToMarkAsRead.length
                : 1;
            if (successRate < 0.8) {
              recentlyReadChats.set(chatId, Date.now());
            }
          } catch (error) {
            throw error;
          }
        },

        getChatMessages: (chatId: string) => {
          const state = get();
          return state.messages[chatId] || [];
        },

        getChatByFriendId: (friendId: string) => {
          const state = get();
          return state.chats.find((chat) => chat.otherParticipant === friendId);
        },

        getUnreadChatsCount: () => {
          const state = get();
          return state.chats.filter((chat) => chat.unreadMessages > 0).length;
        },

        markMessagesAsSeen: (messages: ChatMessage[]) => {
        },
      };
    },
    {
      name: "messaging-store",
      partialize: (state) => ({
        activeChat: state.activeChat,
        messages: state.messages,
        chats: state.chats,
        unreadCount: state.unreadCount,
      }),
    }
  )
);
