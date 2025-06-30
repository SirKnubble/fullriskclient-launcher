export enum ChatType {
  PRIVATE = "PRIVATE",
}

export interface ChatParticipant {
  userId: string;
  joinedAt?: number;
  role?: string;
}

export interface Chat {
  _id: string;
  type: ChatType;
  participants: ChatParticipant[];
  name?: string;
  timestamp?: number;
  groupAvatarUrl?: string;
  createdAt?: number;
  updatedAt?: number;
}

export interface MessageReaction {
  userId: string;
  emoji: string;
  createdAt?: number;
}

export interface ChatMessage {
  _id: string;
  chatId: string;
  senderId: string;
  content: string;
  createdAt: number;
  sentAt?: number;
  editedAt?: number;
  readAt?: number;
  receivedAt?: number;
  deletedAt?: number;
  relatesTo?: string;
  reactions?: MessageReaction[];
  medias?: any[];
  status?: string;
}

export interface ChatWithMetadata {
  _id: string;
  type: ChatType;
  participants: ChatParticipant[];
  name?: string;
  timestamp?: number;
  groupAvatarUrl?: string;
  createdAt?: number;
  updatedAt?: number;
  
  otherParticipant?: string;
  latestMessage?: ChatMessage;
  unreadMessages: number;
}

export interface CreatePrivateChatRequest {
  recipient: string;
}

export interface CreateChatMessageRequest {
  content: string;
  relatesTo?: string;
}

export interface EditChatMessageRequest {
  messageId: string;
  content: string;
}

export interface DeleteChatMessageRequest {
  messageId: string;
}

export interface ReactToChatMessageRequest {
  emoji: string;
}

export interface MarkMessageReceivedRequest {
  messageId: string;
}

export interface MessagingWebSocketEnvelope {
  channel: string;
  data: any;
}

export interface NewMessageEvent {
  message: ChatMessage;
  chat: Chat;
}

export interface MessageUpdatedEvent {
  message: ChatMessage;
  chat: Chat;
}

export interface MessageDeletedEvent {
  messageId: string;
  chatId: string;
}

export interface ChatCreatedEvent {
  chat: ChatWithMetadata;
}

export interface MessageReactionEvent {
  message: ChatMessage;
  reaction: MessageReaction;
}
