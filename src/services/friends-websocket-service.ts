import { listen } from '@tauri-apps/api/event';
import { useMessagingStore } from '../store/useMessagingStore';
import { useFriendsStore } from '../store/useFriendsStore';
import { showInfoToast } from '../utils/toast-helpers';
import { useThemeStore } from '../store/useThemeStore';
import { useMinecraftAuthStore } from '../store/minecraft-auth-store';
import type { ChatMessage } from '../types/messaging';

interface WebSocketEnvelope {
  channel: string;
  data: any;
}

/**
 * Singleton service that manages websocket event listeners for the friends window.
 * This ensures only one listener is ever active, regardless of React component lifecycle.
 */
class FriendsWebSocketService {
  private static instance: FriendsWebSocketService | null = null;
  private isListenerActive = false;
  private unsubscribe: (() => void) | null = null;
  private shownToasts = new Set<string>();
  private lastToastTime = 0;
  private readonly TOAST_DEBOUNCE_MS = 100;
  private readonly MAX_TOAST_CACHE = 1000;

  static getInstance(): FriendsWebSocketService {
    if (!FriendsWebSocketService.instance) {
      FriendsWebSocketService.instance = new FriendsWebSocketService();
    }
    return FriendsWebSocketService.instance;
  }

  private constructor() {}

  isActive(): boolean {
    return this.isListenerActive;
  }

  shouldShowToast(messageId: string): boolean {
    const now = Date.now();
    const toastKey = `msg-${messageId}`;
    
    if (this.shownToasts.has(toastKey)) {
      return false;
    }
    
    if (now - this.lastToastTime < this.TOAST_DEBOUNCE_MS) {
      return false;
    }
    
    if (this.shownToasts.size >= this.MAX_TOAST_CACHE) {
      this.shownToasts.clear();
    }
    
    this.shownToasts.add(toastKey);
    this.lastToastTime = now;
    return true;
  }

  private showMessageToast(message: ChatMessage): void {
    const { activeChat, getChatMessages } = useMessagingStore.getState();
    const { friends } = useFriendsStore.getState();
    const { accentColor } = useThemeStore.getState();
    const { activeAccount } = useMinecraftAuthStore.getState();
    
    if (activeChat && activeChat._id === message.chatId) {
      return;
    }

    if (activeAccount && message.senderId === activeAccount.id) {
      return;
    }

    if (!this.shouldShowToast(message._id)) {
      return;
    }

    try {
      const senderFriend = friends.find(f => f.noriskUser.uuid === message.senderId);
      let senderName = senderFriend?.noriskUser.displayName || senderFriend?.noriskUser.ign;
      
      if (!senderName) {
        senderName = `User ${message.senderId.slice(0, 8)}`;
      }
      
      showInfoToast(
        `${senderName}: ${message.content}`, 
        { 
          accentColor: accentColor.value,
          avatarUserId: message.senderId,
          avatarDisplayName: senderName
        }
      );
      
    } catch (error) {
    }
  }

  async initialize(): Promise<void> {
    if (this.isListenerActive) {
      return;
    }

    try {
      this.unsubscribe = await listen(
        "global-messaging-event",
        (event) => {
          const envelope = event.payload as WebSocketEnvelope;
          this.handleWebSocketEvent(envelope);
        }
      );

      this.isListenerActive = true;
    } catch (error) {
    }
  }

  private handleWebSocketEvent(envelope: WebSocketEnvelope): void {
    const { refreshMessagingData, addMessage, updateMessage, removeMessage, getChatMessages } = useMessagingStore.getState();
    const { refreshFriendsData } = useFriendsStore.getState();

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
        this.handleMessageReceived(envelope.data);
        break;
      case "messaging:message_updated":
        updateMessage(envelope.data.chatId, envelope.data);
        break;
      case "messaging:message_deleted":
        removeMessage(envelope.data.chatId, envelope.data.messageId);
        break;
      case "messaging:chat_created":
        refreshMessagingData();
        break;
      default:
        break;
    }
  }

  private handleMessageReceived(messageData: ChatMessage): void {
    const { getChatMessages, addMessage } = useMessagingStore.getState();
    
    const existingMessages = getChatMessages(messageData.chatId);
    const messageExists = existingMessages.some(m => m._id === messageData._id);
    
    if (!messageExists) {
      this.showMessageToast(messageData);
    }
    
    addMessage(messageData.chatId, messageData);
  }

  cleanup(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    this.isListenerActive = false;
  }
}

export const friendsWebSocketService = FriendsWebSocketService.getInstance();
