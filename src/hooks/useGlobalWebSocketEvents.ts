import { useEffect, useRef } from 'react';
import { listen } from '@tauri-apps/api/event';
import { useMessagingStore, isChatRecentlyRead } from '../store/useMessagingStore';
import { useFriendsStore } from '../store/useFriendsStore';
import { showInfoToast } from '../utils/toast-helpers';
import { useThemeStore } from '../store/useThemeStore';
import { useMinecraftAuthStore } from '../store/minecraft-auth-store';
import { UserResolver } from '../utils/user-resolution';
import { toast } from '../components/ui/GlobalToaster';
import type { ChatMessage } from '../types/messaging';

declare global {
  interface Window {
    markChatAsRecentlyLoaded?: (chatId: string) => void;
  }
}

interface WebSocketEnvelope {
  channel: string;
  data: any;
}

const globalToastDeduplication = new Map<string, number>();
const seenMessageIds = new Set<string>();
const recentlyLoadedChats = new Set<string>();
const chatLoadTimestamps = new Map<string, number>();
const TOAST_DEDUPLICATION_WINDOW = 5000;
const CHAT_LOAD_COOLDOWN = 15000;

function markChatAsRecentlyLoaded(chatId: string) {
  const now = Date.now();
  recentlyLoadedChats.add(chatId);
  chatLoadTimestamps.set(chatId, now);
  
  setTimeout(() => {
    recentlyLoadedChats.delete(chatId);
    chatLoadTimestamps.delete(chatId);
  }, CHAT_LOAD_COOLDOWN);
}

function isToastDuplicate(channel: string, data: any): boolean {
  if ((channel === 'messaging:message_received' || channel === 'messaging:message_updated') && data._id) {
    const now = Date.now();
    
    if (data.chatId && recentlyLoadedChats.has(data.chatId)) {
      seenMessageIds.add(data._id);
      return true;
    }

    const messageAge = now - (data.createdAt || 0);
    if (messageAge > 60000) {
      seenMessageIds.add(data._id);
      return true;
    }

    if (data.chatId) {
      const loadTime = chatLoadTimestamps.get(data.chatId);
      if (loadTime && messageAge > 5000) {
        seenMessageIds.add(data._id);
        return true;
      }
    }

    let deduplicationKey: string;
    if (channel === 'messaging:message_updated') {
      deduplicationKey = `${channel}:${data._id}:${data.content || ''}:${data.chatId || ''}`;
    } else {
      deduplicationKey = `${channel}:${data._id}`;
    }

    const lastSeen = globalToastDeduplication.get(deduplicationKey);
    if (lastSeen && now - lastSeen < TOAST_DEDUPLICATION_WINDOW) {
      return true;
    }

    if (channel === 'messaging:message_received' && seenMessageIds.has(data._id)) {
      return true;
    }
    
    globalToastDeduplication.set(deduplicationKey, now);
    if (channel === 'messaging:message_received') {
      seenMessageIds.add(data._id);
    }
    
    if (seenMessageIds.size > 1000) {
      const idsArray = Array.from(seenMessageIds);
      seenMessageIds.clear();
      idsArray.slice(-500).forEach(id => seenMessageIds.add(id));
    }
    
    return false;
  }
  
  const toastKey = `${channel}:${JSON.stringify(data)}:${Math.floor(Date.now() / 5000)}`;
  const now = Date.now();

  if (globalToastDeduplication.size > 100) {
    for (const [key, time] of globalToastDeduplication.entries()) {
      if (now - time > TOAST_DEDUPLICATION_WINDOW) {
        globalToastDeduplication.delete(key);
      }
    }
  }

  if (globalToastDeduplication.has(toastKey)) {
    return true;
  }

  globalToastDeduplication.set(toastKey, now);
  return false;
}

function extractFriendName(data: any): string | null {
  if (data?.username) return data.username;
  if (data?.friend_name) return data.friend_name;
  if (data?.name) return data.name;
  if (data?.ign) return data.ign;
  if (data?.user?.username) return data.user.username;
  if (data?.user?.ign) return data.user.ign;
  if (data?.friend?.username) return data.friend.username;
  if (data?.friend?.ign) return data.friend.ign;
  if (data?.users?.[0]?.ign) return data.users[0].ign;
  return null;
}

