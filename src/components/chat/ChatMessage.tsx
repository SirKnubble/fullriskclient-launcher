import { Icon } from "@iconify/react";
import { cn } from "../../lib/utils";
import { useCrafatarAvatar } from "../../hooks/useCrafatarAvatar";

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

interface ChatMessageProps {
  message: Message;
  isOwn: boolean;
  friendUuid: string;
  accentColor: string;
}

export function ChatMessage({ message, isOwn, friendUuid, accentColor }: ChatMessageProps) {
  const avatarUrl = useCrafatarAvatar({ uuid: isOwn ? undefined : friendUuid, size: 24 });
  const formatTime = (timestamp?: number) => {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div
      className={cn(
        "flex gap-2 max-w-[80%]",
        isOwn ? "ml-auto flex-row-reverse" : "mr-auto"
      )}
    >
      {!isOwn && (
        avatarUrl ? (
          <img
            src={avatarUrl}
            alt=""
            className="w-6 h-6 rounded flex-shrink-0 mt-1"
          />
        ) : (
          <div
            className="w-6 h-6 rounded flex-shrink-0 mt-1 flex items-center justify-center"
            style={{ backgroundColor: `${accentColor}30` }}
          >
            <Icon icon="solar:user-bold" className="w-3 h-3" style={{ color: accentColor }} />
          </div>
        )
      )}

      <div
        className="rounded-xl px-3 py-2"
        style={{
          backgroundColor: isOwn ? `${accentColor}25` : `${accentColor}15`,
          border: `1px solid ${isOwn ? `${accentColor}50` : `${accentColor}30`}`,
        }}
      >
        <p className="text-sm text-white whitespace-pre-wrap break-all font-minecraft-ten">
          {message.content}
        </p>
        <div
          className="text-xs mt-1.5 font-minecraft-ten"
          style={{ color: isOwn ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.5)" }}
        >
          {formatTime(message.sentAt || message.timestamp)}
        </div>
      </div>
    </div>
  );
}
