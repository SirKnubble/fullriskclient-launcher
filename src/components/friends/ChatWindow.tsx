import React, { useState, useEffect, useRef } from "react";
import { Edit, Send, Smile, Trash, ArrowLeft } from "lucide-react";
import { Icon } from "@iconify/react";
import {
  sendMessage,
  editMessage,
  deleteMessage,
  reactToMessage,
  removeReaction,
} from "../../services/messaging-service";
import type { ChatMessage } from "../../types/messaging";
import { useMinecraftAuthStore } from "../../store/minecraft-auth-store";
import { useFriendsStore } from "../../store/useFriendsStore";
import { useMessagingStore, markChatAsGloballyRead } from "../../store/useMessagingStore";
import { useThemeStore } from "../../store/useThemeStore";
import { Skeleton } from "../ui/Skeleton";
import { cn } from "../../lib/utils";
import { IconButton } from "../ui/buttons/IconButton";
import { Avatar } from "../common/Avatar";
import { useAvatarPreloader } from "../../hooks/useAvatarLoader";


const COMMON_EMOJIS = [
  "😀", "😂", "😍", "😭", "😅", "🥺", "👍", "❤️", 
  "😊", "😎", "🔥", "💯", "🎉", "👏", "🙌", "🤔",
  "😢", "😡", "🤯", "😴", "🤝", "💪", "🙏", "✨"
];

interface ChatWindowProps {
  chatId: string;
  recipientName: string;
  recipientId?: string;
  onClose: () => void;
}

interface GroupedMessage {
  senderId: string;
  senderName: string;
  messages: ChatMessage[];
  timestamp: number;
}