export function useGlobalWebSocketEvents(windowType: 'main' | 'friends') {
  const listenerSetupRef = useRef(false);
  const { refreshMessagingData, addMessage, updateMessage, removeMessage, getChatMessages, messages } = useMessagingStore();
  const { refreshFriendsData, friends } = useFriendsStore();
  const accentColor = useThemeStore((state) => state.accentColor);
  const { activeAccount } = useMinecraftAuthStore();

  useEffect(() => {
    Object.values(messages).flat().forEach(message => {
      seenMessageIds.add(message._id);
    });
    
    if (friends.length === 0) {
      refreshFriendsData().catch(() => {});
    }
  }, []);

  useEffect(() => {
    Object.values(messages).flat().forEach(message => {
      if (!seenMessageIds.has(message._id)) {
        seenMessageIds.add(message._id);
      }
    });
  }, [messages]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.markChatAsRecentlyLoaded = markChatAsRecentlyLoaded;
    }
    
    return () => {
      if (typeof window !== 'undefined') {
        delete window.markChatAsRecentlyLoaded;
      }
    };
  }, []);

  useEffect(() => {
    if (listenerSetupRef.current) {
      return;
    }

    let unsubscribeGlobal: (() => void) | undefined;
    let unsubscribeFriendsWs: (() => void) | undefined;

    const setupEventListeners = async () => {
      try {
        listenerSetupRef.current = true;

        unsubscribeGlobal = await listen(
          "global-messaging-event",
          (event) => {
            const envelope = event.payload as WebSocketEnvelope;
            handleWebSocketEvent(envelope);
          }
        );

        unsubscribeFriendsWs = await listen(
          "friends-ws-message",
          (event) => {
            const envelope = event.payload as WebSocketEnvelope;
            handleWebSocketEvent(envelope);
          }
        );
      } catch (error) {
        listenerSetupRef.current = false;
      }
    };

    const handleWebSocketEvent = (envelope: WebSocketEnvelope) => {
      updateStoresForEvent(envelope);
      
      const isDuplicate = isToastDuplicate(envelope.channel, envelope.data);
      
      if (!isDuplicate) {
        showToastForEvent(envelope);
      }
    };

    const updateStoresForEvent = (envelope: WebSocketEnvelope) => {
      switch (envelope.channel) {
        case "nrc_friends:friend_online":
        case "nrc_friends:friend_offline":
        case "nrc_friends:friend_request":
        case "nrc_friends:friend_update":
        case "nrc_friends:friend_changed_online_state":
        case "nrc_friends:server_change":
          refreshFriendsData();
          break;

        case "messaging:message_received":
          handleMessageReceived(envelope.data);
          break;
        case "messaging:message_updated":
          handleMessageUpdated(envelope.data);
          break;
        case "messaging:message_deleted":
          handleMessageDeleted(envelope.data);
          break;
        case "messaging:chat_created":
          refreshMessagingData();
          break;
        default:
          break;
      }
    };

    const showToastForEvent = (envelope: WebSocketEnvelope) => {
      const friendName = extractFriendName(envelope.data);

      switch (envelope.channel) {
        case "nrc_friends:friend_online":
          if (friendName) {
            toast.info(`${friendName} is now online`);
          } else {
            toast.info("A friend came online");
          }
          break;

        case "nrc_friends:friend_offline":
          if (friendName) {
            toast.info(`${friendName} went offline`);
          } else {
            toast.info("A friend went offline");
          }
          break;

        case "nrc_friends:friend_request":
          if (friendName) {
            toast.info(`Friend request from ${friendName}`);
          } else {
            toast.info("New friend request received");
          }
          break;

        case "nrc_friends:ping_add":
          if (friendName) {
            toast.info(`${friendName} sent you a ping!`);
          } else {
            toast.info("A friend sent you a ping!");
          }
          break;

        case "nrc_friends:host_invite":
          if (friendName) {
            toast.info(`Host invite from ${friendName}`);
          } else {
            toast.info("Host invite received!");
          }
          break;

        case "nrc_friends:public_server_invite":
          if (friendName) {
            toast.info(`Server invite from ${friendName}`);
          } else {
            toast.info("Server invite received!");
          }
          break;

        case "messaging:message_received":
          handleMessageReceivedToast(envelope.data);
          break;

        case "messaging:message_updated":
          handleMessageUpdatedToast(envelope.data);
          break;

        case "nrc_notifications:notifications":
          if (
            envelope.data?.type ===
            "gg.norisk.networking.model.notifications.notification.FriendRequestReceivedNotifications"
          ) {
            const friendName = envelope.data?.friend?.name;
            if (friendName) {
              toast.info(`Friend request from ${friendName}`);
            } else {
              toast.info("New friend request received");
            }
          }
          break;
          
        default:
          break;
      }
    };

    const handleMessageReceived = (messageData: ChatMessage) => {
      const existingMessages = getChatMessages(messageData.chatId);
      const messageExists = existingMessages.some(m => m._id === messageData._id);
      
      if (messageExists) {
        updateMessage(messageData.chatId, messageData);
      } else {
        addMessage(messageData.chatId, messageData);
      }
    };

    const handleMessageReceivedToast = async (messageData: ChatMessage) => {
      try {
        const { currentUser: friendsCurrentUser } = useFriendsStore.getState();
        
        if (activeAccount?.id === messageData.senderId || 
            activeAccount?.minecraft_username === messageData.senderId ||
            friendsCurrentUser?.userId === messageData.senderId) {
          return;
        }

        if (isChatRecentlyRead(messageData.chatId)) {
          return;
        }

        const existingMessages = getChatMessages(messageData.chatId);
        const messageExists = existingMessages.some(m => m._id === messageData._id);
        
        if (messageExists) {
          return;
        }

        const messageAge = Date.now() - messageData.createdAt;
        if (messageAge > 60000) {
          return;
        }

        if (recentlyLoadedChats.has(messageData.chatId)) {
          return;
        }

        const chatLoadTime = chatLoadTimestamps.get(messageData.chatId);
        if (chatLoadTime && messageAge > 10000) {
          return;
        }

        if (messageAge > 10000 && !chatLoadTime) {
          return;
        }

        const senderName = await UserResolver.resolveUserName(messageData.senderId, friends);
        const displayName = senderName || "Someone";
        
        const maxLength = 50;
        const messageContent = messageData.content.length > maxLength 
          ? `${messageData.content.substring(0, maxLength)}...` 
          : messageData.content;
        
        showInfoToast(`${displayName}: "${messageContent}"`, { 
          accentColor: accentColor.value,
          avatarUserId: messageData.senderId,
          avatarDisplayName: displayName
        });
      } catch (error) {
      }
    };

    const handleMessageUpdatedToast = async (messageData: ChatMessage) => {
      try {
        const { currentUser: friendsCurrentUser } = useFriendsStore.getState();
        
        if (activeAccount?.id === messageData.senderId || 
            activeAccount?.minecraft_username === messageData.senderId ||
            friendsCurrentUser?.userId === messageData.senderId) {
          return;
        }

        if (recentlyLoadedChats.has(messageData.chatId)) {
          return;
        }

        const messageAge = Date.now() - messageData.createdAt;
        if (messageAge > 60000) {
          return;
        }

        const chatLoadTime = chatLoadTimestamps.get(messageData.chatId);
        if (chatLoadTime && messageAge > 5000) {
          return;
        }

        const editAge = messageData.editedAt ? Date.now() - messageData.editedAt : Date.now() - messageData.createdAt;
        if (editAge > 10000) {
          return;
        }

        if (!messageData.editedAt && messageAge > 5000) {
          return;
        }

        const senderName = await UserResolver.resolveUserName(messageData.senderId, friends);
        const displayName = senderName || "Someone";
        
        const maxLength = 50;
        const messageContent = messageData.content.length > maxLength 
          ? `${messageData.content.substring(0, maxLength)}...` 
          : messageData.content;
        
        showInfoToast(`${displayName}: "${messageContent}"`, { 
          accentColor: accentColor.value,
          avatarUserId: messageData.senderId,
          avatarDisplayName: displayName
        });
      } catch (error) {
      }
    };

    const handleMessageUpdated = (messageData: ChatMessage) => {
      updateMessage(messageData.chatId, messageData);
    };

    const handleMessageDeleted = (data: { chatId: string; messageId: string }) => {
      removeMessage(data.chatId, data.messageId);
    };

    setupEventListeners();

    return () => {
      if (unsubscribeGlobal) {
        unsubscribeGlobal();
      }
      if (unsubscribeFriendsWs) {
        unsubscribeFriendsWs();
      }
      listenerSetupRef.current = false;
    };
  }, [windowType]);
}
