import { invokeCommand, createServiceFunction, createServiceFunctionWithArgs } from "./base-service";
import type {
  Chat,
  ChatMessage,
  ChatWithMetadata,
} from "../types/messaging";

export const getPrivateChats = createServiceFunction<ChatWithMetadata[]>("get_private_chats_command");
export const getCachedChats = createServiceFunction<ChatWithMetadata[]>("get_cached_chats_command");
export const getUnreadMessageCount = createServiceFunction<number>("get_unread_count_command");

export const getPrivateChatForFriend = createServiceFunctionWithArgs<ChatWithMetadata, string>(
  "get_private_chat_for_friend_command",
  (friendUuid) => ({ friendUuid })
);

export const createPrivateChat = createServiceFunctionWithArgs<Chat, string>(
  "create_private_chat_command",
  (recipientUuid) => ({ recipientUuid })
);

export const sendMessage = createServiceFunctionWithArgs<ChatMessage, { chatId: string; content: string; relatesTo?: string }>(
  "send_message_command",
  ({ chatId, content, relatesTo }) => ({ chatId, content, relatesTo })
);

export const editMessage = createServiceFunctionWithArgs<ChatMessage, { chatId: string; messageId: string; content: string }>(
  "edit_message_command",
  ({ chatId, messageId, content }) => ({ chatId, messageId, content })
);

export const deleteMessage = createServiceFunctionWithArgs<void, { chatId: string; messageId: string }>(
  "delete_message_command",
  ({ chatId, messageId }) => ({ chatId, messageId })
);

export const getMessages = createServiceFunctionWithArgs<ChatMessage[], { chatId: string; page?: number }>(
  "get_messages_command",
  ({ chatId, page = 0 }) => ({ chatId, page })
);

export const getCachedMessages = createServiceFunctionWithArgs<ChatMessage[], string>(
  "get_cached_messages_command",
  (chatId) => ({ chatId })
);

export const reactToMessage = createServiceFunctionWithArgs<ChatMessage, { messageId: string; emoji: string }>(
  "react_to_message_command",
  ({ messageId, emoji }) => ({ messageId, emoji })
);

export const removeReaction = createServiceFunctionWithArgs<ChatMessage, string>(
  "remove_reaction_command",
  (messageId) => ({ messageId })
);

export const markMessageReceived = createServiceFunctionWithArgs<ChatMessage, { chatId: string; messageId: string }>(
  "mark_message_as_read_command",
  ({ chatId, messageId }) => ({ chatId, messageId })
);

export const findOrCreateChatWithFriend = async (
  friendUuid: string
): Promise<ChatWithMetadata> => {
  try {
    return await getPrivateChatForFriend(friendUuid);
  } catch (error) {
    const chat = await createPrivateChat(friendUuid);
    return {
      _id: chat._id,
      type: chat.type,
      participants: chat.participants,
      name: chat.name,
      timestamp: chat.timestamp,
      groupAvatarUrl: chat.groupAvatarUrl,
      createdAt: chat.createdAt,
      updatedAt: chat.updatedAt,
      otherParticipant: friendUuid,
      latestMessage: undefined,
      unreadMessages: 0,
    };
  }
};