export default function ChatWindow({ chatId, recipientName, recipientId, onClose }: ChatWindowProps) {
  const accentColor = useThemeStore((state) => state.accentColor);
  const borderRadius = useThemeStore((state) => state.borderRadius);
  
  const {
    addMessage,
    updateMessage,
    removeMessage,
    loadChatMessages,
    loadMoreMessages,
    markChatAsRead,
    refreshMessagingData,
    setActiveChat,
  } = useMessagingStore();

  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null);
  const [showInputEmojiPicker, setShowInputEmojiPicker] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const inputEmojiPickerRef = useRef<HTMLDivElement>(null);
  const loadingTriggerRef = useRef<HTMLDivElement>(null);
  
  const currentUser = useMinecraftAuthStore((state) => state.activeAccount);
  const { currentUser: friendsCurrentUser } = useFriendsStore();
  
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  
  useEffect(() => {
    const currentChats = useMessagingStore.getState().chats;
    const activeChat = currentChats.find(chat => chat._id === chatId);
    
    if (activeChat) {
      setActiveChat(activeChat);
    }
    
    return () => {
      setActiveChat(null);
    };
  }, [chatId, setActiveChat]);

  useEffect(() => {
    const unsubscribe = useMessagingStore.subscribe((state) => {
      const newMessages = state.messages[chatId] || [];
      setMessages(newMessages);
    });
    
    const initialMessages = useMessagingStore.getState().messages[chatId] || [];
    setMessages(initialMessages);
    
    if (initialMessages.length > 0) {
      setLoading(false);
    }
    
    return unsubscribe;
  }, [chatId]);
  
  const preloadAvatars = useAvatarPreloader();

  useEffect(() => {
    if (messages.length > 0) {
      const uniqueSenders = Array.from(new Set(messages.map(m => m.senderId)));
      if (recipientId && !uniqueSenders.includes(recipientId)) {
        uniqueSenders.push(recipientId);
      }
      preloadAvatars(uniqueSenders);
    } else if (recipientId) {
      preloadAvatars([recipientId]);
    }
  }, [messages, recipientId, preloadAvatars]);

  useEffect(() => {
    const loadInitialMessages = async () => {
      if (!chatId) return;
      
      const existingMessages = useMessagingStore.getState().messages[chatId] || [];
      
      const isFirstLoad = existingMessages.length === 0;
      if (isFirstLoad) {
        setLoading(true);
      }
      
      try {
        await loadChatMessages(chatId);
        
        try {
          markChatAsGloballyRead(chatId);
          await markChatAsRead(chatId);
        } catch (error) {
          markChatAsGloballyRead(chatId);
        }
        
        await refreshMessagingData(true);
      } catch (error) {
      } finally {
        if (isFirstLoad) {
          setLoading(false);
        }
      }
    };
    
    loadInitialMessages();
  }, [chatId, loadChatMessages, refreshMessagingData, markChatAsRead]);

  useEffect(() => {
    if (!loading && messagesContainerRef.current && messagesEndRef.current) {
      const container = messagesContainerRef.current;
      const isNearBottom = container.scrollTop + container.clientHeight >= container.scrollHeight - 100;
      
      if (isNearBottom || messages.length === 1) {
        setTimeout(() => {
          if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
          }
        }, 100);
      }
    }
  }, [messages.length, loading]);

  useEffect(() => {
    if (!loadingTriggerRef.current) return;

    const observer = new IntersectionObserver(
      async (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && !loadingMore && hasMoreMessages && messages.length > 0) {
          setLoadingMore(true);
          try {
            const olderMessages = await loadMoreMessages(chatId);
            if (olderMessages.length === 0) {
              setHasMoreMessages(false);
            }
          } catch (error) {
          } finally {
            setLoadingMore(false);
          }
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(loadingTriggerRef.current);
    return () => observer.disconnect();
  }, [chatId, loadingMore, hasMoreMessages]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showEmojiPicker && emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false);
        setSelectedMessageId(null);
      }
      if (showInputEmojiPicker && inputEmojiPickerRef.current && !inputEmojiPickerRef.current.contains(event.target as Node)) {
        setShowInputEmojiPicker(false);
      }
    };

    if (showEmojiPicker || showInputEmojiPicker) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showEmojiPicker, showInputEmojiPicker]);

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;

    try {
      const message = await sendMessage({ chatId, content: newMessage.trim() });
      addMessage(chatId, message);
      setNewMessage("");
    } catch (error) {
    }
  };

  const handleEditMessage = async (messageId: string) => {
    if (!editContent.trim()) return;

    try {
      const updatedMessage = await editMessage({ chatId, messageId, content: editContent.trim() });
      updateMessage(chatId, updatedMessage);
      setEditingMessageId(null);
      setEditContent("");
    } catch (error) {
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    try {
      await deleteMessage({ chatId, messageId });
      removeMessage(chatId, messageId);
    } catch (error) {
    }
  };

  const handleReaction = async (messageId: string, emoji: string) => {
    try {
      const message = messages.find(m => m._id === messageId);
      if (!message) return;

      const authUserId = currentUser?.id;
      const authUsername = currentUser?.minecraft_username;
      const friendsUserId = friendsCurrentUser?.userId;

      const userReaction = message.reactions?.find(r => 
        r.userId === authUserId || 
        r.userId === authUsername || 
        r.userId === friendsUserId
      );
      
      if (userReaction) {
        const updatedMessage = await removeReaction(messageId);
        updateMessage(chatId, updatedMessage);
      } else {
        const updatedMessage = await reactToMessage({ messageId, emoji });
        updateMessage(chatId, updatedMessage);
      }
      
      setShowEmojiPicker(false);
      setSelectedMessageId(null);
    } catch (error) {
    }
  };

  const startEditing = (message: ChatMessage) => {
    setEditingMessageId(message._id);
    setEditContent(message.content);
  };

  const cancelEditing = () => {
    setEditingMessageId(null);
    setEditContent("");
  };

  const openEmojiPicker = (messageId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    setSelectedMessageId(messageId);
    setShowEmojiPicker(true);
  };

  const insertEmojiIntoInput = (emoji: string) => {
    setNewMessage(prev => prev + emoji);
    setShowInputEmojiPicker(false);
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return "Today";
    } else if (date.toDateString() === yesterday.toDateString()) {
      return "Yesterday";
    } else {
      return date.toLocaleDateString([], { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
    }
  };

  const isOwnMessage = (senderId: string) => {
    const authUserId = currentUser?.id;
    const authUsername = currentUser?.minecraft_username;
    const friendsUserId = friendsCurrentUser?.userId;
    
    return senderId === authUserId || 
           senderId === authUsername || 
           senderId === friendsUserId;
  };

  const getSenderDisplayName = (senderId: string) => {
    if (isOwnMessage(senderId)) {
      return "You";
    }
    return recipientName;
  };

  const isOwnReaction = (reactionUserId: string) => {
    const authUserId = currentUser?.id;
    const authUsername = currentUser?.minecraft_username;
    const friendsUserId = friendsCurrentUser?.userId;
    
    return reactionUserId === authUserId || 
           reactionUserId === authUsername || 
           reactionUserId === friendsUserId;
  };

  const groupedMessages = React.useMemo(() => {
    const groups: GroupedMessage[] = [];
    let currentGroup: GroupedMessage | null = null;
    let lastDate = "";

    messages.forEach(message => {
      const messageDate = new Date(message.createdAt).toDateString();
      const isNewDay = messageDate !== lastDate;
      const isNewSender = !currentGroup || currentGroup.senderId !== message.senderId;
      const timeDiff = currentGroup ? message.createdAt - currentGroup.timestamp : 0;
      const isNewTimeGroup = timeDiff > 5 * 60 * 1000;

      if (isNewDay || isNewSender || isNewTimeGroup) {
        currentGroup = {
          senderId: message.senderId,
          senderName: getSenderDisplayName(message.senderId),
          messages: [message],
          timestamp: message.createdAt,
        };
        groups.push(currentGroup);
      } else {
        currentGroup.messages.push(message);
      }

      lastDate = messageDate;
    });

    return groups;
  }, [messages, currentUser, recipientName, getSenderDisplayName]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 p-4 border-b border-white/10">
        <IconButton
          icon={<ArrowLeft className="w-5 h-5" />}
          onClick={onClose}
          variant="ghost"
          size="sm"
          className="text-white/70 hover:text-white"
        />
        <Avatar
          userId={recipientId}
          displayName={recipientName}
          size={40}
          className="border-white/20"
          showSkeleton={true}
        />
        <span className="font-minecraft text-white text-4xl font-medium">{recipientName}</span>
      </div>

      <div className="flex-1 overflow-hidden">
        <div 
          ref={messagesContainerRef}
          className="h-full overflow-y-auto p-4 space-y-4 custom-scrollbar"
          onClick={() => {
            setShowEmojiPicker(false);
            setSelectedMessageId(null);
            setShowInputEmojiPicker(false);
          }}
        >
        {hasMoreMessages && (
          <div ref={loadingTriggerRef} className="h-4 flex justify-center">
            {loadingMore && (
              <div className="text-white/40 font-minecraft-ten text-xs">Loading more...</div>
            )}
          </div>
        )}

        {loading ? (
          <MessagesLoadingSkeleton />
        ) : groupedMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div
              className="w-16 h-16 flex items-center justify-center mb-4 backdrop-blur-md border border-white/10"
              style={{
                backgroundColor: `${accentColor}15`,
                borderRadius: `${borderRadius * 2}px`,
              }}
            >
              <Icon
                icon="solar:chat-round-dots-bold"
                className="w-8 h-8"
                style={{ color: `${accentColor}` }}
              />
            </div>
            <h3 className="text-xl font-minecraft text-white mb-2">Start a conversation</h3>
            <p className="text-white/60 font-minecraft-ten text-sm tracking-wide lowercase">
              Send a message to {recipientName}
            </p>
          </div>
        ) : (
          groupedMessages.map((group, groupIndex) => {
            const showDateSeparator = groupIndex === 0 || 
              new Date(group.timestamp).toDateString() !== 
              new Date(groupedMessages[groupIndex - 1].timestamp).toDateString();

            return (
              <div key={`group-${groupIndex}`}>
                {showDateSeparator && (
                  <div className="flex items-center justify-center py-4">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2 h-2"
                        style={{ 
                          borderRadius: `${borderRadius}px`,
                          backgroundColor: `${accentColor}`,
                        }}
                      />
                      <span className="font-minecraft-ten text-xs text-white/60 uppercase tracking-wider">
                        {formatDate(group.timestamp)}
                      </span>
                      <div
                        className="w-2 h-2"
                        style={{ 
                          borderRadius: `${borderRadius}px`,
                          backgroundColor: `${accentColor}`,
                        }}
                      />
                    </div>
                  </div>
                )}

                <div className={cn(
                  "flex space-x-3",
                  isOwnMessage(group.senderId) ? "flex-row-reverse space-x-reverse" : ""
                )}>
                  <div className="flex-shrink-0">
                    <Avatar
                      userId={group.senderId}
                      displayName={group.senderName}
                      size={40}
                      showSkeleton={true}
                    />
                  </div>

                  <div className={cn(
                    "flex-1 space-y-1",
                    isOwnMessage(group.senderId) ? "items-end" : "items-start"
                  )}>
                    <div className={cn(
                      "flex items-baseline space-x-2",
                      isOwnMessage(group.senderId) ? "flex-row-reverse space-x-reverse" : ""
                    )}>
                      <span 
                        className="font-minecraft text-3xl"
                        style={{ color: isOwnMessage(group.senderId) ? accentColor.value : 'white' }}
                      >
                        {group.senderName}
                      </span>
                      <span className="font-minecraft-ten text-xs text-white/40">
                        {formatTime(group.timestamp)}
                      </span>
                    </div>

                    {group.messages.map((message) => (
                      <div
                        key={message._id}
                        className="group relative"
                        onMouseEnter={() => setHoveredMessageId(message._id)}
                        onMouseLeave={() => setHoveredMessageId(null)}
                      >
                        {editingMessageId === message._id ? (
                          <div 
                            className="p-3 backdrop-blur-md border border-white/10"
                            style={{ 
                              borderRadius: `${borderRadius}px`,
                              background: `${accentColor}15`,
                            }}
                          >
                            <textarea
                              value={editContent}
                              onChange={(e) => setEditContent(e.target.value)}
                              className="w-full p-2 font-minecraft-ten text-xs resize-none text-white border-none outline-none bg-black/30"
                              style={{ borderRadius: `${borderRadius}px` }}
                              rows={3}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                  e.preventDefault();
                                  handleEditMessage(message._id);
                                } else if (e.key === 'Escape') {
                                  cancelEditing();
                                }
                              }}
                            />
                            <div className="flex justify-end space-x-2 mt-2">
                              <button
                                onClick={cancelEditing}
                                className="text-white/60 hover:text-white transition-colors font-minecraft-ten text-xs"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => handleEditMessage(message._id)}
                                className="px-3 py-1 rounded font-minecraft-ten text-xs text-white"
                                style={{ 
                                  backgroundColor: accentColor.value,
                                  borderRadius: `${borderRadius}px`
                                }}
                              >
                                Save
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className={cn("relative", isOwnMessage(message.senderId) ? "flex justify-end" : "flex justify-start")}>
                            <div 
                              className={cn(
                                "p-3 transition-all duration-200 max-w-[80%] relative backdrop-blur-md hover:bg-white/5",
                                isOwnMessage(message.senderId) ? "border border-white/10" : "border border-white/5"
                              )}
                              style={{ 
                                backgroundColor: isOwnMessage(message.senderId) 
                                  ? `${accentColor}20` 
                                  : "rgba(255,255,255,0.02)",
                                borderColor: isOwnMessage(message.senderId) 
                                  ? `${accentColor}40` 
                                  : "rgba(255,255,255,0.05)",
                                borderRadius: `${borderRadius}px`
                              }}
                            >
                              <p className={cn(
                                "font-minecraft-ten text-xs whitespace-pre-wrap",
                                isOwnMessage(message.senderId) ? "text-white" : "text-white"
                              )}>
                                {message.content}
                              </p>

                              {message.editedAt && (
                                <span className="font-minecraft-ten text-xs text-white/40 ml-2">
                                  (edited)
                                </span>
                              )}

                              {message.reactions && message.reactions.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-2">
                                  {message.reactions.map((reaction, index) => (
                                    <button
                                      key={index}
                                      onClick={() => handleReaction(message._id, reaction.emoji)}
                                      className={cn(
                                        "inline-flex items-center space-x-1 px-2 py-1 rounded-full text-xs transition-colors",
                                        isOwnReaction(reaction.userId)
                                          ? 'text-white'
                                          : 'text-white/70'
                                      )}
                                      style={{
                                        backgroundColor: isOwnReaction(reaction.userId)
                                          ? accentColor.value
                                          : 'rgba(255, 255, 255, 0.1)'
                                      }}
                                    >
                                      <span>{reaction.emoji}</span>
                                      <span className="font-minecraft-ten text-xs">1</span>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>

                            {hoveredMessageId === message._id && isOwnMessage(message.senderId) && (
                              <div 
                                className={cn(
                                  "absolute -top-2 flex space-x-1 shadow-lg p-1 z-10 backdrop-blur-md border border-white/10",
                                  isOwnMessage(message.senderId) ? "left-2" : "right-2"
                                )}
                                style={{
                                  borderRadius: `${borderRadius}px`,
                                  background: `${accentColor}25`,
                                  backdropFilter: 'blur(10px)',
                                }}
                              >
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openEmojiPicker(message._id, e);
                                  }}
                                  className="p-1 hover:bg-white/10 rounded text-white/60 hover:text-white transition-colors"
                                  title="Add reaction"
                                >
                                  <Smile className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    startEditing(message);
                                  }}
                                  className="p-1 hover:bg-white/10 rounded text-white/60 hover:text-white transition-colors"
                                  title="Edit message"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteMessage(message._id);
                                  }}
                                  className="p-1 hover:bg-white/10 rounded text-white/60 hover:text-red-400 transition-colors"
                                  title="Delete message"
                                >
                                  <Trash className="w-4 h-4" />
                                </button>
                              </div>
                            )}

                            {hoveredMessageId === message._id && !isOwnMessage(message.senderId) && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openEmojiPicker(message._id, e);
                                }}
                                className={cn(
                                  "absolute -top-2 p-1 shadow-lg text-white/60 hover:text-white transition-colors z-10 backdrop-blur-md border border-white/10",
                                  isOwnMessage(message.senderId) ? "left-2" : "right-2"
                                )}
                                style={{
                                  borderRadius: `${borderRadius}px`,
                                  background: `${accentColor}25`,
                                  backdropFilter: 'blur(10px)',
                                }}
                                title="Add reaction"
                              >
                                <Smile className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="p-4 border-t border-white/10">
        <div className="flex items-end space-x-2">
          <div className="flex-1 relative">
            <textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder={`Message ${recipientName}`}
              className="w-full p-3 font-minecraft-ten text-xs resize-none text-white border border-white/10 focus:border-white/30 outline-none placeholder-white/40 bg-black/40"
              style={{ 
                borderRadius: `${borderRadius}px`,
              }}
              rows={1}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
            />
            <button
              onClick={() => setShowInputEmojiPicker(!showInputEmojiPicker)}
              className="absolute right-2 top-2 p-1 text-white/60 hover:text-white transition-colors"
            >
              <Smile className="w-4 h-4" />
            </button>
          </div>
          <button
            onClick={handleSendMessage}
            disabled={!newMessage.trim()}
            className="p-3 rounded-lg transition-colors text-white disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ 
              backgroundColor: accentColor.value,
              borderRadius: `${borderRadius}px`
            }}
          >
            <Send className="w-4 h-4" />
          </button>
        </div>

        {showInputEmojiPicker && (
          <div
            ref={inputEmojiPickerRef}
            className="absolute bottom-20 left-4 shadow-xl w-64 z-50 backdrop-blur-md border"
            style={{
              borderRadius: `${borderRadius}px`,
              background: `${accentColor}25`,
              borderColor: `${accentColor}40`,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-3">
              <div className="grid grid-cols-8 gap-2">
                {COMMON_EMOJIS.map((emoji, index) => (
                  <button
                    key={index}
                    onClick={() => insertEmojiIntoInput(emoji)}
                    className="w-8 h-8 flex items-center justify-center hover:bg-white/10 transition-colors text-lg"
                    style={{ borderRadius: `${borderRadius}px` }}
                    title={emoji}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {showEmojiPicker && selectedMessageId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowEmojiPicker(false);
              setSelectedMessageId(null);
            }
          }}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" />
          
          <div
            ref={emojiPickerRef}
            className="relative shadow-2xl w-80 backdrop-blur-md border border-white/10"
            onClick={(e) => e.stopPropagation()}
            style={{
              borderRadius: `${borderRadius}px`,
              background: `${accentColor}25`,
            }}
          >
            <div className="p-4">
              <h3 className="font-minecraft text-white/80 text-sm mb-3 text-center">
                React to message
              </h3>
              <div className="grid grid-cols-8 gap-2">
                {COMMON_EMOJIS.map((emoji, index) => (
                  <button
                    key={index}
                    onClick={() => handleReaction(selectedMessageId, emoji)}
                    className="w-10 h-10 flex items-center justify-center hover:bg-white/10 transition-colors text-xl"
                    style={{ borderRadius: `${borderRadius}px` }}
                    title={emoji}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const MessagesLoadingSkeleton = React.memo(() => {
  return (
    <div className="p-4 space-y-6">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="flex space-x-3">
          <Skeleton 
            variant="image" 
            width="40px" 
            height="40px" 
            className="flex-shrink-0 rounded-full" 
          />
          <div className="flex-1 space-y-2">
            <div className="flex space-x-2">
              <Skeleton variant="text" width="64px" height="16px" />
              <Skeleton variant="text" width="48px" height="12px" />
            </div>
            <Skeleton variant="text" width="192px" height="48px" />
          </div>
        </div>
      ))}
    </div>
  );
});

